import type { LoginResponse, TeilnehmerSession } from '@apas/shared';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireLeiter, requireTeilnehmer, signLeiterToken, signTeilnehmerToken } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { consumeMagicLink, issueMagicLink } from '../magic.js';
import { toGruppe, toTeilnehmer } from '../serialize.js';

export const authRouter = Router();

// ---------------------------------------------------------------- Ausbildungsleiter

const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
});

// Constant-ish work for unknown users so login timing doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-dummy-password', 10);

authRouter.post('/leiter/login', async (req, res) => {
  const { email, password } = parseBody(loginSchema, req);
  const leiter = await db.leiter.findOne((l) => l.email === email);
  const ok = await bcrypt.compare(password, leiter?.passwordHash ?? DUMMY_HASH);
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

// ---------------------------------------------------------------- Teilnehmer (magic link)

const verifySchema = z.object({ token: z.string().min(10).max(200) });

authRouter.post('/teilnehmer/verify', async (req, res) => {
  const { token } = parseBody(verifySchema, req);
  const teilnehmerId = await consumeMagicLink(token);
  if (!teilnehmerId) throw new HttpError(400, 'Link ungültig oder abgelaufen — bitte neuen Link anfordern');

  const t = await db.teilnehmer.patch(teilnehmerId, (x) => ({ ...x, emailVerified: true }));
  if (!t) throw new HttpError(400, 'Teilnehmer existiert nicht mehr');
  const gruppe = await db.gruppen.get(t.gruppeId);
  if (!gruppe) throw new HttpError(400, 'Gruppe existiert nicht mehr');

  const body: TeilnehmerSession = {
    token: signTeilnehmerToken({ sub: t.id, gruppeId: t.gruppeId }),
    teilnehmer: toTeilnehmer(t, { includeEmail: true }),
    gruppe: toGruppe(gruppe, { includeInvite: false }),
  };
  res.json(body);
});

const requestLinkSchema = z.object({ email: z.email().transform((e) => e.toLowerCase()) });

/**
 * Re-entry: sends a fresh magic link for every Gruppe membership of this e-mail.
 * Always answers 202 so the endpoint can't be used to probe for registered addresses.
 */
authRouter.post('/teilnehmer/request-link', async (req, res) => {
  const { email } = parseBody(requestLinkSchema, req);
  const memberships = await db.teilnehmer.find((t) => t.email === email);
  for (const t of memberships) {
    const gruppe = await db.gruppen.get(t.gruppeId);
    if (gruppe) await issueMagicLink(t, gruppe);
  }
  res.status(202).json({ ok: true });
});

authRouter.get('/teilnehmer/me', requireTeilnehmer, async (req, res) => {
  const t = await db.teilnehmer.get(req.teilnehmer!.sub);
  const gruppe = await db.gruppen.get(t!.gruppeId);
  if (!gruppe) throw new HttpError(404, 'Gruppe nicht gefunden');
  res.json({
    teilnehmer: toTeilnehmer(t!, { includeEmail: true }),
    gruppe: toGruppe(gruppe, { includeInvite: false }),
  });
});
