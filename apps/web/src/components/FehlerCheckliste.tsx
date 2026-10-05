import { useState } from 'react';
import { punkteLabel, type FehlerTabelle } from '../content/stations';
import './FehlerCheckliste.css';

/**
 * "Worauf wird bewertet": one Fehlerpunkte table as a self-study checklist
 * ("hab ich vermieden"). Check state is deliberately component-local only.
 */
export function FehlerCheckliste({ tabelle }: { tabelle: FehlerTabelle }) {
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="fcl">
      <div className="fcl-head">
        <h3>{tabelle.titel}</h3>
        <span className="badge num">max. {tabelle.maxPunkte} Fehlerpunkte</span>
      </div>
      {tabelle.hinweis && <p className="muted fcl-hint">{tabelle.hinweis}</p>}
      <ul className="fcl-list">
        {tabelle.zeilen.map((z, i) => {
          const done = checked.has(i);
          return (
            <li key={z.fehler}>
              <label className={`fcl-item ${done ? 'fcl-done' : ''}`}>
                <input type="checkbox" checked={done} onChange={() => toggle(i)} />
                <span className="fcl-text">{z.fehler}</span>
                <span className={`fcl-points num ${z.punkte >= 10 ? 'fcl-points-high' : ''}`}>{punkteLabel(z)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="fcl-foot">
        <span className="muted num">
          {checked.size} von {tabelle.zeilen.length} vermieden
        </span>
        {checked.size > 0 && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setChecked(new Set())}>
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
