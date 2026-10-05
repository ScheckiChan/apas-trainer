import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { FEHLERPUNKTE_REGELN, QUELLE, STATIONEN, type Station } from '../content/stations';
import './Stations.css';

/** "Soll 160–220 Sek." for variants of one task, "500 / 300 Sek." for separate parts. */
function sollZeit(s: Station): string | null {
  const sek = s.zeitvorgaben.flatMap((z) => (z.sekunden === null ? [] : [z.sekunden]));
  if (sek.length === 0) return null;
  if (sek.length > 2) return `${Math.min(...sek)}–${Math.max(...sek)} Sek.`;
  return `${sek.join(' / ')} Sek.`;
}

/**
 * Static Stationskarten for APAS Bronze. Each card links to the station's deep dive at
 * `${basePath}/${station.id}` (basePath depends on where the overview is mounted).
 */
export function Stations({ basePath }: { basePath: string }) {
  return (
    <div className="stations stack">
      <h1>Stationen — APAS Bronze</h1>

      <ol className="stations-grid">
        {STATIONEN.map((s) => {
          const zeit = sollZeit(s);
          return (
            <li key={s.nr}>
              <Link to={`${basePath}/${s.id}`} className="station-card" aria-label={`Station ${s.nr}: ${s.titel}`}>
                <span className="station-nr num" aria-hidden="true">
                  {s.nr}
                </span>
                <div className="station-body">
                  <h2>{s.titel}</h2>
                  <p className="station-facts num">
                    {zeit && (
                      <span>
                        <Icon name="clock" size="1.1em" /> Soll {zeit}
                      </span>
                    )}
                    <span>max. {s.fehlerpunkte.map((t) => t.maxPunkte).join(' + ')} Fehlerpunkte</span>
                  </p>
                  <p>{s.ablauf}</p>
                  <ul>
                    {s.schwerpunkte.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <span className="station-more">
                    Stoppuhr, Fehlerpunkte, Ablauf{s.fragenkatalog ? ' & Lernkarten' : ''}
                    <Icon name="arrow-right" size="1.1em" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

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
