import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { getToken } from './lib/api';
import { Calendar } from './views/Calendar';
import { GroupDetail } from './views/GroupDetail';
import { GroupsDashboard } from './views/GroupsDashboard';
import { Join } from './views/Join';
import { Login } from './views/Login';
import { StationDetail } from './views/StationDetail';
import { Stations } from './views/Stations';
import { TeilnehmerView } from './views/TeilnehmerView';

function RequireLeiter({ children }: { children: ReactElement }) {
  return getToken('leiter') ? children : <Navigate to="/login" replace />;
}

function RequireTeilnehmer({ children }: { children: ReactElement }) {
  return getToken('teilnehmer') ? children : <Navigate to="/login?teilnehmer=1" replace />;
}

function Home() {
  if (getToken('leiter')) return <Navigate to="/gruppen" replace />;
  if (getToken('teilnehmer')) return <Navigate to="/teilnehmer" replace />;
  return <Navigate to="/login" replace />;
}

function LeiterCalendarPage() {
  const { gruppeId } = useParams();
  return (
    <>
      <AppHeader backTo={`/gruppen/${gruppeId}`} />
      <main className="page">
        <Calendar gruppeId={gruppeId!} auth="leiter" />
      </main>
    </>
  );
}

/** Where the station overview lives for the current URL, and where its back arrow goes. */
function useStationsBase(): { basePath: string; backTo: string } {
  const { gruppeId } = useParams();
  if (gruppeId) return { basePath: `/gruppen/${gruppeId}/stationen`, backTo: `/gruppen/${gruppeId}` };
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
  const { stationId } = useParams();
  const base = useStationsBase();
  // Teilnehmer see the overview as a tab; /teilnehmer/stationen redirects back to that tab.
  const basePath = teilnehmer ? '/teilnehmer/stationen' : base.basePath;
  return (
    <>
      <AppHeader backTo={basePath} />
      <main className="page">
        <StationDetail stationId={stationId} basePath={basePath} />
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

      <Route path="/gruppen" element={<RequireLeiter><GroupsDashboard /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId" element={<RequireLeiter><GroupDetail /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId/kalender" element={<RequireLeiter><LeiterCalendarPage /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId/stationen" element={<RequireLeiter><StationsPage /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId/stationen/:stationId" element={<RequireLeiter><StationDetailPage /></RequireLeiter>} />

      <Route path="/teilnehmer" element={<RequireTeilnehmer><TeilnehmerView /></RequireTeilnehmer>} />
      <Route path="/teilnehmer/stationen" element={<Navigate to="/teilnehmer?tab=stationen" replace />} />
      <Route path="/teilnehmer/stationen/:stationId" element={<RequireTeilnehmer><StationDetailPage teilnehmer /></RequireTeilnehmer>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
