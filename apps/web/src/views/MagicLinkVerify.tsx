import type { TeilnehmerSession } from '@apas/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, setToken } from '../lib/api';
import './MagicLinkVerify.css';

/** Handles /auth/verify?token=… — exchanges the single-use magic link for a Teilnehmer JWT. */
export function MagicLinkVerify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Magic links are single-use: guard against React StrictMode running the effect twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get('token');
    if (!token) {
      setError('Der Link ist unvollständig.');
      return;
    }
    api<TeilnehmerSession>('/auth/teilnehmer/verify', { method: 'POST', auth: 'none', body: { token } })
      .then((session) => {
        setToken('teilnehmer', session.token);
        navigate('/teilnehmer', { replace: true });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [params, navigate]);

  return (
    <div className="verify">
      <div className="card verify-card stack">
        {error ? (
          <>
            <h1>Anmeldung fehlgeschlagen</h1>
            <div className="alert alert-error">{error}</div>
            <Link className="btn" to="/login?teilnehmer=1">
              Neuen Link anfordern
            </Link>
          </>
        ) : (
          <>
            <div className="verify-spinner" aria-hidden />
            <h1>Anmeldung wird bestätigt…</h1>
          </>
        )}
      </div>
    </div>
  );
}
