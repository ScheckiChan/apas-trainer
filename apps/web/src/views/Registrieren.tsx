import type { AuthSession, RegistrierenRequest } from '@apas/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthBrand } from '../components/AuthBrand';
import { Icon } from '../components/Icon';
import { HttpError, api, fieldError, formError } from '../lib/api';
import { homePath, useSession } from '../lib/session';
import './Login.css';

/**
 * /registrieren — the instance-wide invite link: self-registration of a global account
 * (systemRolle Teilnehmer, no Trupp yet, Feuerwehr required). Afterwards the person picks a
 * Trupp on /trupp-waehlen; an Ausbilder or a Trupp's own invite link work as before.
 */
export function Registrieren() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [ffError, setFfError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  const mismatch = repeat.length > 0 && repeat !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setFfError(null);
    setEmailTaken(false);
    if (password !== repeat) {
      // The inline hint under the field already says what is wrong.
      document.getElementById('reg-repeat')?.focus();
      return;
    }
    setBusy(true);
    try {
      const body: RegistrierenRequest = { email: email.trim(), name, password, ff: ff.trim() };
      const session = await api<AuthSession>('/auth/registrieren', { method: 'POST', auth: 'none', body });
      signIn(session);
      // A fresh Teilnehmer has no Trupp yet: picking one is the next step.
      const ohneTrupp = session.benutzer.systemRolle === 'teilnehmer' && !session.benutzer.truppId;
      navigate(ohneTrupp ? '/trupp-waehlen' : homePath(session), { replace: true });
    } catch (err) {
      const inlineEmail = fieldError(err, 'email');
      const inlineFf = fieldError(err, 'ff');
      setEmailError(inlineEmail);
      setFfError(inlineFf);
      setError(formError(err, ['email', 'ff']));
      setEmailTaken(err instanceof HttpError && err.status === 409);
      if (inlineEmail) document.getElementById('reg-email')?.focus();
      else if (inlineFf) document.getElementById('reg-ff')?.focus();
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
            Mit deinem Konto siehst du Kalender, Stationen und Rangliste. Danach wählst du deinen Trupp selbst aus der
            Liste.
          </p>
          {error && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">
                {error}
                {emailTaken && (
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
              <label htmlFor="reg-email">E-Mail-Adresse</label>
              <input
                id="reg-email"
                type="email"
                inputMode="email"
                required
                maxLength={254}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="z. B. max@example.com"
                aria-invalid={emailError ? true : undefined}
                aria-describedby="reg-email-hint"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
              />
              <p id="reg-email-hint" className={`field-hint ${emailError ? 'field-hint-error' : ''}`}>
                {emailError ?? 'Damit meldest du dich an.'}
              </p>
            </div>
            <div className="field">
              <label htmlFor="reg-name">Name</label>
              <input
                id="reg-name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                autoCapitalize="words"
                placeholder="z. B. Max Mustermann"
                aria-describedby="reg-name-hint"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p id="reg-name-hint" className="field-hint">
                So sehen dich die anderen in der App.
              </p>
            </div>
            <div className="field">
              <label htmlFor="reg-ff">Feuerwehr</label>
              <input
                id="reg-ff"
                required
                minLength={2}
                maxLength={100}
                autoComplete="organization"
                autoCapitalize="words"
                placeholder="z. B. FF Musterdorf"
                aria-invalid={ffError ? true : undefined}
                aria-describedby="reg-ff-hint"
                value={ff}
                onChange={(e) => {
                  setFf(e.target.value);
                  setFfError(null);
                }}
              />
              <p id="reg-ff-hint" className={`field-hint ${ffError ? 'field-hint-error' : ''}`}>
                {ffError ?? 'Deine Heimat-Feuerwehr.'}
              </p>
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
