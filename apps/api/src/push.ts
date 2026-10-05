import webpush from 'web-push';
import { config } from './config.js';
import { db, type PushOwner, type PushSubscriptionRecord } from './db.js';
import { newId } from './lib/ids.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Path inside the web app to open on click. */
  url?: string;
  tag?: string;
}

let configured = false;

/** Configures web-push with the VAPID keys from env. Returns false if push is disabled. */
export function initPush(): boolean {
  const { publicKey, privateKey, subject } = config.vapid;
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled');
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export const isPushEnabled = (): boolean => configured;

export const vapidPublicKey = (): string => config.vapid.publicKey;

const sameOwner = (a: PushOwner, b: PushOwner) => a.kind === b.kind && a.id === b.id;

export async function saveSubscription(
  owner: PushOwner,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await db.pushSubscriptions.update((items) => {
    // One record per endpoint — a device that switches account is re-assigned.
    const rest = items.filter((s) => s.endpoint !== sub.endpoint);
    const rec: PushSubscriptionRecord = {
      id: newId(),
      endpoint: sub.endpoint,
      keys: sub.keys,
      owner,
      createdAt: new Date().toISOString(),
    };
    return { items: [...rest, rec], result: undefined };
  });
}

export async function removeSubscription(endpoint: string, owner: PushOwner): Promise<void> {
  await db.pushSubscriptions.remove((s) => s.endpoint === endpoint && sameOwner(s.owner, owner));
}

export async function removeSubscriptionsOf(owner: PushOwner): Promise<void> {
  await db.pushSubscriptions.remove((s) => sameOwner(s.owner, owner));
}

/** Sends a notification to every subscription of the given owners. Returns the number delivered. */
export async function sendPushTo(owners: PushOwner[], payload: PushPayload): Promise<number> {
  if (!configured || owners.length === 0) return 0;
  const subs = await db.pushSubscriptions.find((s) => owners.some((o) => sameOwner(o, s.owner)));
  const body = JSON.stringify(payload);
  let delivered = 0;
  const gone: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 12 });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.warn(`[push] send failed: ${status ?? (err as Error).message}`);
      }
    }),
  );

  if (gone.length) await db.pushSubscriptions.remove((s) => gone.includes(s.endpoint));
  return delivered;
}
