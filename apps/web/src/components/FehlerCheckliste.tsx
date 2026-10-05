import { punkteLabel, type Fehlerpunkt, type FehlerTabelle } from '../content/stations';
import { Icon } from './Icon';
import './FehlerCheckliste.css';

/** The Zeitüberschreitung row is never ticked by hand — the Stoppuhr computes it. */
export const isZeitZeile = (z: Fehlerpunkt): boolean => z.bezug === 'je 10 Sek.';

/** Points from the ticked / counted rows (without Zeitüberschreitung). */
export const checklistenPunkte = (tabelle: FehlerTabelle, counts: readonly number[]): number =>
  tabelle.zeilen.reduce((sum, z, i) => sum + (isZeitZeile(z) ? 0 : (counts[i] ?? 0) * z.punkte), 0);

const MAX_COUNT = 9;

/**
 * One Fehlerpunkte table as a live scoring sheet: tick what happened during the run.
 * Rows that apply "je Mitglied" / "je Fall" get a counter, one-off rows a checkbox, and
 * the Zeitüberschreitung row shows the points computed from the Stoppuhr.
 * State lives in the parent (useLauf) so the Gesamt-Fehlerpunkte can be summed.
 */
export function FehlerCheckliste({
  tabelle,
  counts,
  onChange,
  zeitPunkte,
  onReset,
}: {
  tabelle: FehlerTabelle;
  counts: readonly number[];
  onChange: (zeile: number, count: number) => void;
  /** null = no Soll-Zeit chosen, so Zeitüberschreitung can't be computed. */
  zeitPunkte: number | null;
  onReset: () => void;
}) {
  const summe = checklistenPunkte(tabelle, counts) + (zeitPunkte ?? 0);
  const ueber = summe > tabelle.maxPunkte;
  const touched = counts.some((c) => c > 0);

  return (
    <div className="fcl">
      <div className="fcl-head">
        <h3>{tabelle.titel}</h3>
        <span className="badge num">max. {tabelle.maxPunkte} Fehlerpunkte</span>
      </div>
      {tabelle.hinweis && <p className="muted fcl-hint">{tabelle.hinweis}</p>}
      <ul className="fcl-list">
        {tabelle.zeilen.map((z, i) => {
          const count = counts[i] ?? 0;
          const high = z.punkte >= 10 ? 'fcl-points-high' : '';
          if (isZeitZeile(z)) {
            return (
              <li key={z.fehler}>
                <div className={`fcl-item fcl-auto ${zeitPunkte ? 'fcl-hit' : ''}`}>
                  <Icon name="timer" className="fcl-auto-icon" />
                  <span className="fcl-text">
                    {z.fehler}
                    <span className="fcl-sub">
                      {zeitPunkte === null ? 'Soll-Zeit wählen — dann rechnet die Stoppuhr mit' : 'automatisch aus der Stoppuhr'}
                    </span>
                  </span>
                  <span className="fcl-points num">
                    {zeitPunkte ? `+${zeitPunkte}` : punkteLabel(z)}
                  </span>
                </div>
              </li>
            );
          }
          if (z.bezug === null) {
            return (
              <li key={z.fehler}>
                <label className={`fcl-item ${count ? 'fcl-hit' : ''}`}>
                  <input type="checkbox" checked={count > 0} onChange={(e) => onChange(i, e.target.checked ? 1 : 0)} />
                  <span className="fcl-text">{z.fehler}</span>
                  <span className={`fcl-points num ${high}`}>{punkteLabel(z)}</span>
                </label>
              </li>
            );
          }
          return (
            <li key={z.fehler}>
              <div className={`fcl-item fcl-counted ${count ? 'fcl-hit' : ''}`}>
                <span className="fcl-stepper">
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    disabled={count === 0}
                    onClick={() => onChange(i, count - 1)}
                    aria-label={`${z.fehler}: einen weniger`}
                  >
                    <Icon name="minus" />
                  </button>
                  <output className="fcl-count num" aria-live="polite">
                    {count}
                  </output>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    disabled={count >= MAX_COUNT}
                    onClick={() => onChange(i, count + 1)}
                    aria-label={`${z.fehler}: einen mehr`}
                  >
                    <Icon name="plus" />
                  </button>
                </span>
                <span className="fcl-text">{z.fehler}</span>
                <span className={`fcl-points num ${high}`}>
                  {count > 1 ? `${count} × ${z.punkte} = ${count * z.punkte}` : punkteLabel(z)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fcl-foot">
        <span className={`fcl-sum num ${ueber ? 'fcl-sum-over' : ''}`}>
          {summe} von max. {tabelle.maxPunkte} Fehlerpunkten
        </span>
        {touched && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onReset}>
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
