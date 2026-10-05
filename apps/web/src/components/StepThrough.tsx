import { useRef, useState, type TouchEvent } from 'react';
import type { AblaufSchritt } from '../content/stations';
import './StepThrough.css';

/**
 * Guided walk-through of a station's Ablauf: one active step (animated in with pure CSS),
 * Weiter/Zurück, a progress bar, and the full numbered list below for orientation/jumping.
 * Swiping left/right on the active card also navigates.
 */
export function StepThrough({ schritte }: { schritte: AblaufSchritt[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const touchX = useRef<number | null>(null);
  const total = schritte.length;
  const step = schritte[index]!;

  const goTo = (i: number) => {
    if (i < 0 || i >= total || i === index) return;
    setDir(i > index ? 'next' : 'prev');
    setIndex(i);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    const end = e.changedTouches[0]?.clientX;
    touchX.current = null;
    if (start === null || end === undefined || Math.abs(end - start) < 50) return;
    goTo(end < start ? index + 1 : index - 1);
  };

  return (
    <div className="steps">
      <div className="steps-progress-label" aria-live="polite">
        Schritt {index + 1} von {total}
      </div>
      <div
        className="steps-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div className="steps-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* key remounts the card so the enter animation runs on every step change */}
        <article key={index} className={`steps-card steps-enter-${dir}`}>
          <div className="steps-card-nr">{index + 1}</div>
          <div className="steps-card-body">
            <h3>{step.titel}</h3>
            <SchrittInhalt schritt={step} />
          </div>
        </article>
      </div>

      <div className="steps-nav">
        <button type="button" className="btn btn-secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
          ← Zurück
        </button>
        {index < total - 1 ? (
          <button type="button" className="btn" onClick={() => goTo(index + 1)}>
            Weiter →
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => goTo(0)}>
            ↺ Von vorne
          </button>
        )}
      </div>

      <ol className="steps-list">
        {schritte.map((s, i) => (
          <li key={s.titel} className={i === index ? 'steps-list-active' : i < index ? 'steps-list-done' : ''}>
            <button type="button" onClick={() => goTo(i)} aria-current={i === index ? 'step' : undefined}>
              <span className="steps-list-nr">{i < index ? '✓' : i + 1}</span>
              <span>{s.titel}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SchrittInhalt({ schritt }: { schritt: AblaufSchritt }) {
  return (
    <>
      {schritt.text && <p>{schritt.text}</p>}
      {schritt.punkte && (
        <ul>
          {schritt.punkte.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </>
  );
}
