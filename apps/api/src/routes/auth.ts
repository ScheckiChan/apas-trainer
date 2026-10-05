import type { AuthSession, MeResponse } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type BenutzerRecord } from '../db.js';
import { requireAuth, signBenutzerToken } from '../lib/auth.js';
import {
  emailKey,
  emailSchema,
  emailVergeben,
  findByEmail,
  nameSchema,
  newBenutzerRecord,
  optionalFfSchema,
  passwordSchema,
} from '../lib/benutzer.js';
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

// Deliberately lenient: no format check, so a typo yields the normal 401 instead of a 400
// that would hint at the address format. Lookup is by emailKey().
const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

authRouter.post('/login', async (req, res) => {
  const input = parseBody(loginSchema, req);
  const b = findByEmail(await db.benutzer.all(), emailKey(input.email));
  if (b && !b.passwordHash) {
    throw new HttpError(
      409,
      'Für dieses Konto ist noch kein Passwort gesetzt — bitte einmal über den Einladungslink deines Trupps ' +
        '„Neu beitreten" (mit genau deinem bisherigen Namen) und dabei ein Passwort festlegen, ' +
        'oder eine Ausbilderin / einen Ausbilder bitten, dein Passwort zurückzusetzen.',
    );
  }
  // verifyPassword also runs (against a dummy hash) for unknown addresses — no timing leak.
  if (!(await verifyPassword(input.password, b?.passwordHash)) || !b) {
    throw new HttpError(401, 'E-Mail-Adresse oder Passwort falsch');
  }
  res.json(await authSession(b));
});

// ---------------------------------------------------------------- Self-registration

const registrierenSchema = z.object({
  email: emailSchema,
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
    // Unique login address; display names may repeat.
    if (findByEmail(items, input.email)) throw emailVergeben(input.email);
    const rec = newBenutzerRecord({ email: input.email, name: input.name, ff: input.ff, passwordHash });
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
