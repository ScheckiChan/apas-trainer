import { ROLLE_SHORT, type MeResponse, type TruppWahl } from '@apas/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { HauptNav } from '../components/HauptNav';
import { Icon } from '../components/Icon';
import { RollenBesetzt } from '../components/Rollen';
import { TruppName } from '../components/TruppName';
import { HttpError, api, errorMessage } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { useMe, useSession } from '../lib/session';
import './TruppWaehlen.css';

/** Where a Teilnehmer sees their Trupp and picks their Rolle (TruppDetail is Ausbilder-only). */
const EIGENER_TRUPP = '/teilnehmer?tab=trupp';

/**
 * /trupp-waehlen — self-service Trupp choice for a Teilnehmer without Trupp (after the
 * instance-wide /registrieren link). GET /trupps/waehlbar, then
 * POST /trupps/waehlbar/:truppId/beitreten — no invite token involved.
 */
export function TruppWaehlen() {
  const me = useMe();
  const navigate = useNavigate();
  const { setMe, refresh } = useSession();
  const [trupps, setTrupps] = useState<TruppWahl[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    api<TruppWahl[]>('/trupps/waehlbar')
      .then(setTrupps)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  // An Ausbilder may have assigned this account meanwhile — the stored copy could be stale.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const beitreten = async (t: TruppWahl) => {
    if (!confirm(`Dem Trupp „${t.name}" beitreten? In einen anderen Trupp umbuchen kann dich danach nur ein Ausbilder.`)) {
      return;
    }
    setBusyId(t.id);
    setJoinError(null);
    try {
      const res = await api<MeResponse>(`/trupps/waehlbar/${encodeURIComponent(t.id)}/beitreten`, { method: 'POST' });
      setMe(res);
      navigate(EIGENER_TRUPP, { replace: true });
    } catch (err) {
      setJoinError(errorMessage(err));
      setBusyId(null);
      // 409: already in a Trupp (e.g. joined on another device) → the session shows which one.
      // 404: the Trupp was deleted meanwhile → reload the list.
      if (err instanceof HttpError && err.status === 409) void refresh();
      if (err instanceof HttpError && err.status === 404) load();
    }
  };

  const { benutzer, trupp } = me;

  return (
    <>
      <AppHeader backTo="/teilnehmer">
        <HauptNav />
      </AppHeader>
      <main className="page stack">
        <div>
          <h1>Trupp wählen</h1>
          <p className="muted tw-intro">
            Such dir den Trupp aus, mit dem du zur Prüfung antrittst. Deine Rolle wählst du danach gemeinsam mit
            deinem Trupp.
          </p>
        </div>

        {joinError && (
          <div className="alert alert-error" role="alert">
            <Icon name="triangle-alert" />
            <div className="alert-body">{joinError}</div>
          </div>
        )}

        {benutzer.truppId && trupp ? (
          <section className="card stack">
            <div className="alert alert-ok">
              <Icon name="circle-check" />
              <div className="alert-body">
                Du bist bereits im Trupp „{trupp.name}". In einen anderen Trupp umbuchen kann dich nur ein Ausbilder.
              </div>
            </div>
            <div>
              <Link to={EIGENER_TRUPP} className="btn">
                Zu meinem Trupp
                <Icon name="arrow-right" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {loadError && (
              <div className="alert alert-error" role="alert">
                <Icon name="triangle-alert" />
                <div className="alert-body">
                  {loadError}
                  <div>
                    <button type="button" className="btn btn-secondary btn-small tw-retry" onClick={load}>
                      <Icon name="refresh-cw" />
                      Erneut laden
                    </button>
                  </div>
                </div>
              </div>
            )}
            {trupps === null && !loadError && <p className="muted">Lade…</p>}

            {trupps?.length === 0 && (
              <section className="card stack">
                <p>Noch keine Trupps angelegt — ein Ausbilder legt sie an.</p>
                <div>
                  <button type="button" className="btn btn-secondary btn-small" onClick={load}>
                    <Icon name="refresh-cw" />
                    Erneut laden
                  </button>
                </div>
              </section>
            )}

            {trupps && trupps.length > 0 && (
              <ul className="tw-list">
                {trupps.map((t) => (
                  <li key={t.id} className="card tw-card">
                    <h2 className="tw-name">
                      <TruppName name={t.name} icon={t.icon} />
                    </h2>
                    <p className="tw-meta">
                      <span className="tw-meta-item">
                        <Icon name="users" />
                        <span className="num">
                          {t.teilnehmerCount === 0 ? 'Noch niemand dabei' : `${t.teilnehmerCount} Teilnehmer`}
                        </span>
                      </span>
                      <span className="tw-meta-item">
                        <Icon name="calendar-days" />
                        {t.pruefungstermin ? (
                          <span className="num">
                            Prüfung am {formatDate(t.pruefungstermin)} · {countdownLabel(t.pruefungstermin)}
                          </span>
                        ) : (
                          <span>Kein Prüfungstermin</span>
                        )}
                      </span>
                    </p>
                    <RollenBesetzt besetzt={t.besetzteRollen} />
                    <p className="muted tw-offen">
                      {t.offeneRollen.length > 0
                        ? `Noch offen: ${t.offeneRollen.map((r) => ROLLE_SHORT[r]).join(', ')}`
                        : 'Alle Rollen besetzt — du kannst trotzdem beitreten und eine Rolle ergänzen.'}
                    </p>
                    <button
                      type="button"
                      className="btn tw-join"
                      onClick={() => beitreten(t)}
                      disabled={busyId !== null}
                      aria-busy={busyId === t.id}
                      aria-label={`Trupp ${t.name} beitreten`}
                    >
                      <Icon name="user-round-check" />
                      {busyId === t.id ? 'Trete bei…' : 'Beitreten'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <section className="card tw-suche" aria-labelledby="tw-suche-titel">
              <h2 id="tw-suche-titel" className="tw-suche-titel">
                Kein passender Trupp dabei?
              </h2>
              <p className="muted">
                Lieber mit anderen Wartenden zu einem neuen Trupp zusammenfinden? In der Truppsuche gibst du deine
                Wunschrolle an und bildest mit anderen ohne Trupp einen neuen.
              </p>
              <div>
                <Link to="/truppsuche" className="btn btn-secondary">
                  <Icon name="search" />
                  Zur Truppsuche
                </Link>
              </div>
            </section>

            <p className="muted">
              Hast du einen Einladungslink oder QR-Code von deinem Trupp? Öffne ihn — dort kannst du direkt beitreten.
            </p>
          </>
        )}
      </main>
    </>
  );
}
