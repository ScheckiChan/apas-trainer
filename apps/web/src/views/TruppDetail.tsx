import {
  checklistAmpel,
  type ChecklistItem,
  type Trupp,
  type Rolle,
  type Teilnehmer,
  type TeilnehmerCreateResponse,
} from '@apas/shared';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { Icon } from '../components/Icon';
import { RolleSelect, RollenAbdeckung, saveRolle } from '../components/Rollen';
import { api, errorMessage } from '../lib/api';
import { countdownLabel, daysUntil, formatDate } from '../lib/format';
import './TruppDetail.css';

export function TruppDetail() {
  const { truppId } = useParams();
  const [trupp, setTrupp] = useState<Trupp | null>(null);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tr, t] = await Promise.all([
        api<Trupp>(`/trupps/${truppId}`, { auth: 'leiter' }),
        api<Teilnehmer[]>(`/trupps/${truppId}/teilnehmer`, { auth: 'leiter' }),
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
        auth: 'leiter',
        body: { [item]: next },
      });
      setTeilnehmer((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const changeRolle = async (t: Teilnehmer, rolle: Rolle | null) => {
    try {
      const updated = await saveRolle(t.id, rolle, 'leiter');
      setTeilnehmer((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const remove = async (t: Teilnehmer) => {
    if (!confirm(`${t.name} aus dem Trupp entfernen?`)) return;
    try {
      await api(`/trupps/${truppId}/teilnehmer/${t.id}`, { method: 'DELETE', auth: 'leiter' });
      setTeilnehmer((list) => list.filter((x) => x.id !== t.id));
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
            <h1>{trupp.name}</h1>
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
                    <div className="gd-tn-name">{t.name}</div>
                    <div className="muted">{t.ff}</div>
                  </div>
                  <RolleSelect teilnehmer={t} onChange={(rolle) => changeRolle(t, rolle)} />
                  <ChecklistToggles teilnehmer={t} compact onToggle={(item) => toggle(t, item)} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon gd-remove"
                    onClick={() => remove(t)}
                    title="Aus dem Trupp entfernen"
                    aria-label={`${t.name} entfernen`}
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
      </main>
    </>
  );
}

/**
 * Direct add without the invite link (e.g. pre-populating a Trupp). The generated password
 * is only in the API response, so it is shown exactly once here.
 */
function AddTeilnehmer({ truppId, onAdded }: { truppId: string; onAdded: (t: Teilnehmer) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TeilnehmerCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<TeilnehmerCreateResponse>(`/trupps/${truppId}/teilnehmer`, {
        method: 'POST',
        auth: 'leiter',
        body: { name, ff },
      });
      onAdded(res.teilnehmer);
      setCreated(res);
      setCopied(false);
      setName('');
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      setCopied(true);
    } catch {
      prompt('Passwort kopieren:', created.tempPassword);
    }
  };

  return (
    <div className="gd-add">
      {created && (
        <div className="alert alert-ok gd-add-result" role="status">
          <Icon name="circle-check" />
          <div className="alert-body gd-add-body">
            <div>
              <strong>{created.teilnehmer.name}</strong> wurde hinzugefügt. Einmaliges Passwort — jetzt weitergeben,
              es wird nicht erneut angezeigt:
            </div>
            <code className="gd-temp-pw">{created.tempPassword}</code>
            <div className="muted">Anmeldung über den Einladungslink → „Anmelden" mit Name + Passwort.</div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} />
                {copied ? 'Kopiert' : 'Passwort kopieren'}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setCreated(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {open ? (
        <form className="gd-add-form" onSubmit={submit}>
          {error && (
            <div className="alert alert-error gd-add-error">
              <Icon name="triangle-alert" />
              <div className="alert-body">{error}</div>
            </div>
          )}
          <input
            required
            minLength={2}
            maxLength={100}
            placeholder="Name, z. B. Max Mustermann"
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            required
            minLength={2}
            maxLength={100}
            placeholder="FF, z. B. FF Fels"
            aria-label="Feuerwehr"
            value={ff}
            onChange={(e) => setFf(e.target.value)}
          />
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Füge hinzu…' : 'Hinzufügen'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(true)}>
          <Icon name="user-plus" />
          Person hinzufügen
        </button>
      )}
    </div>
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
        auth: 'leiter',
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
      onRegenerated(await api<Trupp>(`/trupps/${trupp.id}/invite/regenerate`, { method: 'POST', auth: 'leiter' }));
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
