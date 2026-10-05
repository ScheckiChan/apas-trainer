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
// Systemrollen (account level) — NOT the Trupp-internal APAS-Rolle above
// ---------------------------------------------------------------------------

/**
 * What an account may do in the app. Completely separate from `Rolle` (GKDT, ATF/ATM1, …),
 * which is the position a person holds inside their Trupp for the exam. A `teilnehmer`
 * account can hold any APAS-Rolle; an `ausbilder` or `pruefer` usually holds none.
 */
export const SYSTEM_ROLLEN = ['ausbilder', 'pruefer', 'teilnehmer'] as const;
export type SystemRolle = (typeof SYSTEM_ROLLEN)[number];

export const SYSTEM_ROLLE_LABELS: Record<SystemRolle, string> = {
  ausbilder: 'Ausbilder',
  pruefer: 'Prüfer',
  teilnehmer: 'Teilnehmer',
};

/**
 * "Ergebnis speichern" rule, shared by API and web: Ausbilder and Prüfer may save for any
 * Trupp, a Teilnehmer only for the Trupp they belong to.
 */
export function kannErgebnisSpeichern(
  benutzer: { systemRolle: SystemRolle; truppId: string | null },
  truppId: string,
): boolean {
  return benutzer.systemRolle !== 'teilnehmer' || benutzer.truppId === truppId;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

/**
 * One account = one global identity. `name` is both the display name and the login
 * identifier (unique instance-wide, compared case-insensitively). Trupp membership and
 * the Trupp-internal APAS-Rolle are optional.
 */
export interface Benutzer {
  id: string;
  name: string;
  /** Freiwillige Feuerwehr — null if never given (self-registration doesn't ask for it). */
  ff: string | null;
  systemRolle: SystemRolle;
  /** null = not (yet) attached to a Trupp. */
  truppId: string | null;
  /** APAS-Rolle within the Trupp; always null without a Trupp. */
  rolle: Rolle | null;
  checkliste: Checkliste;
  createdAt: string;
}

export interface Trupp {
  id: string;
  name: string;
  stufe: Stufe;
  /** ISO date (YYYY-MM-DD) */
  pruefungstermin?: string | null;
  /** Id of the Ausbilder account that created the Trupp (informational — every Ausbilder manages every Trupp). */
  ownerId: string;
  /** Only present for Ausbilder. */
  inviteToken?: string;
  createdAt: string;
}

export interface TruppSummary extends Trupp {
  teilnehmerCount: number;
  bereitCount: number;
  /** How many of the ROLLEN have at least one holder (0..ROLLEN.length). */
  rollenBesetzt: number;
}

/** An account seen as a member of a Trupp (GET /trupps/:id/teilnehmer and friends). */
export interface Teilnehmer {
  /** Same id as the Benutzer account. */
  id: string;
  truppId: string;
  name: string;
  ff: string | null;
  systemRolle: SystemRolle;
  /** APAS-Rolle, assigned in the Trupp at any time (not at join). null = noch keine Rolle. */
  rolle: Rolle | null;
  /** When the account was attached to this Trupp. */
  joinedAt: string;
  checkliste: Checkliste;
}

/** Instance-wide: shared by every Trupp of this Ausbildung (e.g. the one vehicle). */
export interface Ressource {
  id: string;
  name: string;
  standort: string;
}

export type TerminTyp = 'fix' | 'individual';

/** Instance-wide: one shared calendar for all Trupps of this Ausbildung. */
export interface Termin {
  id: string;
  typ: TerminTyp;
  titel: string;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  ende: string;
  /** Benutzer ids (any Trupp, or none). */
  teilnehmerIds: string[];
  ressourceId?: string | null;
  /** Benutzer id of the creator. Termine created before the unified accounts may hold 'ausbildungsleiter'. */
  createdBy: string;
}

/**
 * An account as listed in the shared calendar's picker (GET /termine/personen): only what
 * is needed to assign people across Trupps — no Checkliste. Accounts without a Trupp are
 * included with truppId/truppName null.
 */
export interface KalenderPerson {
  id: string;
  name: string;
  ff: string | null;
  systemRolle: SystemRolle;
  rolle: Rolle | null;
  truppId: string | null;
  truppName: string | null;
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
  /** The Trupp the calling account belongs to (false for every row if it has no Trupp). */
  eigen: boolean;
  /** This Trupp's latest recorded run at the station. */
  ergebnis: StationErgebnis;
  /** 1-based rank by Zeit; equal times share a rank (1, 1, 3). */
  rang: number;
}

/** GET /rangliste: one leaderboard per station, in STATION_IDS order. */
export interface StationRangliste {
  stationId: StationId;
  /** Only Trupps with a recorded result for this station, fastest first. */
  eintraege: RanglistenEintrag[];
}

/**
 * Per-station leaderboards: every Trupp with a result for a station is ranked there by Zeit
 * (fastest first; for Station 4 the sum of both Teile). Fehlerpunkte and bestanden are shown
 * alongside but don't move a Trupp — they only break the order within an equal time.
 */
export function stationsRanglisten(
  trupps: readonly { truppId: string; truppName: string; eigen: boolean; ergebnisse: readonly StationErgebnis[] }[],
): StationRangliste[] {
  return STATION_IDS.map((stationId) => {
    const eintraege = trupps.flatMap((t): RanglistenEintrag[] => {
      const ergebnis = t.ergebnisse.find((e) => e.stationId === stationId);
      return ergebnis ? [{ truppId: t.truppId, truppName: t.truppName, eigen: t.eigen, ergebnis, rang: 0 }] : [];
    });
    eintraege.sort(
      (a, b) =>
        a.ergebnis.zeitSekunden - b.ergebnis.zeitSekunden ||
        a.ergebnis.fehlerpunkte - b.ergebnis.fehlerpunkte ||
        a.truppName.localeCompare(b.truppName, 'de'),
    );
    eintraege.forEach((r, i) => {
      const prev = eintraege[i - 1];
      r.rang = prev && prev.ergebnis.zeitSekunden === r.ergebnis.zeitSekunden ? prev.rang : i + 1;
    });
    return { stationId, eintraege };
  });
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

/** GET /auth/me — the signed-in account, resolved from storage on every call. */
export interface MeResponse {
  benutzer: Benutzer;
  /** The account's Trupp (null without membership). `inviteToken` only for Ausbilder. */
  trupp: Trupp | null;
}

/** POST /auth/login, POST /auth/registrieren, POST /trupps/:inviteToken/join. */
export interface AuthSession extends MeResponse {
  token: string;
}

/** POST /auth/login — one login for every systemRolle. `name` is case-insensitive. */
export interface LoginRequest {
  name: string;
  password: string;
}

/** POST /auth/registrieren — creates a `teilnehmer` account without a Trupp. */
export interface RegistrierenRequest {
  name: string;
  password: string;
  ff?: string | null;
}

export interface JoinInfo {
  truppName: string;
  pruefungstermin?: string | null;
}

/** POST /trupps/:inviteToken/join — new account, already a member of that Trupp. */
export interface JoinRequest {
  name: string;
  ff: string;
  password: string;
}

/** Ausbilder creates a new account directly in a Trupp (POST /trupps/:id/teilnehmer). */
export interface TeilnehmerCreateRequest {
  name: string;
  ff?: string | null;
}

export interface TeilnehmerCreateResponse {
  teilnehmer: Teilnehmer;
  /** Generated password in plaintext — returned exactly once, never stored or retrievable again. */
  tempPassword: string;
}

/** Ausbilder attaches an existing account without Trupp (POST /trupps/:id/teilnehmer/zuordnen). */
export interface TeilnehmerZuordnenRequest {
  benutzerId: string;
}

export interface RolleUpdate {
  rolle: Rolle | null;
}

/** One row of the Benutzerverwaltung (GET /benutzer, GET /benutzer/ohne-trupp). */
export interface BenutzerUebersicht {
  id: string;
  name: string;
  ff: string | null;
  systemRolle: SystemRolle;
  trupp: { id: string; name: string } | null;
  createdAt: string;
}

/** PATCH /benutzer/:id/systemrolle */
export interface SystemRolleUpdate {
  systemRolle: SystemRolle;
}

/** POST /benutzer/:id/passwort-zuruecksetzen */
export interface PasswortResetResponse {
  /** Plaintext, returned exactly once. */
  tempPassword: string;
}

// ---------------------------------------------------------------------------
// Instanz-Einstellungen (Branding)
// ---------------------------------------------------------------------------

export const WAPPEN_MAX_BYTES = 2 * 1024 * 1024;
export const WAPPEN_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export type WappenContentType = (typeof WAPPEN_CONTENT_TYPES)[number];

export interface WappenInfo {
  /**
   * API path of the image incl. cache-busting version, relative to the API base like every
   * other api() path, e.g. "/einstellungen/wappen?v=1759660800000" → fetch/show it as
   * `${API_BASE}/api${pfad}`.
   */
  pfad: string;
  contentType: WappenContentType;
  /** ISO datetime of the last upload. */
  aktualisiertAm: string;
}

/** GET /einstellungen (public). */
export interface Einstellungen {
  fuehrendeFeuerwehr: string | null;
  /** null = no Wappen uploaded → show nothing. */
  wappen: WappenInfo | null;
}

/** PUT /einstellungen — empty string or null clears the name. */
export interface EinstellungenUpdate {
  fuehrendeFeuerwehr: string | null;
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
