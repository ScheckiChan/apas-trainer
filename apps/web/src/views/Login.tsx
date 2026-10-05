import type { LoginResponse } from '@apas/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, setToken } from '../lib/api';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const teilnehmerFirst = params.has('teilnehmer');

  return (
    <div className="login">
      <div className="login-brand">
        <img src="/icons/icon-192.png" alt="" width={72} height={72} />
        <h1>APAS-Trainer</h1>
        <p>Gemeinsam zur Ausbildungsprüfung Atemschutz — Bronze</p>
      </div>
      <div className={`login-cards ${teilnehmerFirst ? 'login-cards-reverse' : ''}`}>
        <LeiterLogin onSuccess={() => navigate('/gruppen', { replace: true })} />
        <TeilnehmerRelink />
      </div>
    </div>
  );
}

function LeiterLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<LoginResponse>('/auth/leiter/login', {
        method: 'POST',
        auth: 'none',
        body: { email, password },
      });
      setToken('leiter', res.token);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Ausbildungsleiter</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <div>
        <div className="field">
          <label htmlFor="login-email">E-Mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Passwort</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  );
}

/** Teilnehmer have no password: re-entry always goes through a fresh magic link. */
function TeilnehmerRelink() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/teilnehmer/request-link', { method: 'POST', auth: 'none', body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Teilnehmer</h2>
      <p className="muted">
        Kein Passwort nötig. Gib die E-Mail-Adresse ein, mit der du dich angemeldet hast — wir schicken dir einen
        neuen Anmeldelink. Neu dabei? Nutze den Einladungslink deines Ausbildungsleiters.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {sent ? (
        <div className="alert alert-ok">
          Falls diese Adresse registriert ist, ist ein Anmeldelink unterwegs. Bitte prüfe dein Postfach.
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="relink-email">E-Mail</label>
            <input
              id="relink-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" type="submit" disabled={busy}>
            {busy ? 'Senden…' : 'Anmeldelink anfordern'}
          </button>
        </>
      )}
    </form>
  );
}
