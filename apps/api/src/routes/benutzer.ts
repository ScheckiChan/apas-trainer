import { SYSTEM_ROLLEN, type BenutzerUebersicht, type PasswortResetResponse } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type BenutzerRecord } from '../db.js';
import { requireAusbilder } from '../lib/auth.js';
import { emailSchema, emailVergeben, findByEmail, nameSchema } from '../lib/benutzer.js';
import { HttpError, parseBody } from '../lib/http.js';
import { generateTempPassword, hashPassword } from '../lib/password.js';
import { removeSubscriptionsOf } from '../push.js';
import { toBenutzerUebersicht } from '../serialize.js';

/** Mounted at /api/benutzer — Benutzerverwaltung, Ausbilder only. */
export const benutzerRouter = Router();

benutzerRouter.use(requireAusbilder);

const LETZTER_AUSBILDER =
  'Es muss mindestens ein Ausbilder bestehen bleiben — ernenne zuerst eine weitere Person zum Ausbilder.';

async function uebersicht(filter: (b: BenutzerRecord) => boolean): Promise<BenutzerUebersicht[]> {
  const [benutzer, trupps] = await Promise.all([db.benutzer.all(), db.trupps.all()]);
  const truppById = new Map(trupps.map((t) => [t.id, t]));
  return benutzer
    .filter(filter)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((b) => toBenutzerUebersicht(b, truppById));
}

/** Every account of the instance. */
benutzerRouter.get('/', async (_req, res) => {
  res.json(await uebersicht(() => true));
});

/** Picker for "Person hinzufügen → bestehendes Konto": accounts without a Trupp (any systemRolle). */
benutzerRouter.get('/ohne-trupp', async (_req, res) => {
  res.json(await uebersicht((b) => b.truppId === null));
});

const systemRolleSchema = z.object({ systemRolle: z.enum(SYSTEM_ROLLEN) });

/**
 * Changes an account's systemRolle. Takes effect on that account's next request (the role
 * is resolved from storage, not from the token). The last Ausbilder can't be demoted —
 * checked inside the write lock so two concurrent demotions can't both pass.
 */
benutzerRouter.patch('/:benutzerId/systemrolle', async (req, res) => {
  const { systemRolle } = parseBody(systemRolleSchema, req);
  const id = String(req.params.benutzerId);
  await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === id);
    if (!b) throw new HttpError(404, 'Konto nicht gefunden');
    if (b.systemRolle === 'ausbilder' && systemRolle !== 'ausbilder') {
      const ausbilder = items.filter((x) => x.systemRolle === 'ausbilder').length;
      if (ausbilder <= 1) throw new HttpError(409, LETZTER_AUSBILDER);
    }
    b.systemRolle = systemRolle;
    return { items, result: undefined };
  });
  const [row] = await uebersicht((b) => b.id === id);
  res.json(row);
});

const emailUpdateSchema = z.object({ email: emailSchema });

/**
 * Sets an account's login address (e.g. replaces an `@ohne-email.lokal` placeholder).
 * Unique instance-wide — checked inside the write lock, ignoring the account itself so
 * re-saving the same address is a no-op. Effective for the next login; sessions stay valid.
 */
benutzerRouter.patch('/:benutzerId/email', async (req, res) => {
  const { email } = parseBody(emailUpdateSchema, req);
  const id = String(req.params.benutzerId);
  await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === id);
    if (!b) throw new HttpError(404, 'Konto nicht gefunden');
    const taken = findByEmail(items, email);
    if (taken && taken.id !== id) throw emailVergeben(email, `Es gehört ${taken.name}.`);
    b.email = email;
    return { items, result: undefined };
  });
  const [row] = await uebersicht((b) => b.id === id);
  res.json(row);
});

const nameUpdateSchema = z.object({ name: nameSchema });

/** Changes the display name (not unique, not the login). */
benutzerRouter.patch('/:benutzerId/name', async (req, res) => {
  const { name } = parseBody(nameUpdateSchema, req);
  const id = String(req.params.benutzerId);
  const updated = await db.benutzer.patch(id, (b) => ({ ...b, name }));
  if (!updated) throw new HttpError(404, 'Konto nicht gefunden');
  const [row] = await uebersicht((b) => b.id === id);
  res.json(row);
});

/**
 * Replaces the password with a generated one, returned in plaintext once — the
 * replacement for the old "remove and re-add" workaround now that removing someone from a
 * Trupp keeps the account.
 */
benutzerRouter.post('/:benutzerId/passwort-zuruecksetzen', async (req, res) => {
  const id = String(req.params.benutzerId);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const updated = await db.benutzer.patch(id, (b) => ({ ...b, passwordHash }));
  if (!updated) throw new HttpError(404, 'Konto nicht gefunden');
  const body: PasswortResetResponse = { tempPassword };
  res.json(body);
});

/**
 * Deletes an account entirely: also removes it from every Termin and drops its push
 * subscriptions. Its saved Stationsergebnisse belong to the Trupp and stay. Not for your
 * own account, and never the last Ausbilder.
 */
benutzerRouter.delete('/:benutzerId', async (req, res) => {
  const id = String(req.params.benutzerId);
  if (id === req.benutzer!.id) throw new HttpError(409, 'Das eigene Konto kann nicht gelöscht werden');
  await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === id);
    if (!b) throw new HttpError(404, 'Konto nicht gefunden');
    if (b.systemRolle === 'ausbilder' && items.filter((x) => x.systemRolle === 'ausbilder').length <= 1) {
      throw new HttpError(409, LETZTER_AUSBILDER);
    }
    return { items: items.filter((x) => x.id !== id), result: undefined };
  });
  await db.termine.update((items) => ({
    items: items.map((t) =>
      t.teilnehmerIds.includes(id) || t.anwesendIds?.includes(id)
        ? {
            ...t,
            teilnehmerIds: t.teilnehmerIds.filter((x) => x !== id),
            anwesendIds: (t.anwesendIds ?? []).filter((x) => x !== id),
          }
        : t,
    ),
    result: undefined,
  }));
  await removeSubscriptionsOf({ kind: 'benutzer', id });
  res.status(204).end();
});
