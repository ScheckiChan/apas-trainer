// Types and small pure helpers shared between apps/api and apps/web.

/** Prüfungsstufe — v1 only supports Bronze, kept as a field so Silber/Gold can be added cheaply. */
export type Stufe = 'BRONZE';

// ---------------------------------------------------------------------------
// Rollen
// ---------------------------------------------------------------------------

export const ROLLEN = ['GKDT', 'ATF_ATM1', 'ATM2', 'WASSERTRUPPFUEHRER'] as const;
export type Rolle = (typeof ROLLEN)[number];

export const ROLLE_LABELS: Record<Rolle, string> = {
  GKDT: 'Gruppenkommandant (GKDT)',
  ATF_ATM1: 'Atemschutztruppführer (ATF / ATM 1)',
  ATM2: 'Atemschutztruppmann (ATM 2)',
  WASSERTRUPPFUEHRER: 'Wassertruppführer',
};

export const ROLLE_SHORT: Record<Rolle, string> = {
  GKDT: 'GKDT',
  ATF_ATM1: 'ATF/ATM1',
  ATM2: 'ATM2',
  WASSERTRUPPFUEHRER: 'WTF',
};

/** How many Teilnehmer currently hold each Rolle. Duplicates are allowed (Ergänzungsteilnehmer). */
export function rollenBesetzung(teilnehmer: readonly { rolle: Rolle | null }[]): Record<Rolle, number> {
  const counts = Object.fromEntries(ROLLEN.map((r) => [r, 0])) as Record<Rolle, number>;
  for (const t of teilnehmer) if (t.rolle) counts[t.rolle]++;
  return counts;
}

// ---------------------------------------------------------------------------
// Checkliste
// ---------------------------------------------------------------------------

export type CheckStatus = 'ok' | 'offen';

export interface Checkliste {
  at: CheckStatus;
  ats3: CheckStatus;
  tauglichkeit: CheckStatus;
}

export type ChecklistItem = keyof Checkliste;

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = ['at', 'ats3', 'tauglichkeit'] as const;

export const CHECKLIST_LABELS: Record<ChecklistItem, string> = {
  at: 'AT',
  ats3: 'ATS3',
  tauglichkeit: 'Tauglichkeit',
};

export const EMPTY_CHECKLISTE: Checkliste = { at: 'offen', ats3: 'offen', tauglichkeit: 'offen' };

/**
 * Which checklist items apply to a Rolle. Whoever currently holds GKDT does not need
 * Tauglichkeit; without a Rolle (null) every item is required.
 */
export function isChecklistItemRequired(rolle: Rolle | null, item: ChecklistItem): boolean {
  if (item === 'tauglichkeit' && rolle === 'GKDT') return false;
  return true;
}

export function requiredChecklistItems(rolle: Rolle | null): ChecklistItem[] {
  return CHECKLIST_ITEMS.filter((i) => isChecklistItemRequired(rolle, i));
}

/** Ampel: gruen = all required ok, gelb = some ok, rot = none ok. */
export type Ampel = 'gruen' | 'gelb' | 'rot';

export function checklistAmpel(rolle: Rolle | null, checkliste: Checkliste): Ampel {
  const required = requiredChecklistItems(rolle);
  const done = required.filter((i) => checkliste[i] === 'ok').length;
  if (done === required.length) return 'gruen';
  if (done === 0) return 'rot';
  return 'gelb';
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Ausbildungsleiter {
  id: string;
  email: string;
}

export interface Trupp {
  id: string;
  name: string;
  stufe: Stufe;
  /** ISO date (YYYY-MM-DD) */
  pruefungstermin?: string | null;
  ownerId: string;
  /** Only present for the owning Ausbildungsleiter. */
  inviteToken?: string;
  createdAt: string;
}

export interface TruppSummary extends Trupp {
  teilnehmerCount: number;
  bereitCount: number;
  /** How many of the ROLLEN have at least one holder (0..ROLLEN.length). */
  rollenBesetzt: number;
}

export interface Teilnehmer {
  id: string;
  truppId: string;
  name: string;
  ff: string;
  /** Assigned in the Trupp at any time (not at join). null = noch keine Rolle. */
  rolle: Rolle | null;
  joinedAt: string;
  checkliste: Checkliste;
}

export interface Ressource {
  id: string;
  truppId: string;
  name: string;
  standort: string;
}

export type TerminTyp = 'fix' | 'individual';

export interface Termin {
  id: string;
  truppId: string;
  typ: TerminTyp;
  titel: string;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  ende: string;
  teilnehmerIds: string[];
  ressourceId?: string | null;
  /** teilnehmerId or 'ausbildungsleiter' */
  createdBy: string;
}

/** A Ressource booked by a Termin for a time window. */
export interface Buchung {
  terminId: string;
  ressourceId: string;
  start: string;
  ende: string;
}

export interface BuchungsKonflikt {
  terminId: string;
  titel: string;
  start: string;
  ende: string;
  ressourceId: string;
}

export function intervalsOverlap(aStart: string, aEnde: string, bStart: string, bEnde: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnde).getTime() &&
    new Date(bStart).getTime() < new Date(aEnde).getTime();
}

