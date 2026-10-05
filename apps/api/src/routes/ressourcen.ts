import { Router } from 'express';
import { z } from 'zod';
import { db, type RessourceRecord } from '../db.js';
import { requireAusbilder, requireAuth } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { toRessource } from '../serialize.js';

/**
 * Mounted at /api/ressourcen. Instance-wide like the calendar: every Trupp books the same
 * Ressourcen. Anyone signed in reads them; only Ausbilder create or delete.
 */
export const ressourcenRouter = Router();

ressourcenRouter.get('/', requireAuth, async (_req, res) => {
  const list = await db.ressourcen.all();
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(list.map(toRessource));
});

const ressourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  standort: z.string().trim().max(200).default(''),
});

ressourcenRouter.post('/', requireAusbilder, async (req, res) => {
  const input = parseBody(ressourceSchema, req);
  const rec: RessourceRecord = { id: newId(), name: input.name, standort: input.standort };
  await db.ressourcen.insert(rec);
  res.status(201).json(toRessource(rec));
});

ressourcenRouter.delete('/:ressourceId', requireAusbilder, async (req, res) => {
  const ressourceId = String(req.params.ressourceId);
  const removed = await db.ressourcen.remove((r) => r.id === ressourceId);
  if (!removed) throw new HttpError(404, 'Ressource nicht gefunden');
  // Termine keep existing but lose their booking.
  await db.termine.update((items) => ({
    items: items.map((t) => (t.ressourceId === ressourceId ? { ...t, ressourceId: null } : t)),
    result: undefined,
  }));
  res.status(204).end();
});
