import {
  SYSTEM_ROLLE_LABELS,
  type AuthSession,
  type JoinInfo,
  type JoinRequest,
  type LoginRequest,
  type MeResponse,
} from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthBrand } from '../components/AuthBrand';
import { Icon } from '../components/Icon';
import { HttpError, api, errorMessage, lastInvite, rememberInvite } from '../lib/api';
import { formatDate } from '../lib/format';
import { homePath, useSession } from '../lib/session';
import './Login.css';
import './Join.css';

type Mode = 'neu' | 'anmelden';

/**
 * /join/:token — the invite link of one Trupp.
 * Signed out: "Neu beitreten" (new account, already in the Trupp) or "Anmelden" (global login).
 * Signed in without a Trupp: "Diesem Trupp beitreten" (POST /trupps/:token/beitreten).
 */
export function Join() {
  const { token = '' } = useParams();
  const { state } = useSession();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const base = `/trupps/${encodeURIComponent(token)}`;

  useEffect(() => {
    api<JoinInfo>(`${base}/join`, { auth: 'none' })
      .then(setInfo)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [base]);

  return (
    <main className="auth join">
      <div className="auth-inner">
        <AuthBrand>
          {info ? (
            <p>
              Einladung in den Trupp <strong>{info.truppName}</strong>
              {info.pruefungstermin && <span className="num"> · Prüfung am {formatDate(info.pruefungstermin)}</span>}
            </p>
          ) : (
            !loadError && <p>Einladung wird geladen…</p>
          )}
        </AuthBrand>

        {loadError && (
          <div className="alert alert-error" role="alert">
            <Icon name="triangle-alert" />
            <div className="alert-body">{loadError}</div>
          </div>
        )}

        {info &&
          (state.status === 'loading' ? (
            <p className="muted">Lade…</p>
          ) : state.status === 'ready' ? (
            <Angemeldet info={info} token={token} me={state.me} />
          ) : (
            <JoinForm info={info} token={token} />
          ))}
      </div>
    </main>
  );
}

/** Already signed in on this device: join this Trupp, or explain why not. */
function Angemeldet({ info, token, me }: { info: JoinInfo; token: string; me: MeResponse }) {
  const navigate = useNavigate();
  const { setMe, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { benutzer, trupp } = me;
  const rolle = benutzer.systemRolle;

  const beitreten = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<MeResponse>(`/trupps/${encodeURIComponent(token)}/beitreten`, { method: 'POST' });
      setMe(res);
      if (res.trupp) rememberInvite({ token, truppName: res.trupp.name });
      navigate(homePath(res), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <section className="card stack">
      <p className="join-who">
        <Icon name="circle-user-round" />
        <span>
          Angemeldet als <strong>{benutzer.name}</strong>
          <span className="muted"> · {SYSTEM_ROLLE_LABELS[rolle]}</span>
        </span>
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}

      {trupp ? (
        trupp.name === info.truppName ? (
          <>
            <div className="alert alert-ok">
              <Icon name="circle-check" />
              <div className="alert-body">Du bist bereits im Trupp „{trupp.name}".</div>
            </div>
            <button type="button" className="btn" onClick={() => navigate(homePath(me), { replace: true })}>
              Weiter
              <Icon name="arrow-right" />
            </button>
          </>
        ) : (
          <>
            <p>
              Du bist bereits im Trupp „{trupp.name}". Ein Ausbilder kann dich in „{info.truppName}" umbuchen.
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(homePath(me), { replace: true })}>
              Zur Startseite
            </button>
          </>
        )
      ) : (
        <>
          <p>
            {rolle === 'teilnehmer'
              ? `Du bist noch in keinem Trupp. Tritt „${info.truppName}" bei, um eure Checkliste, Rollen und Ergebnisse zu sehen.`
              : `Als ${SYSTEM_ROLLE_LABELS[rolle]} siehst du ohnehin alle Trupps. Beitreten musst du nur, wenn du selbst in „${info.truppName}" mitmachst.`}
          </p>
          <button
            type="button"
            className={`btn ${rolle === 'teilnehmer' ? '' : 'btn-secondary'}`}
            onClick={beitreten}
            disabled={busy}
            aria-busy={busy}
          >
            <Icon name="user-round-check" />
            {busy ? 'Trete bei…' : 'Diesem Trupp beitreten'}
          </button>
        </>
      )}

      <p className="auth-alt">
        Nicht du?{' '}
        <button type="button" className="btn btn-ghost btn-small join-logout" onClick={signOut}>
          Abmelden
        </button>
      </p>
    </section>
  );
}

function JoinForm({ info, token }: { info: JoinInfo; token: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [mode, setMode] = useState<Mode>(() =>
    params.has('anmelden') || lastInvite()?.token === token ? 'anmelden' : 'neu',
  );
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 409 on "Neu beitreten" = name taken → offer "Anmelden"; on "Anmelden" = account without
  // password from before the unified accounts → offer "Neu beitreten".
  const [switchTo, setSwitchTo] = useState<Mode | null>(null);

  const mismatch = mode === 'neu' && repeat.length > 0 && repeat !== password;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSwitchTo(null);
    setPassword('');
    setRepeat('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSwitchTo(null);
    if (mode === 'neu' && password !== repeat) {
      // The inline hint under the field already says what is wrong.
      document.getElementById('join-repeat')?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === 'neu') {
        const body: JoinRequest = { name, ff, password };
        const session = await api<AuthSession>(`/trupps/${encodeURIComponent(token)}/join`, {
          method: 'POST',
          auth: 'none',
          body,
        });
        signIn(session);
        rememberInvite({ token, truppName: session.trupp?.name ?? info.truppName });
        navigate(homePath(session), { replace: true });
      } else {
        const body: LoginRequest = { name, password };
        const session = await api<AuthSession>('/auth/login', { method: 'POST', auth: 'none', body });
        signIn(session);
        // Already a member here → straight home; otherwise the page offers "beitreten".
        if (session.trupp && session.trupp.name === info.truppName) {
          rememberInvite({ token, truppName: session.trupp.name });
          navigate(homePath(session), { replace: true });
        }
      }
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof HttpError && err.status === 409) setSwitchTo(mode === 'neu' ? 'anmelden' : 'neu');
      setBusy(false);
    }
  };

  return (
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
          : 'Schon ein Konto? Melde dich mit deinem Namen und Passwort an.'}
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">
            {error}
            {switchTo && (
              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-small join-switch"
                  onClick={() => switchMode(switchTo)}
                >
                  Zu „{switchTo === 'anmelden' ? 'Anmelden' : 'Neu beitreten'}" wechseln
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
            autoCapitalize="words"
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
              {mismatch ? 'Stimmt noch nicht mit dem Passwort überein.' : '8 bis 72 Zeichen.'}
            </p>
          </div>
        )}
      </div>
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? 'Bitte warten…' : mode === 'neu' ? 'Beitreten' : 'Anmelden'}
      </button>
    </form>
  );
}
