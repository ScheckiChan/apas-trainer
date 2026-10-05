import { config } from './config.js';
import { db, type GruppeRecord, type TeilnehmerRecord } from './db.js';
import { newId, randomToken, sha256 } from './lib/ids.js';
import { sendMagicLink } from './lib/mail.js';

/** Creates a single-use magic link for a Teilnehmer and hands it to the (stubbed) mailer. */
export async function issueMagicLink(t: TeilnehmerRecord, gruppe: GruppeRecord): Promise<void> {
  const token = randomToken(32);
  const now = Date.now();
  const expiresAt = new Date(now + config.magicLinkTtlMinutes * 60_000).toISOString();

  await db.magicLinks.update((items) => {
    // Drop expired/used links while we're here; keep the collection small.
    const live = items.filter((m) => !m.usedAt && new Date(m.expiresAt).getTime() > now);
    live.push({ id: newId(), tokenHash: sha256(token), teilnehmerId: t.id, expiresAt, usedAt: null });
    return { items: live, result: undefined };
  });

  await sendMagicLink({
    to: t.email,
    name: t.name,
    gruppeName: gruppe.name,
    link: `${config.publicUrl}/auth/verify?token=${encodeURIComponent(token)}`,
    expiresInMinutes: config.magicLinkTtlMinutes,
  });
}

/** Consumes a magic-link token. Returns the Teilnehmer id, or null if invalid/expired/used. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const hash = sha256(token);
  return db.magicLinks.update((items) => {
    const m = items.find((x) => x.tokenHash === hash);
    if (!m || m.usedAt || new Date(m.expiresAt).getTime() <= Date.now()) {
      return { items, result: null };
    }
    m.usedAt = new Date().toISOString();
    return { items, result: m.teilnehmerId };
  });
}
