import {
  checklistAmpel,
  kannTruppIdentitaetBearbeiten,
  ROLLEN,
  rollenBesetzung,
  TRUPP_ICONS,
  TRUPP_NAME_MAX,
  type TruppSummary,
  type TeilnehmerCreateResponse,
} from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, istMitglied, type MitgliedRecord, type TruppRecord } from '../db.js';
import { isAusbilder, loadTrupp, requireAusbilder, requireAuth, requireRolle } from '../lib/auth.js';
import { findByName, nameSchema, nameVergeben, newBenutzerRecord, optionalFfSchema } from '../lib/benutzer.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId, randomToken } from '../lib/ids.js';
import { generateTempPassword, hashPassword } from '../lib/password.js';
import { toTrupp, toTeilnehmer } from '../serialize.js';

export const truppsRouter = Router();

const isoDate = z.iso.date();

/** Trupp names: free text (playful names welcome), trimmed, inner whitespace collapsed. */
const truppNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(TRUPP_NAME_MAX));

// ---------------------------------------------------------------- Trupps

/**
 * All Trupps of the instance. Ausbilder manage them; Prüfer need the list to pick which
 * Trupp they are scoring (no invite token for them).
 */
truppsRouter.get('/', requireAuth, requireRolle('ausbilder', 'pruefer'), async (req, res) => {
  const [trupps, benutzer] = await Promise.all([db.trupps.all(), db.benutzer.all()]);
  const includeInvite = isAusbilder(req);
  const body: TruppSummary[] = trupps
    .sort((a, b) => (a.pruefungstermin ?? '9999').localeCompare(b.pruefungstermin ?? '9999'))
    .map((trupp) => {
      const members = benutzer.filter((b) => b.truppId === trupp.id);
      const besetzung = rollenBesetzung(members);
      return {
        ...toTrupp(trupp, { includeInvite }),
        teilnehmerCount: members.length,
        bereitCount: members.filter((t) => checklistAmpel(t.rolle, t.checkliste) === 'gruen').length,
        rollenBesetzt: ROLLEN.filter((r) => besetzung[r] > 0).length,
      };
    });
  res.json(body);
});

const createSchema = z.object({
  name: truppNameSchema,
  pruefungstermin: isoDate.nullish(),
});

truppsRouter.post('/', requireAusbilder, async (req, res) => {
  const input = parseBody(createSchema, req);
  const rec: TruppRecord = {
    id: newId(),
    name: input.name,
    icon: null,
    stufe: 'BRONZE',
    pruefungstermin: input.pruefungstermin ?? null,
    ownerId: req.benutzer!.id,
    inviteToken: randomToken(),
    createdAt: new Date().toISOString(),
  };
  await db.trupps.insert(rec);
  res.status(201).json(toTrupp(rec, { includeInvite: true }));
});

truppsRouter.get('/:truppId', requireAuth, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  res.json(toTrupp(trupp, { includeInvite: isAusbilder(req) }));
});

const patchSchema = z.object({
  name: truppNameSchema.optional(),
  pruefungstermin: isoDate.nullable().optional(),
});

truppsRouter.patch('/:truppId', requireAusbilder, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const input = parseBody(patchSchema, req);
  const updated = await db.trupps.patch(trupp.id, (x) => ({
    ...x,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.pruefungstermin !== undefined ? { pruefungstermin: input.pruefungstermin } : {}),
  }));
  res.json(toTrupp(updated!, { includeInvite: true }));
});

const identitaetSchema = z
  .object({
    name: truppNameSchema.optional(),
    /** null = back to "not chosen" (default icon). */
    icon: z.enum(TRUPP_ICONS).nullable().optional(),
  })
  .strict()
  .refine((x) => x.name !== undefined || x.icon !== undefined, { message: 'Name oder Icon angeben' });

/**
 * Self-service Trupp-Identität (name + mascot icon), just for fun: any Ausbilder, or a
 * Teilnehmer who is a member of this Trupp. Prüfer and members of other Trupps get 403
 * (checked before the lookup, so it doesn't reveal whether the Trupp id exists).
 * Ausbilder-only fields (pruefungstermin, invite) stay on PATCH /:truppId.
 */
truppsRouter.patch('/:truppId/identitaet', requireAuth, async (req, res) => {
  if (!kannTruppIdentitaetBearbeiten(req.benutzer!, String(req.params.truppId))) {
    throw new HttpError(403, 'Nur Mitglieder dieses Trupps oder Ausbilder können Name und Icon ändern');
  }
  const trupp = await loadTrupp(req, 'trupp');
  const input = parseBody(identitaetSchema, req);
  const updated = await db.trupps.patch(trupp.id, (x) => ({
    ...x,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
  }));
  res.json(toTrupp(updated!, { includeInvite: isAusbilder(req) }));
});

