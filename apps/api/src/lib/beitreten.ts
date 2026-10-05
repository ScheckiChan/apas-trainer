import { db, type BenutzerRecord } from '../db.js';
import { HttpError } from './http.js';

/*
 * The signed-in account joins a Trupp itself. Shared by both entry points:
 *   POST /trupps/:inviteToken/beitreten          (routes/join.ts — per-Trupp invite link)
 *   POST /trupps/waehlbar/:truppId/beitreten     (routes/trupps.ts — self-service Trupp-Wahl)
 */

export const TRUPP_NICHT_GEFUNDEN = 'Trupp nicht gefunden';

/**
 * Check + write inside the benutzer lock: idempotent for the same Trupp, 409 if the account
 * is already in another one (an Ausbilder moves it), Rolle reset on join. The Trupp is
 * re-checked inside the lock so a Trupp deleted meanwhile isn't joined.
 *
 * `nurTeilnehmer`: the self-service path is for systemRolle 'teilnehmer' only (checked
 * against the stored record, not the token claim). The invite-link path keeps its
 * historical behaviour and doesn't restrict systemRolle.
 */
export async function truppBeitreten(
  benutzerId: string,
  truppId: string,
  opts: { nurTeilnehmer?: boolean; nichtGefunden?: string } = {},
): Promise<BenutzerRecord> {
  return db.benutzer.update(async (items) => {
    const b = items.find((x) => x.id === benutzerId);
    if (!b) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
    if (opts.nurTeilnehmer && b.systemRolle !== 'teilnehmer') {
      throw new HttpError(403, 'Nur Teilnehmer können selbst einem Trupp beitreten. Ein Ausbilder kann dich zuordnen.');
    }
    if (!(await db.trupps.get(truppId))) throw new HttpError(404, opts.nichtGefunden ?? TRUPP_NICHT_GEFUNDEN);
    if (b.truppId === truppId) return { items, result: b };
    if (b.truppId) {
      throw new HttpError(409, 'Du bist bereits in einem anderen Trupp. Ein Ausbilder kann dich umbuchen.');
    }
    b.truppId = truppId;
    b.rolle = null;
    b.joinedAt = new Date().toISOString();
    return { items, result: b };
  });
}
