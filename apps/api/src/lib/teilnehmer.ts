import { EMPTY_CHECKLISTE } from '@apas/shared';
import { z } from 'zod';
import type { TeilnehmerRecord } from '../db.js';
import { newId } from './ids.js';

/*
 * Shared by both ways a Teilnehmer comes into existence: self-join via invite link
 * (routes/join.ts) and direct add by the Ausbildungsleiter (routes/gruppen.ts).
 */

/** Identity within a Gruppe is the name — compared trimmed, whitespace-collapsed, case-insensitive. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

export const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((n) => n.replace(/\s+/g, ' '));

export const ffSchema = z.string().trim().min(2).max(100);

export function findByName(items: readonly TeilnehmerRecord[], gruppeId: string, name: string) {
  const key = nameKey(name);
  return items.find((t) => t.gruppeId === gruppeId && nameKey(t.name) === key);
}

export function newTeilnehmerRecord(
  gruppeId: string,
  input: { name: string; ff: string; passwordHash: string },
): TeilnehmerRecord {
  return {
    id: newId(),
    gruppeId,
    name: input.name,
    ff: input.ff,
    rolle: null,
    passwordHash: input.passwordHash,
    joinedAt: new Date().toISOString(),
    checkliste: { ...EMPTY_CHECKLISTE },
  };
}
