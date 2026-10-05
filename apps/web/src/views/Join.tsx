import { ROLLE_LABELS, ROLLEN, type JoinInfo, type JoinRequest, type Rolle } from '@apas/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import './Join.css';

export function Join() {
  const { token } = useParams();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<JoinRequest>({ name: '', ff: '', rolle: 'ATF_ATM1', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    api<JoinInfo>(`/join/${encodeURIComponent(token ?? '')}`, { auth: 'none' })
      .then(setInfo)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [token]);

  const update = <K extends keyof JoinRequest>(key: K, value: JoinRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/join/${encodeURIComponent(token ?? '')}`, { method: 'POST', auth: 'none', body: form });
      setSentTo(form.email);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join">
      <div className="join-inner">
        <div className="join-head">
          <img src="/icons/icon-192.png" alt="" width={56} height={56} />
          <div>
            <h1>APAS-Trainer</h1>
            {info && (
              <p>
                Einladung zur Übungsgruppe <strong>{info.gruppeName}</strong>
                {info.pruefungstermin && <> · Prüfung am {formatDate(info.pruefungstermin)}</>}
              </p>
            )}
          </div>
        </div>

        {loadError && <div className="alert alert-error">{loadError}</div>}

        {info && sentTo && (
          <div className="card stack join-sent">
            <div className="join-sent-icon">✉️</div>
            <h2>Prüfe dein E-Mail-Postfach</h2>
            <p>
              Wir haben einen Anmeldelink an <strong>{sentTo}</strong> geschickt. Klicke auf den Link, um deine
              Anmeldung zu bestätigen. Der Link ist nur kurze Zeit gültig.
            </p>
            {import.meta.env.DEV && (
              <p className="muted">Entwicklungsmodus: Der Link wird in der Konsole der API ausgegeben.</p>
            )}
          </div>
        )}

        {info && !sentTo && (
          <form className="card stack" onSubmit={submit}>
            <h2>Anmeldung</h2>
            <p className="muted">Kein Passwort nötig — du bekommst einen Anmeldelink per E-Mail.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <div>
              <div className="field">
                <label htmlFor="join-name">Name</label>
                <input
                  id="join-name"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="join-ff">Feuerwehr</label>
                <input
                  id="join-ff"
                  required
                  minLength={2}
                  placeholder="z. B. FF Musterdorf"
                  value={form.ff}
                  onChange={(e) => update('ff', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="join-rolle">Rolle</label>
                <select id="join-rolle" value={form.rolle} onChange={(e) => update('rolle', e.target.value as Rolle)}>
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {ROLLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="join-email">E-Mail</label>
                <input
                  id="join-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Senden…' : 'Anmeldelink anfordern'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
