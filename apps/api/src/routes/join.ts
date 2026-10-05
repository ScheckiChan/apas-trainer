import { EMPTY_CHECKLISTE, ROLLEN, type JoinInfo } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type GruppeRecord, type TeilnehmerRecord } from '../db.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { issueMagicLink } from '../magic.js';

export const joinRouter = Router();

async function gruppeByInvite(token: string): Promise<GruppeRecord> {
  const g = await db.gruppen.findOne((x) => x.inviteToken === token);
  if (!g) throw new HttpError(404, 'Einladungslink ungültig oder nicht mehr aktiv');
  return g;
}

joinRouter.get('/:token', async (req, res) => {
  const g = await gruppeByInvite(String(req.params.token));
  const body: JoinInfo = { gruppeName: g.name, pruefungstermin: g.pruefungstermin };
  res.json(body);
});

const joinSchema = z.object({
  name: z.string().trim().min(2).max(100),
  ff: z.string().trim().min(2).max(100),
  rolle: z.enum(ROLLEN),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
});

/**
 * Registers a Teilnehmer in the Gruppe (or finds the existing one with the same e-mail)
 * and sends a magic link. No password is ever involved.
 */
joinRouter.post('/:token', async (req, res) => {
  const gruppe = await gruppeByInvite(String(req.params.token));
  const input = parseBody(joinSchema, req);

  const teilnehmer = await db.teilnehmer.update((items) => {
    const existing = items.find((t) => t.gruppeId === gruppe.id && t.email === input.email);
    if (existing) {
      // Same person re-joining — keep data stable, only refresh unverified profiles.
      if (!existing.emailVerified) Object.assign(existing, { name: input.name, ff: input.ff, rolle: input.rolle });
      return { items, result: existing };
    }
    const rec: TeilnehmerRecord = {
      id: newId(),
      gruppeId: gruppe.id,
      name: input.name,
      ff: input.ff,
      rolle: input.rolle,
      email: input.email,
      emailVerified: false,
      joinedAt: new Date().toISOString(),
      checkliste: { ...EMPTY_CHECKLISTE },
    };
    return { items: [...items, rec], result: rec };
  });

  await issueMagicLink(teilnehmer, gruppe);
  res.status(202).json({ ok: true });
});
