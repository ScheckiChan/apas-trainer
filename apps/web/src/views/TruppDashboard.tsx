import { ROLLEN, TRUPP_NAME_MAX, type Trupp, type TruppSummary } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { EinladungsLink } from '../components/EinladungsLink';
import { HauptNav } from '../components/HauptNav';
import { Icon } from '../components/Icon';
import { TruppName } from '../components/TruppName';
import { api, deleteTrupp, errorMessage, truppLoeschenFrage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import { useMe, useSession } from '../lib/session';
import './TruppDashboard.css';

/**
 * Home of Ausbilder and Prüfer: the Trupps of this APAS-Bronze-Ausbildung.
 * Ausbilder open a Trupp to manage it (creating another one is a secondary action).
 * Prüfer only score station runs, so a row takes them straight to that Trupp's Stationen.
 */
export function TruppDashboard() {
  const navigate = useNavigate();
  const me = useMe();
  const { refresh } = useSession();
  const ausbilder = me.benutzer.systemRolle === 'ausbilder';
  const [trupps, setTrupps] = useState<TruppSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api<TruppSummary[]>('/trupps')
      .then(setTrupps)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const empty = trupps?.length === 0;

  const loeschen = async (t: TruppSummary) => {
    if (!confirm(truppLoeschenFrage(t.name, t.teilnehmerCount))) return;
    setError(null);
    try {
      await deleteTrupp(t.id);
      setTrupps((list) => list?.filter((x) => x.id !== t.id) ?? null);
      // The Ausbilder's own Trupp: the session copy would still name it.
      if (me.benutzer.truppId === t.id) void refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <AppHeader>
        <HauptNav />
      </AppHeader>
      <main className="page stack">
        <div>
          <h1>Trupps</h1>
          {!ausbilder && (
            <p className="muted">
              Wähle einen Trupp, um an einer Station die Zeit zu nehmen und das Ergebnis zu speichern.
            </p>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <Icon name="triangle-alert" />
            <div className="alert-body">{error}</div>
          </div>
        )}
        {trupps === null && !error && <p className="muted">Lade…</p>}
        {empty && <p className="muted">{ausbilder ? 'Noch kein Trupp angelegt.' : 'Es gibt noch keinen Trupp.'}</p>}

        {trupps && trupps.length > 0 && (
          <div className={`tl ${ausbilder ? 'tl-with-actions' : ''}`}>
            <div className="tl-head" aria-hidden="true">
              <span>Trupp</span>
              <span>Rollen</span>
              <span>Teilnehmer</span>
              <span>Bereit</span>
              <span>Prüfung</span>
            </div>
            <ul className="tl-list">
              {trupps.map((t) => (
                <li key={t.id} className="tl-item">
                  <TruppRow trupp={t} to={ausbilder ? `/trupps/${t.id}` : `/trupps/${t.id}/stationen`} />
                  {ausbilder && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon tl-delete"
                      onClick={() => loeschen(t)}
                      title="Trupp löschen (Mitglieder bleiben als Benutzer erhalten)"
                      aria-label={`Trupp ${t.name} löschen`}
                    >
                      <Icon name="trash-2" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ausbilder &&
          trupps !== null &&
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

        {ausbilder && trupps !== null && (
          <EinladungsLink
            titel="Teilnehmer einladen"
            link={`${window.location.origin}/registrieren`}
            qrAlt="QR-Code zur Registrierung"
            beschreibung={
              <>
                Ein Link für alle: Wer sich damit registriert, wählt danach selbst seinen Trupp. Der Einladungslink
                in jedem Trupp führt weiterhin direkt in diesen Trupp.
              </>
            }
          />
        )}
      </main>
    </>
  );
}

/** One table row with the real counts inline. Collapses to three lines on phones. */
function TruppRow({ trupp: t, to }: { trupp: TruppSummary; to: string }) {
  const days = t.pruefungstermin ? daysUntil(t.pruefungstermin) : null;
  const urgent = days !== null && days >= 0 && days <= 14;
  const rollenKomplett = t.rollenBesetzt === ROLLEN.length;
  return (
    <Link to={to} className="tl-row">
      <TruppName className="tl-name" name={t.name} icon={t.icon} />
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
            maxLength={TRUPP_NAME_MAX}
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
