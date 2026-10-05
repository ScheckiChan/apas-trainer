import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { getToken } from './lib/api';
import { Calendar } from './views/Calendar';
import { GroupDetail } from './views/GroupDetail';
import { GroupsDashboard } from './views/GroupsDashboard';
import { Join } from './views/Join';
import { Login } from './views/Login';
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

function StationsPage() {
  const { gruppeId } = useParams();
  return (
    <>
      <AppHeader backTo={gruppeId ? `/gruppen/${gruppeId}` : '/'} />
      <main className="page">
        <Stations />
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

      <Route path="/gruppen" element={<RequireLeiter><GroupsDashboard /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId" element={<RequireLeiter><GroupDetail /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId/kalender" element={<RequireLeiter><LeiterCalendarPage /></RequireLeiter>} />
      <Route path="/gruppen/:gruppeId/stationen" element={<RequireLeiter><StationsPage /></RequireLeiter>} />

      <Route path="/teilnehmer" element={<RequireTeilnehmer><TeilnehmerView /></RequireTeilnehmer>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
