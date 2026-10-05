import type { ApiError } from '@apas/shared';

/**
 * One account, one token per device. `auth: 'auth'` sends it, `'none'` doesn't (public
 * endpoints, login, registration). What the account may do is never read from the token —
 * the session (lib/session.tsx) always asks GET /auth/me.
 */
export type AuthKind = 'auth' | 'none';

const TOKEN_KEY = 'apas.token';

/**
 * Before the unified accounts a device could hold a Leiter and a Teilnehmer token side by
 * side. The API still accepts both, so the first load keeps one of them (the Leiter one wins,
 * matching the old "Leiter session wins" rule) and drops the old keys.
 */
const LEGACY_TOKEN_KEYS = ['apas.leiterToken', 'apas.teilnehmerToken'] as const;

function migrateLegacyToken(): void {
  try {
    if (!localStorage.getItem(TOKEN_KEY)) {
      const legacy = LEGACY_TOKEN_KEYS.map((k) => localStorage.getItem(k)).find((t) => !!t);
      if (legacy) localStorage.setItem(TOKEN_KEY, legacy);
    }
    for (const k of LEGACY_TOKEN_KEYS) localStorage.removeItem(k);
  } catch {
    // Storage unavailable (private mode) — nothing to migrate.
  }
}

migrateLegacyToken();

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/** Absolute URL of an API path (e.g. for <img src>), same prefix api() uses. */
export const apiUrl = (path: string): string => `${API_BASE}/api${path}`;

export interface ApiOptions {
  method?: string;
  /** JSON body. */
  body?: unknown;
  /** Raw body (e.g. an uploaded file), sent as-is with its own type as Content-Type. */
  raw?: Blob;
  /** Defaults to 'auth'. */
  auth?: AuthKind;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const auth = opts.auth ?? 'auth';
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.raw !== undefined) {
    headers['Content-Type'] = opts.raw.type || 'application/octet-stream';
    body = opts.raw;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (auth === 'auth') {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { method: opts.method ?? 'GET', headers, body });
  } catch {
    throw new HttpError(0, 'Keine Verbindung zum Server — bist du offline?');
  }

  // Expired / revoked token or deleted account → back to the login (see App + session).
  if (res.status === 401 && auth === 'auth') {
    clearToken();
    window.dispatchEvent(new CustomEvent('apas:unauthorized'));
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
 * The last invite link used on this device — the Join page opens on "Anmelden" when the
 * same link is opened again.
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
