import {
  CHECKLIST_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  kannTruppIdentitaetBearbeiten,
  type Benutzer,
  type ChecklistItem,
  type MeResponse,
  type Rolle,
  type Teilnehmer,
  type Trupp,
} from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { HauptNav } from '../components/HauptNav';
import { Icon } from '../components/Icon';
import { RolleSelect, RollenAbdeckung, rolleLabel, saveRolle } from '../components/Rollen';
import { TruppIdentitaet } from '../components/TruppIdentitaet';
import { TruppName } from '../components/TruppName';
import { api, errorMessage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import { useMe, useSession } from '../lib/session';
import { Stations } from './Stations';
import './TeilnehmerView.css';

const TABS = ['checkliste', 'trupp', 'stationen'] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);

const urgentCountdown = (termin: string | null | undefined): boolean => {
  if (!termin) return false;
  const days = daysUntil(termin);
  return days >= 0 && days <= 14;
};

/** A Teilnehmer account that belongs to a Trupp. */
type Mitglied = Benutzer & { truppId: string };

/** Home of a Teilnehmer: their Trupp — or, without one yet, a calm "wait for your Trupp" state. */
export function TeilnehmerView() {
  const me = useMe();
  const [searchParams] = useSearchParams();

  // The calendar used to be a tab here; it is now the shared /kalender of all Trupps.
  if (searchParams.get('tab') === 'kalender') return <Navigate to="/kalender" replace />;

  return (
    <>
      <AppHeader>
        <HauptNav />
      </AppHeader>
      <main className="page stack">
        {me.benutzer.truppId && me.trupp ? (
          <TruppHome me={me} benutzer={me.benutzer as Mitglied} trupp={me.trupp} />
        ) : (
          <OhneTrupp benutzer={me.benutzer} />
        )}
      </main>
    </>
  );
}

