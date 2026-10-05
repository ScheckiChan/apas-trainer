import type { JoinInfo, TeilnehmerSession } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type GruppeRecord, type TeilnehmerRecord } from '../db.js';
import { signTeilnehmerToken } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { ffSchema, findByName, nameSchema, newTeilnehmerRecord } from '../lib/teilnehmer.js';
import { toGruppe, toTeilnehmer } from '../serialize.js';

/**
 * Public Teilnehmer entry points, all scoped by the Gruppe's invite token.
 * Mounted at /api/gruppen (next to the authenticated gruppenRouter):
 *   GET  /:token/join   → JoinInfo
 *   POST /:token/join   → create Teilnehmer + session
 *   POST /:token/login  → session for an existing Teilnehmer
 */
export const joinRouter = Router();

async function gruppeByInvite(token: string): Promise<GruppeRecord> {
  const g = await db.gruppen.findOne((x) => x.inviteToken === token);
  if (!g) throw new HttpError(404, 'Einladungslink ungültig oder nicht mehr aktiv');
  return g;
}

function session(t: TeilnehmerRecord, g: GruppeRecord): TeilnehmerSession {
  return {
    token: signTeilnehmerToken({ sub: t.id, gruppeId: t.gruppeId }),
    teilnehmer: toTeilnehmer(t),
    gruppe: toGruppe(g, { includeInvite: false }),
  };
}

joinRouter.get('/:token/join', async (req, res) => {
  const g = await gruppeByInvite(String(req.params.token));
  const body: JoinInfo = { gruppeName: g.name, pruefungstermin: g.pruefungstermin };
  res.json(body);
});

const joinSchema = z.object({
  name: nameSchema,
  ff: ffSchema,
  // bcrypt only uses the first 72 bytes — cap it instead of silently truncating.
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(72),
});

joinRouter.post('/:token/join', async (req, res) => {
  const gruppe = await gruppeByInvite(String(req.params.token));
  const input = parseBody(joinSchema, req);
  // Hash outside the collection lock — bcrypt is deliberately slow.
  const passwordHash = await hashPassword(input.password);

  const teilnehmer = await db.teilnehmer.update((items) => {
    const existing = findByName(items, gruppe.id, input.name);
    if (existing?.passwordHash) {
      throw new HttpError(
        409,
        `Der Name „${existing.name}" ist in dieser Gruppe schon vergeben. Wenn du das bist, wähle „Anmelden". ` +
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
    const rec = newTeilnehmerRecord(gruppe.id, { name: input.name, ff: input.ff, passwordHash });
    return { items: [...items, rec], result: rec };
  });

  res.status(201).json(session(teilnehmer, gruppe));
});

const loginSchema = z.object({
  name: nameSchema,
  password: z.string().min(1).max(200),
});

joinRouter.post('/:token/login', async (req, res) => {
  const gruppe = await gruppeByInvite(String(req.params.token));
  const input = parseBody(loginSchema, req);
  const t = findByName(await db.teilnehmer.all(), gruppe.id, input.name);

  if (t && !t.passwordHash) {
    throw new HttpError(
      409,
      'Für diesen Namen ist noch kein Passwort gesetzt — bitte einmal über „Neu beitreten" mit demselben Namen ein Passwort festlegen.',
    );
  }
  if (!t || !(await verifyPassword(input.password, t.passwordHash))) {
    throw new HttpError(401, 'Name oder Passwort falsch');
  }
  res.json(session(t, gruppe));
});
