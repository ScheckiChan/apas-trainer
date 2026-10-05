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

/** Which checklist items apply to a Rolle. GKDT does not require Tauglichkeit. */
export function isChecklistItemRequired(rolle: Rolle, item: ChecklistItem): boolean {
  if (item === 'tauglichkeit' && rolle === 'GKDT') return false;
  return true;
}

export function requiredChecklistItems(rolle: Rolle): ChecklistItem[] {
  return CHECKLIST_ITEMS.filter((i) => isChecklistItemRequired(rolle, i));
}

/** Ampel: gruen = all required ok, gelb = some ok, rot = none ok. */
export type Ampel = 'gruen' | 'gelb' | 'rot';

export function checklistAmpel(rolle: Rolle, checkliste: Checkliste): Ampel {
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

export interface Gruppe {
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

export interface GruppeSummary extends Gruppe {
  teilnehmerCount: number;
  bereitCount: number;
}

export interface Teilnehmer {
  id: string;
  gruppeId: string;
  name: string;
  ff: string;
  rolle: Rolle;
  /** Only present for the Ausbildungsleiter or the Teilnehmer themself. */
  email?: string;
  emailVerified: boolean;
  joinedAt: string;
  checkliste: Checkliste;
}

export interface Ressource {
  id: string;
  gruppeId: string;
  name: string;
  standort: string;
}

export type TerminTyp = 'fix' | 'individual';

export interface Termin {
  id: string;
  gruppeId: string;
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
// API payloads
// ---------------------------------------------------------------------------

export interface LoginResponse {
  token: string;
  leiter: Ausbildungsleiter;
}

export interface TeilnehmerSession {
  token: string;
  teilnehmer: Teilnehmer;
  gruppe: Gruppe;
}

export interface JoinInfo {
  gruppeName: string;
  pruefungstermin?: string | null;
}

export interface JoinRequest {
  name: string;
  ff: string;
  rolle: Rolle;
  email: string;
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
