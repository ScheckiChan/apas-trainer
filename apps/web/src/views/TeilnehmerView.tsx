import {
  CHECKLIST_LABELS,
  ROLLE_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  type ChecklistItem,
  type Gruppe,
  type Teilnehmer,
} from '@apas/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { PushButton } from '../components/PushButton';
import { api, clearToken, errorMessage } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { Calendar } from './Calendar';
import { Stations } from './Stations';
import './TeilnehmerView.css';

type Tab = 'checkliste' | 'kalender' | 'stationen';

export function TeilnehmerView() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Teilnehmer | null>(null);
  const [gruppe, setGruppe] = useState<Gruppe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('checkliste');

  useEffect(() => {
    api<{ teilnehmer: Teilnehmer; gruppe: Gruppe }>('/auth/teilnehmer/me', { auth: 'teilnehmer' })
      .then((r) => {
        setMe(r.teilnehmer);
        setGruppe(r.gruppe);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const toggle = async (item: ChecklistItem) => {
    if (!me) return;
    const next = me.checkliste[item] === 'ok' ? 'offen' : 'ok';
    try {
      const updated = await api<Teilnehmer>(`/gruppen/${me.gruppeId}/teilnehmer/${me.id}/checkliste`, {
        method: 'PATCH',
        auth: 'teilnehmer',
        body: { [item]: next },
      });
      setMe(updated);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const logout = () => {
    clearToken('teilnehmer');
    navigate('/login?teilnehmer=1', { replace: true });
  };

  return (
    <>
      <AppHeader>
        <PushButton auth="teilnehmer" />
        <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
          Abmelden
        </button>
      </AppHeader>
      <main className="page stack">
        {error && <div className="alert alert-error">{error}</div>}
        {!me || !gruppe ? (
          !error && <p className="muted">Lade…</p>
        ) : (
          <>
            <section className="tv-hero">
              <div>
                <div className="tv-hello">Servus, {me.name.split(' ')[0]}!</div>
                <h1>{gruppe.name}</h1>
                <div className="tv-meta">
                  {me.ff} · {ROLLE_LABELS[me.rolle]}
                </div>
              </div>
              <div className="tv-countdown">
                <strong>{countdownLabel(gruppe.pruefungstermin)}</strong>
                {gruppe.pruefungstermin && <span>Prüfung am {formatDate(gruppe.pruefungstermin)}</span>}
              </div>
            </section>

            <nav className="tv-tabs" role="tablist">
              {(
                [
                  ['checkliste', 'Checkliste'],
                  ['kalender', 'Kalender'],
                  ['stationen', 'Stationen'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`tv-tab ${tab === key ? 'tv-tab-active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'checkliste' && (
              <section className="card stack">
                <div className="tv-check-head">
                  <AmpelDot teilnehmer={me} />
                  <h2>Meine Voraussetzungen</h2>
                </div>
                <p className="muted">Tippe auf einen Punkt, um ihn zwischen „offen" und „ok" umzuschalten.</p>
                <ChecklistToggles teilnehmer={me} onToggle={toggle} />
                {!isChecklistItemRequired(me.rolle, 'tauglichkeit') && (
                  <p className="muted">
                    {CHECKLIST_LABELS.tauglichkeit} ist für die Rolle {ROLLE_LABELS[me.rolle]} nicht erforderlich.
                  </p>
                )}
                {checklistAmpel(me.rolle, me.checkliste) === 'gruen' && (
                  <div className="alert alert-ok">Alle Voraussetzungen erfüllt — du bist startklar!</div>
                )}
              </section>
            )}

            {tab === 'kalender' && <Calendar gruppeId={gruppe.id} auth="teilnehmer" currentTeilnehmerId={me.id} />}

            {tab === 'stationen' && <Stations />}
          </>
        )}
      </main>
    </>
  );
}
