import { intervalsOverlap, type BuchungsKonflikt, type TerminSaveResponse } from '@apas/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { db, type GruppeRecord, type TerminRecord } from '../db.js';
import { isOwner, loadGruppeForPrincipal, requireAny } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { forgetReminders } from '../reminders.js';
import { toTermin } from '../serialize.js';

/** Mounted at /api/gruppen/:gruppeId/termine */
export const termineRouter = Router({ mergeParams: true });

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

/** Overlapping Termine on the same Ressource. Informational only — never blocks a booking. */
async function findKonflikte(
  gruppeId: string,
  ressourceId: string | null | undefined,
  start: string,
  ende: string,
  excludeTerminId?: string,
): Promise<BuchungsKonflikt[]> {
  if (!ressourceId) return [];
  const others = await db.termine.find(
    (t) =>
      t.gruppeId === gruppeId &&
      t.ressourceId === ressourceId &&
      t.id !== excludeTerminId &&
      intervalsOverlap(start, ende, t.start, t.ende),
  );
  return others.map((t) => ({ terminId: t.id, titel: t.titel, start: t.start, ende: t.ende, ressourceId }));
}

async function validateRefs(g: GruppeRecord, teilnehmerIds: string[], ressourceId: string | null | undefined) {
  if (ressourceId) {
    const r = await db.ressourcen.get(ressourceId);
    if (!r || r.gruppeId !== g.id) throw new HttpError(400, 'Ressource gehört nicht zu dieser Gruppe');
  }
  const members = new Set((await db.teilnehmer.find((t) => t.gruppeId === g.id)).map((t) => t.id));
  const unknown = teilnehmerIds.filter((id) => !members.has(id));
  if (unknown.length) throw new HttpError(400, 'Unbekannte Teilnehmer ausgewählt', { unknown });
}

const creatorId = (req: Request): string => (req.leiter ? 'ausbildungsleiter' : req.teilnehmer!.sub);

/** Ausbildungsleiter may edit everything; Teilnehmer only Individualübungen they created. */
function canModify(req: Request, g: GruppeRecord, t: TerminRecord): boolean {
  if (isOwner(req, g)) return true;
  return t.typ === 'individual' && !!req.teilnehmer && t.createdBy === req.teilnehmer.sub;
}

termineRouter.use(requireAny);

termineRouter.get('/', async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const from = typeof req.query.from === 'string' ? new Date(req.query.from).getTime() : -Infinity;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to).getTime() : Infinity;
  const list = await db.termine.find(
    (t) => t.gruppeId === g.id && new Date(t.ende).getTime() >= from && new Date(t.start).getTime() <= to,
  );
  list.sort((a, b) => a.start.localeCompare(b.start));
  res.json(list.map(toTermin));
});

termineRouter.post('/konflikte', async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const q = parseBody(conflictQuerySchema, req);
  res.json(await findKonflikte(g.id, q.ressourceId, q.start, q.ende, q.excludeTerminId));
});

termineRouter.post('/', async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const input = parseBody(terminSchema, req);
  if (input.typ === 'fix' && !isOwner(req, g)) {
    throw new HttpError(403, 'Fixtermine können nur vom Ausbildungsleiter angelegt werden');
  }
  const teilnehmerIds = [...new Set(input.teilnehmerIds)];
  await validateRefs(g, teilnehmerIds, input.ressourceId);

  const rec: TerminRecord = {
    id: newId(),
    gruppeId: g.id,
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
    konflikte: await findKonflikte(g.id, rec.ressourceId, rec.start, rec.ende, rec.id),
  };
  res.status(201).json(body);
});

termineRouter.put('/:terminId', async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const existing = await db.termine.get(String(req.params.terminId));
  if (!existing || existing.gruppeId !== g.id) throw new HttpError(404, 'Termin nicht gefunden');
  if (!canModify(req, g, existing)) throw new HttpError(403, 'Keine Berechtigung für diesen Termin');

  const input = parseBody(terminSchema, req);
  if (input.typ !== existing.typ && !isOwner(req, g)) {
    throw new HttpError(403, 'Nur der Ausbildungsleiter kann den Termintyp ändern');
  }
  const teilnehmerIds = [...new Set(input.teilnehmerIds)];
  await validateRefs(g, teilnehmerIds, input.ressourceId);

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
    konflikte: await findKonflikte(g.id, updated!.ressourceId, updated!.start, updated!.ende, updated!.id),
  };
  res.json(body);
});

termineRouter.delete('/:terminId', async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const existing = await db.termine.get(String(req.params.terminId));
  if (!existing || existing.gruppeId !== g.id) throw new HttpError(404, 'Termin nicht gefunden');
  if (!canModify(req, g, existing)) throw new HttpError(403, 'Keine Berechtigung für diesen Termin');
  await db.termine.remove((t) => t.id === existing.id);
  await forgetReminders(existing.id);
  res.status(204).end();
});
