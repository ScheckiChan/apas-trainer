import {
  STATION_WERTUNG,
  ZEIT_PUNKTE_JE_10_SEK,
  type ErgebnisInput,
  type StationErgebnis,
  type Trupp,
} from '@apas/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Station } from '../content/stations';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, formatMinuten, formatStoppuhr } from '../lib/format';
import type { Lauf, LaufTeil } from '../lib/useLauf';
import { Icon } from './Icon';
import './StationLauf.css';

/** Stoppuhr per Teil. One card for most stations, two for Geräteversorgung + Fragen. */
export function Zeitnehmung({ lauf }: { lauf: Lauf }) {
  const mehrere = lauf.teile.length > 1;
  return (
    <section className="card sl-zeit" aria-label="Stoppuhr">
      <div className="sl-head">
        <h2>
          <Icon name="timer" /> Stoppuhr
        </h2>
        <p className="muted">
          Läuft live gegen die Soll-Zeit. Zeitüberschreitung: {ZEIT_PUNKTE_JE_10_SEK} Fehlerpunkte je angefangene 10 Sek.
        </p>
      </div>
      <div className={mehrere ? 'sl-uhren sl-uhren-multi' : 'sl-uhren'}>
        {lauf.teile.map((t, i) => (
          <Stoppuhr key={t.tabelle.titel} teil={t} index={i} lauf={lauf} titel={mehrere ? teilTitel(t) : null} />
        ))}
      </div>
    </section>
  );
}

const teilTitel = (t: LaufTeil) => t.tabelle.titel.replace(/^Fehlerpunkte Station /, '');

