import type { AuthSession, LoginRequest } from '@apas/shared';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthBrand } from '../components/AuthBrand';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import { homePath, useSession } from '../lib/session';
import './Login.css';

/** Only internal paths are followed after login (no open redirect). */
export function weiterNach(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : null;
}

/** One login for every account (Ausbilder, Prüfer, Teilnehmer): E-Mail-Adresse + Passwort. */
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: LoginRequest = { email: email.trim(), password };
      const session = await api<AuthSession>('/auth/login', { method: 'POST', auth: 'none', body });
      signIn(session);
      navigate(weiterNach(location.state) ?? homePath(session), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-inner">
        <AuthBrand>
          <p>Gemeinsam zur Ausbildungsprüfung Atemschutz — Bronze</p>
        </AuthBrand>

        <form className="card stack auth-form" onSubmit={submit}>
          <h2>Anmelden</h2>
          {error && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">{error}</div>
            </div>
          )}
          <div>
            <div className="field">
              <label htmlFor="login-email">E-Mail-Adresse</label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={254}
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
            <Icon name="log-in" />
            {busy ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>

        <div className="stack">
          <p className="auth-alt">
            Noch kein Konto? <Link to="/registrieren">Registrieren</Link>
          </p>
          <p className="muted">
            Bisher mit deinem Namen angemeldet? Die Anmeldung läuft jetzt über die E-Mail-Adresse. Ist bei deinem Konto
            noch keine hinterlegt, trägt sie ein Ausbilder in der Benutzerverwaltung für dich ein.
          </p>
          <p className="muted">
            Hast du einen Einladungslink oder QR-Code von deinem Trupp? Öffne ihn — dort kannst du direkt beitreten.
          </p>
        </div>
      </div>
    </main>
  );
}
