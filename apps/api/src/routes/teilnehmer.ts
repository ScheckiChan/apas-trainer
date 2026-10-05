import { ROLLEN } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type MitgliedRecord } from '../db.js';
import { isAusbilder, requireAuth } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { toTeilnehmer } from '../serialize.js';

/** Mounted at /api/teilnehmer */
export const teilnehmerRouter = Router();

const rolleSchema = z.object({ rolle: z.enum(ROLLEN).nullable() });

/**
 * APAS-Rolle (GKDT, ATF/ATM1, …) assignment inside a Trupp — unrelated to the systemRolle.
 * A joint decision: any Ausbilder, or any member of the same Trupp (whatever their
 * systemRolle), may change anyone's Rolle in it. Several people may hold the same Rolle
 * (Ergänzungsteilnehmer), so nothing is blocked here.
 */
teilnehmerRouter.patch('/:teilnehmerId/rolle', requireAuth, async (req, res) => {
  const { rolle } = parseBody(rolleSchema, req);
  const targetId = String(req.params.teilnehmerId);
  const updated = await db.benutzer.update((items) => {
    const t = items.find((x) => x.id === targetId);
    const allowed = !!t?.truppId && (isAusbilder(req) || req.benutzer!.truppId === t.truppId);
    if (!t || !allowed) return { items, result: undefined };
    t.rolle = rolle;
    return { items, result: t as MitgliedRecord };
  });
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated));
});
