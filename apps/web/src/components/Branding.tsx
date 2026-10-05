import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';

/**
 * The instance branding (führende Feuerwehr + Wappen) as plain values. `wappenSrc` is null
 * when no Wappen is set or the image failed to load — then nothing is rendered at all.
 */
export function useBranding(): {
  ff: string | null;
  wappenSrc: string | null;
  wappenAlt: string;
  onWappenError: () => void;
} {
  const { einstellungen } = useEinstellungen();
  const pfad = einstellungen?.wappen?.pfad ?? null;
  const [failed, setFailed] = useState<string | null>(null);

  // A new upload (new ?v=) gets a fresh chance to load.
  useEffect(() => {
    if (failed && failed !== pfad) setFailed(null);
  }, [pfad, failed]);

  const ff = einstellungen?.fuehrendeFeuerwehr?.trim() || null;
  return {
    ff,
    wappenSrc: pfad && failed !== pfad ? apiUrl(pfad) : null,
    wappenAlt: ff ?? 'Wappen',
    onWappenError: () => setFailed(pfad),
  };
}
