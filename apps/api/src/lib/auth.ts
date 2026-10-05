import type { SystemRolle } from '@apas/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db, type BenutzerRecord, type TruppRecord } from '../db.js';
import { HttpError } from './http.js';

/*
 * One token kind for every account. The token only proves *who* is calling; what they
 * may do (systemRolle) and which Trupp they belong to are read from benutzer.json on
 * every request, so a role change or Trupp move takes effect immediately without
 * re-login. `systemRolle` in the claims is informational (state at login time).
 *
 * Tokens issued before the unified accounts (audiences apas:leiter / apas:teilnehmer)
 * are still accepted: the migration kept every id, so their `sub` resolves to the same
 * person. They simply run out at their original expiry.
 */

export interface BenutzerTokenPayload {
  kind: 'benutzer';
  sub: string; // Benutzer id
  systemRolle: SystemRolle;
}

const BENUTZER_AUD = 'apas:benutzer';
const LEGACY_AUDS = ['apas:leiter', 'apas:teilnehmer'];
const KNOWN_KINDS = new Set(['benutzer', 'leiter', 'teilnehmer']);

export function signBenutzerToken(b: Pick<BenutzerRecord, 'id' | 'systemRolle'>): string {
  const payload: BenutzerTokenPayload = { kind: 'benutzer', sub: b.id, systemRolle: b.systemRolle };
  const ttl = b.systemRolle === 'ausbilder' ? config.ausbilderTokenTtl : config.benutzerTokenTtl;
  return jwt.sign(payload, config.jwtSecret, {
    audience: BENUTZER_AUD,
    expiresIn: ttl as jwt.SignOptions['expiresIn'],
  });
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

/** Returns the account id of a valid token (current or legacy), else null. */
function verifyToken(token: string): string | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, { audience: [BENUTZER_AUD, ...LEGACY_AUDS] }) as jwt.JwtPayload;
    if (!KNOWN_KINDS.has(String(p.kind)) || typeof p.sub !== 'string') return null;
    return p.sub;
  } catch {
    return null;
  }
}

/** The caller, as currently stored (not as claimed in the token). */
export interface Angemeldet {
  id: string;
  name: string;
  systemRolle: SystemRolle;
  truppId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    benutzer?: Angemeldet;
  }
}

async function authenticate(req: Request): Promise<Angemeldet> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Anmeldung erforderlich');
  const id = verifyToken(token);
  const rec = id ? await db.benutzer.get(id) : undefined;
  if (!rec) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
  req.benutzer = { id: rec.id, name: rec.name, systemRolle: rec.systemRolle, truppId: rec.truppId };
  return req.benutzer;
}

/** Requires a valid token of an account that still exists. Sets req.benutzer. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  await authenticate(req);
  next();
}

const ROLLEN_TEXT: Record<SystemRolle, string> = { ausbilder: 'Ausbilder', pruefer: 'Prüfer', teilnehmer: 'Teilnehmer' };

/** Must run after requireAuth. 403 unless the caller's current systemRolle is one of `rollen`. */
export function requireRolle(...rollen: SystemRolle[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.benutzer || !rollen.includes(req.benutzer.systemRolle)) {
      throw new HttpError(403, `Nur für ${rollen.map((r) => ROLLEN_TEXT[r]).join(' und ')} erlaubt`);
    }
    next();
  };
}

/** requireAuth + systemRolle 'ausbilder' (everything the former Ausbildungsleiter could do). */
export async function requireAusbilder(req: Request, _res: Response, next: NextFunction) {
  const b = await authenticate(req);
  if (b.systemRolle !== 'ausbilder') throw new HttpError(403, 'Nur für Ausbilder erlaubt');
  next();
}

export const isAusbilder = (req: Request): boolean => req.benutzer?.systemRolle === 'ausbilder';

/**
 * Who may see a Trupp:
 * - 'trupp':       Trupp record + Ergebnisse — Ausbilder, Prüfer (they score any Trupp's
 *                  station run) and members of that Trupp.
 * - 'mitglieder':  member list incl. Checklisten (Tauglichkeit!) — Ausbilder and members only.
 */
export type TruppSicht = 'trupp' | 'mitglieder';

function darfSehen(b: Angemeldet, trupp: TruppRecord, sicht: TruppSicht): boolean {
  if (b.systemRolle === 'ausbilder' || b.truppId === trupp.id) return true;
  return sicht === 'trupp' && b.systemRolle === 'pruefer';
}

/**
 * Loads the Trupp from :truppId and checks the caller may see it (404 otherwise, so Trupp
 * ids of others aren't confirmed). Must run after requireAuth.
 */
export async function loadTrupp(req: Request, sicht: TruppSicht): Promise<TruppRecord> {
  const trupp = await db.trupps.get(String(req.params.truppId));
  if (!trupp || !darfSehen(req.benutzer!, trupp, sicht)) throw new HttpError(404, 'Trupp nicht gefunden');
  return trupp;
}
