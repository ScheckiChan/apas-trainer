import { Link } from 'react-router-dom';
import { FehlerCheckliste } from '../components/FehlerCheckliste';
import { Flashcards } from '../components/Flashcards';
import { Icon } from '../components/Icon';
import { StepThrough } from '../components/StepThrough';
import { FRAGENKATALOG, QUELLE, STATIONEN, stationById, type Zeitvorgabe } from '../content/stations';
import './StationDetail.css';
import './Stations.css';

const minuten = (sek: number) => `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')} min`;

/**
 * Per-station deep dive: Zeitvorgabe, animated Ablauf step-through, Fehlerpunkte as a
 * self-study checklist, and (Station 4) the Gerätekunde flashcards.
 * `basePath` is the station overview this page belongs to (links back/next stay in it).
 */
export function StationDetail({ stationId, basePath }: { stationId: string | undefined; basePath: string }) {
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

      <section className="card stack">
        <div>
          <h2>Checkliste — worauf wird bewertet</h2>
          <p className="muted sd-intro">
            Zum Selbststudium: abhaken, was du sicher vermeidest. Wird nicht gespeichert.
          </p>
        </div>
        {station.fehlerpunkte.map((t) => (
          <FehlerCheckliste key={t.titel} tabelle={t} />
        ))}
      </section>

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
          <span>max. {minuten(z.sekunden)}</span>
        </dd>
      ) : (
        <dd className="sd-zeit-text">{z.hinweis}</dd>
      )}
    </div>
  );
}
