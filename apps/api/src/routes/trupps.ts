import { checklistAmpel, ROLLEN, rollenBesetzung, type TruppSummary, type TeilnehmerCreateResponse } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type TruppRecord, type RessourceRecord } from '../db.js';
import { isOwner, loadTruppForPrincipal, requireAny, requireLeiter } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newId, randomToken } from '../lib/ids.js';
import { generateTempPassword, hashPassword } from '../lib/password.js';
import { ffSchema, findByName, nameSchema, newTeilnehmerRecord } from '../lib/teilnehmer.js';
import { removeSubscriptionsOf } from '../push.js';
import { toTrupp, toRessource, toTeilnehmer } from '../serialize.js';

export const truppsRouter = Router();

const isoDate = z.iso.date();

// ---------------------------------------------------------------- Trupps (Ausbildungsleiter)

truppsRouter.get('/', requireLeiter, async (req, res) => {
  const trupps = await db.trupps.find((trupp) => trupp.ownerId === req.leiter!.sub);
  const teilnehmer = await db.teilnehmer.all();
  const body: TruppSummary[] = trupps
    .sort((a, b) => (a.pruefungstermin ?? '9999').localeCompare(b.pruefungstermin ?? '9999'))
    .map((trupp) => {
      const members = teilnehmer.filter((t) => t.truppId === trupp.id);
      const besetzung = rollenBesetzung(members);
      return {
        ...toTrupp(trupp, { includeInvite: true }),
        teilnehmerCount: members.length,
        bereitCount: members.filter((t) => checklistAmpel(t.rolle, t.checkliste) === 'gruen').length,
        rollenBesetzt: ROLLEN.filter((r) => besetzung[r] > 0).length,
      };
    });
  res.json(body);
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pruefungstermin: isoDate.nullish(),
});

truppsRouter.post('/', requireLeiter, async (req, res) => {
  const input = parseBody(createSchema, req);
  const rec: TruppRecord = {
    id: newId(),
    name: input.name,
    stufe: 'BRONZE',
    pruefungstermin: input.pruefungstermin ?? null,
    ownerId: req.leiter!.sub,
    inviteToken: randomToken(),
    createdAt: new Date().toISOString(),
  };
  await db.trupps.insert(rec);
  res.status(201).json(toTrupp(rec, { includeInvite: true }));
});

truppsRouter.get('/:truppId', requireAny, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  res.json(toTrupp(trupp, { includeInvite: isOwner(req, trupp) }));
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  pruefungstermin: isoDate.nullable().optional(),
});

truppsRouter.patch('/:truppId', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const input = parseBody(patchSchema, req);
  const updated = await db.trupps.patch(trupp.id, (x) => ({
    ...x,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.pruefungstermin !== undefined ? { pruefungstermin: input.pruefungstermin } : {}),
  }));
  res.json(toTrupp(updated!, { includeInvite: true }));
});

truppsRouter.post('/:truppId/invite/regenerate', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const updated = await db.trupps.patch(trupp.id, (x) => ({ ...x, inviteToken: randomToken() }));
  res.json(toTrupp(updated!, { includeInvite: true }));
});

// ---------------------------------------------------------------- Teilnehmer

truppsRouter.get('/:truppId/teilnehmer', requireAny, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const list = await db.teilnehmer.find((t) => t.truppId === trupp.id);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(list.map(toTeilnehmer));
});

const addTeilnehmerSchema = z.object({ name: nameSchema, ff: ffSchema });

/**
 * Direct add by the owning Ausbildungsleiter (e.g. to pre-populate a Trupp). Creates the
 * Teilnehmer exactly like a self-join, but with a generated password that is returned in
 * plaintext once — the person then logs in via the invite link with name + this password.
 */
