import type { Einstellungen } from '@apas/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

/**
 * Instance branding (führende Feuerwehr + Wappen) from the public GET /einstellungen.
 * Fetched once per app load; the last answer is kept on the device so the header doesn't
 * jump on the next start. The Benutzerverwaltung pushes changes in via `set`.
 */
interface EinstellungenApi {
  einstellungen: Einstellungen | null;
  set: (e: Einstellungen) => void;
}

const CACHE_KEY = 'apas.einstellungen';

function readCache(): Einstellungen | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Einstellungen | null;
    return v && 'fuehrendeFeuerwehr' in v && 'wappen' in v ? v : null;
  } catch {
    return null;
  }
}

function writeCache(e: Einstellungen): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(e));
  } catch {
    // ignore
  }
}

const EinstellungenContext = createContext<EinstellungenApi | null>(null);

export function EinstellungenProvider({ children }: { children: ReactNode }) {
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(readCache);

  useEffect(() => {
    api<Einstellungen>('/einstellungen', { auth: 'none' })
      .then((e) => {
        writeCache(e);
        setEinstellungen(e);
      })
      .catch(() => {
        // Branding is optional — keep whatever we had.
      });
  }, []);

  const set = useCallback((e: Einstellungen) => {
    writeCache(e);
    setEinstellungen(e);
  }, []);

  const value = useMemo<EinstellungenApi>(() => ({ einstellungen, set }), [einstellungen, set]);

  return <EinstellungenContext.Provider value={value}>{children}</EinstellungenContext.Provider>;
}

export function useEinstellungen(): EinstellungenApi {
  const ctx = useContext(EinstellungenContext);
  if (!ctx) throw new Error('useEinstellungen outside EinstellungenProvider');
  return ctx;
}
