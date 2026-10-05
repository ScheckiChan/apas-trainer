import {
  ROLLE_LABELS,
  ROLLE_SHORT,
  ROLLEN,
  TRUPPSUCHE_MAX_PERSONEN,
  TRUPPSUCHE_MIN_PERSONEN,
  type GewuenschteRolleUpdate,
  type MeResponse,
  type Rolle,
  type TruppsuchePerson,
  type TruppsucheResponse,
  type TruppsucheTruppRequest,
} from '@apas/shared';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { HauptNav } from '../components/HauptNav';
import { Icon } from '../components/Icon';
import { RollenMix } from '../components/Rollen';
import { HttpError, api, errorMessage } from '../lib/api';
import { useMe, useSession } from '../lib/session';
import './Truppsuche.css';

/** Where a Teilnehmer sees their Trupp (same target as the self-join on /trupp-waehlen). */
const EIGENER_TRUPP = '/teilnehmer?tab=trupp';

/** Without the trailing "(GKDT)" etc. — the short form is shown next to it anyway. */
const rolleName = (r: Rolle) => ROLLE_LABELS[r].replace(/\s*\(.*\)$/, '');

const personen = (n: number) => (n === 1 ? '1 Person' : `${n} Personen`);
const weiterePersonen = (n: number) => (n === 1 ? '1 weitere Person' : `${n} weitere Personen`);

/**
 * /truppsuche — the second self-service path next to /trupp-waehlen: Teilnehmer without a
 * Trupp set the Rolle they want to play (PATCH /benutzer/me/gewuenschte-rolle), see the other
 * waiting people (GET /truppsuche) and form a NEW Trupp from a selection
 * (POST /truppsuche/trupp, 2–6 people incl. the caller, all-or-nothing on the server).
 */
