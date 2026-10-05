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
// Wochentage / Trainingspräferenz
// ---------------------------------------------------------------------------

/** The 7 weekdays, Monday-first (same order as the Kalender's week grid). Canonical storage order. */
export const WOCHENTAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const;
export type Wochentag = (typeof WOCHENTAGE)[number];

export const WOCHENTAG_LABELS: Record<Wochentag, string> = {
  montag: 'Montag',
  dienstag: 'Dienstag',
  mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag',
  freitag: 'Freitag',
  samstag: 'Samstag',
  sonntag: 'Sonntag',
};

/** Two-letter labels — identical to the Kalender's column headers (Mo, Di, …). */
export const WOCHENTAG_KURZ: Record<Wochentag, string> = {
  montag: 'Mo',
  dienstag: 'Di',
  mittwoch: 'Mi',
  donnerstag: 'Do',
  freitag: 'Fr',
  samstag: 'Sa',
  sonntag: 'So',
};

export function isWochentag(v: unknown): v is Wochentag {
  return typeof v === 'string' && (WOCHENTAGE as readonly string[]).includes(v);
}

/** Valid weekdays only, deduplicated, in canonical Monday-first order. */
export function normalisiereWochentage(tage: readonly unknown[]): Wochentag[] {
  const set = new Set(tage.filter(isWochentag));
  return WOCHENTAGE.filter((t) => set.has(t));
}

