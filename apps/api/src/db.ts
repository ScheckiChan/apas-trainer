import type { Checkliste, Rolle, StationId, Stufe, TeilErgebnis, TerminTyp } from '@apas/shared';
import { config } from './config.js';
import { JsonCollection } from './lib/store.js';

// Stored record shapes (may contain server-only fields such as hashes).

export interface LeiterRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface TruppRecord {
  id: string;
  name: string;
  stufe: Stufe;
  pruefungstermin: string | null;
  ownerId: string;
  inviteToken: string;
  createdAt: string;
}

export interface TeilnehmerRecord {
  id: string;
  truppId: string;
  name: string;
  ff: string;
  rolle: Rolle | null;
  /** bcrypt hash. Missing only on legacy records from the magic-link era (claimable via join). */
  passwordHash?: string;
  joinedAt: string;
  checkliste: Checkliste;
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
  ressourceId: string | null;
  createdBy: string;
  createdAt: string;
}

export type PushOwner = { kind: 'leiter'; id: string } | { kind: 'teilnehmer'; id: string };

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
  /** Ausbildungsleiter id */
  aufgenommenVon: string;
}

const dir = config.dataDir;

export const db = {
  leiter: new JsonCollection<LeiterRecord>(dir, 'ausbildungsleiter'),
  trupps: new JsonCollection<TruppRecord>(dir, 'trupps'),
  teilnehmer: new JsonCollection<TeilnehmerRecord>(dir, 'teilnehmer'),
  ressourcen: new JsonCollection<RessourceRecord>(dir, 'ressourcen'),
  termine: new JsonCollection<TerminRecord>(dir, 'termine'),
  pushSubscriptions: new JsonCollection<PushSubscriptionRecord>(dir, 'pushsubscriptions'),
  reminders: new JsonCollection<ReminderRecord>(dir, 'reminders'),
  ergebnisse: new JsonCollection<ErgebnisRecord>(dir, 'ergebnisse'),
};
