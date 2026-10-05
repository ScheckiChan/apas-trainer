import { EMPTY_CHECKLISTE, type SystemRolle } from '@apas/shared';
import { z } from 'zod';
import type { BenutzerRecord } from '../db.js';
import { HttpError } from './http.js';
import { newId } from './ids.js';

/*
 * Shared by every way an account comes into existence: self-registration (routes/auth.ts),
 * self-join via invite link (routes/join.ts), direct add by an Ausbilder (routes/trupps.ts),
 * the seed script and the migration.
 */

/** Login identity is the name — compared trimmed, whitespace-collapsed, case-insensitive, instance-wide. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name muss mindestens 2 Zeichen haben')
  .max(100)
  .transform((n) => n.replace(/\s+/g, ' '));

export const ffSchema = z.string().trim().min(2).max(100);

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

export function findByName<T extends { name: string }>(items: readonly T[], name: string): T | undefined {
  const key = nameKey(name);
  return items.find((b) => nameKey(b.name) === key);
}

export function nameVergeben(existingName: string, hinweis: string): HttpError {
  return new HttpError(409, `Der Name „${existingName}" ist schon vergeben. ${hinweis}`);
}

export function newBenutzerRecord(input: {
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
    name: input.name,
    passwordHash: input.passwordHash,
    systemRolle: input.systemRolle ?? 'teilnehmer',
    ff: input.ff,
    truppId,
    rolle: null,
    checkliste: { ...EMPTY_CHECKLISTE },
    createdAt: now,
    joinedAt: truppId ? now : null,
  };
}