function Stoppuhr({ teil: t, index, lauf, titel }: { teil: LaufTeil; index: number; lauf: Lauf; titel: string | null }) {
  const over = t.sollSek !== null && t.sekunden > t.sollSek;
  const idle = !t.laeuft && t.sekunden === 0;
  const zv = t.zeitvorgaben[t.variante];
  const selectId = `sl-variante-${index}`;

  return (
    <div className={`sl-uhr ${over ? 'sl-over' : ''}`}>
      {titel && <h3 className="sl-uhr-title">{titel}</h3>}

      {t.zeitvorgaben.length > 1 && (
        <div className="sl-variante">
          <label htmlFor={selectId}>Soll-Zeit gilt für</label>
          <select
            id={selectId}
            value={t.variante}
            disabled={t.laeuft}
            onChange={(e) => lauf.setVariante(index, Number(e.target.value))}
          >
            {t.zeitvorgaben.map((z, i) => (
              <option key={z.label} value={i}>
                {z.label}
                {z.sekunden !== null ? ` — ${z.sekunden} Sek.` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {zv && zv.sekunden === null && (
        <div className="sl-variante">
          <label htmlFor={`${selectId}-eigen`}>Soll-Zeit in Sekunden ({zv.hinweis ?? 'frei'})</label>
          <input
            id={`${selectId}-eigen`}
            type="number"
            inputMode="numeric"
            min={1}
            max={3600}
            placeholder="z. B. 180"
            value={t.eigeneSoll}
            onChange={(e) => lauf.setEigeneSoll(index, e.target.value)}
          />
        </div>
      )}

      <div className="sl-display num" role="timer" aria-live="off">
        {formatStoppuhr(t.sekunden)}
      </div>

      <p className="sl-status num" aria-live="polite">
        {t.sollSek === null ? (
          'Keine Soll-Zeit gewählt'
        ) : over ? (
          <span>
            Überschreitung: <strong>{t.sekunden - t.sollSek} Sek.</strong> → <strong>+{t.zeitPunkte} Fehlerpunkte</strong>
          </span>
        ) : (
          <span>
            Soll {formatStoppuhr(t.sollSek)} · noch <strong>{formatMinuten(t.sollSek - t.sekunden)}</strong>
          </span>
        )}
      </p>

      <div className="sl-controls">
        <button
          type="button"
          className={`btn sl-start ${t.laeuft ? 'btn-secondary' : ''}`}
          onClick={() => lauf.startPause(index)}
        >
          <Icon name={t.laeuft ? 'pause' : 'play'} />
          {t.laeuft ? 'Pause' : idle ? 'Start' : 'Weiter'}
        </button>
        <button
          type="button"
          className="btn btn-secondary sl-reset"
          disabled={idle}
          onClick={() => lauf.resetUhr(index)}
          aria-label="Stoppuhr zurücksetzen"
        >
          <Icon name="rotate-ccw" />
          <span className="hide-sm">Reset</span>
        </button>
      </div>
    </div>
  );
}

/** Gesamt-Fehlerpunkte of this run against the station's own limit(s). */
export function LaufSumme({ lauf }: { lauf: Lauf }) {
  const mehrere = lauf.teile.length > 1;
  const max = lauf.teile.map((t) => t.tabelle.maxPunkte).join(' + ');
  return (
    <div className={`sl-summe ${lauf.bestanden ? 'sl-pass' : 'sl-fail'}`}>
      <div className="sl-summe-main">
        <span className="sl-summe-label">Gesamt-Fehlerpunkte</span>
        <span className="sl-summe-value num">{lauf.gesamt}</span>
        <span className="muted num">max. {max}</span>
      </div>
      <BestandenBadge bestanden={lauf.bestanden} />
      <ul className="sl-summe-teile num">
        {lauf.teile.map((t) => (
          <li key={t.tabelle.titel}>
            {mehrere && <strong>{teilTitel(t)}: </strong>}
            Checkliste {t.checkPunkte} + Zeit {t.zeitPunkte ?? 0}
            {mehrere && ` = ${t.summe} / ${t.tabelle.maxPunkte}`}
          </li>
        ))}
      </ul>
      <p className="muted sl-summe-hint">
        Station für sich betrachtet. Insgesamt gilt zusätzlich: höchstens 35 Fehlerpunkte über alle Stationen.
      </p>
    </div>
  );
}

export function BestandenBadge({ bestanden, label }: { bestanden: boolean; label?: string }) {
  return (
    <span className={`badge sl-badge ${bestanden ? 'sl-badge-pass' : 'sl-badge-fail'}`}>
      <Icon name={bestanden ? 'circle-check' : 'circle-x'} size="1.1em" />
      {label ?? (bestanden ? 'bestanden' : 'nicht bestanden')}
    </span>
  );
}

/**
 * Compact bar pinned to the bottom of the screen once a run has started, so the clock and
 * the running total stay in view while scrolling through the Fehlerpunkte.
 */
export function LaufLeiste({ lauf }: { lauf: Lauf }) {
  if (!lauf.begonnen) return null;
  const t = lauf.teile[lauf.aktiv];
  const over = t.sollSek !== null && t.sekunden > t.sollSek;
  return (
    <div className="sl-bar" role="region" aria-label="Laufender Durchgang">
      <div className="sl-bar-inner">
        <button
          type="button"
          className={`btn btn-icon sl-bar-btn ${t.laeuft ? 'btn-secondary' : ''}`}
          onClick={() => lauf.startPause(lauf.aktiv)}
          aria-label={t.laeuft ? 'Pause' : 'Start'}
        >
          <Icon name={t.laeuft ? 'pause' : 'play'} />
        </button>
        <span className={`sl-bar-time num ${over ? 'sl-bar-over' : ''}`}>{formatStoppuhr(t.sekunden)}</span>
        {lauf.teile.length > 1 && <span className="sl-bar-teil muted">{teilTitel(t)}</span>}
        <span className="sl-bar-points num">
          <strong>{lauf.gesamt}</strong> FP
        </span>
        <Icon
          name={lauf.bestanden ? 'circle-check' : 'circle-x'}
          className={lauf.bestanden ? 'sl-bar-pass' : 'sl-bar-fail'}
        />
        <span className="sr-only">{lauf.bestanden ? 'bestanden' : 'nicht bestanden'}</span>
      </div>
    </div>
  );
}

/**
 * Leiter-only: stores this run as the Trupp's latest result for the station (replaces the
 * previous one). Stops the clocks so the saved time matches what is shown.
 */
export function ErgebnisSpeichern({ station, truppId, lauf }: { station: Station; truppId: string; lauf: Lauf }) {
  const [trupp, setTrupp] = useState<Trupp | null>(null);
  const [letztes, setLetztes] = useState<StationErgebnis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState<StationErgebnis | null>(null);

  useEffect(() => {
    Promise.all([
      api<Trupp>(`/trupps/${truppId}`, { auth: 'leiter' }),
      api<StationErgebnis[]>(`/trupps/${truppId}/ergebnisse`, { auth: 'leiter' }),
    ])
      .then(([tr, list]) => {
        setTrupp(tr);
        setLetztes(list.find((e) => e.stationId === station.id) ?? null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [truppId, station.id]);

  // Starting a clock again begins a new run, so the confirmation no longer applies.
  useEffect(() => {
    if (lauf.laeuftIrgendwo) setGespeichert(null);
  }, [lauf.laeuftIrgendwo]);

  const save = async () => {
    const teile = lauf.stoppen();
    const body: ErgebnisInput = {
      zeitSekunden: teile.reduce((s, t) => s + t.zeitSekunden, 0),
      fehlerpunkte: teile.reduce((s, t) => s + t.fehlerpunkte, 0),
      ...(STATION_WERTUNG[station.id].teile.length > 1 ? { teile } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = await api<StationErgebnis>(`/trupps/${truppId}/ergebnisse/${station.id}`, {
        method: 'PUT',
        auth: 'leiter',
        body,
      });
      setGespeichert(saved);
      setLetztes(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sl-save stack">
      {error && (
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      {gespeichert ? (
        <div className="alert alert-ok">
          <Icon name="circle-check" />
          <div className="alert-body">
            <strong>Gespeichert</strong> für {trupp?.name ?? 'den Trupp'}: {formatStoppuhr(gespeichert.zeitSekunden)} ·{' '}
            {gespeichert.fehlerpunkte} Fehlerpunkte · {gespeichert.bestanden ? 'bestanden' : 'nicht bestanden'}.{' '}
            <Link to={`/rangliste?station=${station.id}`}>Zur Rangliste</Link>
          </div>
        </div>
      ) : (
        trupp && (
          <p className="muted num">
            Speichert diesen Durchgang als Ergebnis von <strong>{trupp.name}</strong>.
            {letztes &&
              ` Ersetzt das letzte vom ${formatDateTime(letztes.aufgenommenAm)} (${formatStoppuhr(letztes.zeitSekunden)} · ${letztes.fehlerpunkte} Fehlerpunkte).`}
          </p>
        )
      )}
      <button type="button" className="btn sl-save-btn" onClick={save} disabled={busy || !trupp || !lauf.begonnen} aria-busy={busy}>
        <Icon name="save" />
        {busy ? 'Speichere…' : 'Ergebnis speichern'}
      </button>
    </div>
  );
}
