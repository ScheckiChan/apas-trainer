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
 * Role assignment is a joint decision: the owning Ausbildungsleiter or any Teilnehmer
 * of the same Trupp may change anyone's Rolle. Several Teilnehmer may hold the same
 * Rolle (Ergänzungsteilnehmer), so nothing is blocked here.
 */
teilnehmerRouter.patch('/:teilnehmerId/rolle', requireAny, async (req, res) => {
  const { rolle } = parseBody(rolleSchema, req);
  const target = await db.teilnehmer.get(String(req.params.teilnehmerId));
  const trupp = target ? await db.trupps.get(target.truppId) : undefined;
  const allowed =
    !!trupp &&
    ((!!req.leiter && trupp.ownerId === req.leiter.sub) || req.teilnehmer?.truppId === trupp.id);
  if (!target || !allowed) throw new HttpError(404, 'Teilnehmer nicht gefunden');

  const updated = await db.teilnehmer.patch(target.id, (t) => ({ ...t, rolle }));
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated));
});
