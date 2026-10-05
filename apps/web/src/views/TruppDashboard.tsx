import { ROLLEN, type Trupp, type TruppSummary } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
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
        <PushButton auth="leiter" />
        <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
          Abmelden
        </button>
      </AppHeader>
      <main className="page stack">
        <h1 className="dashboard-title">Trupps</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {trupps === null && !error && <p className="muted">Lade…</p>}
        {empty && <div className="card muted">Noch kein Trupp angelegt.</div>}

        {trupps && trupps.length > 0 && (
          <ul className="dashboard-list">
            {trupps.map((t) => (
              <li key={t.id}>
                <TruppRow trupp={t} />
              </li>
            ))}
          </ul>
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
                + Neuen Trupp erstellen
              </button>
            </div>
          ))}
      </main>
    </>
  );
}

function TruppRow({ trupp: t }: { trupp: TruppSummary }) {
  const days = t.pruefungstermin ? daysUntil(t.pruefungstermin) : null;
  const urgent = days !== null && days >= 0 && days <= 14;
  const rollenKomplett = t.rollenBesetzt === ROLLEN.length;
  return (
    <Link to={`/trupps/${t.id}`} className="card dashboard-card">
      <div className="dashboard-card-top">
        <h2>{t.name}</h2>
        <span className={`badge ${urgent ? 'badge-red' : ''}`}>{countdownLabel(t.pruefungstermin)}</span>
      </div>
      <div className="dashboard-card-stats">
        <span className={rollenKomplett ? '' : 'dashboard-warn'}>
          <strong>
            {t.rollenBesetzt}/{ROLLEN.length}
          </strong>{' '}
          Rollen besetzt
        </span>
        <span>
          <strong>{t.teilnehmerCount}</strong> Teilnehmer
        </span>
        <span>
          <span className="ampel ampel-gruen" /> <strong>{t.bereitCount}</strong> bereit
        </span>
      </div>
      <div className="muted dashboard-card-date">
        {t.pruefungstermin ? `Prüfung am ${formatDate(t.pruefungstermin)}` : 'Prüfungstermin noch offen'}
      </div>
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
      {error && <div className="alert alert-error">{error}</div>}
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
        <button className="btn" type="submit" disabled={busy}>
          Trupp erstellen
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
