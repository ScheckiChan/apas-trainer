import { api, type AuthKind } from './api';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // In dev the Vite server handles modules; a SW would only get in the way.
  if (import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}

export const pushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Asks for permission, subscribes this device and registers it with the API. */
export async function enablePush(auth: Exclude<AuthKind, 'none'>): Promise<void> {
  if (!pushSupported()) throw new Error('Dieser Browser unterstützt keine Push-Benachrichtigungen');
  const { enabled, publicKey } = await api<{ enabled: boolean; publicKey: string | null }>(
    '/push/vapid-public-key',
    { auth: 'none' },
  );
  if (!enabled || !publicKey) throw new Error('Push-Benachrichtigungen sind am Server nicht eingerichtet');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api('/push/subscribe', { method: 'POST', auth, body: { endpoint: json.endpoint, keys: json.keys } });
}
