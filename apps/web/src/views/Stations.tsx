import { FEHLERPUNKTE_REGELN, QUELLE, STATIONEN } from '../content/stations';
import './Stations.css';

/** Static Stationskarten for APAS Bronze. */
export function Stations() {
  return (
    <div className="stations stack">
      <h1>Stationen — APAS Bronze</h1>

      <div className="stations-grid">
        {STATIONEN.map((s) => (
          <article key={s.nr} className="card station-card">
            <div className="station-nr">Station {s.nr}</div>
            <h2>{s.titel}</h2>
            <p>{s.ablauf}</p>
            <ul>
              {s.schwerpunkte.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </article>
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
