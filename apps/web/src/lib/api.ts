import type { ApiError } from '@apas/shared';

/**
 * Two independent sessions can live on one device (e.g. an Ausbildungsleiter who
 * also tests the Teilnehmer view). Each request states explicitly which token it uses.
 */
export type AuthKind = 'leiter' | 'teilnehmer' | 'none';

const TOKEN_KEYS: Record<Exclude<AuthKind, 'none'>, string> = {
  leiter: 'apas.leiterToken',
  teilnehmer: 'apas.teilnehmerToken',
};

export function getToken(kind: Exclude<AuthKind, 'none'>): string | null {
  return localStorage.getItem(TOKEN_KEYS[kind]);
}

export function setToken(kind: Exclude<AuthKind, 'none'>, token: string): void {
  localStorage.setItem(TOKEN_KEYS[kind], token);
}

export function clearToken(kind: Exclude<AuthKind, 'none'>): void {
  localStorage.removeItem(TOKEN_KEYS[kind]);
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth: AuthKind },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== 'none') {
    const token = getToken(opts.auth);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new HttpError(0, 'Keine Verbindung zum Server — bist du offline?');
  }

  if (res.status === 401 && opts.auth !== 'none') {
    clearToken(opts.auth);
    window.dispatchEvent(new CustomEvent('apas:unauthorized', { detail: opts.auth }));
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const err = data as Partial<ApiError>;
    throw new HttpError(res.status, err.error ?? `Fehler ${res.status}`, err.details);
  }
  return data as T;
}

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Unbekannter Fehler';

/**
 * Teilnehmer log in via their Trupp's invite link (identity = Trupp + Name). The last
 * used link is remembered so the Login page can send returning Teilnehmer back to it.
 */
export interface LastInvite {
  token: string;
  truppName: string;
}

const LAST_INVITE_KEY = 'apas.lastInvite';

export function rememberInvite(invite: LastInvite): void {
  localStorage.setItem(LAST_INVITE_KEY, JSON.stringify(invite));
}

export function lastInvite(): LastInvite | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_INVITE_KEY) ?? 'null') as
      | (Partial<LastInvite> & { gruppeName?: unknown })
      | null;
    // Entries saved before the Gruppe → Trupp rename use `gruppeName`.
    const truppName = v?.truppName ?? v?.gruppeName;
    return v && typeof v.token === 'string' && typeof truppName === 'string' ? { token: v.token, truppName } : null;
  } catch {
    return null;
  }
}
