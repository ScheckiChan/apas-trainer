import {
  isStationId,
  STATION_IDS,
  STATION_WERTUNG,
  type RanglistenEintrag,
  type StationId,
  type StationRangliste,
} from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { BestandenBadge } from '../components/StationLauf';
import { stationById } from '../content/stations';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, formatStoppuhr, formatTime } from '../lib/format';
import './Rangliste.css';

const REFRESH_MS = 30_000;

/**
 * Per-station leaderboards, meant to be glanced at (or projected) during a training session:
 * one station at a time, Trupps ranked by Zeit. Visible to every signed-in account.
 * Refreshes itself.
 */
export function Rangliste() {
  const [listen, setListen] = useState<StationRangliste[] | null>(null);
  const [stand, setStand] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ?station= so "Zur Rangliste" after saving lands on the station just run.
  const [searchParams, setSearchParams] = useSearchParams();
  const stationParam = searchParams.get('station') ?? '';
  const stationId: StationId = isStationId(stationParam) ? stationParam : STATION_IDS[0];
  const setStation = (id: StationId) =>
    setSearchParams(id === STATION_IDS[0] ? {} : { station: id }, { replace: true });

  const load = useCallback(() => {
    api<StationRangliste[]>('/rangliste')
      .then((r) => {
        setListen(r);
        setStand(new Date());
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const station = stationById(stationId);
  const eintraege = listen?.find((l) => l.stationId === stationId)?.eintraege;

  return (
    <>
      <AppHeader backTo="/">
        <button type="button" className="btn btn-ghost btn-small" onClick={load} title="Aktualisieren">
          <Icon name="refresh-cw" />
          <span className="hide-sm">Aktualisieren</span>
        </button>
      </AppHeader>
      <main className="page stack rl">
        <div>
          <h1>Rangliste</h1>
          <p className="rl-meta">
            Je Station nach Zeit, schnellste zuerst. Fehlerpunkte und ob der Durchgang bestanden wäre stehen daneben.
            {stand && <span className="num"> Stand {formatTime(stand.toISOString())}.</span>}
          </p>
        </div>

        <div className="rl-tabs" role="tablist" aria-label="Station">
          {STATION_IDS.map((id, i) => {
            const anzahl = listen?.find((l) => l.stationId === id)?.eintraege.length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === stationId}
                className={`rl-tab ${id === stationId ? 'rl-tab-active' : ''}`}
                onClick={() => setStation(id)}
              >
                <span className="rl-tab-nr num">{i + 1}</span>
                <span className="rl-tab-label">
                  {STATION_WERTUNG[id].teile[0]?.titel}
                  {anzahl !== undefined && (
                    <span className="rl-tab-count num">{anzahl === 0 ? 'noch leer' : anzahl === 1 ? '1 Trupp' : `${anzahl} Trupps`}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <section className="stack" role="tabpanel" aria-labelledby="rl-station-titel">
          <h2 id="rl-station-titel" className="rl-station-titel">
            {station ? `${station.nr}. ${station.titel}` : STATION_WERTUNG[stationId].titel}
          </h2>

          {error && (
            <div className="alert alert-error">
              <Icon name="triangle-alert" />
              <div className="alert-body">{error}</div>
            </div>
          )}
          {listen === null && !error && <p className="muted">Lade…</p>}
          {eintraege?.length === 0 && <p className="muted">Für diese Station ist noch kein Ergebnis gespeichert.</p>}

          {eintraege && eintraege.length > 0 && (
            <ol className="rl-list">
              {eintraege.map((r) => (
                <li key={r.truppId}>
                  <RanglistenZeile stationId={stationId} row={r} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}

function RanglistenZeile({ stationId, row: r }: { stationId: StationId; row: RanglistenEintrag }) {
  const e = r.ergebnis;
  const wertung = STATION_WERTUNG[stationId];
  const mehrere = wertung.teile.length > 1;

  return (
    <div className={`rl-row ${r.eigen ? 'rl-eigen' : ''} ${e.bestanden ? '' : 'rl-fail'}`}>
      <span className="rl-rang num" aria-label={`Rang ${r.rang}`}>
        {r.rang}
      </span>
      <span className="rl-main">
        <span className="rl-name">
          {r.truppName}
          {r.eigen && <span className="badge badge-accent">euer Trupp</span>}
        </span>
        <span className="rl-status">
          <BestandenBadge bestanden={e.bestanden} />
          <span className="rl-fp num">
            <strong>{e.fehlerpunkte}</strong> / {wertung.teile.map((t) => t.maxPunkte).join(' + ')} FP
          </span>
        </span>
        {mehrere && (
          <span className="rl-teile num">
            {e.teile
              .map((t, i) => `${wertung.teile[i]?.titel} ${formatStoppuhr(t.zeitSekunden)} · ${t.fehlerpunkte} FP`)
              .join(' — ')}
          </span>
        )}
        <span className="rl-when num">{formatDateTime(e.aufgenommenAm)}</span>
      </span>
      <span className="rl-zeit num">
        <strong>{formatStoppuhr(e.zeitSekunden)}</strong>
        <span>{mehrere ? 'Zeit gesamt' : 'Zeit'}</span>
      </span>
    </div>
  );
}
