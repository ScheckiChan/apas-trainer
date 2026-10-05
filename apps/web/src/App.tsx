import { kannErgebnisSpeichern, type SystemRolle } from '@apas/shared';
import { useEffect, useRef, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { Icon } from './components/Icon';
import { homePath, useSession } from './lib/session';
import { BenutzerVerwaltung } from './views/Benutzer';
import { KalenderPage } from './views/Calendar';
import { Join } from './views/Join';
import { Login } from './views/Login';
import { Rangliste } from './views/Rangliste';
import { Registrieren } from './views/Registrieren';
import { StationDetail } from './views/StationDetail';
import { Stations } from './views/Stations';
import { TeilnehmerView } from './views/TeilnehmerView';
import { TruppDashboard } from './views/TruppDashboard';
import { TruppDetail } from './views/TruppDetail';
import { TruppWaehlen } from './views/TruppWaehlen';

function Laden() {
  return (
    <>
      <AppHeader />
      <main className="page muted">Lade…</main>
    </>
  );
}

/** /auth/me failed for another reason than 401 and nothing is cached (first start offline). */
function SessionFehler({ error }: { error: string }) {
  const { refresh, signOut } = useSession();
  return (
    <>
      <AppHeader />
      <main className="page stack">
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => void refresh()}>
            <Icon name="refresh-cw" />
            Erneut versuchen
          </button>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Abmelden
          </button>
        </div>
      </main>
    </>
  );
}

/**
 * Waits for /auth/me, sends signed-out visitors to the login (remembering where they were
 * headed) and accounts without one of `rollen` to their own home.
 */
function Gate({ rollen, children }: { rollen?: SystemRolle[]; children: ReactElement }) {
  const { state } = useSession();
  const location = useLocation();
  if (state.status === 'loading') return <Laden />;
  if (state.status === 'error') return <SessionFehler error={state.error} />;
  if (state.status === 'anon') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (rollen && !rollen.includes(state.me.benutzer.systemRolle)) return <Navigate to={homePath(state.me)} replace />;
  return children;
}

function Home() {
  const { state } = useSession();
  if (state.status === 'loading') return <Laden />;
  if (state.status === 'error') return <SessionFehler error={state.error} />;
  if (state.status === 'anon') return <Navigate to="/login" replace />;
  return <Navigate to={homePath(state.me)} replace />;
}

/**
 * /login and /registrieren are pointless once signed in. Only for visitors who arrive already
 * signed in: when the page itself signs someone in, it navigates on its own (Login → `from`,
 * Registrieren → /trupp-waehlen). The router applies that navigation in a transition, so the
 * session update renders first — redirecting here would overwrite the page's target.
 */
function NurAbgemeldet({ children }: { children: ReactElement }) {
  const { state } = useSession();
  const warAbgemeldet = useRef(false);
  if (state.status === 'anon') warAbgemeldet.current = true;
  if (state.status === 'ready' && !warAbgemeldet.current) return <Navigate to={homePath(state.me)} replace />;
  return children;
}

/** Trupp pages: TruppDetail is Ausbilder-only; Prüfer go straight to the Trupp's Stationen. */
function TruppDetailRoute() {
  const { me } = useSession();
  const { truppId } = useParams();
  if (me?.benutzer.systemRolle === 'pruefer') return <Navigate to={`/trupps/${truppId}/stationen`} replace />;
  return (
    <Gate rollen={['ausbilder']}>
      <TruppDetail />
    </Gate>
  );
}

/** A Trupp's station pages: Ausbilder, Prüfer and the Trupp's own members. */
function TruppZugang({ children }: { children: ReactElement }) {
  const { me } = useSession();
  const { truppId } = useParams();
  if (me && me.benutzer.systemRolle === 'teilnehmer' && me.benutzer.truppId !== truppId) {
    return <Navigate to={homePath(me)} replace />;
  }
  return children;
}

