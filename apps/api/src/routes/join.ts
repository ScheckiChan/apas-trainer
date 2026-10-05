import type { JoinInfo, TeilnehmerSession } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type TruppRecord, type TeilnehmerRecord } from '../db.js';
import { signTeilnehmerToken } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { ffSchema, findByName, nameSchema, newTeilnehmerRecord } from '../lib/teilnehmer.js';
import { toTrupp, toTeilnehmer } from '../serialize.js';

/**
 * Public Teilnehmer entry points, all scoped by the Trupp's invite token.
 * Mounted at /api/trupps (next to the authenticated truppsRouter):
 *   GET  /:token/join   → JoinInfo
 *   POST /:token/join   → create Teilnehmer + session
 *   POST /:token/login  → session for an existing Teilnehmer
 */
export const joinRouter = Router();

async function truppByInvite(token: string): Promise<TruppRecord> {
  const trupp = await db.trupps.findOne((x) => x.inviteToken === token);
  if (!trupp) throw new HttpError(404, 'Einladungslink ungültig oder nicht mehr aktiv');
  return trupp;
}

function session(t: TeilnehmerRecord, trupp: TruppRecord): TeilnehmerSession {
  return {
    token: signTeilnehmerToken({ sub: t.id, truppId: t.truppId }),
    teilnehmer: toTeilnehmer(t),
    trupp: toTrupp(trupp, { includeInvite: false }),
  };
}

joinRouter.get('/:token/join', async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const body: JoinInfo = { truppName: trupp.name, pruefungstermin: trupp.pruefungstermin };
  res.json(body);
});

const joinSchema = z.object({
  name: nameSchema,
  ff: ffSchema,
  // bcrypt only uses the first 72 bytes — cap it instead of silently truncating.
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(72),
});

joinRouter.post('/:token/join', async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const input = parseBody(joinSchema, req);
  // Hash outside the collection lock — bcrypt is deliberately slow.
  const passwordHash = await hashPassword(input.password);

  const teilnehmer = await db.teilnehmer.update((items) => {
    const existing = findByName(items, trupp.id, input.name);
    if (existing?.passwordHash) {
      throw new HttpError(
        409,
        `Der Name „${existing.name}" ist in diesem Trupp schon vergeben. Wenn du das bist, wähle „Anmelden". ` +
          'Sonst unterscheide dich z. B. mit dem Anfangsbuchstaben deines Nachnamens.',
      );
    }
    if (existing) {
      // Legacy record from the magic-link era without a password: the first join claims it.
      const { email: _e, emailVerified: _v, ...rest } = existing as TeilnehmerRecord & {
        email?: string;
        emailVerified?: boolean;
      };
      const claimed: TeilnehmerRecord = { ...rest, name: input.name, ff: input.ff, passwordHash };
      return { items: items.map((t) => (t.id === existing.id ? claimed : t)), result: claimed };
    }
    const rec = newTeilnehmerRecord(trupp.id, { name: input.name, ff: input.ff, passwordHash });
    return { items: [...items, rec], result: rec };
  });

  res.status(201).json(session(teilnehmer, trupp));
});

const loginSchema = z.object({
  name: nameSchema,
  password: z.string().min(1).max(200),
});

joinRouter.post('/:token/login', async (req, res) => {
  const trupp = await truppByInvite(String(req.params.token));
  const input = parseBody(loginSchema, req);
  const t = findByName(await db.teilnehmer.all(), trupp.id, input.name);

  if (t && !t.passwordHash) {
    throw new HttpError(
      409,
      'Für diesen Namen ist noch kein Passwort gesetzt — bitte einmal über „Neu beitreten" mit demselben Namen ein Passwort festlegen.',
    );
  }
  if (!t || !(await verifyPassword(input.password, t.passwordHash))) {
    throw new HttpError(401, 'Name oder Passwort falsch');
  }
  res.json(session(t, trupp));
});
