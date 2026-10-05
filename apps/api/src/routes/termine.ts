import { intervalsOverlap, type BuchungsKonflikt, type KalenderPerson, type TerminSaveResponse } from '@apas/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { db, type TerminRecord } from '../db.js';
import { isAusbilder, requireAuth } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { forgetReminders, notifyNewFixtermin } from '../reminders.js';
import { toTermin, trainingspraeferenzOf, truppIconOf } from '../serialize.js';

/**
 * Mounted at /api/termine. One shared calendar for the whole instance (= one Ausbildung):
 * every account sees the same Termine, and a Termin may assign people of any Trupp (or none).
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
  const known = new Set((await db.benutzer.all()).map((b) => b.id));
  const unknown = teilnehmerIds.filter((id) => !known.has(id));
  if (unknown.length) throw new HttpError(400, 'Unbekannte Personen ausgewählt', { unknown });
}

/**
 * Any Ausbilder may edit everything; everyone else (Prüfer, Teilnehmer) only the
 * Individualübungen they created, no matter which Trupps the assignees belong to.
 */
function canModify(req: Request, t: TerminRecord): boolean {
  if (isAusbilder(req)) return true;
  return t.typ === 'individual' && t.createdBy === req.benutzer!.id;
}

termineRouter.use(requireAuth);

termineRouter.get('/', async (req, res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from).getTime() : -Infinity;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to).getTime() : Infinity;
  const list = await db.termine.find(
    (t) => new Date(t.ende).getTime() >= from && new Date(t.start).getTime() <= to,
  );
  list.sort((a, b) => a.start.localeCompare(b.start));
  res.json(list.map(toTermin));
});

/**
 * Everyone who can be assigned to a Termin: every account, labelled with its Trupp.
 * Accounts without a Trupp (fresh registrations, Prüfer, Ausbilder) come last with
 * truppId/truppName null.
 */
termineRouter.get('/personen', async (_req, res) => {
  const [benutzer, trupps] = await Promise.all([db.benutzer.all(), db.trupps.all()]);
  const truppById = new Map(trupps.map((t) => [t.id, t]));
  const body: KalenderPerson[] = benutzer
    .map((b) => {
      const trupp = b.truppId ? truppById.get(b.truppId) : undefined;
      return {
        id: b.id,
        name: b.name,
        ff: b.ff,
        systemRolle: b.systemRolle,
        rolle: b.truppId ? (b.rolle ?? null) : null,
        truppId: b.truppId,
        truppName: b.truppId ? (trupp?.name ?? '—') : null,
        truppIcon: truppIconOf(trupp),
        trainingspraeferenz: trainingspraeferenzOf(b),
      };
    })
    .sort(
      (a, b) =>
        Number(a.truppName === null) - Number(b.truppName === null) ||
        (a.truppName ?? '').localeCompare(b.truppName ?? '', 'de') ||
        a.name.localeCompare(b.name, 'de'),
    );
  res.json(body);
});

termineRouter.post('/konflikte', async (req, res) => {
  const q = parseBody(conflictQuerySchema, req);
  res.json(await findKonflikte(q.ressourceId, q.start, q.ende, q.excludeTerminId));
});

termineRouter.post('/', async (req, res) => {
  const input = parseBody(terminSchema, req);
  if (input.typ === 'fix' && !isAusbilder(req)) {
    throw new HttpError(403, 'Fixtermine können nur von Ausbildern angelegt werden');
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
    anwesendIds: [],
    ressourceId: input.ressourceId ?? null,
    createdBy: req.benutzer!.id,
    createdAt: new Date().toISOString(),
  };
  await db.termine.insert(rec);
  const body: TerminSaveResponse = {
    termin: toTermin(rec),
    konflikte: await findKonflikte(rec.ressourceId, rec.start, rec.ende, rec.id),
  };
  res.status(201).json(body);
  // Fire-and-forget: push problems must never fail or delay the request.
  if (rec.typ === 'fix') void notifyNewFixtermin(rec).catch((err) => console.log('[push] notifyNewFixtermin', err));
});

termineRouter.put('/:terminId', async (req, res) => {
  const existing = await db.termine.get(String(req.params.terminId));
  if (!existing) throw new HttpError(404, 'Termin nicht gefunden');
  if (!canModify(req, existing)) throw new HttpError(403, 'Keine Berechtigung für diesen Termin');

  const input = parseBody(terminSchema, req);
  if (input.typ !== existing.typ && !isAusbilder(req)) {
    throw new HttpError(403, 'Nur Ausbilder können den Termintyp ändern');
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
    // RSVP only exists on Fixtermine: kept across edits, cleared when it becomes an Individualübung.
    anwesendIds: input.typ === 'fix' ? (t.anwesendIds ?? []) : [],
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

/**
 * RSVP ("anwesend") on a Fixtermin. Everyone may (un)register only themselves; an Ausbilder
 * may (un)register anyone (e.g. someone without the app). Both directions are idempotent and
 * answer with the updated Termin.
 */
async function setAnwesend(req: Request, anwesend: boolean) {
  const terminId = String(req.params.terminId);
  const benutzerId = String(req.params.benutzerId);
  if (benutzerId !== req.benutzer!.id && !isAusbilder(req)) {
    throw new HttpError(403, 'Du kannst nur dich selbst anmelden oder abmelden');
  }
  const existing = await db.termine.get(terminId);
  if (!existing) throw new HttpError(404, 'Termin nicht gefunden');
  if (existing.typ !== 'fix') throw new HttpError(400, 'Anmeldung nur für Fixtermine');
  if (!(await db.benutzer.get(benutzerId))) throw new HttpError(400, 'Unbekannte Person');

  const updated = await db.termine.patch(terminId, (t) => {
    if (t.typ !== 'fix') throw new HttpError(400, 'Anmeldung nur für Fixtermine');
    const ids = t.anwesendIds ?? [];
    if (ids.includes(benutzerId) === anwesend) return { ...t, anwesendIds: ids }; // already in that state
    return { ...t, anwesendIds: anwesend ? [...ids, benutzerId] : ids.filter((id) => id !== benutzerId) };
  });
  if (!updated) throw new HttpError(404, 'Termin nicht gefunden');
  return toTermin(updated);
}

termineRouter.put('/:terminId/anwesend/:benutzerId', async (req, res) => {
  res.json(await setAnwesend(req, true));
});

termineRouter.delete('/:terminId/anwesend/:benutzerId', async (req, res) => {
  res.json(await setAnwesend(req, false));
});
