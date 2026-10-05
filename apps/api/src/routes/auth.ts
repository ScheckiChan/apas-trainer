import type { AuthSession, MeResponse } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type BenutzerRecord } from '../db.js';
import { requireAuth, signBenutzerToken } from '../lib/auth.js';
import { findByName, nameSchema, nameVergeben, newBenutzerRecord, optionalFfSchema, passwordSchema } from '../lib/benutzer.js';
import { HttpError, parseBody } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toBenutzer, toTrupp } from '../serialize.js';

/** Mounted at /api/auth */
export const authRouter = Router();

export async function meResponse(b: BenutzerRecord): Promise<MeResponse> {
  const trupp = b.truppId ? await db.trupps.get(b.truppId) : undefined;
  return {
    benutzer: toBenutzer(b),
    trupp: trupp ? toTrupp(trupp, { includeInvite: b.systemRolle === 'ausbilder' }) : null,
  };
}

export async function authSession(b: BenutzerRecord): Promise<AuthSession> {
  return { token: signBenutzerToken(b), ...(await meResponse(b)) };
}

// ---------------------------------------------------------------- Login (every systemRolle)

const loginSchema = z.object({
  name: nameSchema,
  password: z.string().min(1).max(200),
});

authRouter.post('/login', async (req, res) => {
  const input = parseBody(loginSchema, req);
  const b = findByName(await db.benutzer.all(), input.name);
  if (b && !b.passwordHash) {
    throw new HttpError(
      409,
      'Für dieses Konto ist noch kein Passwort gesetzt — bitte einmal über den Einladungslink deines Trupps ' +
        'mit genau demselben Namen „Neu beitreten" und dabei ein Passwort festlegen.',
    );
  }
  // verifyPassword also runs (against a dummy hash) for unknown names — no timing leak.
  if (!(await verifyPassword(input.password, b?.passwordHash)) || !b) {
    throw new HttpError(401, 'Name oder Passwort falsch');
  }
  res.json(await authSession(b));
});

// ---------------------------------------------------------------- Self-registration

const registrierenSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
  ff: optionalFfSchema,
});

/** Public. Creates a `teilnehmer` account without Trupp; an Ausbilder attaches it later. */
authRouter.post('/registrieren', async (req, res) => {
  const input = parseBody(registrierenSchema, req);
  // Hash outside the collection lock — bcrypt is deliberately slow.
  const passwordHash = await hashPassword(input.password);
  const b = await db.benutzer.update((items) => {
    const existing = findByName(items, input.name);
    if (existing) {
      throw nameVergeben(
        existing.name,
        'Wenn du das bist, melde dich an. Sonst unterscheide dich z. B. mit dem Anfangsbuchstaben deines Nachnamens.',
      );
    }
    const rec = newBenutzerRecord({ name: input.name, ff: input.ff, passwordHash });
    return { items: [...items, rec], result: rec };
  });
  res.status(201).json(await authSession(b));
});

// ---------------------------------------------------------------- Current account

authRouter.get('/me', requireAuth, async (req, res) => {
  const b = await db.benutzer.get(req.benutzer!.id);
  if (!b) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
  res.json(await meResponse(b));
});
