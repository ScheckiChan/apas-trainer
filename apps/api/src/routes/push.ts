import { Router, type Request } from 'express';
import { z } from 'zod';
import type { PushOwner } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { isPushEnabled, removeSubscription, saveSubscription, vapidPublicKey } from '../push.js';

export const pushRouter = Router();

pushRouter.get('/vapid-public-key', (_req, res) => {
  res.json({ enabled: isPushEnabled(), publicKey: isPushEnabled() ? vapidPublicKey() : null });
});

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const ownerOf = (req: Request): PushOwner => ({ kind: 'benutzer', id: req.benutzer!.id });

pushRouter.post('/subscribe', requireAuth, async (req, res) => {
  if (!isPushEnabled()) throw new HttpError(503, 'Push-Benachrichtigungen sind am Server nicht konfiguriert');
  const sub = parseBody(subscriptionSchema, req);
  await saveSubscription(ownerOf(req), sub);
  res.status(201).json({ ok: true });
});

pushRouter.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = parseBody(z.object({ endpoint: z.url() }), req);
  await removeSubscription(endpoint, ownerOf(req));
  res.json({ ok: true });
});
