import type {
  Benutzer,
  BenutzerUebersicht,
  Einstellungen,
  Ressource,
  StationErgebnis,
  Teilnehmer,
  Termin,
  Trupp,
} from '@apas/shared';
import type {
  BenutzerRecord,
  EinstellungenRecord,
  ErgebnisRecord,
  MitgliedRecord,
  RessourceRecord,
  TerminRecord,
  TruppRecord,
} from './db.js';

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

export function toBenutzer(b: BenutzerRecord): Benutzer {
  return {
    id: b.id,
    name: b.name,
    ff: b.ff,
    systemRolle: b.systemRolle,
    truppId: b.truppId,
    rolle: b.truppId ? (b.rolle ?? null) : null,
    checkliste: b.checkliste,
    createdAt: b.createdAt,
  };
}

/** An account in its role as member of a Trupp. */
export function toTeilnehmer(b: MitgliedRecord): Teilnehmer {
  return {
    id: b.id,
    truppId: b.truppId,
    name: b.name,
    ff: b.ff,
    systemRolle: b.systemRolle,
    rolle: b.rolle ?? null,
    joinedAt: b.joinedAt ?? b.createdAt,
    checkliste: b.checkliste,
  };
}

export function toBenutzerUebersicht(b: BenutzerRecord, truppName: ReadonlyMap<string, string>): BenutzerUebersicht {
  return {
    id: b.id,
    name: b.name,
    ff: b.ff,
    systemRolle: b.systemRolle,
    trupp: b.truppId ? { id: b.truppId, name: truppName.get(b.truppId) ?? '—' } : null,
    createdAt: b.createdAt,
  };
}

export function toRessource(r: RessourceRecord): Ressource {
  return { id: r.id, name: r.name, standort: r.standort };
}

export function toTermin(t: TerminRecord): Termin {
  return {
    id: t.id,
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

export function toEinstellungen(e: EinstellungenRecord | undefined): Einstellungen {
  const w = e?.wappen;
  return {
    fuehrendeFeuerwehr: e?.fuehrendeFeuerwehr ?? null,
    wappen: w
      ? {
          pfad: `/einstellungen/wappen?v=${new Date(w.aktualisiertAm).getTime()}`,
          contentType: w.contentType,
          aktualisiertAm: w.aktualisiertAm,
        }
      : null,
  };
}
