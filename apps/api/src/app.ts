import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { requireAuth } from './lib/auth.js';
import { errorHandler } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { benutzerRouter } from './routes/benutzer.js';
import { einstellungenRouter } from './routes/einstellungen.js';
import { ergebnisseRouter, ranglisteRouter } from './routes/ergebnisse.js';
import { truppsRouter } from './routes/trupps.js';
import { eigenesKontoRouter, truppsucheRouter } from './routes/truppsuche.js';
import { joinRouter } from './routes/join.js';
import { pushRouter } from './routes/push.js';
import { teilnehmerRouter } from './routes/teilnehmer.js';
import { ressourcenRouter } from './routes/ressourcen.js';
import { termineRouter } from './routes/termine.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
  }
  // The Wappen upload reads its raw body itself (routes/einstellungen.ts) and decides the
  // type by sniffing, so a JSON Content-Type there must not hit the JSON parser.
  const jsonParser = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path === '/api/einstellungen/wappen' ? next() : jsonParser(req, res, next)));

  // General limiter for the whole API, stricter ones for the unauthenticated auth endpoints.
  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
  const strict = (opts: { limit: number; skipSuccessfulRequests?: boolean }) =>
    rateLimit({
      windowMs: 15 * 60_000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Zu viele Versuche — bitte später erneut probieren' },
      ...opts,
    });
  // Password logins: only failed attempts count, so a whole Trupp behind one NAT can
  // still sign in, while brute force is capped at 20 wrong passwords per 15 min and IP.
  const loginLimiter = strict({ limit: 20, skipSuccessfulRequests: true });
  // Registering / joining creates or changes accounts — every attempt counts. One shared
  // budget per IP for registration and the invite-token endpoints.
  const accountLimiter = strict({ limit: 30 });
  // Self-service Trupp-Wahl join: authenticated, so budgeted per account instead of per IP —
  // a whole event behind one venue Wi-Fi can register + self-join without starving each
  // other, while a single account still can't hammer it. Runs after requireAuth (below).
  const proKonto = (prefix: string, limit: number) =>
    rateLimit({
      windowMs: 15 * 60_000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Zu viele Versuche — bitte später erneut probieren' },
      keyGenerator: (req) => `${prefix}:${req.benutzer!.id}`,
    });
  const selbstBeitrittLimiter = proKonto('benutzer', 10);
  // Truppsuche "Neuen Trupp bilden" creates a Trupp without any Ausbilder — same per-account
  // budget as the self-join, counted separately.
  const truppsucheLimiter = proKonto('truppsuche', 10);

  app.use('/api', apiLimiter);
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/login', loginLimiter);
  app.post('/api/auth/registrieren', accountLimiter);
  app.post('/api/trupps/:token/join', accountLimiter);
  app.post('/api/trupps/:token/beitreten', accountLimiter);
  // requireAuth first so the limiter can key by account (unauthenticated → 401 here).
  app.post('/api/trupps/waehlbar/:truppId/beitreten', requireAuth, selbstBeitrittLimiter);
  app.post('/api/truppsuche/trupp', requireAuth, truppsucheLimiter);

  app.use('/api/auth', authRouter);
  // Self-service on the own account — must come before the Ausbilder-only benutzerRouter.
  app.use('/api/benutzer/me', eigenesKontoRouter);
  app.use('/api/benutzer', benutzerRouter);
  app.use('/api/truppsuche', truppsucheRouter);
  app.use('/api/einstellungen', einstellungenRouter);
  app.use('/api/termine', termineRouter);
  app.use('/api/ressourcen', ressourcenRouter);
  app.use('/api/trupps/:truppId/ergebnisse', ergebnisseRouter);
  app.use('/api/rangliste', ranglisteRouter);
  app.use('/api/trupps', joinRouter);
  app.use('/api/trupps', truppsRouter);
  app.use('/api/teilnehmer', teilnehmerRouter);
  app.use('/api/push', pushRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Nicht gefunden' });
  });
  app.use(errorHandler);
  return app;
}
