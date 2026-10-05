import { Link } from 'react-router-dom';
import { FehlerCheckliste } from '../components/FehlerCheckliste';
import { Flashcards } from '../components/Flashcards';
import { Icon } from '../components/Icon';
import { ErgebnisSpeichern, LaufLeiste, LaufSumme, Zeitnehmung } from '../components/StationLauf';
import { StepThrough } from '../components/StepThrough';
import { FRAGENKATALOG, QUELLE, STATIONEN, stationById, type Station, type Zeitvorgabe } from '../content/stations';
import { formatMinuten } from '../lib/format';
import { useLauf } from '../lib/useLauf';
import './StationDetail.css';
import './Stations.css';

/**
 * Per-station deep dive: Zeitvorgabe, live Stoppuhr + Fehlerpunkte scoring for a run,
 * animated Ablauf step-through, and (Station 4) the Gerätekunde flashcards.
 * `basePath` is the station overview this page belongs to (links back/next stay in it).
 * `truppId` is set on the Ausbildungsleiter's Trupp route and enables "Ergebnis speichern".
 */
export function StationDetail({
  stationId,
  basePath,
  truppId,
}: {
  stationId: string | undefined;
  basePath: string;
  truppId?: string;
}) {
  const station = stationById(stationId);
  if (!station) {
    return (
      <div className="stack">
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">Station nicht gefunden.</div>
        </div>
        <Link to={basePath} className="btn btn-secondary">
          <Icon name="arrow-left" />
          Zur Stationsübersicht
        </Link>
      </div>
    );
  }

  // Keyed so prev/next navigation starts a fresh run.
  return <StationSeite key={station.id} station={station} basePath={basePath} truppId={truppId} />;
}

function StationSeite({ station, basePath, truppId }: { station: Station; basePath: string; truppId?: string }) {
  const lauf = useLauf(station);
  const pos = STATIONEN.indexOf(station);
  const prev = STATIONEN[pos - 1];
  const next = STATIONEN[pos + 1];

  return (
    <div className="sd stack">
      <div>
        <h1>{station.titel}</h1>
        <p className="sd-meta num">
          Station {station.nr} von {STATIONEN.length} · Bestimmungen Abschnitt {station.abschnitt}
        </p>
      </div>

      <section className="sd-zeit" aria-label="Zeitvorgabe">
        <h2 className="sd-zeit-title">
          <Icon name="clock" /> Soll-Zeit
        </h2>
        <dl className="sd-zeit-list">
          {station.zeitvorgaben.map((z) => (
            <ZeitZeile key={z.label} z={z} />
          ))}
        </dl>
      </section>

      {station.hinweise.length > 0 && (
        <div className="alert alert-warn">
          <Icon name="triangle-alert" />
          <ul className="alert-body sd-hinweise">
            {station.hinweise.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <Zeitnehmung lauf={lauf} />

      <section className="card stack">
        <div>
          <h2>Fehlerpunkte — dieser Durchgang</h2>
          <p className="muted sd-intro">
            Abhaken bzw. mitzählen, was beim Durchgang passiert. Die Zeitüberschreitung rechnet die Stoppuhr
            dazu. {truppId ? 'Gespeichert wird erst mit „Ergebnis speichern".' : 'Zum Üben — wird nicht gespeichert.'}
          </p>
        </div>
        {lauf.teile.map((t, i) => (
          <FehlerCheckliste
            key={t.tabelle.titel}
            tabelle={t.tabelle}
            counts={t.counts}
            zeitPunkte={t.zeitPunkte}
            onChange={(zeile, count) => lauf.setCount(i, zeile, count)}
            onReset={() => lauf.resetCounts(i)}
          />
        ))}
        <LaufSumme lauf={lauf} />
        {truppId && <ErgebnisSpeichern station={station} truppId={truppId} lauf={lauf} />}
      </section>

      <section className="card">
        <h2>Ablauf Schritt für Schritt</h2>
        <StepThrough schritte={station.schritte} />
      </section>

      {station.zusatz.map((z) => (
        <section key={z.titel} className="card sd-zusatz">
          <h2>{z.titel}</h2>
          {z.punkte && (
            <ol>
              {z.punkte.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
          {z.text && <p>{z.text}</p>}
        </section>
      ))}

      {station.fragenkatalog && (
        <section className="card">
          <h2>Gerätekunde — Fragenkatalog</h2>
          <p className="muted sd-intro">
            Alle {FRAGENKATALOG.length} Fragen als Lernkarten. Bei der Prüfung beantwortet der GKDT 15 davon.
          </p>
          <Flashcards fragen={FRAGENKATALOG} />
        </section>
      )}

      <nav className="sd-pager">
        {prev ? (
          <Link className="btn btn-secondary sd-pager-prev" to={`${basePath}/${prev.id}`}>
            <Icon name="chevron-left" />
            <span>
              {prev.nr}. {prev.titel}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn btn-secondary sd-pager-next" to={`${basePath}/${next.id}`}>
            <span>
              {next.nr}. {next.titel}
            </span>
            <Icon name="chevron-right" />
          </Link>
        )}
      </nav>

      <p className="stations-source">{QUELLE}</p>

      <LaufLeiste lauf={lauf} />
    </div>
  );
}

function ZeitZeile({ z }: { z: Zeitvorgabe }) {
  return (
    <div className="sd-zeit-row">
      <dt>{z.label}</dt>
      {z.sekunden !== null ? (
        <dd className="num">
          <strong>{z.sekunden} Sek.</strong>
          <span>max. {formatMinuten(z.sekunden)}</span>
        </dd>
      ) : (
        <dd className="sd-zeit-text">{z.hinweis}</dd>
      )}
    </div>
  );
}
