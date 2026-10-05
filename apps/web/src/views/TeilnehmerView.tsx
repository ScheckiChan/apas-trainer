import {
  CHECKLIST_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  type ChecklistItem,
  type Gruppe,
  type Rolle,
  type Teilnehmer,
} from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { PushButton } from '../components/PushButton';
import { RolleSelect, RollenAbdeckung, rolleLabel, saveRolle } from '../components/Rollen';
import { api, clearToken, errorMessage } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { Calendar } from './Calendar';
import { Stations } from './Stations';
import './TeilnehmerView.css';

type Tab = 'checkliste' | 'gruppe' | 'kalender' | 'stationen';

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

  const changeRolle = async (t: Teilnehmer, rolle: Rolle | null) => {
    try {
      const updated = await saveRolle(t.id, rolle, 'teilnehmer');
      if (updated.id === me?.id) setMe(updated);
      return updated;
    } catch (err) {
      alert(errorMessage(err));
      return null;
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
                  {me.ff} · {rolleLabel(me.rolle)}
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
                  ['gruppe', 'Gruppe'],
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
                    {CHECKLIST_LABELS.tauglichkeit} ist für die Rolle {rolleLabel(me.rolle)} nicht erforderlich.
                  </p>
                )}
                {!me.rolle && (
                  <p className="muted">
                    Du hast noch keine Rolle. Die Rollen werden gemeinsam eingeteilt — im Tab „Gruppe".
                  </p>
                )}
                {checklistAmpel(me.rolle, me.checkliste) === 'gruen' && (
                  <div className="alert alert-ok">Alle Voraussetzungen erfüllt — du bist startklar!</div>
                )}
              </section>
            )}

            {tab === 'gruppe' && <GruppeTab me={me} onRolleChange={changeRolle} />}

            {tab === 'kalender' && <Calendar gruppeId={gruppe.id} auth="teilnehmer" currentTeilnehmerId={me.id} />}

            {tab === 'stationen' && <Stations />}
          </>
        )}
      </main>
    </>
  );
}

/**
 * Everyone in the Gruppe with their Ampel and Rolle. Role shuffling before the exam is a
 * group decision, so every Teilnehmer can change any Rolle here; checklists stay read-only.
 */
function GruppeTab({
  me,
  onRolleChange,
}: {
  me: Teilnehmer;
  onRolleChange: (t: Teilnehmer, rolle: Rolle | null) => Promise<Teilnehmer | null>;
}) {
  const [list, setList] = useState<Teilnehmer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Teilnehmer[]>(`/gruppen/${me.gruppeId}/teilnehmer`, { auth: 'teilnehmer' })
      .then(setList)
      .catch((err) => setError(errorMessage(err)));
  }, [me.gruppeId]);

  useEffect(load, [load]);

  const change = async (t: Teilnehmer, rolle: Rolle | null) => {
    const updated = await onRolleChange(t, rolle);
    if (updated) setList((l) => l?.map((x) => (x.id === updated.id ? updated : x)) ?? l);
  };

  // Keep my own row in sync with checklist toggles made on the other tab.
  const rows = list?.map((t) => (t.id === me.id ? me : t));

  return (
    <section className="card stack">
      <h2>Gruppe &amp; Rollen</h2>
      <p className="muted">
        Die Rollen könnt ihr jederzeit gemeinsam umstellen — jede Rolle darf auch mehrfach besetzt sein
        (Ergänzungsteilnehmer).
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {!rows ? (
        !error && <p className="muted">Lade…</p>
      ) : (
        <>
          <RollenAbdeckung teilnehmer={rows} />
          <ul className="tv-tn-list">
            {rows.map((t) => (
              <li key={t.id} className="tv-tn">
                <AmpelDot teilnehmer={t} />
                <div className="tv-tn-main">
                  <div className="tv-tn-name">
                    {t.name}
                    {t.id === me.id && <span className="badge">du</span>}
                  </div>
                  <div className="muted">{t.ff}</div>
                </div>
                <RolleSelect teilnehmer={t} onChange={(rolle) => change(t, rolle)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
