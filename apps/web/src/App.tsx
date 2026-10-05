import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { getToken } from './lib/api';
import { KalenderPage } from './views/Calendar';
import { TruppDetail } from './views/TruppDetail';
import { TruppDashboard } from './views/TruppDashboard';
import { Join } from './views/Join';
import { Login } from './views/Login';
import { Rangliste } from './views/Rangliste';
import { StationDetail } from './views/StationDetail';
import { Stations } from './views/Stations';
import { TeilnehmerView } from './views/TeilnehmerView';

function RequireLeiter({ children }: { children: ReactElement }) {
  return getToken('leiter') ? children : <Navigate to="/login" replace />;
}

function RequireTeilnehmer({ children }: { children: ReactElement }) {
  return getToken('teilnehmer') ? children : <Navigate to="/login?teilnehmer=1" replace />;
}

/** Either session will do (Rangliste and Kalender are shared by everyone signed in). */
function RequireAny({ children }: { children: ReactElement }) {
  return getToken('leiter') || getToken('teilnehmer') ? children : <Navigate to="/login" replace />;
}

function Home() {
  if (getToken('leiter')) return <Navigate to="/trupps" replace />;
  if (getToken('teilnehmer')) return <Navigate to="/teilnehmer" replace />;
  return <Navigate to="/login" replace />;
}

/** Where the station overview lives for the current URL, and where its back arrow goes. */
function useStationsBase(): { basePath: string; backTo: string } {
  const { truppId } = useParams();
  if (truppId) return { basePath: `/trupps/${truppId}/stationen`, backTo: `/trupps/${truppId}` };
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
  const base = useStationsBase();
  // Teilnehmer see the overview as a tab; /teilnehmer/stationen redirects back to that tab.
  const basePath = teilnehmer ? '/teilnehmer/stationen' : base.basePath;
  return (
    <>
      <AppHeader backTo={basePath} />
      <main className="page">
        <StationDetail stationId={stationId} basePath={basePath} truppId={teilnehmer ? undefined : truppId} />
      </main>
    </>
  );
}

export function App() {
  const navigate = useNavigate();

  // Expired / revoked token → back to the matching login.
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      const kind = (e as CustomEvent<string>).detail;
      navigate(kind === 'teilnehmer' ? '/login?teilnehmer=1' : '/login', { replace: true });
    };
    window.addEventListener('apas:unauthorized', onUnauthorized);
    return () => window.removeEventListener('apas:unauthorized', onUnauthorized);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/stationen" element={<StationsPage />} />
      <Route path="/stationen/:stationId" element={<StationDetailPage />} />
      <Route path="/rangliste" element={<RequireAny><Rangliste /></RequireAny>} />
      <Route path="/kalender" element={<RequireAny><KalenderPage /></RequireAny>} />

      <Route path="/trupps" element={<RequireLeiter><TruppDashboard /></RequireLeiter>} />
      <Route path="/trupps/:truppId" element={<RequireLeiter><TruppDetail /></RequireLeiter>} />
      <Route path="/trupps/:truppId/kalender" element={<Navigate to="/kalender" replace />} />
      <Route path="/trupps/:truppId/stationen" element={<RequireLeiter><StationsPage /></RequireLeiter>} />
      <Route path="/trupps/:truppId/stationen/:stationId" element={<RequireLeiter><StationDetailPage /></RequireLeiter>} />

      <Route path="/teilnehmer" element={<RequireTeilnehmer><TeilnehmerView /></RequireTeilnehmer>} />
      <Route path="/teilnehmer/stationen" element={<Navigate to="/teilnehmer?tab=stationen" replace />} />
      <Route path="/teilnehmer/stationen/:stationId" element={<RequireTeilnehmer><StationDetailPage teilnehmer /></RequireTeilnehmer>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
