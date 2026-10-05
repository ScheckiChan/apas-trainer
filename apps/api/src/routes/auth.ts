import type { LoginResponse } from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireLeiter, requireTeilnehmer, signLeiterToken } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { verifyPassword } from '../lib/password.js';
import { toGruppe, toTeilnehmer } from '../serialize.js';

export const authRouter = Router();

// ---------------------------------------------------------------- Ausbildungsleiter

const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
});

authRouter.post('/leiter/login', async (req, res) => {
  const { email, password } = parseBody(loginSchema, req);
  const leiter = await db.leiter.findOne((l) => l.email === email);
  const ok = await verifyPassword(password, leiter?.passwordHash);
  if (!leiter || !ok) throw new HttpError(401, 'E-Mail oder Passwort falsch');

  const body: LoginResponse = {
    token: signLeiterToken({ sub: leiter.id, email: leiter.email }),
    leiter: { id: leiter.id, email: leiter.email },
  };
  res.json(body);
});

authRouter.get('/leiter/me', requireLeiter, async (req, res) => {
  const leiter = await db.leiter.get(req.leiter!.sub);
  res.json({ id: leiter!.id, email: leiter!.email });
});

// ---------------------------------------------------------------- Teilnehmer
// Join and login live in routes/join.ts (scoped by invite token).

authRouter.get('/teilnehmer/me', requireTeilnehmer, async (req, res) => {
  const t = await db.teilnehmer.get(req.teilnehmer!.sub);
  const gruppe = await db.gruppen.get(t!.gruppeId);
  if (!gruppe) throw new HttpError(404, 'Gruppe nicht gefunden');
  res.json({
    teilnehmer: toTeilnehmer(t!),
    gruppe: toGruppe(gruppe, { includeInvite: false }),
  });
});
