import type { JoinInfo, JoinRequest, TeilnehmerLoginRequest, TeilnehmerSession } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { HttpError, api, errorMessage, lastInvite, rememberInvite, setToken } from '../lib/api';
import { formatDate } from '../lib/format';
import './Login.css';
import './Join.css';

type Mode = 'neu' | 'anmelden';

/**
 * /join/:token — "Neu beitreten" (Name, FF, Passwort) or "Anmelden" (Name, Passwort).
 * Both are scoped to this Trupp's invite token and log in straight away.
 */
export function Join() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() =>
    params.has('anmelden') || lastInvite()?.token === token ? 'anmelden' : 'neu',
  );
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Join rejected because the name is taken → offer the switch to "Anmelden".
  const [nameTaken, setNameTaken] = useState(false);

  const base = `/trupps/${encodeURIComponent(token)}`;
  const mismatch = mode === 'neu' && repeat.length > 0 && repeat !== password;

  useEffect(() => {
    api<JoinInfo>(`${base}/join`, { auth: 'none' })
      .then(setInfo)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [base]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNameTaken(false);
    setPassword('');
    setRepeat('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameTaken(false);
    if (mode === 'neu' && password !== repeat) {
      // The inline hint under the field already says what is wrong.
      document.getElementById('join-repeat')?.focus();
      return;
    }
    setBusy(true);
    try {
      const body: JoinRequest | TeilnehmerLoginRequest =
        mode === 'neu' ? { name, ff, password } : { name, password };
      const session = await api<TeilnehmerSession>(`${base}/${mode === 'neu' ? 'join' : 'login'}`, {
        method: 'POST',
        auth: 'none',
        body,
      });
      setToken('teilnehmer', session.token);
      rememberInvite({ token, truppName: session.trupp.name });
      navigate('/teilnehmer', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setNameTaken(mode === 'neu' && err instanceof HttpError && err.status === 409);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth join">
      <div className="auth-inner">
        <div className="auth-brand">
          <img src="/icons/icon-192.png" alt="" width={48} height={48} />
          <div>
            <h1>APAS-Trainer</h1>
            {info ? (
              <p>
                Trupp <strong>{info.truppName}</strong>
                {info.pruefungstermin && <span className="num"> · Prüfung am {formatDate(info.pruefungstermin)}</span>}
              </p>
            ) : (
              !loadError && <p>Einladung wird geladen…</p>
            )}
          </div>
        </div>

        {loadError && (
          <div className="alert alert-error" role="alert">
            <Icon name="triangle-alert" />
            <div className="alert-body">{loadError}</div>
          </div>
        )}

        {info && (
          <form className="card stack" onSubmit={submit}>
            <div className="join-tabs" role="tablist">
              {(
                [
                  ['neu', 'Neu beitreten'],
                  ['anmelden', 'Anmelden'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  className={`join-tab ${mode === key ? 'join-tab-active' : ''}`}
                  onClick={() => switchMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted">
              {mode === 'neu'
                ? 'Lege dein Konto für diesen Trupp an. Deine Rolle wird später gemeinsam im Trupp eingeteilt.'
                : 'Schon beigetreten? Melde dich mit deinem Namen und Passwort an.'}
            </p>
            {error && (
              <div className="alert alert-error" role="alert">
                <Icon name="triangle-alert" />
                <div className="alert-body">
                  {error}
                  {nameTaken && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small join-switch"
                        onClick={() => switchMode('anmelden')}
                      >
                        Zu „Anmelden" wechseln
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="field">
                <label htmlFor="join-name">Name</label>
                <input
                  id="join-name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="username"
                  placeholder={mode === 'neu' ? 'z. B. Max Mustermann' : undefined}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {mode === 'neu' && (
                <div className="field">
                  <label htmlFor="join-ff">Feuerwehr</label>
                  <input
                    id="join-ff"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="z. B. FF Musterdorf"
                    value={ff}
                    onChange={(e) => setFf(e.target.value)}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="join-password">Passwort</label>
                <input
                  id="join-password"
                  type="password"
                  required
                  minLength={mode === 'neu' ? 8 : undefined}
                  maxLength={mode === 'neu' ? 72 : undefined}
                  autoComplete={mode === 'neu' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {mode === 'neu' && (
                <div className="field">
                  <label htmlFor="join-repeat">Passwort wiederholen</label>
                  <input
                    id="join-repeat"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    aria-invalid={mismatch || undefined}
                    aria-describedby="join-repeat-hint"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                  />
                  <p id="join-repeat-hint" className={`field-hint ${mismatch ? 'field-hint-error' : ''}`}>
                    {mismatch ? 'Stimmt noch nicht mit dem Passwort überein.' : 'Mindestens 8 Zeichen.'}
                  </p>
                </div>
              )}
            </div>
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Bitte warten…' : mode === 'neu' ? 'Beitreten' : 'Anmelden'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
