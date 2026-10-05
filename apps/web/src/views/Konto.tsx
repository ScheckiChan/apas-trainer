import {
  normalisiereWochentage,
  SYSTEM_ROLLE_LABELS,
  WOCHENTAG_KURZ,
  WOCHENTAG_LABELS,
  WOCHENTAGE,
  type MeResponse,
  type TrainingspraeferenzUpdate,
  type Wochentag,
} from '@apas/shared';
import { useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { TruppName } from '../components/TruppName';
import { api, errorMessage } from '../lib/api';
import { useMe, useSession } from '../lib/session';
import './Konto.css';

/** /konto — the signed-in account's own settings (every systemRolle). */
export function Konto() {
  const me = useMe();
  const { benutzer, trupp } = me;

  return (
    <>
      <AppHeader backTo="/" />
      <main className="page stack konto">
        <div>
          <h1>Mein Konto</h1>
          <p className="muted">
            {benutzer.name} · {SYSTEM_ROLLE_LABELS[benutzer.systemRolle]}
            {trupp && (
              <>
                {' · '}
                <TruppName name={trupp.name} icon={trupp.icon} />
              </>
            )}
          </p>
        </div>
        <Trainingspraeferenz me={me} />
      </main>
    </>
  );
}

/**
 * Preferred training days: 7 toggle chips, each tap saves right away (optimistic; on failure
 * the last saved state comes back with a short error). Informational only — Ausbilder see it
 * as a hint in the Kalender, it never restricts anything.
 */
function Trainingspraeferenz({ me }: { me: MeResponse }) {
  const { setMe } = useSession();
  const [tage, setTage] = useState<Wochentag[]>(me.benutzer.trainingspraeferenz ?? []);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Last state the server confirmed — what a failed save rolls back to. */
  const confirmed = useRef<Wochentag[]>(tage);
  /** Only the newest request may roll back / settle the UI (taps can overlap). */
  const seq = useRef(0);

  const toggle = async (tag: Wochentag) => {
    const next = normalisiereWochentage(tage.includes(tag) ? tage.filter((t) => t !== tag) : [...tage, tag]);
    setTage(next);
    setError(null);
    setStatus('saving');
    const n = ++seq.current;
    try {
      const body: TrainingspraeferenzUpdate = { tage: next };
      const res = await api<MeResponse>('/auth/me/trainingspraeferenz', { method: 'PUT', body });
      confirmed.current = res.benutzer.trainingspraeferenz;
      setMe(res);
      if (n === seq.current) {
        setTage(res.benutzer.trainingspraeferenz);
        setStatus('saved');
      }
    } catch (err) {
      if (n === seq.current) {
        setTage(confirmed.current);
        setStatus('idle');
        setError(`Nicht gespeichert: ${errorMessage(err)}`);
      }
    }
  };

  const auswahl = tage.length === 0 ? 'Keine Angabe' : tage.map((t) => WOCHENTAG_KURZ[t]).join(', ');

  return (
    <section className="card stack" aria-labelledby="konto-tage-head">
      <div>
        <h2 id="konto-tage-head">Bevorzugte Trainingstage</h2>
        <p className="muted">
          An welchen Wochentagen kannst du normalerweise üben? Das ist nur ein Hinweis für die Ausbilder bei der
          Terminplanung — du kannst trotzdem an jedem Tag eingeteilt werden und dich anmelden. Nichts ausgewählt
          bedeutet „keine Angabe“.
        </p>
      </div>

      <div className="konto-tage" role="group" aria-labelledby="konto-tage-head">
        {WOCHENTAGE.map((t) => {
          const an = tage.includes(t);
          return (
            <button
              key={t}
              type="button"
              className={`konto-tag ${an ? 'konto-tag-an' : ''}`}
              aria-pressed={an}
              aria-label={WOCHENTAG_LABELS[t]}
              title={WOCHENTAG_LABELS[t]}
              onClick={() => void toggle(t)}
            >
              <Icon name={an ? 'circle-check' : 'circle'} className="konto-tag-icon" />
              <span className="konto-tag-label">{WOCHENTAG_KURZ[t]}</span>
            </button>
          );
        })}
      </div>

      <p className="konto-tage-status" role="status">
        <span>
          <span className="muted">Ausgewählt: </span>
          <strong>{auswahl}</strong>
        </span>
        {status === 'saving' && <span className="muted">Speichert…</span>}
        {status === 'saved' && (
          <span className="konto-saved">
            <Icon name="check" size="1em" />
            Gespeichert
          </span>
        )}
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
    </section>
  );
}
