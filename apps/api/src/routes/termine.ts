import { intervalsOverlap, type BuchungsKonflikt, type KalenderPerson, type TerminSaveResponse } from '@apas/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { db, type TerminRecord } from '../db.js';
import { requireAny } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { forgetReminders } from '../reminders.js';
import { toTermin } from '../serialize.js';

/**
 * Mounted at /api/termine. One shared calendar for the whole instance (= one Ausbildung):
 * every Trupp sees the same Termine, and a Termin may assign Teilnehmer of any Trupp.
 */
export const termineRouter = Router();

const isoDateTime = z.iso.datetime({ offset: true });

const terminSchema = z
  .object({
    typ: z.enum(['fix', 'individual']),
    titel: z.string().trim().min(1).max(120),
    start: isoDateTime,
    ende: isoDateTime,
    teilnehmerIds: z.array(z.string()).max(200).default([]),
    ressourceId: z.string().nullish(),
  })
  .refine((t) => new Date(t.ende).getTime() > new Date(t.start).getTime(), {
    message: 'Ende muss nach dem Beginn liegen',
    path: ['ende'],
  });

const conflictQuerySchema = z.object({
  ressourceId: z.string(),
  start: isoDateTime,
  ende: isoDateTime,
  excludeTerminId: z.string().optional(),
});

/**
 * Overlapping Termine on the same Ressource, across all Trupps — the Ressource (e.g. the one
 * vehicle) is shared by the whole instance. Informational only — never blocks a booking.
 */
async function findKonflikte(
  ressourceId: string | null | undefined,
  start: string,
  ende: string,
  excludeTerminId?: string,
): Promise<BuchungsKonflikt[]> {
  if (!ressourceId) return [];
  const others = await db.termine.find(
    (t) => t.ressourceId === ressourceId && t.id !== excludeTerminId && intervalsOverlap(start, ende, t.start, t.ende),
  );
  return others.map((t) => ({ terminId: t.id, titel: t.titel, start: t.start, ende: t.ende, ressourceId }));
}

async function validateRefs(teilnehmerIds: string[], ressourceId: string | null | undefined) {
  if (ressourceId && !(await db.ressourcen.get(ressourceId))) {
    throw new HttpError(400, 'Unbekannte Ressource');
  }
  const known = new Set((await db.teilnehmer.all()).map((t) => t.id));
  const unknown = teilnehmerIds.filter((id) => !known.has(id));
  if (unknown.length) throw new HttpError(400, 'Unbekannte Teilnehmer ausgewählt', { unknown });
}

const creatorId = (req: Request): string => (req.leiter ? 'ausbildungsleiter' : req.teilnehmer!.sub);

/**
 * Ausbildungsleiter may edit everything; a Teilnehmer only Individualübungen they created,
 * no matter which Trupps the assignees belong to. Single-instance deployment: any
 * Ausbildungsleiter account is "the" Ausbildungsleiter.
 */
function canModify(req: Request, t: TerminRecord): boolean {
  if (req.leiter) return true;
  return t.typ === 'individual' && !!req.teilnehmer && t.createdBy === req.teilnehmer.sub;
}

termineRouter.use(requireAny);

termineRouter.get('/', async (req, res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from).getTime() : -Infinity;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to).getTime() : Infinity;
  const list = await db.termine.find(
    (t) => new Date(t.ende).getTime() >= from && new Date(t.start).getTime() <= to,
  );
  list.sort((a, b) => a.start.localeCompare(b.start));
  res.json(list.map(toTermin));
});

/** Everyone who can be assigned to a Termin: the Teilnehmer of all Trupps, labelled with their Trupp. */
termineRouter.get('/personen', async (_req, res) => {
  const [teilnehmer, trupps] = await Promise.all([db.teilnehmer.all(), db.trupps.all()]);
  const truppName = new Map(trupps.map((t) => [t.id, t.name]));
  const body: KalenderPerson[] = teilnehmer
    .map((t) => ({
      id: t.id,
      name: t.name,
      ff: t.ff,
      rolle: t.rolle ?? null,
      truppId: t.truppId,
      truppName: truppName.get(t.truppId) ?? '—',
    }))
    .sort((a, b) => a.truppName.localeCompare(b.truppName, 'de') || a.name.localeCompare(b.name, 'de'));
  res.json(body);
});

termineRouter.post('/konflikte', async (req, res) => {
  const q = parseBody(conflictQuerySchema, req);
  res.json(await findKonflikte(q.ressourceId, q.start, q.ende, q.excludeTerminId));
});

termineRouter.post('/', async (req, res) => {
  const input = parseBody(terminSchema, req);
  if (input.typ === 'fix' && !req.leiter) {
    throw new HttpError(403, 'Fixtermine können nur vom Ausbildungsleiter angelegt werden');
  }
  const teilnehmerIds = [...new Set(input.teilnehmerIds)];
  await validateRefs(teilnehmerIds, input.ressourceId);

  const rec: TerminRecord = {
    id: newId(),
    typ: input.typ,
    titel: input.titel,
    start: new Date(input.start).toISOString(),
    ende: new Date(input.ende).toISOString(),
    teilnehmerIds,
    ressourceId: input.ressourceId ?? null,
    createdBy: creatorId(req),
    createdAt: new Date().toISOString(),
  };
  await db.termine.insert(rec);
  const body: TerminSaveResponse = {
    termin: toTermin(rec),
    konflikte: await findKonflikte(rec.ressourceId, rec.start, rec.ende, rec.id),
  };
  res.status(201).json(body);
});

termineRouter.put('/:terminId', async (req, res) => {
  const existing = await db.termine.get(String(req.params.terminId));
  if (!existing) throw new HttpError(404, 'Termin nicht gefunden');
  if (!canModify(req, existing)) throw new HttpError(403, 'Keine Berechtigung für diesen Termin');

  const input = parseBody(terminSchema, req);
  if (input.typ !== existing.typ && !req.leiter) {
    throw new HttpError(403, 'Nur der Ausbildungsleiter kann den Termintyp ändern');
  }
  const teilnehmerIds = [...new Set(input.teilnehmerIds)];
  await validateRefs(teilnehmerIds, input.ressourceId);

  const updated = await db.termine.patch(existing.id, (t) => ({
    ...t,
    typ: input.typ,
    titel: input.titel,
    start: new Date(input.start).toISOString(),
    ende: new Date(input.ende).toISOString(),
    teilnehmerIds,
    ressourceId: input.ressourceId ?? null,
  }));
  const body: TerminSaveResponse = {
    termin: toTermin(updated!),
    konflikte: await findKonflikte(updated!.ressourceId, updated!.start, updated!.ende, updated!.id),
  };
  res.json(body);
});

termineRouter.delete('/:terminId', async (req, res) => {
  const existing = await db.termine.get(String(req.params.terminId));
  if (!existing) throw new HttpError(404, 'Termin nicht gefunden');
  if (!canModify(req, existing)) throw new HttpError(403, 'Keine Berechtigung für diesen Termin');
  await db.termine.remove((t) => t.id === existing.id);
  await forgetReminders(existing.id);
  res.status(204).end();
});