truppsRouter.post('/:truppId/invite/regenerate', requireAusbilder, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const updated = await db.trupps.patch(trupp.id, (x) => ({ ...x, inviteToken: randomToken() }));
  res.json(toTrupp(updated!, { includeInvite: true }));
});

// ---------------------------------------------------------------- Mitglieder

truppsRouter.get('/:truppId/teilnehmer', requireAuth, async (req, res) => {
  const trupp = await loadTrupp(req, 'mitglieder');
  const list = (await db.benutzer.all()).filter(istMitglied).filter((b) => b.truppId === trupp.id);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(list.map(toTeilnehmer));
});

const addTeilnehmerSchema = z.object({ name: nameSchema, ff: optionalFfSchema });

/**
 * "Person hinzufügen", new account: created like a self-join (already a member of this
 * Trupp) with a generated password that is returned in plaintext once — the person then
 * logs in with name + this password on the normal login.
 */
truppsRouter.post('/:truppId/teilnehmer', requireAusbilder, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const input = parseBody(addTeilnehmerSchema, req);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const rec = await db.benutzer.update((items) => {
    const existing = findByName(items, input.name);
    if (existing) {
      throw nameVergeben(
        existing.name,
        existing.truppId
          ? 'Unterscheide die Person z. B. mit dem Anfangsbuchstaben des Nachnamens.'
          : 'Hat sich die Person schon registriert, wähle sie unter den bestehenden Konten aus. ' +
              'Sonst unterscheide sie z. B. mit dem Anfangsbuchstaben des Nachnamens.',
      );
    }
    const created = newBenutzerRecord({ name: input.name, ff: input.ff, passwordHash, truppId: trupp.id });
    return { items: [...items, created], result: created as MitgliedRecord };
  });

  const body: TeilnehmerCreateResponse = { teilnehmer: toTeilnehmer(rec), tempPassword };
  res.status(201).json(body);
});

const zuordnenSchema = z.object({ benutzerId: z.string().min(1).max(100) });

/**
 * "Person hinzufügen", existing account: attaches a registered account that has no Trupp
 * yet (see GET /benutzer/ohne-trupp). Idempotent for the same Trupp.
 */
truppsRouter.post('/:truppId/teilnehmer/zuordnen', requireAusbilder, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const { benutzerId } = parseBody(zuordnenSchema, req);
  const rec = await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === benutzerId);
    if (!b) throw new HttpError(404, 'Konto nicht gefunden');
    if (b.truppId && b.truppId !== trupp.id) {
      throw new HttpError(409, `${b.name} ist bereits in einem anderen Trupp — dort zuerst entfernen.`);
    }
    if (b.truppId !== trupp.id) {
      b.truppId = trupp.id;
      b.rolle = null;
      b.joinedAt = new Date().toISOString();
    }
    return { items, result: b as MitgliedRecord };
  });
  res.json(toTeilnehmer(rec));
});

const checkStatus = z.enum(['ok', 'offen']);
const checklistPatch = z.object({
  at: checkStatus.optional(),
  ats3: checkStatus.optional(),
  tauglichkeit: checkStatus.optional(),
});

/** Checkliste can be toggled by an Ausbilder or by the person themself. */
truppsRouter.patch('/:truppId/teilnehmer/:teilnehmerId/checkliste', requireAuth, async (req, res) => {
  const trupp = await loadTrupp(req, 'mitglieder');
  const teilnehmerId = String(req.params.teilnehmerId);
  if (!isAusbilder(req) && req.benutzer!.id !== teilnehmerId) {
    throw new HttpError(403, 'Nur die eigene Checkliste kann bearbeitet werden');
  }
  const input = parseBody(checklistPatch, req);
  const updated = await db.benutzer.update((items) => {
    const t = items.find((x) => x.id === teilnehmerId && x.truppId === trupp.id);
    if (!t) return { items, result: undefined };
    // Not applicable for whoever holds GKDT right now. The stored value is kept, so it
    // comes back unchanged if the Rolle is reassigned later.
    if (t.rolle === 'GKDT') delete input.tauglichkeit;
    t.checkliste = { ...t.checkliste, ...input };
    return { items, result: t as MitgliedRecord };
  });
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated));
});

/**
 * Removes the person from this Trupp (APAS-Rolle is cleared). The account itself, its
 * Checkliste, Termin assignments and push subscriptions stay — it can be attached to a Trupp
 * again. Deleting the account entirely is DELETE /benutzer/:id.
 */
truppsRouter.delete('/:truppId/teilnehmer/:teilnehmerId', requireAusbilder, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const teilnehmerId = String(req.params.teilnehmerId);
  const removed = await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === teilnehmerId && x.truppId === trupp.id);
    if (!b) return { items, result: false };
    b.truppId = null;
    b.rolle = null;
    b.joinedAt = null;
    return { items, result: true };
  });
  if (!removed) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.status(204).end();
});