// ---------------------------------------------------------------------------
// Stationen: Bestehensregel, recorded results, Rangliste
// ---------------------------------------------------------------------------

export const STATION_IDS = ['ausruesten', 'personensuche', 'hindernisstrecke', 'geraeteversorgung'] as const;
export type StationId = (typeof STATION_IDS)[number];

export const isStationId = (v: string): v is StationId => (STATION_IDS as readonly string[]).includes(v);

/**
 * Fehlerpunkte limits per station from the NÖ LFV Bestimmungen APAS. Station 4 is scored as
 * two Teile (Geräteversorgung max. 5, Fragen max. 6), each with its own limit and time.
 * The web content tables read their `maxPunkte` from here.
 */
export const STATION_WERTUNG: Record<StationId, { titel: string; teile: { titel: string; maxPunkte: number }[] }> = {
  ausruesten: { titel: 'Ausrüsten', teile: [{ titel: 'Ausrüsten', maxPunkte: 20 }] },
  personensuche: { titel: 'Personensuche', teile: [{ titel: 'Personensuche', maxPunkte: 10 }] },
  hindernisstrecke: { titel: 'Hindernisstrecke', teile: [{ titel: 'Hindernisstrecke', maxPunkte: 10 }] },
  geraeteversorgung: {
    titel: 'Geräteversorgung + Fragen',
    teile: [
      { titel: 'Geräteversorgung', maxPunkte: 5 },
      { titel: 'Fragen', maxPunkte: 6 },
    ],
  },
};

/** Bestehensregel: at most 35 Fehlerpunkte over all stations (plus every station within its own limit). */
export const GESAMT_MAX_FEHLERPUNKTE = 35;

/** "Zeitüberschreitung: 2 Punkte je 10 Sek." — every started 10-second block counts. */
export const ZEIT_PUNKTE_JE_10_SEK = 2;

export function zeitueberschreitungPunkte(elapsedSek: number, sollSek: number): number {
  const over = Math.floor(elapsedSek) - sollSek;
  return over > 0 ? Math.ceil(over / 10) * ZEIT_PUNKTE_JE_10_SEK : 0;
}

/** A station is passed when every Teil stays within its own limit. */
export function stationBestanden(stationId: StationId, teilFehlerpunkte: readonly number[]): boolean {
  return STATION_WERTUNG[stationId].teile.every((t, i) => (teilFehlerpunkte[i] ?? 0) <= t.maxPunkte);
}

export interface TeilErgebnis {
  zeitSekunden: number;
  fehlerpunkte: number;
}

/** Latest recorded run of one Trupp at one station (only the latest is kept). */
export interface StationErgebnis {
  stationId: StationId;
  /** Sum over the Teile. */
  zeitSekunden: number;
  /** Sum over the Teile, including Zeitüberschreitung. */
  fehlerpunkte: number;
  /** One entry per Teil of STATION_WERTUNG[stationId]. */
  teile: TeilErgebnis[];
  bestanden: boolean;
  /** ISO datetime */
  aufgenommenAm: string;
}

/**
 * PUT /trupps/:id/ergebnisse/:stationId. `teile` is required for stations with more than one
 * Teil (Station 4) and must add up to the totals; single-Teil stations may omit it.
 */
