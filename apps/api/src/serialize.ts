import {
  isTruppIcon,
  normalisiereWochentage,
  type Benutzer,
  type BenutzerUebersicht,
  type Einstellungen,
  type Ressource,
  type StationErgebnis,
  type Teilnehmer,
  type Termin,
  type Trupp,
  type TruppIcon,
  type Wochentag,
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

/**
 * The stored icon if it is (still) one of TRUPP_ICONS, else null — so a missing field
 * (pre-migration record) or a hand-edited bogus value never reaches the frontend.
 */
export function truppIconOf(trupp: Pick<TruppRecord, 'icon'> | undefined): TruppIcon | null {
  const icon = trupp?.icon;
  return isTruppIcon(icon) ? icon : null;
}

export function toTrupp(trupp: TruppRecord, opts: { includeInvite: boolean }): Trupp {
  return {
    id: trupp.id,
    name: trupp.name,
    icon: truppIconOf(trupp),
    stufe: trupp.stufe,
    pruefungstermin: trupp.pruefungstermin,
    ownerId: trupp.ownerId,
    createdAt: trupp.createdAt,
    ...(opts.includeInvite ? { inviteToken: trupp.inviteToken } : {}),
  };
}

/**
 * Stored preferred days, defensively normalised (valid weekdays, deduped, Monday-first) so a
 * pre-migration record (field missing) or a hand-edited value never reaches the frontend.
 */
export function trainingspraeferenzOf(b: Pick<BenutzerRecord, 'trainingspraeferenz'>): Wochentag[] {
  return Array.isArray(b.trainingspraeferenz) ? normalisiereWochentage(b.trainingspraeferenz) : [];
}

/** Own account only (incl. e-mail) — never for lists other Teilnehmer see. */
export function toBenutzer(b: BenutzerRecord): Benutzer {
  return {
    id: b.id,
    email: b.email,
    name: b.name,
    ff: b.ff,
    systemRolle: b.systemRolle,
    truppId: b.truppId,
    rolle: b.truppId ? (b.rolle ?? null) : null,
    gewuenschteRolle: b.truppId ? null : (b.gewuenschteRolle ?? null),
    checkliste: b.checkliste,
    trainingspraeferenz: trainingspraeferenzOf(b),
    createdAt: b.createdAt,
  };
}

/** An account in its role as member of a Trupp. Deliberately without e-mail (other members see it). */
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

/** Benutzerverwaltung row (Ausbilder only) — includes the e-mail. */
export function toBenutzerUebersicht(b: BenutzerRecord, trupps: ReadonlyMap<string, TruppRecord>): BenutzerUebersicht {
  const trupp = b.truppId ? trupps.get(b.truppId) : undefined;
  return {
    id: b.id,
    email: b.email,
    name: b.name,
    ff: b.ff,
    systemRolle: b.systemRolle,
    trupp: b.truppId ? { id: b.truppId, name: trupp?.name ?? '—', icon: truppIconOf(trupp) } : null,
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
    // Defensive: records written before migrateAnwesend lack the field.
    anwesendIds: t.typ === 'fix' ? (t.anwesendIds ?? []) : [],
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