truppsRouter.post('/:truppId/teilnehmer', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const input = parseBody(addTeilnehmerSchema, req);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const teilnehmer = await db.teilnehmer.update((items) => {
    const existing = findByName(items, trupp.id, input.name);
    if (existing) {
      throw new HttpError(
        409,
        `Der Name „${existing.name}" ist in diesem Trupp schon vergeben. ` +
          'Unterscheide die Person z. B. mit dem Anfangsbuchstaben des Nachnamens.',
      );
    }
    const rec = newTeilnehmerRecord(trupp.id, { name: input.name, ff: input.ff, passwordHash });
    return { items: [...items, rec], result: rec };
  });

  const body: TeilnehmerCreateResponse = { teilnehmer: toTeilnehmer(teilnehmer), tempPassword };
  res.status(201).json(body);
});

const checkStatus = z.enum(['ok', 'offen']);
const checklistPatch = z.object({
  at: checkStatus.optional(),
  ats3: checkStatus.optional(),
  tauglichkeit: checkStatus.optional(),
});

/** Checkliste can be toggled by the Ausbildungsleiter or by the Teilnehmer themself. */
truppsRouter.patch('/:truppId/teilnehmer/:teilnehmerId/checkliste', requireAny, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const teilnehmerId = String(req.params.teilnehmerId);
  if (!isOwner(req, trupp) && req.teilnehmer?.sub !== teilnehmerId) {
    throw new HttpError(403, 'Nur die eigene Checkliste kann bearbeitet werden');
  }
  const input = parseBody(checklistPatch, req);
  const updated = await db.teilnehmer.update((items) => {
    const t = items.find((x) => x.id === teilnehmerId && x.truppId === trupp.id);
    if (!t) return { items, result: undefined };
    // Not applicable for whoever holds GKDT right now. The stored value is kept, so it
    // comes back unchanged if the Rolle is reassigned later.
    if (t.rolle === 'GKDT') delete input.tauglichkeit;
    t.checkliste = { ...t.checkliste, ...input };
    return { items, result: t };
  });
  if (!updated) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  res.json(toTeilnehmer(updated));
});

truppsRouter.delete('/:truppId/teilnehmer/:teilnehmerId', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const teilnehmerId = String(req.params.teilnehmerId);
  const removed = await db.teilnehmer.remove((t) => t.id === teilnehmerId && t.truppId === trupp.id);
  if (!removed) throw new HttpError(404, 'Teilnehmer nicht gefunden');
  await db.termine.update((items) => ({
    items: items.map((t) =>
      t.truppId === trupp.id ? { ...t, teilnehmerIds: t.teilnehmerIds.filter((id) => id !== teilnehmerId) } : t,
    ),
    result: undefined,
  }));
  await removeSubscriptionsOf({ kind: 'teilnehmer', id: teilnehmerId });
  res.status(204).end();
});

// ---------------------------------------------------------------- Ressourcen

truppsRouter.get('/:truppId/ressourcen', requireAny, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const list = await db.ressourcen.find((r) => r.truppId === trupp.id);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  res.json(list.map(toRessource));
});

const ressourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  standort: z.string().trim().max(200).default(''),
});

truppsRouter.post('/:truppId/ressourcen', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const input = parseBody(ressourceSchema, req);
  const rec: RessourceRecord = { id: newId(), truppId: trupp.id, name: input.name, standort: input.standort };
  await db.ressourcen.insert(rec);
  res.status(201).json(toRessource(rec));
});

truppsRouter.delete('/:truppId/ressourcen/:ressourceId', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const ressourceId = String(req.params.ressourceId);
  const removed = await db.ressourcen.remove((r) => r.id === ressourceId && r.truppId === trupp.id);
  if (!removed) throw new HttpError(404, 'Ressource nicht gefunden');
  // Termine keep existing but lose their booking.
  await db.termine.update((items) => ({
    items: items.map((t) => (t.ressourceId === ressourceId ? { ...t, ressourceId: null } : t)),
    result: undefined,
  }));
  res.status(204).end();
});
