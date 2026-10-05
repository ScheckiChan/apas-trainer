import { Link } from 'react-router-dom';
import { FEHLERPUNKTE_REGELN, QUELLE, STATIONEN } from '../content/stations';
import './Stations.css';

/**
 * Static Stationskarten for APAS Bronze. Each card links to the station's deep dive at
 * `${basePath}/${station.id}` (basePath depends on where the overview is mounted).
 */
export function Stations({ basePath }: { basePath: string }) {
  return (
    <div className="stations stack">
      <h1>Stationen — APAS Bronze</h1>

      <div className="stations-grid">
        {STATIONEN.map((s) => (
          <Link key={s.nr} to={`${basePath}/${s.id}`} className="card station-card">
            <div className="station-nr">Station {s.nr}</div>
            <h2>{s.titel}</h2>
            <p>{s.ablauf}</p>
            <ul>
              {s.schwerpunkte.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <span className="station-more">Ablauf, Checkliste{s.fragenkatalog ? ' & Lernkarten' : ''} →</span>
          </Link>
        ))}
      </div>

      <section className="card stations-rules">
        <h2>Fehlerpunkte — Grundregel</h2>
        <ul>
          {FEHLERPUNKTE_REGELN.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <p className="stations-source">{QUELLE}</p>
    </div>
  );
}
