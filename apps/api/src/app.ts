import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { gruppenRouter } from './routes/gruppen.js';
import { joinRouter } from './routes/join.js';
import { pushRouter } from './routes/push.js';
import { termineRouter } from './routes/termine.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
  }
  app.use(express.json({ limit: '100kb' }));

  // General limiter for the whole API, stricter one for unauthenticated auth/join endpoints.
  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Versuche — bitte später erneut probieren' },
  });

  app.use('/api', apiLimiter);
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth/leiter/login', authLimiter);
  app.use('/api/auth/teilnehmer/request-link', authLimiter);
  app.use('/api/auth/teilnehmer/verify', authLimiter);
  app.post('/api/join/:token', authLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/join', joinRouter);
  app.use('/api/gruppen/:gruppeId/termine', termineRouter);
  app.use('/api/gruppen', gruppenRouter);
  app.use('/api/push', pushRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Nicht gefunden' });
  });
  app.use(errorHandler);
  return app;
}