/** Weekday of a date in the local time zone of the caller (browser: the user's local time). */
export function wochentagVon(date: Date): Wochentag {
  // getDay(): 0 = Sonntag … 6 = Samstag → shift to Monday-first.
  return WOCHENTAGE[(date.getDay() + 6) % 7]!;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Login-E-Mail
// ---------------------------------------------------------------------------

/**
 * Domain of the placeholder addresses (`<id>@ohne-email.lokal`) the migration gives accounts
 * that had no e-mail on file. Not deliverable (`.lokal` is no real TLD) and rejected as
 * user input, so an Ausbilder can spot and replace them in the Benutzerverwaltung.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'ohne-email.lokal';

/** true for a migration placeholder address — flag it in the UI, never present it as real. */
export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/**
 * One account = one global identity. `email` is the login identifier (unique instance-wide,
 * stored lowercase); `name` is only the display name (not unique). Trupp membership and
 * the Trupp-internal APAS-Rolle are optional.
 *
 * Only ever delivered for the signed-in account itself (GET /auth/me & co.) — other people's
 * e-mail addresses are visible to Ausbilder in the Benutzerverwaltung only.
 */
export interface Benutzer {
  id: string;
  /** Login identifier, lowercase. May be a placeholder (see isPlaceholderEmail). */
  email: string;
  /** Display name — not unique. */
  name: string;
  /** Freiwillige Feuerwehr — null if never given (self-registration doesn't ask for it). */
  ff: string | null;
  systemRolle: SystemRolle;
  /** null = not (yet) attached to a Trupp. */
  truppId: string | null;
  /** APAS-Rolle within the Trupp; always null without a Trupp. */
  rolle: Rolle | null;
  /**
   * Truppsuche: the APAS-Rolle this person WANTS to play once grouped into a new Trupp.
   * Only meaningful without a Trupp — always null while truppId is set (cleared on every
   * way into a Trupp). Set via PATCH /benutzer/me/gewuenschte-rolle.
   */
  gewuenschteRolle: Rolle | null;
  checkliste: Checkliste;
  /**
   * Self-reported preferred training days, Monday-first, no duplicates. [] = no preference
   * set (NOT "every day"). Informational only — never restricts Termin assignment or RSVP.
   * Only the account itself can change it (PUT /auth/me/trainingspraeferenz).
   */
  trainingspraeferenz: Wochentag[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Trupp-Identität (self-chosen display name + mascot icon, just for fun)
// ---------------------------------------------------------------------------

/**
 * The curated icons a Trupp may pick as its mascot. Lucide icon ids (same set and names as
 * apps/web Icon.tsx). The API rejects anything else, so a stored icon always renders.
 * Feuerwehr-flavoured plus a few generic team/mascot symbols; deliberately no skulls,
 * weapons or other imagery that reads wrong in a rescue-service training context.
 */
export const TRUPP_ICONS = [
  'flame',
  'fire-extinguisher',
  'droplets',
  'siren',
  'axe',
  'shield',
  'zap',
  'target',
  'trophy',
  'crown',
  'rocket',
  'mountain',
  'anchor',
  'star',
  'bird',
  'dog',
] as const;
export type TruppIcon = (typeof TRUPP_ICONS)[number];

export const isTruppIcon = (v: unknown): v is TruppIcon =>
  typeof v === 'string' && (TRUPP_ICONS as readonly string[]).includes(v);

/**
 * Shown while a Trupp hasn't picked an icon (`Trupp.icon === null`). Intentionally NOT part
 * of TRUPP_ICONS: the neutral "group of people" icon means "nothing chosen yet" and can't be
 * picked, so a chosen mascot is always distinguishable from the default.
 */
export const DEFAULT_TRUPP_ICON = 'users' as const;

/** Max length of a Trupp name (create, Ausbilder edit and self-service rename alike). */
export const TRUPP_NAME_MAX = 40;

/** The icon to display for a Trupp: its chosen one, else DEFAULT_TRUPP_ICON. */
export function truppIconOrDefault(icon: TruppIcon | null | undefined): TruppIcon | typeof DEFAULT_TRUPP_ICON {
  return icon ?? DEFAULT_TRUPP_ICON;
}

/**
 * Who may change a Trupp's name/icon (PATCH /trupps/:id/identitaet): every Ausbilder, and
 * Teilnehmer who are members of that Trupp. Prüfer and members of other Trupps may not.
 */
export function kannTruppIdentitaetBearbeiten(
  benutzer: { systemRolle: SystemRolle; truppId: string | null },
  truppId: string,
): boolean {
  if (benutzer.systemRolle === 'ausbilder') return true;
  return benutzer.systemRolle === 'teilnehmer' && benutzer.truppId === truppId;
}

export interface Trupp {
  id: string;
  name: string;
  /** Self-chosen mascot icon; null = not chosen yet (render DEFAULT_TRUPP_ICON). */
  icon: TruppIcon | null;
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

/** An account seen as a member of a Trupp (GET /trupps/:id/teilnehmer and friends). No e-mail (visible to other members). */
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
  /**
   * Fixtermine only: Benutzer ids who confirmed "anwesend" themselves (or were marked by an
   * Ausbilder) — separate from the assigned teilnehmerIds. Always [] for Individualübungen.
   */
  anwesendIds: string[];
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
  /** The Trupp's chosen icon; null if no Trupp or none chosen yet. */
  truppIcon: TruppIcon | null;
  /** The person's self-reported preferred days ([] = none set → show no hint). Informational only. */
  trainingspraeferenz: Wochentag[];
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
  /** null = not chosen yet (render DEFAULT_TRUPP_ICON). */
  truppIcon: TruppIcon | null;
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
  trupps: readonly {
    truppId: string;
    truppName: string;
    truppIcon: TruppIcon | null;
    eigen: boolean;
    ergebnisse: readonly StationErgebnis[];
  }[],
): StationRangliste[] {
  return STATION_IDS.map((stationId) => {
    const eintraege = trupps.flatMap((t): RanglistenEintrag[] => {
      const ergebnis = t.ergebnisse.find((e) => e.stationId === stationId);
      return ergebnis
        ? [{ truppId: t.truppId, truppName: t.truppName, truppIcon: t.truppIcon, eigen: t.eigen, ergebnis, rang: 0 }]
        : [];
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

/**
 * PUT /auth/me/trainingspraeferenz — the signed-in account sets its own preferred days
 * (any systemRolle). Full replacement; [] clears it. Duplicates are dropped and the stored
 * order is canonical (Monday-first). Responds with MeResponse.
 */
export interface TrainingspraeferenzUpdate {
  tage: Wochentag[];
}

/** POST /auth/login, POST /auth/registrieren, POST /trupps/:inviteToken/join. */
export interface AuthSession extends MeResponse {
  token: string;
}

/** POST /auth/login — one login for every systemRolle. `email` is case-insensitive. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /auth/registrieren — creates a `teilnehmer` account without a Trupp. */
export interface RegistrierenRequest {
  email: string;
  /** Display name. */
  name: string;
  password: string;
  /** Home Feuerwehr — required (cross-FF event). */
  ff: string;
}

export interface JoinInfo {
  truppName: string;
  truppIcon: TruppIcon | null;
  pruefungstermin?: string | null;
}

/**
 * GET /trupps/waehlbar — one Trupp as offered to a Teilnehmer without Trupp for self-service
 * joining (POST /trupps/waehlbar/:truppId/beitreten). No invite token, no member names.
 */
export interface TruppWahl {
  id: string;
  name: string;
  icon: TruppIcon | null;
  pruefungstermin: string | null;
  teilnehmerCount: number;
  /** ROLLEN with nobody holding them yet, in ROLLEN order. */
  offeneRollen: Rolle[];
  /** ROLLEN with at least one holder, in ROLLEN order (duplicates are allowed, so still joinable). */
  besetzteRollen: Rolle[];
}

// ---------------------------------------------------------------------------
// Truppsuche — Trupp-less Teilnehmer group themselves into a NEW Trupp
// ---------------------------------------------------------------------------

/** Min/max people (initiator included) in one POST /truppsuche/trupp. */
export const TRUPPSUCHE_MIN_PERSONEN = 2;
export const TRUPPSUCHE_MAX_PERSONEN = 6;

/** PATCH /benutzer/me/gewuenschte-rolle — null clears it. Response: MeResponse. */
export interface GewuenschteRolleUpdate {
  gewuenschteRolle: Rolle | null;
}

/** One waiting person in GET /truppsuche. Deliberately no Checkliste, no e-mail. */
export interface TruppsuchePerson {
  id: string;
  name: string;
  ff: string | null;
  gewuenschteRolle: Rolle;
}

/** GET /truppsuche */
export interface TruppsucheResponse {
  /** The caller's own Wunschrolle (null = not set, caller is then not listed for others). */
  eigeneGewuenschteRolle: Rolle | null;
  /**
   * OTHER Trupp-less Teilnehmer with a Wunschrolle (caller excluded), sorted by
   * gewuenschteRolle in ROLLEN order, then name.
   */
  personen: TruppsuchePerson[];
}

/**
 * POST /truppsuche/trupp — the OTHER people to form a new Trupp with (the caller is added
 * implicitly). Response 201: MeResponse (caller now in the new Trupp).
 */
export interface TruppsucheTruppRequest {
  benutzerIds: string[];
}

/** POST /trupps/:inviteToken/join — new account, already a member of that Trupp. */
export interface JoinRequest {
  email: string;
  name: string;
  ff: string;
  password: string;
}

/** Ausbilder creates a new account directly in a Trupp (POST /trupps/:id/teilnehmer). */
export interface TeilnehmerCreateRequest {
  /** Login of the new account. */
  email: string;
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
  /** Login identifier, lowercase. May be a placeholder (see isPlaceholderEmail). */
  email: string;
  name: string;
  ff: string | null;
  systemRolle: SystemRolle;
  trupp: { id: string; name: string; icon: TruppIcon | null } | null;
  createdAt: string;
}

/**
 * PATCH /trupps/:id/identitaet — self-service name/icon (Ausbilder or a member of that
 * Trupp). At least one field. `icon: null` resets to "not chosen".
 */
export interface TruppIdentitaetUpdate {
  name?: string;
  icon?: TruppIcon | null;
}

/** PATCH /benutzer/:id/systemrolle */
export interface SystemRolleUpdate {
  systemRolle: SystemRolle;
}

/** PATCH /benutzer/:id/email — Ausbilder only. Must be unique; placeholder domain is rejected. */
export interface BenutzerEmailUpdate {
  email: string;
}

/** PATCH /benutzer/:id/name — Ausbilder only. Display name, not unique. */
export interface BenutzerNameUpdate {
  name: string;
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
