import type { JoinInfo } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type BenutzerRecord, type TruppRecord } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { ffSchema, findByName, nameSchema, nameVergeben, newBenutzerRecord, passwordSchema } from '../lib/benutzer.js';
import { HttpError, parseBody } from '../lib/http.js';
import { hashPassword } from '../lib/password.js';
import { truppIconOf } from '../serialize.js';
import { authSession, meResponse } from './auth.js';

/**
 * Invite-link entry points, scoped by the Trupp's invite token. Mounted at /api/trupps
 * (next to the authenticated truppsRouter):
 *   GET  /:token/join       → JoinInfo (public)
 *   POST /:token/join       → new account that is already a member of the Trupp (public)
 *   POST /:token/beitreten  → the signed-in account (no Trupp yet) joins the Trupp
 * Logging in is the global POST /auth/login — the invite token is no longer part of it.
 */
export const joinRouter = Router();

async function truppByInvite(token: string): Promise<TruppRecord> {
  const trupp = await db.trupps.findOne((x) => x.inviteToken === token);
  if (!trupp) throw new HttpError(404, 'Einladungslink ungültig oder nicht mehr aktiv');
  return trupp;
}

joinRouter.get('/:token/join', async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const body: JoinInfo = { truppName: trupp.name, truppIcon: truppIconOf(trupp), pruefungstermin: trupp.pruefungstermin };
  res.json(body);
});

const joinSchema = z.object({
  name: nameSchema,
  ff: ffSchema,
  password: passwordSchema,
});

joinRouter.post('/:token/join', async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const input = parseBody(joinSchema, req);
  const passwordHash = await hashPassword(input.password);

  const benutzer = await db.benutzer.update((items) => {
    const existing = findByName(items, input.name);
    if (existing && !existing.passwordHash && existing.truppId === trupp.id) {
      // Legacy record from the magic-link era without a password: the first join claims it.
      const { email: _e, emailVerified: _v, ...rest } = existing as BenutzerRecord & {
        email?: string;
        emailVerified?: boolean;
      };
      const claimed: BenutzerRecord = { ...rest, name: input.name, ff: input.ff, passwordHash };
      return { items: items.map((b) => (b.id === existing.id ? claimed : b)), result: claimed };
    }
    if (existing) {
      throw nameVergeben(
        existing.name,
        'Wenn du das bist, melde dich an und tritt dann über diesen Link bei. ' +
          'Sonst unterscheide dich z. B. mit dem Anfangsbuchstaben deines Nachnamens.',
      );
    }
    const rec = newBenutzerRecord({ name: input.name, ff: input.ff, passwordHash, truppId: trupp.id });
    return { items: [...items, rec], result: rec };
  });

  res.status(201).json(await authSession(benutzer));
});

/**
 * An already registered (signed-in) account joins via the invite link. Idempotent for the
 * same Trupp; an account that is in another Trupp must be moved by an Ausbilder.
 */
joinRouter.post('/:token/beitreten', requireAuth, async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const benutzer = await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === req.benutzer!.id);
    if (!b) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
    if (b.truppId === trupp.id) return { items, result: b };
    if (b.truppId) {
      throw new HttpError(409, 'Du bist bereits in einem anderen Trupp. Ein Ausbilder kann dich umbuchen.');
    }
    b.truppId = trupp.id;
    b.rolle = null;
    b.joinedAt = new Date().toISOString();
    return { items, result: b };
  });
  res.json(await meResponse(benutzer));
});
