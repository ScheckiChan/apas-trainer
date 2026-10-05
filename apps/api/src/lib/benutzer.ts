import { EMPTY_CHECKLISTE, isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN, type SystemRolle } from '@apas/shared';
import { z } from 'zod';
import type { BenutzerRecord } from '../db.js';
import { HttpError } from './http.js';
import { newId } from './ids.js';

/*
 * Shared by every way an account comes into existence: self-registration (routes/auth.ts),
 * self-join via invite link (routes/join.ts), direct add by an Ausbilder (routes/trupps.ts),
 * the seed script and the migration.
 */

/**
 * Login identity is the e-mail address — stored and compared trimmed + lowercase, unique
 * instance-wide. Every write path checks uniqueness inside the benutzer write lock.
 */
export const emailKey = (email: string): string => email.trim().toLowerCase();

/** Placeholder login for accounts without a known address (migration only — never user input). */
export const placeholderEmail = (id: string): string => `${id}@${PLACEHOLDER_EMAIL_DOMAIN}`;

/** User-supplied e-mail (registration, join, Ausbilder add/edit, seed script). Output is emailKey()-normalised. */
export const emailSchema = z
  .string({ error: 'Bitte eine E-Mail-Adresse angeben' })
  .trim()
  .toLowerCase()
  .max(254, 'E-Mail-Adresse ist zu lang')
  .email('Bitte eine gültige E-Mail-Adresse angeben')
  .refine(
    (e) => !isPlaceholderEmail(e),
    `Adressen mit @${PLACEHOLDER_EMAIL_DOMAIN} sind nur Platzhalter — bitte eine echte E-Mail-Adresse angeben`,
  );

/**
 * Display name only (not unique, not used for login). nameKey() is the same normalisation,
 * case-insensitive — used solely to match legacy magic-link records when they are claimed
 * via the invite link (routes/join.ts).
 */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name muss mindestens 2 Zeichen haben')
  .max(100)
  .transform((n) => n.replace(/\s+/g, ' '));

/** Required FF (registration, invite-link join). */
export const ffSchema = z
  .string({ error: 'Bitte deine Feuerwehr (FF) angeben' })
  .trim()
  .min(1, { error: 'Bitte deine Feuerwehr (FF) angeben', abort: true })
  .min(2, 'FF muss mindestens 2 Zeichen haben')
  .max(100, 'FF darf höchstens 100 Zeichen haben');

/** Optional FF: empty/missing → null. */
export const optionalFfSchema = z
  .string()
  .trim()
  .max(100)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || v.length >= 2, 'FF muss mindestens 2 Zeichen haben');

// bcrypt only uses the first 72 bytes — cap it instead of silently truncating.
export const passwordSchema = z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(72);

export function findByEmail<T extends { email?: string }>(items: readonly T[], email: string): T | undefined {
  const key = emailKey(email);
  return items.find((b) => typeof b.email === 'string' && emailKey(b.email) === key);
}

/** 409 for a taken login address. `hinweis` replaces the default "melde dich an" hint. */
export function emailVergeben(email: string, hinweis = 'Wenn du das bist, melde dich an.'): HttpError {
  return new HttpError(409, `Für die E-Mail-Adresse „${email}" gibt es schon ein Konto. ${hinweis}`);
}

export function newBenutzerRecord(input: {
  /** Already emailKey()-normalised (emailSchema output). */
  email: string;
  name: string;
  ff: string | null;
  passwordHash: string;
  systemRolle?: SystemRolle;
  truppId?: string | null;
}): BenutzerRecord {
  const now = new Date().toISOString();
  const truppId = input.truppId ?? null;
  return {
    id: newId(),
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    systemRolle: input.systemRolle ?? 'teilnehmer',
    ff: input.ff,
    truppId,
    rolle: null,
    gewuenschteRolle: null,
    checkliste: { ...EMPTY_CHECKLISTE },
    createdAt: now,
    joinedAt: truppId ? now : null,
  };
}
