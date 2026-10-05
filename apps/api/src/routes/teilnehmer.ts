import { ROLLEN } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAny } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { toTeilnehmer } from '../serialize.js';

/** Mounted at /api/teilnehmer */
export const teilnehmerRouter = Router();

const rolleSchema = z.object({ rolle: z.enum(ROLLEN).nullable() });

/**
 * Role assignment is a group decision: the owning Ausbildungsleiter or any Teilnehmer
 * of the same Gruppe may change anyone's Rolle. Several Teilnehmer may hold the same
 * Rolle (Ergänzungsteilnehmer), so nothing is blocked here.
 */
teilnehmerRouter.patch('/:teilnehmerId/rolle', requireAny, async (req, res) => {
  const { rolle } = parseBody(rolleSchema, req);
  const target = await db.teilnehmer.get(String(req.params.teilnehmerId));
  const gruppe = target ? await db.gruppen.get(target.gruppeId) : undefined;
  const allowed =
    !!gruppe &&
    ((!!req.leiter && gruppe.ownerId === req.leiter.sub) || req.teilnehmer?.gruppeId === gruppe.id);
  if (!target || !allowed) throw new HttpError(404, 'Teilnehmer nicht gefunden');

  const updated = await db.teilnehmer.patch(target.id, (t) => ({ ...t, rolle }));
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated));
});
