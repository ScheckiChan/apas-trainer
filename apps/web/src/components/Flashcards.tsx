import { useState } from 'react';
import type { Frage } from '../content/stations';
import { Icon } from './Icon';
import './Flashcards.css';

function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Lernkarten: one question at a time, tap to flip, prev/next, optional shuffled order. */
export function Flashcards({ fragen }: { fragen: readonly Frage[] }) {
  const [order, setOrder] = useState<readonly Frage[]>(fragen);
  const [isShuffled, setIsShuffled] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = order.length;
  const frage = order[index]!;

  const goTo = (i: number) => {
    setIndex((i + total) % total);
    setFlipped(false);
  };

  const toggleShuffle = () => {
    setOrder(isShuffled ? fragen : shuffled(fragen));
    setIsShuffled((s) => !s);
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="flash">
      <div className="flash-head">
        <span className="flash-count num">
          Karte <strong>{index + 1}</strong> von {total}
        </span>
        <button type="button" className="btn btn-ghost btn-small" onClick={toggleShuffle} aria-pressed={isShuffled}>
          <Icon name={isShuffled ? 'rotate-ccw' : 'shuffle'} />
          {isShuffled ? 'Originalreihenfolge' : 'Mischen'}
        </button>
      </div>

      {/* div, not <button>: the faces contain block content (p/ul). */}
      <div
        // new key per card: a fresh card always starts on the question side without a flip-back animation
        key={frage.nr}
        role="button"
        tabIndex={0}
        className={`flash-card ${flipped ? 'flash-flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        aria-label={flipped ? 'Antwort — tippen für die Frage' : 'Frage — tippen für die Antwort'}
      >
        <div className="flash-inner">
          <div className="flash-face flash-front" aria-hidden={flipped}>
            <span className="flash-label num">Frage {frage.nr}</span>
            <p className="flash-question">{frage.frage}</p>
            <span className="flash-hint">
              <Icon name="refresh-cw" size="1em" /> Tippen zum Umdrehen
            </span>
          </div>
          <div className="flash-face flash-back" aria-hidden={!flipped}>
            <span className="flash-label num">Antwort {frage.nr}</span>
            {Array.isArray(frage.antwort) ? (
              <ul className="flash-answer">
                {frage.antwort.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="flash-answer">{frage.antwort}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flash-nav">
        <button type="button" className="btn btn-secondary" onClick={() => goTo(index - 1)}>
          <Icon name="chevron-left" />
          Vorherige
        </button>
        <button type="button" className="btn" onClick={() => goTo(index + 1)}>
          Nächste
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}