function TruppHome({ me, benutzer, trupp }: { me: MeResponse; benutzer: Mitglied; trupp: Trupp }) {
  const { setMe } = useSession();
  // ?tab= so the station detail pages can link back to the Stationen tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'checkliste';
  const setTab = (t: Tab) => setSearchParams(t === 'checkliste' ? {} : { tab: t }, { replace: true });

  /** Keeps the session copy of the own account in sync after a change in this view. */
  const merge = (t: Teilnehmer) =>
    setMe({ ...me, benutzer: { ...me.benutzer, rolle: t.rolle, checkliste: t.checkliste } });

  const toggle = async (item: ChecklistItem) => {
    const next = benutzer.checkliste[item] === 'ok' ? 'offen' : 'ok';
    try {
      merge(
        await api<Teilnehmer>(`/trupps/${benutzer.truppId}/teilnehmer/${benutzer.id}/checkliste`, {
          method: 'PATCH',
          body: { [item]: next },
        }),
      );
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const changeRolle = async (t: Teilnehmer, rolle: Rolle | null) => {
    try {
      const updated = await saveRolle(t.id, rolle);
      if (updated.id === benutzer.id) merge(updated);
      return updated;
    } catch (err) {
      alert(errorMessage(err));
      return null;
    }
  };

  return (
    <>
      <section className="tv-head">
        <div>
          <h1>
            <TruppName name={trupp.name} icon={trupp.icon} />
          </h1>
          <p className="tv-meta">
            Servus, {benutzer.name.split(' ')[0]} — {benutzer.ff ? `${benutzer.ff} · ` : ''}
            {rolleLabel(benutzer.rolle)}
          </p>
        </div>
        <div className="tv-countdown">
          <strong className={`num ${urgentCountdown(trupp.pruefungstermin) ? 'tv-urgent' : ''}`}>
            {countdownLabel(trupp.pruefungstermin)}
          </strong>
          {trupp.pruefungstermin && <span className="num">Prüfung am {formatDate(trupp.pruefungstermin)}</span>}
        </div>
      </section>

      <nav className="tv-tabs" role="tablist">
        {(
          [
            ['checkliste', 'Checkliste'],
            ['trupp', 'Trupp'],
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
            <AmpelDot teilnehmer={benutzer} />
            <h2>Meine Voraussetzungen</h2>
          </div>
          <p className="muted">Tippe auf einen Punkt, um ihn zwischen „offen" und „ok" umzuschalten.</p>
          <ChecklistToggles teilnehmer={benutzer} onToggle={toggle} />
          {!isChecklistItemRequired(benutzer.rolle, 'tauglichkeit') && (
            <p className="muted">
              {CHECKLIST_LABELS.tauglichkeit} ist für die Rolle {rolleLabel(benutzer.rolle)} nicht erforderlich.
            </p>
          )}
          {!benutzer.rolle && (
            <p className="muted">Du hast noch keine Rolle. Die Rollen werden gemeinsam eingeteilt — im Tab „Trupp".</p>
          )}
          {checklistAmpel(benutzer.rolle, benutzer.checkliste) === 'gruen' && (
            <div className="alert alert-ok">
              <Icon name="circle-check" />
              <div className="alert-body">Alle Voraussetzungen erfüllt — du bist startklar!</div>
            </div>
          )}
        </section>
      )}

      {tab === 'trupp' && (
        <>
          <TruppTab me={benutzer} onRolleChange={changeRolle} />
          {kannTruppIdentitaetBearbeiten(benutzer, trupp.id) && (
            <TruppIdentitaet
              trupp={trupp}
              // Header, Konto-Menü and the offline copy all read the session's Trupp.
              onSaved={(updated) => setMe({ ...me, trupp: { ...trupp, name: updated.name, icon: updated.icon } })}
            />
          )}
        </>
      )}

      {tab === 'stationen' && <Stations basePath="/teilnehmer/stationen" />}
    </>
  );
}

/**
 * Registered, but not in a Trupp yet: points to /trupp-waehlen (self-service), an Ausbilder may
 * also assign them. Kalender, Rangliste and the Stationen are open to everyone meanwhile.
 */
function OhneTrupp({ benutzer }: { benutzer: Benutzer }) {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);

  // The Ausbilder may have just added this account — check once when the page opens.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pruefen = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };

  return (
    <>
      <div>
        <h1>Servus, {benutzer.name.split(' ')[0]}</h1>
        {benutzer.ff && <p className="tv-meta">{benutzer.ff}</p>}
      </div>
      <section className="card stack">
        <h2>Noch in keinem Trupp</h2>
        <p>
          Wähle deinen Trupp — danach siehst du hier eure Checkliste, die Rollen und den Countdown bis
          zur Prüfung.
        </p>
        <div className="btn-row">
          <Link to="/trupp-waehlen" className="btn">
            <Icon name="users" />
            Trupp wählen
          </Link>
          <button type="button" className="btn btn-ghost btn-small" onClick={pruefen} disabled={busy} aria-busy={busy}>
            <Icon name="refresh-cw" />
            {busy ? 'Prüfe…' : 'Erneut prüfen'}
          </button>
        </div>
        <p className="muted">
          Hat dich ein Ausbilder schon eingeteilt, tippe auf „Erneut prüfen". Bis dahin stehen dir Stationen, Kalender
          und Rangliste offen.
        </p>
      </section>
      <Stations basePath="/stationen" />
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
  me: Mitglied;
  onRolleChange: (t: Teilnehmer, rolle: Rolle | null) => Promise<Teilnehmer | null>;
}) {
  const [list, setList] = useState<Teilnehmer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Teilnehmer[]>(`/trupps/${me.truppId}/teilnehmer`)
      .then(setList)
      .catch((err) => setError(errorMessage(err)));
  }, [me.truppId]);

  useEffect(load, [load]);

  const change = async (t: Teilnehmer, rolle: Rolle | null) => {
    const updated = await onRolleChange(t, rolle);
    if (updated) setList((l) => l?.map((x) => (x.id === updated.id ? updated : x)) ?? l);
  };

  // Keep my own row in sync with checklist toggles made on the other tab.
  const rows = list?.map((t) => (t.id === me.id ? { ...t, rolle: me.rolle, checkliste: me.checkliste } : t));

  return (
    <section className="card stack">
      <h2>Trupp &amp; Rollen</h2>
      <p className="muted">
        Die Rollen könnt ihr jederzeit gemeinsam umstellen — jede Rolle darf auch mehrfach besetzt sein
        (Ergänzungsteilnehmer).
      </p>
      {error && (
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
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
                  {t.ff && <div className="muted">{t.ff}</div>}
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
