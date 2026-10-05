import type { TruppRecord } from '../db.js';
import { newId, randomToken } from './ids.js';

/**
 * A fresh Trupp record — shared by the Ausbilder's POST /trupps and the self-service
 * POST /truppsuche/trupp, so both get the same defaults (no icon, Bronze, own invite token).
 * `ownerId` is informational only: whoever created it.
 */
export function newTruppRecord(input: { name: string; pruefungstermin: string | null; ownerId: string }): TruppRecord {
  return {
    id: newId(),
    name: input.name,
    icon: null,
    stufe: 'BRONZE',
    pruefungstermin: input.pruefungstermin,
    ownerId: input.ownerId,
    inviteToken: randomToken(),
    createdAt: new Date().toISOString(),
  };
}