export function Truppsuche() {
  const me = useMe();
  const navigate = useNavigate();
  const { setMe, refresh } = useSession();

  // Saved Wunschrolle (server truth) and the one currently picked in the selector.
  const [eigene, setEigene] = useState<Rolle | null>(me.benutzer.gewuenschteRolle ?? null);
  const [entwurf, setEntwurf] = useState<Rolle | null>(me.benutzer.gewuenschteRolle ?? null);
  const [rolleBusy, setRolleBusy] = useState(false);
  const [rolleError, setRolleError] = useState<string | null>(null);
  const [rolleOk, setRolleOk] = useState<string | null>(null);

  const [liste, setListe] = useState<TruppsuchePerson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [bildenBusy, setBildenBusy] = useState(false);
  const [bildenError, setBildenError] = useState<string | null>(null);

  const confirmRef = useRef<HTMLHeadingElement>(null);
  const radioName = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api<TruppsucheResponse>('/truppsuche');
      setListe(res.personen);
      setEigene(res.eigeneGewuenschteRolle);
      setEntwurf((prev) => (prev === null ? res.eigeneGewuenschteRolle : prev));
      // Whoever left the list meanwhile can't stay selected.
      setAuswahl((prev) => prev.filter((id) => res.personen.some((p) => p.id === id)));
    } catch (err) {
      setLoadError(errorMessage(err));
      // 409: already in a Trupp (e.g. grouped by someone else) → the session redirects.
      if (err instanceof HttpError && err.status === 409) void refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  // Someone else may have pulled this account into a Trupp meanwhile.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (bestaetigen) confirmRef.current?.focus();
  }, [bestaetigen]);

  const gruppen = useMemo(
    () => ROLLEN.map((r) => ({ rolle: r, personen: (liste ?? []).filter((p) => p.gewuenschteRolle === r) })),
    [liste],
  );

  if (me.benutzer.truppId) return <Navigate to={EIGENER_TRUPP} replace />;

  const rolleSpeichern = async (rolle: Rolle | null) => {
    setRolleBusy(true);
    setRolleError(null);
    setRolleOk(null);
    try {
      const body: GewuenschteRolleUpdate = { gewuenschteRolle: rolle };
      const res = await api<MeResponse>('/benutzer/me/gewuenschte-rolle', { method: 'PATCH', body });
      setMe(res);
      const neu = res.benutzer.gewuenschteRolle ?? null;
      setEigene(neu);
      setEntwurf(neu);
      setRolleOk(
        neu
          ? `Gespeichert — andere Wartende sehen dich jetzt als ${ROLLE_SHORT[neu]}.`
          : 'Wunschrolle entfernt — du stehst nicht mehr in der Liste der Wartenden.',
      );
      if (!neu) setBestaetigen(false);
    } catch (err) {
      setRolleError(errorMessage(err));
      if (err instanceof HttpError && err.status === 409) void refresh();
    } finally {
      setRolleBusy(false);
    }
  };

  const gesamt = auswahl.length + 1;
  const voll = gesamt >= TRUPPSUCHE_MAX_PERSONEN;
  const genug = gesamt >= TRUPPSUCHE_MIN_PERSONEN;
  const ausgewaehlt = (liste ?? []).filter((p) => auswahl.includes(p.id));

  const umschalten = (id: string, an: boolean) => {
    setBildenError(null);
    setBestaetigen(false);
    setAuswahl((prev) => (an ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  };

  const truppBilden = async () => {
    setBildenBusy(true);
    setBildenError(null);
    try {
      const body: TruppsucheTruppRequest = { benutzerIds: auswahl };
      const res = await api<MeResponse>('/truppsuche/trupp', { method: 'POST', body });
      setMe(res);
      navigate(EIGENER_TRUPP, { replace: true });
    } catch (err) {
      setBildenError(errorMessage(err));
      setBildenBusy(false);
      setBestaetigen(false);
      if (err instanceof HttpError && err.status === 409) {
        const weg = (err.details as { nichtVerfuegbar?: unknown } | undefined)?.nichtVerfuegbar;
        if (Array.isArray(weg)) setAuswahl((prev) => prev.filter((id) => !weg.includes(id)));
        // Reload in every 409 case: grabbed people, a cleared own Wunschrolle, or the caller
        // already being in a Trupp (load → refresh → redirect).
        void load();
      }
    }
  };

  const rolleGeaendert = entwurf !== eigene;
  const keineAnderen = liste !== null && liste.length === 0;

  return (
    <>
      <AppHeader backTo="/trupp-waehlen">
        <HauptNav />
      </AppHeader>
      <main className="page stack">
        <div>
          <h1>Truppsuche</h1>
          <p className="muted ts-intro">
            Noch ohne Trupp? Gib an, welche Rolle du übernehmen willst, und bilde mit anderen Wartenden einen neuen
            Trupp. Niemand wird automatisch eingeteilt — erst wenn jemand die Auswahl bestätigt, entsteht der Trupp.
          </p>
        </div>

        {/* ---------------------------------------------------------------- Own Wunschrolle */}
        <section className="card ts-section" aria-labelledby="ts-rolle-titel">
          <h2 id="ts-rolle-titel">Deine Wunschrolle</h2>
          <p className="ts-status">
            {eigene ? (
              <>
                <Icon name="circle-check" className="ts-status-ok" />
                <span>
                  Andere sehen dich als <strong>{rolleName(eigene)}</strong> ({ROLLE_SHORT[eigene]}).
                </span>
              </>
            ) : (
              <>
                <Icon name="circle-dashed" className="ts-status-offen" />
                <span>Noch keine Wunschrolle gespeichert — andere Wartende sehen dich so nicht.</span>
              </>
            )}
          </p>

          <fieldset className="ts-rollen" disabled={rolleBusy}>
            <legend className="sr-only">Wunschrolle wählen</legend>
            {ROLLEN.map((r) => (
              <label key={r} className="ts-rolle">
                <input
                  type="radio"
                  name={radioName}
                  value={r}
                  checked={entwurf === r}
                  onChange={() => {
                    setEntwurf(r);
                    setRolleOk(null);
                  }}
                />
                <span className="ts-rolle-text">
                  <span className="ts-rolle-kurz">{ROLLE_SHORT[r]}</span>
                  <span className="ts-rolle-lang">{rolleName(r)}</span>
                </span>
                {eigene === r && <span className="badge">Gespeichert</span>}
              </label>
            ))}
          </fieldset>

          {rolleError && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">{rolleError}</div>
            </div>
          )}
          {rolleOk && (
            <div className="alert alert-ok" role="status">
              <Icon name="circle-check" />
              <div className="alert-body">{rolleOk}</div>
            </div>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => void rolleSpeichern(entwurf)}
              disabled={rolleBusy || !entwurf || !rolleGeaendert}
              aria-busy={rolleBusy}
            >
              <Icon name="save" />
              {rolleBusy ? 'Speichere…' : 'Wunschrolle speichern'}
            </button>
            {eigene && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void rolleSpeichern(null)}
                disabled={rolleBusy}
              >
                <Icon name="x" />
                Wunschrolle entfernen
              </button>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- Waiting people */}
        <section className="card ts-section" aria-labelledby="ts-liste-titel" aria-busy={loading}>
          <div className="ts-liste-kopf">
            <h2 id="ts-liste-titel">Wer noch einen Trupp sucht</h2>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => void load()}
              disabled={loading}
            >
              <Icon name="refresh-cw" />
              {loading ? 'Lade…' : 'Aktualisieren'}
            </button>
          </div>

          {loadError && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">{loadError}</div>
            </div>
          )}
          {liste === null && !loadError && <p className="muted">Lade…</p>}

          {keineAnderen && (
            <div className="ts-leer">
              <Icon name="users" className="ts-leer-icon" />
              <div>
                <p className="ts-leer-titel">Gerade wartet sonst niemand.</p>
                <p className="muted">
                  {eigene
                    ? 'Deine Wunschrolle ist gespeichert — wer als Nächstes in die Truppsuche kommt, sieht dich und kann dich in einen neuen Trupp holen. Schau später wieder vorbei.'
                    : 'Speichere oben deine Wunschrolle — dann sehen dich alle, die nach dir in die Truppsuche kommen, und können mit dir einen Trupp bilden.'}
                </p>
              </div>
            </div>
          )}

          {liste && liste.length > 0 && (
            <>
              {!eigene && (
                <div className="alert alert-warn">
                  <Icon name="triangle-alert" />
                  <div className="alert-body">
                    Speichere zuerst deine Wunschrolle — erst dann kannst du Personen auswählen.
                  </div>
                </div>
              )}
              <p className="muted ts-mix-hinweis">
                {personen(liste.length)} warten. Wähle aus, mit wem du einen Trupp bilden willst — du selbst bist
                automatisch dabei.
              </p>
              <div className="ts-gruppen">
                {gruppen.map((g) => (
                  <fieldset key={g.rolle} className="ts-gruppe" disabled={!eigene || bildenBusy}>
                    <legend className="ts-gruppe-titel">
                      <span>{rolleName(g.rolle)}</span>
                      <span className="badge num" aria-hidden="true">
                        {g.personen.length}
                      </span>
                      <span className="sr-only">{personen(g.personen.length)}</span>
                    </legend>
                    {g.personen.length === 0 ? (
                      <p className="muted ts-gruppe-leer">
                        <Icon name="circle-dashed" />
                        Niemand wartet als {ROLLE_SHORT[g.rolle]}
                      </p>
                    ) : (
                      <ul className="ts-personen">
                        {g.personen.map((p) => {
                          const an = auswahl.includes(p.id);
                          return (
                            <li key={p.id}>
                              <label className="ts-person">
                                <input
                                  type="checkbox"
                                  checked={an}
                                  disabled={!an && voll}
                                  onChange={(e) => umschalten(p.id, e.target.checked)}
                                />
                                <span className="ts-person-text">
                                  <span className="ts-person-name">{p.name}</span>
                                  <span className="ts-person-ff">{p.ff ?? 'Keine Feuerwehr angegeben'}</span>
                                </span>
                                <span className="badge ts-person-rolle" title={ROLLE_LABELS[p.gewuenschteRolle]}>
                                  {ROLLE_SHORT[p.gewuenschteRolle]}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </fieldset>
                ))}
              </div>
            </>
          )}
        </section>

        {bildenError && (
          <div className="alert alert-error" role="alert">
            <Icon name="triangle-alert" />
            <div className="alert-body">{bildenError}</div>
          </div>
        )}

        {/* ---------------------------------------------------------------- Selection summary */}
        {eigene && liste && liste.length > 0 && (
          <section className="card ts-section" aria-labelledby="ts-auswahl-titel">
            <h2 id="ts-auswahl-titel">Euer neuer Trupp</h2>
            <p className="ts-zaehler num" aria-live="polite">
              Du + {personen(auswahl.length)} = <strong>{personen(gesamt)}</strong>
              <span className="muted">
                {' '}
                (erlaubt: {TRUPPSUCHE_MIN_PERSONEN}–{TRUPPSUCHE_MAX_PERSONEN})
              </span>
            </p>
            <RollenMix rollen={[eigene, ...ausgewaehlt.map((p) => p.gewuenschteRolle)]} />
            {!genug && (
              <p className="ts-hinweis">
                <Icon name="circle-dashed" />
                Wähle mindestens {weiterePersonen(TRUPPSUCHE_MIN_PERSONEN - 1)} aus.
              </p>
            )}
            {voll && (
              <p className="ts-hinweis">
                <Icon name="circle-check" />
                Mehr als {TRUPPSUCHE_MAX_PERSONEN} Personen gehen nicht in einen Trupp — die Auswahl ist voll.
              </p>
            )}

            {!bestaetigen ? (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn ts-bilden"
                  disabled={!genug || bildenBusy}
                  onClick={() => {
                    setBildenError(null);
                    setBestaetigen(true);
                  }}
                >
                  <Icon name="user-plus" />
                  Neuen Trupp aus Auswahl bilden
                </button>
              </div>
            ) : (
              <div className="ts-confirm" role="group" aria-labelledby="ts-confirm-titel">
                <h3 id="ts-confirm-titel" ref={confirmRef} tabIndex={-1}>
                  Wirklich einen neuen Trupp bilden?
                </h3>
                <p>Diese {personen(gesamt)} kommen sofort gemeinsam in einen neuen Trupp, jede mit ihrer Wunschrolle:</p>
                <ul className="ts-confirm-liste">
                  <li>
                    <strong>Du</strong> — {ROLLE_SHORT[eigene]}
                  </li>
                  {ausgewaehlt.map((p) => (
                    <li key={p.id}>
                      {p.name} — {ROLLE_SHORT[p.gewuenschteRolle]}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  Der Trupp bekommt zunächst einen Namen nach deiner Feuerwehr; Name und Rollen könnt ihr danach im
                  Trupp ändern. In einen anderen Trupp umbuchen kann euch danach nur ein Ausbilder.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void truppBilden()}
                    disabled={bildenBusy}
                    aria-busy={bildenBusy}
                  >
                    <Icon name="check" />
                    {bildenBusy ? 'Bilde Trupp…' : 'Ja, Trupp bilden'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setBestaetigen(false)}
                    disabled={bildenBusy}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
