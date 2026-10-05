import type {
  Checkliste,
  Rolle,
  StationId,
  Stufe,
  SystemRolle,
  TeilErgebnis,
  TerminTyp,
  TruppIcon,
  WappenContentType,
} from '@apas/shared';
import { config } from './config.js';
import { JsonCollection } from './lib/store.js';

// Stored record shapes (may contain server-only fields such as hashes).

/**
 * One account per person (benutzer.json) — replaces the former ausbildungsleiter.json and
 * teilnehmer.json (see migrateBenutzer in migrate.ts; ids were kept). `email` is the login
 * identifier (lowercase, unique instance-wide by emailKey(); migrateEmail backfilled it,
 * possibly as a `<id>@ohne-email.lokal` placeholder). `name` is a plain display name.
 */
export interface BenutzerRecord {
  id: string;
  email: string;
  name: string;
  /** bcrypt hash. Missing only on legacy records from the magic-link era (claimable via join). */
  passwordHash?: string;
  systemRolle: SystemRolle;
  ff: string | null;
  truppId: string | null;
  /** APAS-Rolle inside the Trupp; null whenever truppId is null. */
  rolle: Rolle | null;
  checkliste: Checkliste;
  createdAt: string;
  /** When attached to the current Trupp; null without a Trupp. */
  joinedAt: string | null;
}

/** A BenutzerRecord that is a member of a Trupp. */
export type MitgliedRecord = BenutzerRecord & { truppId: string };

export const istMitglied = (b: BenutzerRecord): b is MitgliedRecord => b.truppId !== null;

export interface TruppRecord {
  id: string;
  name: string;
  /** Self-chosen mascot icon (null = not chosen). Missing on records older than migrateTruppIcon. */
  icon?: TruppIcon | null;
  stufe: Stufe;
  pruefungstermin: string | null;
  /** Creating Ausbilder (informational). */
  ownerId: string;
  inviteToken: string;
  createdAt: string;
}

/** Instance-wide, not attached to a Trupp. */
export interface RessourceRecord {
  id: string;
  name: string;
  standort: string;
}

/** Instance-wide: one shared calendar; teilnehmerIds may span Trupps. */
export interface TerminRecord {
  id: string;
  typ: TerminTyp;
  titel: string;
  start: string;
  ende: string;
  teilnehmerIds: string[];
  /**
   * Fixtermine only: self-RSVP ("anwesend"), separate from the assigned teilnehmerIds.
   * Always [] for Individualübungen. Added by migrateAnwesend for older records.
   */
  anwesendIds: string[];
  ressourceId: string | null;
  createdBy: string;
  createdAt: string;
}

/** Before the unified accounts this was 'leiter' | 'teilnehmer'; migrateBenutzer rewrites old records. */
export type PushOwner = { kind: 'benutzer'; id: string };

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  owner: PushOwner;
  createdAt: string;
}

/** Marks a reminder as sent. Keyed by termin + start so moving a Termin re-arms it. */
export interface ReminderRecord {
  id: string;
  terminId: string;
  start: string;
  sentAt: string;
}

/** Latest result of one Trupp at one station. id = `${truppId}:${stationId}`, so a save overwrites. */
export interface ErgebnisRecord {
  id: string;
  truppId: string;
  stationId: StationId;
  zeitSekunden: number;
  fehlerpunkte: number;
  teile: TeilErgebnis[];
  bestanden: boolean;
  aufgenommenAm: string;
  /** Benutzer id of whoever saved it (Ausbilder, Prüfer or Teilnehmer) */
  aufgenommenVon: string;
}

/** Single record, id EINSTELLUNGEN_ID. The Wappen file itself lives next to the JSON files. */
export interface EinstellungenRecord {
  id: string;
  fuehrendeFeuerwehr: string | null;
  wappen: { datei: string; contentType: WappenContentType; aktualisiertAm: string } | null;
}

export const EINSTELLUNGEN_ID = 'instanz';

const dir = config.dataDir;

export const db = {
  benutzer: new JsonCollection<BenutzerRecord>(dir, 'benutzer'),
  trupps: new JsonCollection<TruppRecord>(dir, 'trupps'),
  ressourcen: new JsonCollection<RessourceRecord>(dir, 'ressourcen'),
  termine: new JsonCollection<TerminRecord>(dir, 'termine'),
  pushSubscriptions: new JsonCollection<PushSubscriptionRecord>(dir, 'pushsubscriptions'),
  reminders: new JsonCollection<ReminderRecord>(dir, 'reminders'),
  ergebnisse: new JsonCollection<ErgebnisRecord>(dir, 'ergebnisse'),
  einstellungen: new JsonCollection<EinstellungenRecord>(dir, 'einstellungen'),
};
