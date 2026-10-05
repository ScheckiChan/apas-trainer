import type { AuthSession, RegistrierenRequest } from '@apas/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthBrand } from '../components/AuthBrand';
import { Icon } from '../components/Icon';
import { HttpError, api, errorMessage } from '../lib/api';
import { homePath, useSession } from '../lib/session';
import './Login.css';

/**
 * /registrieren — self-registration of a global account (systemRolle Teilnehmer, no Trupp
 * yet). An Ausbilder attaches it to a Trupp later, or the person opens an invite link.
 */
export function Registrieren() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);

  const mismatch = repeat.length > 0 && repeat !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameTaken(false);
    if (password !== repeat) {
      // The inline hint under the field already says what is wrong.
      document.getElementById('reg-repeat')?.focus();
      return;
    }
    setBusy(true);
    try {
      const body: RegistrierenRequest = { name, password, ff: ff.trim() || null };
      const session = await api<AuthSession>('/auth/registrieren', { method: 'POST', auth: 'none', body });
      signIn(session);
      navigate(homePath(session), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setNameTaken(err instanceof HttpError && err.status === 409);
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-inner">
        <AuthBrand>
          <p>Konto anlegen</p>
        </AuthBrand>

        <form className="card stack auth-form" onSubmit={submit}>
          <h2>Registrieren</h2>
          <p className="muted">
            Mit deinem Konto siehst du Kalender, Stationen und Rangliste. Einem Trupp wirst du von einem Ausbilder
            zugeteilt — oder du trittst über den Einladungslink deines Trupps bei.
          </p>
          {error && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">
                {error}
                {nameTaken && (
                  <div>
                    <Link to="/login" className="btn btn-secondary btn-small auth-switch">
                      Zur Anmeldung
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="field">
              <label htmlFor="reg-name">Name</label>
              <input
                id="reg-name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="username"
                autoCapitalize="words"
                placeholder="z. B. Max Mustermann"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="field-hint">Damit meldest du dich auch an.</p>
            </div>
            <div className="field">
              <label htmlFor="reg-ff">Feuerwehr (optional)</label>
              <input
                id="reg-ff"
                minLength={2}
                maxLength={100}
                placeholder="z. B. FF Musterdorf"
                value={ff}
                onChange={(e) => setFf(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="reg-password">Passwort</label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                aria-describedby="reg-password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p id="reg-password-hint" className="field-hint">
                8 bis 72 Zeichen.
              </p>
            </div>
            <div className="field">
              <label htmlFor="reg-repeat">Passwort wiederholen</label>
              <input
                id="reg-repeat"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                aria-invalid={mismatch || undefined}
                aria-describedby="reg-repeat-hint"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
              {mismatch && (
                <p id="reg-repeat-hint" className="field-hint field-hint-error">
                  Stimmt noch nicht mit dem Passwort überein.
                </p>
              )}
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Bitte warten…' : 'Konto anlegen'}
          </button>
        </form>

        <p className="auth-alt">
          Schon ein Konto? <Link to="/login">Anmelden</Link>
        </p>
      </div>
    </main>
  );
}