/** Where the station overview lives for the current URL, and where its back arrow goes. */
function useStationsBase(): { basePath: string; backTo: string } {
  const { truppId } = useParams();
  const { me } = useSession();
  if (truppId) {
    const rolle = me?.benutzer.systemRolle;
    const backTo = rolle === 'ausbilder' ? `/trupps/${truppId}` : rolle === 'pruefer' ? '/trupps' : '/';
    return { basePath: `/trupps/${truppId}/stationen`, backTo };
  }
  return { basePath: '/stationen', backTo: '/' };
}

function StationsPage() {
  const { basePath, backTo } = useStationsBase();
  return (
    <>
      <AppHeader backTo={backTo} />
      <main className="page">
        <Stations basePath={basePath} />
      </main>
    </>
  );
}

function StationDetailPage({ teilnehmer }: { teilnehmer?: boolean }) {
  const { stationId, truppId } = useParams();
  const { me } = useSession();
  const base = useStationsBase();
  // Teilnehmer see the overview as a tab; /teilnehmer/stationen redirects back to that tab.
  const basePath = teilnehmer ? '/teilnehmer/stationen' : base.basePath;
  // Whose result "Ergebnis speichern" would record: the Trupp in the URL, or a Teilnehmer's own.
  const ergebnisTrupp = teilnehmer ? me?.benutzer.truppId : truppId;
  const speichernFuer =
    me && ergebnisTrupp && kannErgebnisSpeichern(me.benutzer, ergebnisTrupp) ? ergebnisTrupp : undefined;

  if (teilnehmer && me && !me.benutzer.truppId) return <Navigate to={`/stationen/${stationId ?? ''}`} replace />;

  return (
    <>
      <AppHeader backTo={basePath} />
      <main className="page">
        <StationDetail stationId={stationId} basePath={basePath} truppId={speichernFuer} />
      </main>
    </>
  );
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Expired / revoked token or deleted account → back to the login.
  useEffect(() => {
    const onUnauthorized = () =>
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
    window.addEventListener('apas:unauthorized', onUnauthorized);
    return () => window.removeEventListener('apas:unauthorized', onUnauthorized);
  }, [navigate, location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<NurAbgemeldet><Login /></NurAbgemeldet>} />
      <Route path="/registrieren" element={<NurAbgemeldet><Registrieren /></NurAbgemeldet>} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/stationen" element={<StationsPage />} />
      <Route path="/stationen/:stationId" element={<StationDetailPage />} />
      <Route path="/rangliste" element={<Gate><Rangliste /></Gate>} />
      <Route path="/kalender" element={<Gate><KalenderPage /></Gate>} />
      <Route path="/benutzer" element={<Gate rollen={['ausbilder']}><BenutzerVerwaltung /></Gate>} />

      <Route path="/trupps" element={<Gate rollen={['ausbilder', 'pruefer']}><TruppDashboard /></Gate>} />
      <Route path="/trupps/:truppId" element={<TruppDetailRoute />} />
      <Route path="/trupps/:truppId/kalender" element={<Navigate to="/kalender" replace />} />
      <Route path="/trupps/:truppId/stationen" element={<Gate><TruppZugang><StationsPage /></TruppZugang></Gate>} />
      <Route
        path="/trupps/:truppId/stationen/:stationId"
        element={<Gate><TruppZugang><StationDetailPage /></TruppZugang></Gate>}
      />

      {/* Self-service Trupp choice; a Teilnehmer already in a Trupp gets a pointer to it there. */}
      <Route path="/trupp-waehlen" element={<Gate rollen={['teilnehmer']}><TruppWaehlen /></Gate>} />
      <Route path="/teilnehmer" element={<Gate rollen={['teilnehmer']}><TeilnehmerView /></Gate>} />
      <Route path="/teilnehmer/stationen" element={<Navigate to="/teilnehmer?tab=stationen" replace />} />
      <Route
        path="/teilnehmer/stationen/:stationId"
        element={<Gate rollen={['teilnehmer']}><StationDetailPage teilnehmer /></Gate>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