export interface ErgebnisInput {
  zeitSekunden: number;
  fehlerpunkte: number;
  teile?: TeilErgebnis[];
}

export interface RanglistenEintrag {
  truppId: string;
  truppName: string;
  /** The calling Teilnehmer's own Trupp (always false for an Ausbildungsleiter, who usually owns them all). */
  eigen: boolean;
  /** Recorded stations in STATION_IDS order. */
  ergebnisse: StationErgebnis[];
  absolviert: number;
  vollstaendig: boolean;
  gesamtFehlerpunkte: number;
  /** Overall Bestehensregel on what is recorded so far — final only when `vollstaendig`. */
  bestanden: boolean;
  /** 1-based rank among complete Trupps (ties share a rank); null while incomplete. */
  rang: number | null;
}

/** Overall Bestehensregel: total ≤ 35 and no station over its own limit. */
export function gesamtBestanden(ergebnisse: readonly StationErgebnis[]): boolean {
  const total = ergebnisse.reduce((s, e) => s + e.fehlerpunkte, 0);
  return total <= GESAMT_MAX_FEHLERPUNKTE && ergebnisse.every((e) => e.bestanden);
}

/**
 * Ranking: complete Trupps first — passed before failed, then fewer Fehlerpunkte first.
 * Incomplete Trupps follow without a rank (more stations done first), so one great station
 * never outranks four solid ones.
 */
export function rangliste(
  trupps: readonly { truppId: string; truppName: string; eigen: boolean; ergebnisse: readonly StationErgebnis[] }[],
): RanglistenEintrag[] {
  const rows = trupps.map((t): RanglistenEintrag => {
    const ergebnisse = STATION_IDS.flatMap((id) => t.ergebnisse.filter((e) => e.stationId === id));
    return {
      truppId: t.truppId,
      truppName: t.truppName,
      eigen: t.eigen,
      ergebnisse,
      absolviert: ergebnisse.length,
      vollstaendig: ergebnisse.length === STATION_IDS.length,
      gesamtFehlerpunkte: ergebnisse.reduce((s, e) => s + e.fehlerpunkte, 0),
      bestanden: gesamtBestanden(ergebnisse),
      rang: null,
    };
  });

  const group = (r: RanglistenEintrag) => (!r.vollstaendig ? 2 : r.bestanden ? 0 : 1);
  rows.sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 2 ? b.absolviert - a.absolviert : 0) ||
      a.gesamtFehlerpunkte - b.gesamtFehlerpunkte ||
      a.truppName.localeCompare(b.truppName, 'de'),
  );

  rows.forEach((r, i) => {
    if (!r.vollstaendig) return;
    const prev = rows[i - 1];
    r.rang =
      prev && prev.vollstaendig && group(prev) === group(r) && prev.gesamtFehlerpunkte === r.gesamtFehlerpunkte
        ? prev.rang
        : i + 1;
  });
  return rows;
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export interface LoginResponse {
  token: string;
  leiter: Ausbildungsleiter;
}

export interface TeilnehmerSession {
  token: string;
  teilnehmer: Teilnehmer;
  trupp: Trupp;
}

export interface JoinInfo {
  truppName: string;
  pruefungstermin?: string | null;
}

export interface JoinRequest {
  name: string;
  ff: string;
  password: string;
}

/** Ausbildungsleiter adds a Teilnehmer directly (POST /trupps/:id/teilnehmer). */
export interface TeilnehmerCreateRequest {
  name: string;
  ff: string;
}

export interface TeilnehmerCreateResponse {
  teilnehmer: Teilnehmer;
  /** Generated password in plaintext — returned exactly once, never stored or retrievable again. */
  tempPassword: string;
}

export interface TeilnehmerLoginRequest {
  name: string;
  password: string;
}

export interface RolleUpdate {
  rolle: Rolle | null;
}

export interface TerminInput {
  typ: TerminTyp;
  titel: string;
  start: string;
  ende: string;
  teilnehmerIds: string[];
  ressourceId?: string | null;
}

export interface TerminSaveResponse {
  termin: Termin;
  konflikte: BuchungsKonflikt[];
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface ApiError {
  error: string;
  details?: unknown;
}
