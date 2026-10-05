import {
  GESAMT_MAX_FEHLERPUNKTE,
  STATION_IDS,
  STATION_WERTUNG,
  type RanglistenEintrag,
  type StationErgebnis,
} from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { BestandenBadge } from '../components/StationLauf';
import { stationById } from '../content/stations';
import { api, errorMessage, getToken } from '../lib/api';
import { formatDateTime, formatStoppuhr, formatTime } from '../lib/format';
import './Rangliste.css';

const REFRESH_MS = 30_000;

/**
 * Cross-Trupp Rangliste, meant to be glanced at (or projected) during a training session.
 * Visible to every signed-in Ausbildungsleiter or Teilnehmer. Refreshes itself.
 */
export function Rangliste() {
  const auth = getToken('leiter') ? 'leiter' : 'teilnehmer';
  const [rows, setRows] = useState<RanglistenEintrag[] | null>(null);
  const [stand, setStand] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<RanglistenEintrag[]>('/rangliste', { auth })
      .then((r) => {
        setRows(r);
        setStand(new Date());
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [auth]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

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
            Zuerst wer bestehen würde, dann weniger Fehlerpunkte. Trupps mit offenen Stationen stehen ohne Rang
            darunter.
            {stand && <span className="num"> Stand {formatTime(stand.toISOString())}.</span>}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <Icon name="triangle-alert" />
            <div className="alert-body">{error}</div>
          </div>
        )}
        {rows === null && !error && <p className="muted">Lade…</p>}
        {rows?.length === 0 && <p className="muted">Noch keine Trupps angelegt.</p>}

        {rows && rows.length > 0 && (
          <ol className="rl-list">
            {rows.map((r) => (
              <li key={r.truppId}>
                <RanglistenZeile row={r} />
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}

function RanglistenZeile({ row: r }: { row: RanglistenEintrag }) {
  const byStation = new Map(r.ergebnisse.map((e) => [e.stationId, e]));
  const schonDrueber = !r.vollstaendig && !r.bestanden && r.absolviert > 0;

  return (
    <details className={`rl-row ${r.eigen ? 'rl-eigen' : ''} ${r.vollstaendig ? '' : 'rl-offen'}`}>
      <summary className="rl-sum">
        <span className="rl-rang num" aria-label={r.rang ? `Rang ${r.rang}` : 'ohne Rang'}>
          {r.rang ?? '–'}
        </span>
        <span className="rl-main">
          <span className="rl-name">
            {r.truppName}
            {r.eigen && <span className="badge badge-accent">euer Trupp</span>}
          </span>
          <span className="rl-status">
            {r.vollstaendig ? (
              <BestandenBadge bestanden={r.bestanden} />
            ) : (
              <span className="badge rl-badge-offen num">
                <Icon name="circle-dashed" size="1.1em" />
                {r.absolviert}/{STATION_IDS.length} Stationen absolviert
              </span>
            )}
            {schonDrueber && <span className="rl-drueber">Limit bereits überschritten</span>}
          </span>
          <span className="rl-chips" aria-hidden="true">
            {STATION_IDS.map((id, i) => {
              const e = byStation.get(id);
              return (
                <span key={id} className={`rl-chip num ${!e ? 'rl-chip-open' : e.bestanden ? 'rl-chip-pass' : 'rl-chip-fail'}`}>
                  <Icon name={!e ? 'circle-dashed' : e.bestanden ? 'circle-check' : 'circle-x'} size="1em" />
                  {i + 1}
                  {e && <strong>{e.fehlerpunkte}</strong>}
                </span>
              );
            })}
          </span>
        </span>
        <span className="rl-total num">
          <strong>{r.gesamtFehlerpunkte}</strong>
          <span>/ {GESAMT_MAX_FEHLERPUNKTE} FP</span>
        </span>
        <Icon name="chevron-down" className="rl-chev" />
      </summary>

      <table className="rl-detail">
        <caption className="sr-only">Ergebnisse je Station für {r.truppName}</caption>
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">Zeit</th>
            <th scope="col">Fehlerpunkte</th>
            <th scope="col">Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          {STATION_IDS.map((id) => (
            <StationZeile key={id} stationId={id} e={byStation.get(id)} />
          ))}
        </tbody>
      </table>
    </details>
  );
}

function StationZeile({ stationId, e }: { stationId: (typeof STATION_IDS)[number]; e: StationErgebnis | undefined }) {
  const station = stationById(stationId);
  const wertung = STATION_WERTUNG[stationId];
  const mehrere = wertung.teile.length > 1;
  return (
    <tr className={e ? '' : 'rl-detail-open'}>
      <th scope="row">
        {station ? `${station.nr}. ${station.titel}` : wertung.titel}
        {e && <span className="rl-detail-when num">{formatDateTime(e.aufgenommenAm)}</span>}
      </th>
      {e ? (
        <>
          <td className="num">
            {formatStoppuhr(e.zeitSekunden)}
            {mehrere && (
              <span className="rl-detail-teile">
                {e.teile.map((t, i) => `${wertung.teile[i]?.titel} ${formatStoppuhr(t.zeitSekunden)}`).join(' · ')}
              </span>
            )}
          </td>
          <td className="num">
            <strong>{e.fehlerpunkte}</strong> / {wertung.teile.map((t) => t.maxPunkte).join(' + ')}
            {mehrere && (
              <span className="rl-detail-teile">
                {e.teile.map((t, i) => `${wertung.teile[i]?.titel} ${t.fehlerpunkte}`).join(' · ')}
              </span>
            )}
          </td>
          <td>
            <BestandenBadge bestanden={e.bestanden} />
          </td>
        </>
      ) : (
        <td colSpan={3} className="muted">
          noch offen
        </td>
      )}
    </tr>
  );
}
