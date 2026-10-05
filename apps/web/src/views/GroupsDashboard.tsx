import type { Gruppe, GruppeSummary } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { PushButton } from '../components/PushButton';
import { api, clearToken, errorMessage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import './GroupsDashboard.css';

export function GroupsDashboard() {
  const navigate = useNavigate();
  const [gruppen, setGruppen] = useState<GruppeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () =>
    api<GruppeSummary[]>('/gruppen', { auth: 'leiter' })
      .then(setGruppen)
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    void load();
  }, []);

  const logout = () => {
    clearToken('leiter');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <AppHeader>
        <PushButton auth="leiter" />
        <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
          Abmelden
        </button>
      </AppHeader>
      <main className="page stack">
        <div className="dashboard-head">
          <h1>Meine Übungsgruppen</h1>
          <button type="button" className="btn" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? 'Abbrechen' : '+ Neue Gruppe'}
          </button>
        </div>

        {showCreate && (
          <CreateGruppe
            onCreated={(g) => {
              setShowCreate(false);
              navigate(`/gruppen/${g.id}`);
            }}
          />
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {gruppen === null && !error && <p className="muted">Lade…</p>}
        {gruppen?.length === 0 && (
          <div className="card muted">Noch keine Gruppe. Lege die erste Übungsgruppe an und teile den Einladungslink.</div>
        )}

        <div className="dashboard-grid">
          {gruppen?.map((g) => <GruppeCard key={g.id} gruppe={g} />)}
        </div>
      </main>
    </>
  );
}

function GruppeCard({ gruppe: g }: { gruppe: GruppeSummary }) {
  const days = g.pruefungstermin ? daysUntil(g.pruefungstermin) : null;
  const urgent = days !== null && days >= 0 && days <= 14;
  return (
    <Link to={`/gruppen/${g.id}`} className="card dashboard-card">
      <div className="dashboard-card-top">
        <h2>{g.name}</h2>
        <span className={`badge ${urgent ? 'badge-red' : ''}`}>{countdownLabel(g.pruefungstermin)}</span>
      </div>
      <div className="muted">
        {g.pruefungstermin ? `Prüfung am ${formatDate(g.pruefungstermin)}` : 'Prüfungstermin noch offen'}
      </div>
      <div className="dashboard-card-stats">
        <span>
          <strong>{g.teilnehmerCount}</strong> Teilnehmer
        </span>
        <span>
          <span className="ampel ampel-gruen" /> <strong>{g.bereitCount}</strong> bereit
        </span>
      </div>
      {g.teilnehmerCount > 0 && (
        <div className="dashboard-progress" aria-hidden>
          <div style={{ width: `${(g.bereitCount / g.teilnehmerCount) * 100}%` }} />
        </div>
      )}
    </Link>
  );
}

function CreateGruppe({ onCreated }: { onCreated: (g: Gruppe) => void }) {
  const [name, setName] = useState('');
  const [pruefungstermin, setPruefungstermin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const g = await api<Gruppe>('/gruppen', {
        method: 'POST',
        auth: 'leiter',
        body: { name, pruefungstermin: pruefungstermin || null },
      });
      onCreated(g);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Neue Übungsgruppe</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="dashboard-create-fields">
        <div>
          <label htmlFor="g-name">Name</label>
          <input
            id="g-name"
            required
            minLength={2}
            placeholder="z. B. APAS Bronze Abschnitt Fels 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="g-date">Prüfungstermin (optional)</label>
          <input id="g-date" type="date" value={pruefungstermin} onChange={(e) => setPruefungstermin(e.target.value)} />
        </div>
      </div>
      <div>
        <button className="btn" type="submit" disabled={busy}>
          Gruppe anlegen
        </button>
      </div>
    </form>
  );
}
