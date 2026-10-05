import {
  checklistAmpel,
  isPlaceholderEmail,
  kannTruppIdentitaetBearbeiten,
  SYSTEM_ROLLE_LABELS,
  type BenutzerUebersicht,
  type ChecklistItem,
  type Trupp,
  type Rolle,
  type Teilnehmer,
  type TeilnehmerCreateRequest,
  type TeilnehmerCreateResponse,
  type TeilnehmerZuordnenRequest,
} from '@apas/shared';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { EinmalPasswort } from '../components/EinmalPasswort';
import { Icon } from '../components/Icon';
import { RolleSelect, RollenAbdeckung, saveRolle } from '../components/Rollen';
import { TruppIdentitaet } from '../components/TruppIdentitaet';
import { TruppName } from '../components/TruppName';
import { api, deleteTrupp, errorMessage, formError, truppLoeschenFrage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import { useMe, useSession } from '../lib/session';
import './TruppDetail.css';

export function TruppDetail() {
  const { truppId } = useParams();
  const me = useMe();
  const { setMe, refresh } = useSession();
  const navigate = useNavigate();
  const [trupp, setTrupp] = useState<Trupp | null>(null);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tr, t] = await Promise.all([
        api<Trupp>(`/trupps/${truppId}`),
        api<Teilnehmer[]>(`/trupps/${truppId}/teilnehmer`),
      ]);
      setTrupp(tr);
      setTeilnehmer(t);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [truppId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (t: Teilnehmer, item: ChecklistItem) => {
    const next = t.checkliste[item] === 'ok' ? 'offen' : 'ok';
    try {
      const updated = await api<Teilnehmer>(`/trupps/${truppId}/teilnehmer/${t.id}/checkliste`, {
        method: 'PATCH',
        body: { [item]: next },
      });
      setTeilnehmer((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const changeRolle = async (t: Teilnehmer, rolle: Rolle | null) => {
    try {
      const updated = await saveRolle(t.id, rolle);
      setTeilnehmer((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  /** New name/icon: this page, plus the session copy if it is the account's own Trupp. */
  const identitaetGespeichert = (updated: Trupp) => {
    setTrupp(updated);
    if (me.trupp?.id === updated.id) setMe({ ...me, trupp: { ...me.trupp, name: updated.name, icon: updated.icon } });
  };

  const remove = async (t: Teilnehmer) => {
    if (
      !confirm(
        `${t.name} aus dem Trupp „${trupp?.name ?? ''}" entfernen?\n\n` +
          'Das Konto bleibt bestehen und kann später wieder einem Trupp zugeordnet werden. ' +
          'Die Rolle in diesem Trupp wird zurückgesetzt.',
      )
    )
      return;
    try {
      await api(`/trupps/${truppId}/teilnehmer/${t.id}`, { method: 'DELETE' });
      setTeilnehmer((list) => list.filter((x) => x.id !== t.id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const loeschen = async () => {
    if (!trupp || !confirm(truppLoeschenFrage(trupp.name, teilnehmer.length))) return;
    try {
      await deleteTrupp(trupp.id);
      // The Ausbilder's own Trupp: the session copy would still name it.
      if (me.benutzer.truppId === trupp.id) void refresh();
      navigate('/trupps', { replace: true });
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  if (error) {
    return (
      <>
        <AppHeader backTo="/trupps" />
        <main className="page">
          <div className="alert alert-error">
            <Icon name="triangle-alert" />
            <div className="alert-body">{error}</div>
          </div>
        </main>
      </>
    );
  }
  if (!trupp) {
    return (
      <>
        <AppHeader backTo="/trupps" />
        <main className="page muted">Lade…</main>
      </>
    );
  }

  const bereit = teilnehmer.filter((t) => checklistAmpel(t.rolle, t.checkliste) === 'gruen').length;
  const days = trupp.pruefungstermin ? daysUntil(trupp.pruefungstermin) : null;
  const urgent = days !== null && days >= 0 && days <= 14;

  return (
    <>
      <AppHeader backTo="/trupps" />
      <main className="page stack">
        <div className="gd-head">
          <div>
            <h1>
              <TruppName name={trupp.name} icon={trupp.icon} />
            </h1>
            <p className="gd-meta">
              <span className={`num ${urgent ? 'badge badge-accent' : 'gd-countdown'}`}>
                {countdownLabel(trupp.pruefungstermin)}
              </span>
              {trupp.pruefungstermin && <span className="num">Prüfung am {formatDate(trupp.pruefungstermin)}</span>}
            </p>
          </div>
          <div className="btn-row">
            <Link className="btn" to="/kalender" title="Gemeinsamer Kalender aller Trupps">
              <Icon name="calendar-days" />
              Kalender
            </Link>
            <Link className="btn btn-secondary" to={`/trupps/${trupp.id}/stationen`}>
              <Icon name="book-open-check" />
              Stationen
            </Link>
            <Link className="btn btn-secondary" to="/rangliste">
              <Icon name="trophy" />
              Rangliste
            </Link>
          </div>
        </div>

        <section className="card">
          <div className="gd-section-head">
            <h2>
              Teilnehmer <span className="gd-count num">{teilnehmer.length}</span>
            </h2>
            {teilnehmer.length > 0 && (
              <span className="gd-bereit num">
                <Icon name="circle-check" />
                {bereit} von {teilnehmer.length} bereit
              </span>
            )}
          </div>
          {teilnehmer.length > 0 && <RollenAbdeckung teilnehmer={teilnehmer} />}
          <AddTeilnehmer
            truppId={trupp.id}
            onAdded={(t) => setTeilnehmer((list) => [...list, t].sort((a, b) => a.name.localeCompare(b.name, 'de')))}
          />
          {teilnehmer.length === 0 ? (
            <p className="muted">
              Noch niemand beigetreten. Teile den Einladungslink oder QR-Code — oder füge Personen direkt hinzu.
            </p>
          ) : (
            <ul className="gd-tn-list">
              {teilnehmer.map((t) => (
                <li key={t.id} className="gd-tn">
                  <AmpelDot teilnehmer={t} />
                  <div className="gd-tn-main">
                    <div className="gd-tn-name">
                      {t.name}
                      {t.systemRolle !== 'teilnehmer' && <span className="badge">{SYSTEM_ROLLE_LABELS[t.systemRolle]}</span>}
                    </div>
                    {t.ff && <div className="muted">{t.ff}</div>}
                  </div>
                  <RolleSelect teilnehmer={t} onChange={(rolle) => changeRolle(t, rolle)} />
                  <ChecklistToggles teilnehmer={t} compact onToggle={(item) => toggle(t, item)} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon gd-remove"
                    onClick={() => remove(t)}
                    title="Aus dem Trupp entfernen (Konto bleibt bestehen)"
                    aria-label={`${t.name} aus dem Trupp entfernen`}
                  >
                    <Icon name="trash-2" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="gd-grid">
          <PruefungsterminEditor trupp={trupp} onSaved={setTrupp} />
          <InvitePanel trupp={trupp} onRegenerated={setTrupp} />
        </div>

        {kannTruppIdentitaetBearbeiten(me.benutzer, trupp.id) && (
          <TruppIdentitaet
            trupp={trupp}
            onSaved={identitaetGespeichert}
            intro="Name und Maskottchen des Trupps — die Mitglieder können beides auch selbst ändern."
          />
        )}

        {me.benutzer.systemRolle === 'ausbilder' && (
          <section className="card stack">
            <h2>Trupp löschen</h2>
            <p className="muted">
              Die Mitglieder bleiben als Benutzer mit ihrem Konto erhalten und sind danach ohne Trupp — sie können
              einem anderen Trupp zugeordnet werden. Gelöscht werden nur der Trupp und seine Ergebnisse.
            </p>
            <div>
              <button type="button" className="btn btn-ghost gd-loeschen-btn" onClick={loeschen}>
                <Icon name="trash-2" />
                Trupp löschen
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

type AddMode = 'neu' | 'bestehend';

/**
 * "Person hinzufügen" without the invite link: either a new account with a generated
 * password (shown exactly once — it's only in the API response), or an already registered
 * account that isn't in any Trupp yet.
 */
function AddTeilnehmer({ truppId, onAdded }: { truppId: string; onAdded: (t: Teilnehmer) => void }) {
  const [mode, setMode] = useState<AddMode | null>(null);
  const [created, setCreated] = useState<(TeilnehmerCreateResponse & { email: string }) | null>(null);
  const [zugeordnet, setZugeordnet] = useState<string | null>(null);

  const open = (m: AddMode) => {
    setMode(m);
    setCreated(null);
    setZugeordnet(null);
  };

  return (
    <div className="gd-add">
      {created && (
        <EinmalPasswort password={created.tempPassword} email={created.email} onClose={() => setCreated(null)}>
          <strong>{created.teilnehmer.name}</strong> wurde hinzugefügt.
        </EinmalPasswort>
      )}
      {zugeordnet && (
        <div className="alert alert-ok" role="status">
          <Icon name="circle-check" />
          <div className="alert-body">
            <strong>{zugeordnet}</strong> ist jetzt in diesem Trupp und meldet sich mit dem eigenen Passwort an.
          </div>
        </div>
      )}
      {mode === 'neu' ? (
        <NeuesKonto
          truppId={truppId}
          onCancel={() => setMode(null)}
          onCreated={(res, email) => {
            onAdded(res.teilnehmer);
            setCreated({ ...res, email });
            setMode(null);
          }}
        />
      ) : mode === 'bestehend' ? (
        <BestehendesKonto
          truppId={truppId}
          onCancel={() => setMode(null)}
          onAssigned={(t) => {
            onAdded(t);
            setZugeordnet(t.name);
            setMode(null);
          }}
        />
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => open('neu')}>
            <Icon name="user-plus" />
            Person hinzufügen
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => open('bestehend')}>
            <Icon name="user-round-check" />
            Bestehendes Konto zuordnen
          </button>
        </div>
      )}
    </div>
  );
}

function NeuesKonto({
  truppId,
  onCreated,
  onCancel,
}: {
  truppId: string;
  /** `email` is the login address that was entered (the response carries no e-mail). */
  onCreated: (res: TeilnehmerCreateResponse, email: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: TeilnehmerCreateRequest = { email: email.trim(), name, ff: ff.trim() || null };
      const res = await api<TeilnehmerCreateResponse>(`/trupps/${truppId}/teilnehmer`, { method: 'POST', body });
      onCreated(res, body.email.toLowerCase());
    } catch (err) {
      setError(formError(err, []));
      setBusy(false);
    }
  };

  return (
    <form className="gd-add-form gd-add-form-neu" onSubmit={submit} aria-label="Neues Konto anlegen">
      <p className="muted gd-add-intro">
        Neues Konto mit einmaligem Passwort anlegen. Die Person meldet sich mit ihrer E-Mail-Adresse an.
      </p>
      {error && (
        <div className="alert alert-error gd-add-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      <input
        type="email"
        inputMode="email"
        required
        maxLength={254}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="E-Mail-Adresse (für die Anmeldung)"
        aria-label="E-Mail-Adresse (für die Anmeldung)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <input
        required
        minLength={2}
        maxLength={100}
        autoComplete="off"
        placeholder="Name, z. B. Max Mustermann"
        aria-label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        minLength={2}
        maxLength={100}
        placeholder="FF (optional), z. B. FF Fels"
        aria-label="Feuerwehr (optional)"
        value={ff}
        onChange={(e) => setFf(e.target.value)}
      />
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Füge hinzu…' : 'Hinzufügen'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

/** Picker fed by GET /benutzer/ohne-trupp — e.g. people who registered themselves. */
function BestehendesKonto({
  truppId,
  onAssigned,
  onCancel,
}: {
  truppId: string;
  onAssigned: (t: Teilnehmer) => void;
  onCancel: () => void;
}) {
  const [konten, setKonten] = useState<BenutzerUebersicht[] | null>(null);
  const [benutzerId, setBenutzerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BenutzerUebersicht[]>('/benutzer/ohne-trupp')
      .then(setKonten)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!benutzerId) return;
    setBusy(true);
    setError(null);
    try {
      const body: TeilnehmerZuordnenRequest = { benutzerId };
      onAssigned(await api<Teilnehmer>(`/trupps/${truppId}/teilnehmer/zuordnen`, { method: 'POST', body }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const label = (b: BenutzerUebersicht) =>
    [
      b.name,
      isPlaceholderEmail(b.email) ? null : b.email,
      b.ff,
      b.systemRolle !== 'teilnehmer' ? SYSTEM_ROLLE_LABELS[b.systemRolle] : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <form className="gd-add-form gd-add-form-pick" onSubmit={submit} aria-label="Bestehendes Konto zuordnen">
      <p className="muted gd-add-intro">
        Konten ohne Trupp — z. B. Personen, die sich selbst registriert haben. Sie behalten ihr Passwort.
      </p>
      {error && (
        <div className="alert alert-error gd-add-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      {konten === null ? (
        !error && <p className="muted gd-add-intro">Lade…</p>
      ) : konten.length === 0 ? (
        <p className="gd-add-intro">Gerade gibt es kein Konto ohne Trupp.</p>
      ) : (
        <select
          required
          aria-label="Konto"
          value={benutzerId}
          onChange={(e) => setBenutzerId(e.target.value)}
          autoFocus
        >
          <option value="">— Konto wählen ({konten.length}) —</option>
          {konten.map((b) => (
            <option key={b.id} value={b.id}>
              {label(b)}
            </option>
          ))}
        </select>
      )}
      <div className="btn-row">
        {konten && konten.length > 0 && (
          <button className="btn" type="submit" disabled={busy || !benutzerId} aria-busy={busy}>
            {busy ? 'Ordne zu…' : 'Zuordnen'}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {konten && konten.length === 0 ? 'Schließen' : 'Abbrechen'}
        </button>
      </div>
    </form>
  );
}

function PruefungsterminEditor({ trupp, onSaved }: { trupp: Trupp; onSaved: (trupp: Trupp) => void }) {
  const [value, setValue] = useState(trupp.pruefungstermin ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = value !== (trupp.pruefungstermin ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updated = await api<Trupp>(`/trupps/${trupp.id}`, {
        method: 'PATCH',
        body: { pruefungstermin: value || null },
      });
      onSaved(updated);
      setMsg({ ok: true, text: 'Gespeichert' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Prüfungstermin</h2>
      <input
        type="date"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMsg(null);
        }}
        aria-label="Prüfungstermin"
      />
      <div className="btn-row">
        <button className="btn btn-secondary" type="submit" disabled={busy || !dirty} aria-busy={busy}>
          Speichern
        </button>
        {msg && (
          <span className={`gd-msg ${msg.ok ? 'gd-msg-ok' : 'gd-msg-error'}`} role="status">
            <Icon name={msg.ok ? 'check' : 'triangle-alert'} />
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

function InvitePanel({ trupp, onRegenerated }: { trupp: Trupp; onRegenerated: (trupp: Trupp) => void }) {
  const link = `${window.location.origin}/join/${trupp.inviteToken ?? ''}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Literal colours: the QR is a raster image (dark = --ink), kept dark-on-white in both schemes.
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#221716', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('Link kopieren:', link);
    }
  };

  const regenerate = async () => {
    if (!confirm('Neuen Einladungslink erzeugen? Der bisherige Link funktioniert danach nicht mehr.')) return;
    try {
      onRegenerated(await api<Trupp>(`/trupps/${trupp.id}/invite/regenerate`, { method: 'POST' }));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <section className="card gd-invite">
      <div className="stack">
        <h2>Einladungslink</h2>
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Einladungslink" />
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} />
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={regenerate}>
            <Icon name="refresh-cw" />
            Neu erzeugen
          </button>
        </div>
      </div>
      {qr && <img className="gd-qr" src={qr} alt="QR-Code zum Einladungslink" width={150} height={150} />}
    </section>
  );
}
