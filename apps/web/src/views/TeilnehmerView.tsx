import {
  CHECKLIST_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  type ChecklistItem,
  type Trupp,
  type Rolle,
  type Teilnehmer,
} from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { PushButton } from '../components/PushButton';
import { RolleSelect, RollenAbdeckung, rolleLabel, saveRolle } from '../components/Rollen';
import { api, clearToken, errorMessage } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { Calendar } from './Calendar';
import { Stations } from './Stations';
import './TeilnehmerView.css';

const TABS = ['checkliste', 'trupp', 'kalender', 'stationen'] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);

export function TeilnehmerView() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Teilnehmer | null>(null);
  const [trupp, setTrupp] = useState<Trupp | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ?tab= so the station detail pages can link back to the Stationen tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'checkliste';
  const setTab = (t: Tab) => setSearchParams(t === 'checkliste' ? {} : { tab: t }, { replace: true });

  useEffect(() => {
    api<{ teilnehmer: Teilnehmer; trupp: Trupp }>('/auth/teilnehmer/me', { auth: 'teilnehmer' })
      .then((r) => {
        setMe(r.teilnehmer);
        setTrupp(r.trupp);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const toggle = async (item: ChecklistItem) => {
    if (!me) return;
    const next = me.checkliste[item] === 'ok' ? 'offen' : 'ok';
    try {
      const updated = await api<Teilnehmer>(`/trupps/${me.truppId}/teilnehmer/${me.id}/checkliste`, {
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
        {!me || !trupp ? (
          !error && <p className="muted">Lade…</p>
        ) : (
          <>
            <section className="tv-hero">
              <div>
                <div className="tv-hello">Servus, {me.name.split(' ')[0]}!</div>
                <h1>{trupp.name}</h1>
                <div className="tv-meta">
                  {me.ff} · {rolleLabel(me.rolle)}
                </div>
              </div>
              <div className="tv-countdown">
                <strong>{countdownLabel(trupp.pruefungstermin)}</strong>
                {trupp.pruefungstermin && <span>Prüfung am {formatDate(trupp.pruefungstermin)}</span>}
              </div>
            </section>

            <nav className="tv-tabs" role="tablist">
              {(
                [
                  ['checkliste', 'Checkliste'],
                  ['trupp', 'Trupp'],
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
                    Du hast noch keine Rolle. Die Rollen werden gemeinsam eingeteilt — im Tab „Trupp".
                  </p>
                )}
                {checklistAmpel(me.rolle, me.checkliste) === 'gruen' && (
                  <div className="alert alert-ok">Alle Voraussetzungen erfüllt — du bist startklar!</div>
                )}
              </section>
            )}

            {tab === 'trupp' && <TruppTab me={me} onRolleChange={changeRolle} />}

            {tab === 'kalender' && <Calendar truppId={trupp.id} auth="teilnehmer" currentTeilnehmerId={me.id} />}

            {tab === 'stationen' && <Stations basePath="/teilnehmer/stationen" />}
          </>
        )}
      </main>
    </>
  );
}

/**
 * Everyone in the Trupp with their Ampel and Rolle. Role shuffling before the exam is a
 * joint decision, so every Teilnehmer can change any Rolle here; checklists stay read-only.
 */
function TruppTab({
  me,
  onRolleChange,
}: {
  me: Teilnehmer;
  onRolleChange: (t: Teilnehmer, rolle: Rolle | null) => Promise<Teilnehmer | null>;
}) {
  const [list, setList] = useState<Teilnehmer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Teilnehmer[]>(`/trupps/${me.truppId}/teilnehmer`, { auth: 'teilnehmer' })
      .then(setList)
      .catch((err) => setError(errorMessage(err)));
  }, [me.truppId]);

  useEffect(load, [load]);

  const change = async (t: Teilnehmer, rolle: Rolle | null) => {
    const updated = await onRolleChange(t, rolle);
    if (updated) setList((l) => l?.map((x) => (x.id === updated.id ? updated : x)) ?? l);
  };

  // Keep my own row in sync with checklist toggles made on the other tab.
  const rows = list?.map((t) => (t.id === me.id ? me : t));

  return (
    <section className="card stack">
      <h2>Trupp &amp; Rollen</h2>
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
