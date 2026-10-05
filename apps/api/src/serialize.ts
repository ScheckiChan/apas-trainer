import type { StationErgebnis, Trupp, Ressource, Teilnehmer, Termin } from '@apas/shared';
import type { ErgebnisRecord, TruppRecord, RessourceRecord, TeilnehmerRecord, TerminRecord } from './db.js';

export function toTrupp(trupp: TruppRecord, opts: { includeInvite: boolean }): Trupp {
  return {
    id: trupp.id,
    name: trupp.name,
    stufe: trupp.stufe,
    pruefungstermin: trupp.pruefungstermin,
    ownerId: trupp.ownerId,
    createdAt: trupp.createdAt,
    ...(opts.includeInvite ? { inviteToken: trupp.inviteToken } : {}),
  };
}

export function toTeilnehmer(t: TeilnehmerRecord): Teilnehmer {
  return {
    id: t.id,
    truppId: t.truppId,
    name: t.name,
    ff: t.ff,
    rolle: t.rolle ?? null,
    joinedAt: t.joinedAt,
    checkliste: t.checkliste,
  };
}

export function toRessource(r: RessourceRecord): Ressource {
  return { id: r.id, truppId: r.truppId, name: r.name, standort: r.standort };
}

export function toTermin(t: TerminRecord): Termin {
  return {
    id: t.id,
    truppId: t.truppId,
    typ: t.typ,
    titel: t.titel,
    start: t.start,
    ende: t.ende,
    teilnehmerIds: t.teilnehmerIds,
    ressourceId: t.ressourceId,
    createdBy: t.createdBy,
  };
}

export function toErgebnis(e: ErgebnisRecord): StationErgebnis {
  return {
    stationId: e.stationId,
    zeitSekunden: e.zeitSekunden,
    fehlerpunkte: e.fehlerpunkte,
    teile: e.teile,
    bestanden: e.bestanden,
    aufgenommenAm: e.aufgenommenAm,
  };
}
