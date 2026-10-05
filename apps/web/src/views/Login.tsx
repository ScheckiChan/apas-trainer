import type { LoginResponse } from '@apas/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { api, errorMessage, lastInvite, setToken } from '../lib/api';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const teilnehmerFirst = params.has('teilnehmer');

  return (
    <main className="auth">
      <div className="auth-inner">
        <div className="auth-brand">
          <img src="/icons/icon-192.png" alt="" width={48} height={48} />
          <div>
            <h1>APAS-Trainer</h1>
            <p>Gemeinsam zur Ausbildungsprüfung Atemschutz — Bronze</p>
          </div>
        </div>
        <div className={`login-cards ${teilnehmerFirst ? 'login-cards-reverse' : ''}`}>
          <LeiterLogin onSuccess={() => navigate('/trupps', { replace: true })} />
          <TeilnehmerHint />
        </div>
      </div>
    </main>
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
      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
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
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  );
}

/**
 * Teilnehmer accounts belong to one Trupp, so they sign in on that Trupp's invite link
 * (Name + Passwort). The last used link is remembered on this device.
 */
function TeilnehmerHint() {
  const invite = lastInvite();
  return (
    <section className="card stack">
      <h2>Teilnehmer</h2>
      <p className="muted">
        Öffne den Einladungslink (oder QR-Code) deines Trupps und wähle dort „Anmelden" — mit deinem Namen und
        Passwort. Neu dabei? Über denselben Link kannst du beitreten.
      </p>
      {invite && (
        <Link className="btn btn-secondary" to={`/join/${encodeURIComponent(invite.token)}?anmelden`}>
          Anmelden bei „{invite.truppName}"
          <Icon name="arrow-right" />
        </Link>
      )}
    </section>
  );
}
