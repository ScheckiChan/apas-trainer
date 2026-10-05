import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { truppsRouter } from './routes/trupps.js';
import { joinRouter } from './routes/join.js';
import { pushRouter } from './routes/push.js';
import { teilnehmerRouter } from './routes/teilnehmer.js';
import { termineRouter } from './routes/termine.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
  }
  app.use(express.json({ limit: '100kb' }));

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
  // Joining creates accounts — every attempt counts.
  const joinLimiter = strict({ limit: 30 });

  app.use('/api', apiLimiter);
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth/leiter/login', loginLimiter);
  app.post('/api/trupps/:token/login', loginLimiter);
  app.post('/api/trupps/:token/join', joinLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/trupps/:truppId/termine', termineRouter);
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
