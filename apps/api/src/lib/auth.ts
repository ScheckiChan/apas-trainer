import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db, type GruppeRecord } from '../db.js';
import { HttpError } from './http.js';

/*
 * Two strictly separate token types. The `kind` claim is the discriminator and every
 * middleware checks it — a Teilnehmer token is never accepted where a Leiter token
 * is required and vice versa. Different audiences add a second layer of separation.
 */

export interface LeiterTokenPayload {
  kind: 'leiter';
  sub: string; // Ausbildungsleiter id
  email: string;
}

export interface TeilnehmerTokenPayload {
  kind: 'teilnehmer';
  sub: string; // Teilnehmer id
  gruppeId: string;
}

const LEITER_AUD = 'apas:leiter';
const TEILNEHMER_AUD = 'apas:teilnehmer';

export function signLeiterToken(p: Omit<LeiterTokenPayload, 'kind'>): string {
  const payload: LeiterTokenPayload = { kind: 'leiter', ...p };
  return jwt.sign(payload, config.jwtSecret, {
    audience: LEITER_AUD,
    expiresIn: config.leiterTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

export function signTeilnehmerToken(p: Omit<TeilnehmerTokenPayload, 'kind'>): string {
  const payload: TeilnehmerTokenPayload = { kind: 'teilnehmer', ...p };
  return jwt.sign(payload, config.jwtSecret, {
    audience: TEILNEHMER_AUD,
    expiresIn: config.teilnehmerTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

function verifyLeiter(token: string): LeiterTokenPayload | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, { audience: LEITER_AUD }) as jwt.JwtPayload;
    if (p.kind !== 'leiter' || typeof p.sub !== 'string') return null;
    return { kind: 'leiter', sub: p.sub, email: String(p.email) };
  } catch {
    return null;
  }
}

function verifyTeilnehmer(token: string): TeilnehmerTokenPayload | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, { audience: TEILNEHMER_AUD }) as jwt.JwtPayload;
    if (p.kind !== 'teilnehmer' || typeof p.sub !== 'string' || typeof p.gruppeId !== 'string') return null;
    return { kind: 'teilnehmer', sub: p.sub, gruppeId: p.gruppeId };
  } catch {
    return null;
  }
}

export type Principal = LeiterTokenPayload | TeilnehmerTokenPayload;

declare module 'express-serve-static-core' {
  interface Request {
    leiter?: LeiterTokenPayload;
    teilnehmer?: TeilnehmerTokenPayload;
  }
}

/** Requires a valid Ausbildungsleiter token. */
export async function requireLeiter(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  const p = token ? verifyLeiter(token) : null;
  if (!p) throw new HttpError(401, 'Anmeldung als Ausbildungsleiter erforderlich');
  if (!(await db.leiter.get(p.sub))) throw new HttpError(401, 'Konto existiert nicht mehr');
  req.leiter = p;
  next();
}

/** Requires a valid Teilnehmer token whose Teilnehmer still exists. */
export async function requireTeilnehmer(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  const p = token ? verifyTeilnehmer(token) : null;
  if (!p) throw new HttpError(401, 'Anmeldung als Teilnehmer erforderlich');
  const t = await db.teilnehmer.get(p.sub);
  if (!t || t.gruppeId !== p.gruppeId) throw new HttpError(401, 'Teilnehmer existiert nicht mehr');
  req.teilnehmer = p;
  next();
}

/** Accepts either token type; sets req.leiter or req.teilnehmer. */
export async function requireAny(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Anmeldung erforderlich');
  const l = verifyLeiter(token);
  if (l && (await db.leiter.get(l.sub))) {
    req.leiter = l;
    return next();
  }
  const t = verifyTeilnehmer(token);
  if (t) {
    const rec = await db.teilnehmer.get(t.sub);
    if (rec && rec.gruppeId === t.gruppeId) {
      req.teilnehmer = t;
      return next();
    }
  }
  throw new HttpError(401, 'Anmeldung erforderlich');
}

/**
 * Loads the Gruppe from :gruppeId and checks the caller may access it:
 * the owning Ausbildungsleiter, or a Teilnehmer of that Gruppe.
 * Must run after requireAny / requireLeiter / requireTeilnehmer.
 */
export async function loadGruppeForPrincipal(req: Request): Promise<GruppeRecord> {
  const gruppeId = String(req.params.gruppeId);
  const gruppe = await db.gruppen.get(gruppeId);
  if (!gruppe) throw new HttpError(404, 'Gruppe nicht gefunden');
  if (req.leiter && gruppe.ownerId === req.leiter.sub) return gruppe;
  if (req.teilnehmer && req.teilnehmer.gruppeId === gruppe.id) return gruppe;
  throw new HttpError(404, 'Gruppe nicht gefunden');
}

export function isOwner(req: Request, gruppe: GruppeRecord): boolean {
  return !!req.leiter && req.leiter.sub === gruppe.ownerId;
}
