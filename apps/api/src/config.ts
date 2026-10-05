import path from 'node:path';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number, got "${raw}"`);
  return n;
}

const isProd = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET ?? '';
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET must be set in production');
  console.warn('[config] JWT_SECRET not set — using an insecure development secret');
}

export const config = {
  isProd,
  port: num('PORT', 3001),
  dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
  jwtSecret: jwtSecret || 'dev-insecure-secret-change-me',
  leiterTokenTtl: process.env.LEITER_TOKEN_TTL ?? '7d',
  teilnehmerTokenTtl: process.env.TEILNEHMER_TOKEN_TTL ?? '90d',
  magicLinkTtlMinutes: num('MAGIC_LINK_TTL_MINUTES', 30),
  /** Public base URL of the web app, used to build magic links and invite links. */
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  /** Comma separated list of allowed CORS origins. Empty = same-origin only (no CORS headers). */
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY ?? (isProd ? '1' : ''),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },
  reminderHoursBefore: num('REMINDER_HOURS_BEFORE', 24),
  reminderIntervalMinutes: num('REMINDER_INTERVAL_MINUTES', 5),
};
