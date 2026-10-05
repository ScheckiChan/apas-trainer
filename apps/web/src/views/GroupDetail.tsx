import {
  checklistAmpel,
  type ChecklistItem,
  type Gruppe,
  type Rolle,
  type Ressource,
  type Teilnehmer,
  type TeilnehmerCreateResponse,
} from '@apas/shared';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AmpelDot, ChecklistToggles } from '../components/Checklist';
import { RolleSelect, RollenAbdeckung, saveRolle } from '../components/Rollen';
import { api, errorMessage } from '../lib/api';
import { countdownLabel } from '../lib/format';
import './GroupDetail.css';

export function GroupDetail() {
  const { gruppeId } = useParams();
  const [gruppe, setGruppe] = useState<Gruppe | null>(null);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        api<Gruppe>(`/gruppen/${gruppeId}`, { auth: 'leiter' }),
        api<Teilnehmer[]>(`/gruppen/${gruppeId}/teilnehmer`, { auth: 'leiter' }),
      ]);
      setGruppe(g);
      setTeilnehmer(t);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [gruppeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (t: Teilnehmer, item: ChecklistItem) => {
    const next = t.checkliste[item] === 'ok' ? 'offen' : 'ok';
    try {
      const updated = await api<Teilnehmer>(`/gruppen/${gruppeId}/teilnehmer/${t.id}/checkliste`, {
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
    if (!confirm(`${t.name} aus der Gruppe entfernen?`)) return;
    try {
      await api(`/gruppen/${gruppeId}/teilnehmer/${t.id}`, { method: 'DELETE', auth: 'leiter' });
      setTeilnehmer((list) => list.filter((x) => x.id !== t.id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  if (error) {
    return (
      <>
        <AppHeader backTo="/gruppen" />
        <main className="page">
          <div className="alert alert-error">{error}</div>
        </main>
      </>
    );
  }
  if (!gruppe) {
    return (
      <>
        <AppHeader backTo="/gruppen" />
        <main className="page muted">Lade…</main>
      </>
    );
  }

  const bereit = teilnehmer.filter((t) => checklistAmpel(t.rolle, t.checkliste) === 'gruen').length;

  return (
    <>
      <AppHeader backTo="/gruppen" />
      <main className="page stack">
        <div className="gd-head">
          <div>
            <h1>{gruppe.name}</h1>
            <span className="badge">{countdownLabel(gruppe.pruefungstermin)}</span>
          </div>
          <div className="btn-row">
            <Link className="btn" to={`/gruppen/${gruppe.id}/kalender`}>
              📅 Kalender
            </Link>
            <Link className="btn btn-secondary" to={`/gruppen/${gruppe.id}/stationen`}>
              Stationen
            </Link>
          </div>
        </div>

        <div className="gd-grid">
          <PruefungsterminEditor gruppe={gruppe} onSaved={setGruppe} />
          <InvitePanel gruppe={gruppe} onRegenerated={setGruppe} />
        </div>

        <section className="card">
          <div className="gd-section-head">
            <h2>Teilnehmer ({teilnehmer.length})</h2>
            <span className="muted">
              <span className="ampel ampel-gruen" /> {bereit} von {teilnehmer.length} bereit
            </span>
          </div>
          {teilnehmer.length > 0 && <RollenAbdeckung teilnehmer={teilnehmer} />}
          <AddTeilnehmer
            gruppeId={gruppe.id}
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
                    className="btn btn-ghost btn-small gd-remove"
                    onClick={() => remove(t)}
                    title="Aus Gruppe entfernen"
                    aria-label={`${t.name} entfernen`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <RessourcenPanel gruppeId={gruppe.id} />
      </main>
    </>
  );
}

/**
 * Direct add without the invite link (e.g. pre-populating a Trupp). The generated password
 * is only in the API response, so it is shown exactly once here.
 */
function AddTeilnehmer({ gruppeId, onAdded }: { gruppeId: string; onAdded: (t: Teilnehmer) => void }) {
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
      const res = await api<TeilnehmerCreateResponse>(`/gruppen/${gruppeId}/teilnehmer`, {
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
          <div>
            Zugang für <strong>{created.teilnehmer.name}</strong>: Passwort{' '}
            <code className="gd-temp-pw">{created.tempPassword}</code> — jetzt weitergeben, wird nicht erneut
            angezeigt. Anmeldung über den Einladungslink → „Anmelden" mit Name + Passwort.
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
              {copied ? '✓ Kopiert' : 'Passwort kopieren'}
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setCreated(null)}>
              Schließen
            </button>
          </div>
        </div>
      )}
      {open ? (
        <form className="gd-add-form" onSubmit={submit}>
          {error && <div className="alert alert-error gd-add-error">{error}</div>}
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
            <button className="btn" type="submit" disabled={busy}>
              Hinzufügen
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
          + Person hinzufügen
        </button>
      )}
    </div>
  );
}

function PruefungsterminEditor({ gruppe, onSaved }: { gruppe: Gruppe; onSaved: (g: Gruppe) => void }) {
  const [value, setValue] = useState(gruppe.pruefungstermin ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = value !== (gruppe.pruefungstermin ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const g = await api<Gruppe>(`/gruppen/${gruppe.id}`, {
        method: 'PATCH',
        auth: 'leiter',
        body: { pruefungstermin: value || null },
      });
      onSaved(g);
      setMsg('Gespeichert');
    } catch (err) {
      setMsg(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Prüfungstermin</h2>
      <input type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Prüfungstermin" />
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy || !dirty}>
          Speichern
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </form>
  );
}

function InvitePanel({ gruppe, onRegenerated }: { gruppe: Gruppe; onRegenerated: (g: Gruppe) => void }) {
  const link = `${window.location.origin}/join/${gruppe.inviteToken ?? ''}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#1d1f24', light: '#ffffff' } })
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
      onRegenerated(await api<Gruppe>(`/gruppen/${gruppe.id}/invite/regenerate`, { method: 'POST', auth: 'leiter' }));
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
            {copied ? '✓ Kopiert' : 'Kopieren'}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={regenerate}>
            Neu erzeugen
          </button>
        </div>
      </div>
      {qr && <img className="gd-qr" src={qr} alt="QR-Code zum Einladungslink" width={150} height={150} />}
    </section>
  );
}

function RessourcenPanel({ gruppeId }: { gruppeId: string }) {
  const [list, setList] = useState<Ressource[]>([]);
  const [name, setName] = useState('');
  const [standort, setStandort] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Ressource[]>(`/gruppen/${gruppeId}/ressourcen`, { auth: 'leiter' })
      .then(setList)
      .catch((err) => setError(errorMessage(err)));
  }, [gruppeId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<Ressource>(`/gruppen/${gruppeId}/ressourcen`, {
        method: 'POST',
        auth: 'leiter',
        body: { name, standort },
      });
      setList((l) => [...l, r].sort((a, b) => a.name.localeCompare(b.name, 'de')));
      setName('');
      setStandort('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (r: Ressource) => {
    if (!confirm(`Ressource „${r.name}" löschen? Bestehende Termine verlieren die Buchung.`)) return;
    try {
      await api(`/gruppen/${gruppeId}/ressourcen/${r.id}`, { method: 'DELETE', auth: 'leiter' });
      setList((l) => l.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card stack">
      <h2>Ressourcen</h2>
      <p className="muted">Fahrzeuge, Übungsgelände oder Geräte, die bei Terminen gebucht werden können.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {list.length > 0 && (
        <ul className="gd-res-list">
          {list.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                {r.standort && <span className="muted"> · {r.standort}</span>}
              </div>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => remove(r)} aria-label="Löschen">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="gd-res-form" onSubmit={add}>
        <input required placeholder="Name, z. B. HLF Fels" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Standort" value={standort} onChange={(e) => setStandort(e.target.value)} />
        <button className="btn btn-secondary" type="submit">
          Hinzufügen
        </button>
      </form>
    </section>
  );
}
