import type { AuthSession, MeResponse } from '@apas/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HttpError, api, clearToken, errorMessage, getToken, setToken } from './api';

/**
 * The signed-in account, resolved via GET /auth/me. Every role / Trupp decision in the UI
 * reads `me.benutzer.systemRolle` and `me.benutzer.truppId` from here — never the token.
 *
 * The last /auth/me answer is kept on the device so a station page (Stoppuhr) still opens
 * offline, e.g. on a training ground without reception. It is only used when the server
 * can't be reached; a 401 always clears it.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'ready'; me: MeResponse; offline: boolean }
  | { status: 'error'; error: string };

interface SessionApi {
  state: SessionState;
  /** Only set when status is 'ready'. */
  me: MeResponse | null;
  /** Re-reads /auth/me (e.g. after the own systemRolle changed). */
  refresh: () => Promise<MeResponse | null>;
  /** After login, registration or invite join. */
  signIn: (session: AuthSession) => void;
  /** Updates the cached account (e.g. after joining a Trupp or a Checkliste toggle). */
  setMe: (me: MeResponse) => void;
  signOut: () => void;
}

const ME_CACHE_KEY = 'apas.me';

function readCachedMe(): MeResponse | null {
  try {
    const v = JSON.parse(localStorage.getItem(ME_CACHE_KEY) ?? 'null') as MeResponse | null;
    return v && v.benutzer && typeof v.benutzer.systemRolle === 'string' ? v : null;
  } catch {
    return null;
  }
}

function writeCachedMe(me: MeResponse | null): void {
  try {
    if (me) localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_CACHE_KEY);
  } catch {
    // ignore — the cache is only an offline convenience
  }
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => (getToken() ? { status: 'loading' } : { status: 'anon' }));

  const refresh = useCallback(async (): Promise<MeResponse | null> => {
    if (!getToken()) {
      writeCachedMe(null);
      setState({ status: 'anon' });
      return null;
    }
    try {
      const me = await api<MeResponse>('/auth/me');
      writeCachedMe(me);
      setState({ status: 'ready', me, offline: false });
      return me;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        writeCachedMe(null);
        setState({ status: 'anon' });
        return null;
      }
      const cached = readCachedMe();
      if (cached) {
        setState({ status: 'ready', me: cached, offline: true });
        return cached;
      }
      setState({ status: 'error', error: errorMessage(err) });
      return null;
    }
  }, []);

  useEffect(() => {
    if (getToken()) void refresh();
  }, [refresh]);

  // Any API call that got a 401 already cleared the token.
  useEffect(() => {
    const onUnauthorized = () => {
      writeCachedMe(null);
      setState({ status: 'anon' });
    };
    window.addEventListener('apas:unauthorized', onUnauthorized);
    return () => window.removeEventListener('apas:unauthorized', onUnauthorized);
  }, []);

  const signIn = useCallback((session: AuthSession) => {
    const { token, ...me } = session;
    setToken(token);
    writeCachedMe(me);
    setState({ status: 'ready', me, offline: false });
  }, []);

  const setMe = useCallback((me: MeResponse) => {
    writeCachedMe(me);
    setState({ status: 'ready', me, offline: false });
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    writeCachedMe(null);
    setState({ status: 'anon' });
  }, []);

  const value = useMemo<SessionApi>(
    () => ({ state, me: state.status === 'ready' ? state.me : null, refresh, signIn, setMe, signOut }),
    [state, refresh, signIn, setMe, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** For views behind a guard that already waited for the session. */
export function useMe(): MeResponse {
  const { me } = useSession();
  if (!me) throw new Error('useMe without a signed-in account');
  return me;
}

/** Where an account lands after login and on "/". */
export function homePath(me: MeResponse): string {
  return me.benutzer.systemRolle === 'teilnehmer' ? '/teilnehmer' : '/trupps';
}
