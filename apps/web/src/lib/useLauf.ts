import { zeitueberschreitungPunkte, type TeilErgebnis } from '@apas/shared';
import { useEffect, useState } from 'react';
import { checklistenPunkte } from '../components/FehlerCheckliste';
import type { FehlerTabelle, Station, Zeitvorgabe } from '../content/stations';

/**
 * One live station run: a stopwatch per Teil (Station 4 has two — Geräteversorgung and
 * Fragen — each with its own Soll-Zeit and Fehlerpunkte table), the ticked Fehlerpunkte and
 * the derived totals. Purely local; saving is a separate, Leiter-only step.
 */

interface Uhr {
  /** Time accumulated over previous start/pause cycles. */
  accMs: number;
  /** Date.now() of the current start, null while paused. */
  startedAt: number | null;
}

interface TeilState {
  uhr: Uhr;
  /** Index into the Teil's zeitvorgaben. */
  variante: number;
  /** Soll-Zeit typed in for variants without a fixed number (elektronisches Manometer). */
  eigeneSoll: string;
  counts: number[];
}

export interface LaufTeil {
  tabelle: FehlerTabelle;
  zeitvorgaben: Zeitvorgabe[];
  variante: number;
  eigeneSoll: string;
  counts: number[];
  laeuft: boolean;
  /** Whole seconds on the clock. */
  sekunden: number;
  /** null = no usable Soll-Zeit (variant without a number and nothing typed in). */
  sollSek: number | null;
  zeitPunkte: number | null;
  checkPunkte: number;
  summe: number;
  bestanden: boolean;
}

export interface Lauf {
  teile: LaufTeil[];
  /** Teil shown in the sticky bar: the running one, else the last one started. */
  aktiv: number;
  gesamt: number;
  /** This station in isolation: every Teil within its own limit. */
  bestanden: boolean;
  /** Anything on the clock or ticked. */
  begonnen: boolean;
  laeuftIrgendwo: boolean;
  startPause: (teil: number) => void;
  resetUhr: (teil: number) => void;
  setVariante: (teil: number, v: number) => void;
  setEigeneSoll: (teil: number, v: string) => void;
  setCount: (teil: number, zeile: number, count: number) => void;
  resetCounts: (teil: number) => void;
  /** Pauses every clock and returns the result per Teil at that same instant. */
  stoppen: () => TeilErgebnis[];
}

const elapsedMs = (u: Uhr, now: number) => u.accMs + (u.startedAt === null ? 0 : now - u.startedAt);

export const zeitvorgabenFuerTeil = (station: Station, teil: number): Zeitvorgabe[] =>
  station.zeitvorgaben.filter((z) => (z.teil ?? 0) === teil);

export function useLauf(station: Station): Lauf {
  const [state, setState] = useState<TeilState[]>(() =>
    station.fehlerpunkte.map((t) => ({
      uhr: { accMs: 0, startedAt: null },
      variante: 0,
      eigeneSoll: '',
      counts: t.zeilen.map(() => 0),
    })),
  );
  const [aktiv, setAktiv] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const laeuftIrgendwo = state.some((t) => t.uhr.startedAt !== null);

  // Re-render a few times per second while a clock runs. Time is always derived from
  // Date.now(), so a throttled background tab or locked phone never loses seconds.
  useEffect(() => {
    if (!laeuftIrgendwo) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [laeuftIrgendwo]);

  // Keep the screen on while timing (the phone is held, not touched, during a run).
  useEffect(() => {
    if (!laeuftIrgendwo || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [laeuftIrgendwo]);

  const patch = (i: number, fn: (t: TeilState) => TeilState) =>
    setState((s) => s.map((t, j) => (j === i ? fn(t) : t)));

  const teile = derive(station, state, now);
  const gesamt = teile.reduce((s, t) => s + t.summe, 0);

  return {
    teile,
    aktiv,
    gesamt,
    bestanden: teile.every((t) => t.bestanden),
    begonnen: teile.some((t) => t.sekunden > 0 || t.laeuft || t.checkPunkte > 0),
    laeuftIrgendwo,
    startPause: (i) => {
      const t = Date.now();
      setNow(t);
      setAktiv(i);
      patch(i, (s) => ({
        ...s,
        uhr: s.uhr.startedAt === null ? { ...s.uhr, startedAt: t } : { accMs: elapsedMs(s.uhr, t), startedAt: null },
      }));
    },
    resetUhr: (i) => patch(i, (s) => ({ ...s, uhr: { accMs: 0, startedAt: null } })),
    setVariante: (i, v) => patch(i, (s) => ({ ...s, variante: v })),
    setEigeneSoll: (i, v) => patch(i, (s) => ({ ...s, eigeneSoll: v })),
    setCount: (i, zeile, count) =>
      patch(i, (s) => ({ ...s, counts: s.counts.map((c, j) => (j === zeile ? count : c)) })),
    resetCounts: (i) => patch(i, (s) => ({ ...s, counts: s.counts.map(() => 0) })),
    stoppen: () => {
      const t = Date.now();
      const paused = state.map((x) => ({ ...x, uhr: { accMs: elapsedMs(x.uhr, t), startedAt: null } }));
      setNow(t);
      setState(paused);
      return derive(station, paused, t).map((x) => ({ zeitSekunden: x.sekunden, fehlerpunkte: x.summe }));
    },
  };
}

function derive(station: Station, state: readonly TeilState[], now: number): LaufTeil[] {
  return state.map((t, i) => {
    const tabelle = station.fehlerpunkte[i];
    const zeitvorgaben = zeitvorgabenFuerTeil(station, i);
    const zv = zeitvorgaben[t.variante];
    const eigene = Number.parseInt(t.eigeneSoll, 10);
    const sollSek = zv?.sekunden ?? (Number.isFinite(eigene) && eigene > 0 ? eigene : null);
    const sekunden = Math.floor(elapsedMs(t.uhr, now) / 1000);
    const zeitPunkte = sollSek === null ? null : zeitueberschreitungPunkte(sekunden, sollSek);
    const checkPunkte = checklistenPunkte(tabelle, t.counts);
    const summe = checkPunkte + (zeitPunkte ?? 0);
    return {
      tabelle,
      zeitvorgaben,
      variante: t.variante,
      eigeneSoll: t.eigeneSoll,
      counts: t.counts,
      laeuft: t.uhr.startedAt !== null,
      sekunden,
      sollSek,
      zeitPunkte,
      checkPunkte,
      summe,
      bestanden: summe <= tabelle.maxPunkte,
    };
  });
}
