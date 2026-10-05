import { checklistAmpel, type GruppeSummary } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type GruppeRecord, type RessourceRecord } from '../db.js';
import { isOwner, loadGruppeForPrincipal, requireAny, requireLeiter } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId, randomToken } from '../lib/ids.js';
import { removeSubscriptionsOf } from '../push.js';
import { toGruppe, toRessource, toTeilnehmer } from '../serialize.js';

export const gruppenRouter = Router();

const isoDate = z.iso.date();

// ---------------------------------------------------------------- Gruppen (Ausbildungsleiter)

gruppenRouter.get('/', requireLeiter, async (req, res) => {
  const gruppen = await db.gruppen.find((g) => g.ownerId === req.leiter!.sub);
  const teilnehmer = await db.teilnehmer.all();
  const body: GruppeSummary[] = gruppen
    .sort((a, b) => (a.pruefungstermin ?? '9999').localeCompare(b.pruefungstermin ?? '9999'))
    .map((g) => {
      const members = teilnehmer.filter((t) => t.gruppeId === g.id);
      return {
        ...toGruppe(g, { includeInvite: true }),
        teilnehmerCount: members.length,
        bereitCount: members.filter((t) => checklistAmpel(t.rolle, t.checkliste) === 'gruen').length,
      };
    });
  res.json(body);
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pruefungstermin: isoDate.nullish(),
});

gruppenRouter.post('/', requireLeiter, async (req, res) => {
  const input = parseBody(createSchema, req);
  const rec: GruppeRecord = {
    id: newId(),
    name: input.name,
    stufe: 'BRONZE',
    pruefungstermin: input.pruefungstermin ?? null,
    ownerId: req.leiter!.sub,
    inviteToken: randomToken(),
    createdAt: new Date().toISOString(),
  };
  await db.gruppen.insert(rec);
  res.status(201).json(toGruppe(rec, { includeInvite: true }));
});

gruppenRouter.get('/:gruppeId', requireAny, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  res.json(toGruppe(g, { includeInvite: isOwner(req, g) }));
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  pruefungstermin: isoDate.nullable().optional(),
});

gruppenRouter.patch('/:gruppeId', requireLeiter, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const input = parseBody(patchSchema, req);
  const updated = await db.gruppen.patch(g.id, (x) => ({
    ...x,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.pruefungstermin !== undefined ? { pruefungstermin: input.pruefungstermin } : {}),
  }));
  res.json(toGruppe(updated!, { includeInvite: true }));
});

gruppenRouter.post('/:gruppeId/invite/regenerate', requireLeiter, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const updated = await db.gruppen.patch(g.id, (x) => ({ ...x, inviteToken: randomToken() }));
  res.json(toGruppe(updated!, { includeInvite: true }));
});

// ---------------------------------------------------------------- Teilnehmer

gruppenRouter.get('/:gruppeId/teilnehmer', requireAny, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const owner = isOwner(req, g);
  const list = await db.teilnehmer.find((t) => t.gruppeId === g.id);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(
    list.map((t) => toTeilnehmer(t, { includeEmail: owner || t.id === req.teilnehmer?.sub })),
  );
});

const checkStatus = z.enum(['ok', 'offen']);
const checklistPatch = z.object({
  at: checkStatus.optional(),
  ats3: checkStatus.optional(),
  tauglichkeit: checkStatus.optional(),
});

/** Checkliste can be toggled by the Ausbildungsleiter or by the Teilnehmer themself. */
gruppenRouter.patch('/:gruppeId/teilnehmer/:teilnehmerId/checkliste', requireAny, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const teilnehmerId = String(req.params.teilnehmerId);
  if (!isOwner(req, g) && req.teilnehmer?.sub !== teilnehmerId) {
    throw new HttpError(403, 'Nur die eigene Checkliste kann bearbeitet werden');
  }
  const input = parseBody(checklistPatch, req);
  const updated = await db.teilnehmer.update((items) => {
    const t = items.find((x) => x.id === teilnehmerId && x.gruppeId === g.id);
    if (!t) return { items, result: undefined };
    if (t.rolle === 'GKDT') delete input.tauglichkeit; // not applicable for GKDT
    t.checkliste = { ...t.checkliste, ...input };
    return { items, result: t };
  });
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated, { includeEmail: true }));
});

gruppenRouter.delete('/:gruppeId/teilnehmer/:teilnehmerId', requireLeiter, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const teilnehmerId = String(req.params.teilnehmerId);
  const removed = await db.teilnehmer.remove((t) => t.id === teilnehmerId && t.gruppeId === g.id);
  if (!removed) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  await db.termine.update((items) => ({
    items: items.map((t) =>
      t.gruppeId === g.id ? { ...t, teilnehmerIds: t.teilnehmerIds.filter((id) => id !== teilnehmerId) } : t,
    ),
    result: undefined,
  }));
  await db.magicLinks.remove((m) => m.teilnehmerId === teilnehmerId);
  await removeSubscriptionsOf({ kind: 'teilnehmer', id: teilnehmerId });
  res.status(204).end();
});

// ---------------------------------------------------------------- Ressourcen

gruppenRouter.get('/:gruppeId/ressourcen', requireAny, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const list = await db.ressourcen.find((r) => r.gruppeId === g.id);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(list.map(toRessource));
});

const ressourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  standort: z.string().trim().max(200).default(''),
});

gruppenRouter.post('/:gruppeId/ressourcen', requireLeiter, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const input = parseBody(ressourceSchema, req);
  const rec: RessourceRecord = { id: newId(), gruppeId: g.id, name: input.name, standort: input.standort };
  await db.ressourcen.insert(rec);
  res.status(201).json(toRessource(rec));
});

gruppenRouter.delete('/:gruppeId/ressourcen/:ressourceId', requireLeiter, async (req, res) => {
  const g = await loadGruppeForPrincipal(req);
  const ressourceId = String(req.params.ressourceId);
  const removed = await db.ressourcen.remove((r) => r.id === ressourceId && r.gruppeId === g.id);
  if (!removed) throw new HttpError(404, 'Ressource nicht gefunden');
  // Termine keep existing but lose their booking.
  await db.termine.update((items) => ({
    items: items.map((t) => (t.ressourceId === ressourceId ? { ...t, ressourceId: null } : t)),
    result: undefined,
  }));
  res.status(204).end();
});
