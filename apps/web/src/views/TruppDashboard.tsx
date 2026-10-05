import { ROLLEN, type Trupp, type TruppSummary } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { PushButton } from '../components/PushButton';
import { api, clearToken, errorMessage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import './TruppDashboard.css';

/**
 * Landing page of the Ausbildungsleiter: the Trupps of this APAS-Bronze-Ausbildung.
 * Usually just one or a handful — creating another Trupp is a secondary action.
 */
export function TruppDashboard() {
  const navigate = useNavigate();
  const [trupps, setTrupps] = useState<TruppSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api<TruppSummary[]>('/trupps', { auth: 'leiter' })
      .then(setTrupps)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const logout = () => {
    clearToken('leiter');
    navigate('/login', { replace: true });
  };

  const empty = trupps?.length === 0;

  return (
    <>
      <AppHeader>
        <Link to="/kalender" className="btn btn-ghost btn-small" title="Kalender">
          <Icon name="calendar-days" />
          <span className="hide-sm">Kalender</span>
        </Link>
        <Link to="/rangliste" className="btn btn-ghost btn-small" title="Rangliste">
          <Icon name="trophy" />
          <span className="hide-sm">Rangliste</span>
        </Link>
        <PushButton auth="leiter" />
        <button type="button" className="btn btn-ghost btn-small" onClick={logout} title="Abmelden">
          <Icon name="log-out" />
          <span className="hide-sm">Abmelden</span>
        </button>
      </AppHeader>
      <main className="page stack">
        <h1>Trupps</h1>

        {error && (
          <div className="alert alert-error">
            <Icon name="triangle-alert" />
            <div className="alert-body">{error}</div>
          </div>
        )}
        {trupps === null && !error && <p className="muted">Lade…</p>}
        {empty && <p className="muted">Noch kein Trupp angelegt.</p>}

        {trupps && trupps.length > 0 && (
          <div className="tl">
            <div className="tl-head" aria-hidden="true">
              <span>Trupp</span>
              <span>Rollen</span>
              <span>Teilnehmer</span>
              <span>Bereit</span>
              <span>Prüfung</span>
            </div>
            <ul className="tl-list">
              {trupps.map((t) => (
                <li key={t.id}>
                  <TruppRow trupp={t} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {trupps !== null &&
          (showCreate || empty ? (
            <CreateTrupp
              onCancel={empty ? undefined : () => setShowCreate(false)}
              onCreated={(t) => navigate(`/trupps/${t.id}`)}
            />
          ) : (
            <div>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowCreate(true)}>
                <Icon name="plus" />
                Neuen Trupp erstellen
              </button>
            </div>
          ))}
      </main>
    </>
  );
}

/** One table row with the real counts inline. Collapses to three lines on phones. */
function TruppRow({ trupp: t }: { trupp: TruppSummary }) {
  const days = t.pruefungstermin ? daysUntil(t.pruefungstermin) : null;
  const urgent = days !== null && days >= 0 && days <= 14;
  const rollenKomplett = t.rollenBesetzt === ROLLEN.length;
  return (
    <Link to={`/trupps/${t.id}`} className="tl-row">
      <span className="tl-name">{t.name}</span>
      <span className="tl-stats">
        <span className={`tl-cell ${rollenKomplett ? 'tl-ok' : 'tl-warn'}`}>
          <span className="num">
            {t.rollenBesetzt}/{ROLLEN.length}
          </span>
          <span className="tl-lbl">Rollen besetzt</span>
        </span>
        <span className="tl-cell">
          <span className="num">{t.teilnehmerCount}</span>
          <span className="tl-lbl">Teilnehmer</span>
        </span>
        <span className="tl-cell">
          <Icon name="circle-check" size="1.1em" className="tl-bereit-icon" />
          <span className="num">{t.bereitCount}</span>
          <span className="tl-lbl">bereit</span>
        </span>
      </span>
      <span className="tl-pruefung">
        <span className={`num ${urgent ? 'badge badge-accent' : 'tl-countdown'}`}>{countdownLabel(t.pruefungstermin)}</span>
        {t.pruefungstermin && <span className="tl-date num">am {formatDate(t.pruefungstermin)}</span>}
      </span>
      <Icon name="chevron-right" className="tl-chev" />
    </Link>
  );
}

function CreateTrupp({ onCreated, onCancel }: { onCreated: (t: Trupp) => void; onCancel?: () => void }) {
  const [name, setName] = useState('');
  const [pruefungstermin, setPruefungstermin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api<Trupp>('/trupps', {
        method: 'POST',
        auth: 'leiter',
        body: { name, pruefungstermin: pruefungstermin || null },
      });
      onCreated(t);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Neuen Trupp erstellen</h2>
      {error && (
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      <div className="dashboard-create-fields">
        <div>
          <label htmlFor="trupp-name">Name</label>
          <input
            id="trupp-name"
            required
            minLength={2}
            placeholder="z. B. Trupp 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="trupp-date">Prüfungstermin (optional)</label>
          <input
            id="trupp-date"
            type="date"
            value={pruefungstermin}
            onChange={(e) => setPruefungstermin(e.target.value)}
          />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Erstelle…' : 'Trupp erstellen'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
