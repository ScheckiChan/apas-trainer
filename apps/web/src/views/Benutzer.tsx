import {
  SYSTEM_ROLLE_LABELS,
  SYSTEM_ROLLEN,
  WAPPEN_CONTENT_TYPES,
  WAPPEN_MAX_BYTES,
  type BenutzerUebersicht,
  type Einstellungen,
  type EinstellungenUpdate,
  type PasswortResetResponse,
  type SystemRolle,
  type SystemRolleUpdate,
} from '@apas/shared';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { EinmalPasswort } from '../components/EinmalPasswort';
import { Icon } from '../components/Icon';
import { TruppName } from '../components/TruppName';
import { api, apiUrl, errorMessage } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';
import { homePath, useMe, useSession } from '../lib/session';
import './Benutzer.css';

const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/**
 * /benutzer — Ausbilder only. Every account of the instance with its systemRolle (what the
 * account may do in the app — not the APAS-Rolle inside a Trupp), plus the instance branding.
 */
export function BenutzerVerwaltung() {
  const me = useMe();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [konten, setKonten] = useState<BenutzerUebersicht[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suche, setSuche] = useState('');

  useEffect(() => {
    api<BenutzerUebersicht[]>('/benutzer')
      .then(setKonten)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const zaehler = useMemo(() => {
    const c: Record<SystemRolle, number> = { ausbilder: 0, pruefer: 0, teilnehmer: 0 };
    for (const k of konten ?? []) c[k.systemRolle]++;
    return c;
  }, [konten]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de');
    if (!konten || !q) return konten;
    return konten.filter((k) =>
      [k.name, k.ff, k.trupp?.name, SYSTEM_ROLLE_LABELS[k.systemRolle]].some((v) =>
        v?.toLocaleLowerCase('de').includes(q),
      ),
    );
  }, [konten, suche]);

  const ersetzen = (k: BenutzerUebersicht) => setKonten((list) => list?.map((x) => (x.id === k.id ? k : x)) ?? list);

  // Demoted yourself: this screen is no longer yours — reload the account and go home.
  const selbstHerabgestuft = async () => {
    const neu = await refresh();
    navigate(neu ? homePath(neu) : '/login', { replace: true });
  };

  return (
    <>
      <AppHeader backTo="/" />
      <main className="page stack bv">
        <div>
          <h1>Benutzerverwaltung</h1>
          {konten && (
            <p className="muted num">
              {anzahl(konten.length, 'Konto', 'Konten')} · {zaehler.ausbilder} Ausbilder · {zaehler.pruefer} Prüfer ·{' '}
              {zaehler.teilnehmer} Teilnehmer
            </p>
          )}
        </div>

        <section className="stack" aria-labelledby="bv-konten-titel">
          <div className="bv-toolbar">
            <h2 id="bv-konten-titel">Konten</h2>
            {konten && konten.length > 0 && (
              <div className="bv-suche">
                <Icon name="search" />
                <label htmlFor="bv-suche" className="sr-only">
                  Konten durchsuchen
                </label>
                <input
                  id="bv-suche"
                  type="search"
                  placeholder="Name, FF oder Trupp"
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                />
              </div>
            )}
          </div>
          <p className="muted bv-intro">
            Die Systemrolle legt fest, was ein Konto in der App darf: Ausbilder verwalten Trupps, Kalender und Konten,
            Prüfer nehmen bei jedem Trupp Stationsergebnisse auf, Teilnehmer sehen ihren eigenen Trupp. Die Rolle im
            Trupp (GKDT, ATF …) wird davon unabhängig im Trupp eingeteilt.
          </p>

          {error && (
            <div className="alert alert-error" role="alert">
              <Icon name="triangle-alert" />
              <div className="alert-body">{error}</div>
            </div>
          )}
          {konten === null && !error && <p className="muted">Lade…</p>}

          {sichtbar && (
            <div className="bv-table">
              <div className="bv-head" aria-hidden="true">
                <span>Name</span>
                <span>Feuerwehr</span>
                <span>Trupp</span>
                <span>Systemrolle</span>
                <span className="bv-head-actions">Aktionen</span>
              </div>
              {sichtbar.length === 0 ? (
                <p className="muted bv-leer">Kein Konto passt zu „{suche.trim()}".</p>
              ) : (
                <ul className="bv-list">
                  {sichtbar.map((k) => (
                    <li key={k.id}>
                      <KontoZeile
                        konto={k}
                        selbst={k.id === me.benutzer.id}
                        onChanged={ersetzen}
                        onDeleted={() => setKonten((list) => list?.filter((x) => x.id !== k.id) ?? list)}
                        onSelbstHerabgestuft={selbstHerabgestuft}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <BrandingEinstellungen />
      </main>
    </>
  );
}

function KontoZeile({
  konto: k,
  selbst,
  onChanged,
  onDeleted,
  onSelbstHerabgestuft,
}: {
  konto: BenutzerUebersicht;
  selbst: boolean;
  onChanged: (k: BenutzerUebersicht) => void;
  onDeleted: () => void;
  onSelbstHerabgestuft: () => void;
}) {
  // The selector shows the requested value while saving and falls back to the stored one on error.
  const [pending, setPending] = useState<SystemRolle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const changeRolle = async (systemRolle: SystemRolle) => {
    if (systemRolle === k.systemRolle) return;
    if (
      selbst &&
      systemRolle !== 'ausbilder' &&
      !confirm(
        `Dich selbst zum ${SYSTEM_ROLLE_LABELS[systemRolle]} machen?\n\n` +
          'Danach kannst du weder Trupps noch Konten verwalten — das kann nur ein anderer Ausbilder rückgängig machen.',
      )
    ) {
      return;
    }
    setPending(systemRolle);
    setError(null);
    try {
      const body: SystemRolleUpdate = { systemRolle };
      const updated = await api<BenutzerUebersicht>(`/benutzer/${k.id}/systemrolle`, { method: 'PATCH', body });
      onChanged(updated);
      if (selbst && updated.systemRolle !== 'ausbilder') onSelbstHerabgestuft();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const passwortZuruecksetzen = async () => {
    const frage = selbst
      ? 'Dein eigenes Passwort durch ein neues, einmal angezeigtes ersetzen?'
      : `Passwort von ${k.name} zurücksetzen?\n\nDas bisherige Passwort funktioniert danach nicht mehr. Das neue wird einmal angezeigt.`;
    if (!confirm(frage)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<PasswortResetResponse>(`/benutzer/${k.id}/passwort-zuruecksetzen`, { method: 'POST' });
      setTempPassword(res.tempPassword);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loeschen = async () => {
    if (
      !confirm(
        `Konto „${k.name}" endgültig löschen?\n\n` +
          'Die Person wird aus ihrem Trupp und allen Terminen entfernt und kann sich nicht mehr anmelden. ' +
          'Gespeicherte Stationsergebnisse des Trupps bleiben erhalten.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/benutzer/${k.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const selectId = `bv-rolle-${k.id}`;

  return (
    <div className="bv-row">
      <div className="bv-name">
        <span>{k.name}</span>
        {selbst && <span className="badge">du</span>}
      </div>
      <div className="bv-meta">
        <span className={`bv-ff ${k.ff ? '' : 'bv-leerwert'}`}>{k.ff ?? '—'}</span>
        <span className="bv-trupp">
          {k.trupp ? (
            <Link to={`/trupps/${k.trupp.id}`}>
              <TruppName name={k.trupp.name} icon={k.trupp.icon} />
            </Link>
          ) : (
            <span className="bv-leerwert">ohne Trupp</span>
          )}
        </span>
      </div>
      <div className="bv-rolle">
        <label htmlFor={selectId} className="sr-only">
          Systemrolle von {k.name}
        </label>
        <select
          id={selectId}
          value={pending ?? k.systemRolle}
          disabled={pending !== null || busy}
          aria-busy={pending !== null}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-fehler` : undefined}
          onChange={(e) => void changeRolle(e.target.value as SystemRolle)}
        >
          {SYSTEM_ROLLEN.map((r) => (
            <option key={r} value={r}>
              {SYSTEM_ROLLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="bv-actions">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={passwortZuruecksetzen}
          disabled={busy}
          title="Passwort zurücksetzen"
          aria-label={`Passwort von ${k.name} zurücksetzen`}
        >
          <Icon name="key-round" />
        </button>
        {!selbst && (
          <button
            type="button"
            className="btn btn-ghost btn-icon bv-delete"
            onClick={loeschen}
            disabled={busy}
            title="Konto löschen"
            aria-label={`Konto von ${k.name} löschen`}
          >
            <Icon name="trash-2" />
          </button>
        )}
      </div>
      {error && (
        <div className="alert alert-error bv-full" role="alert" id={`${selectId}-fehler`}>
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      {tempPassword && (
        <div className="bv-full">
          <EinmalPasswort password={tempPassword} onClose={() => setTempPassword(null)}>
            Neues Passwort für <strong>{k.name}</strong>.
          </EinmalPasswort>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Branding

type Meldung = { ok: boolean; text: string } | null;

function MeldungText({ meldung }: { meldung: Meldung }) {
  if (!meldung) return null;
  return (
    <span className={`bv-msg ${meldung.ok ? 'bv-msg-ok' : 'bv-msg-error'}`} role={meldung.ok ? 'status' : 'alert'}>
      <Icon name={meldung.ok ? 'check' : 'triangle-alert'} />
      {meldung.text}
    </span>
  );
}

const WAPPEN_TYPEN: readonly string[] = WAPPEN_CONTENT_TYPES;

/** Führende Feuerwehr + Wappen — one instance-wide setting, shown in the header and on the login. */
function BrandingEinstellungen() {
  const { set } = useEinstellungen();
  const [e, setE] = useState<Einstellungen | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);

  useEffect(() => {
    api<Einstellungen>('/einstellungen', { auth: 'none' })
      .then((res) => {
        setE(res);
        set(res);
      })
      .catch((err) => setLadefehler(errorMessage(err)));
  }, [set]);

  const gespeichert = (res: Einstellungen) => {
    setE(res);
    set(res);
  };

  return (
    <section className="card stack" aria-labelledby="bv-branding-titel">
      <div>
        <h2 id="bv-branding-titel">Führende Feuerwehr &amp; Wappen</h2>
        <p className="muted bv-intro">Erscheint klein neben dem App-Namen im Kopfbereich und auf der Anmeldeseite.</p>
      </div>
      {ladefehler && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{ladefehler}</div>
        </div>
      )}
      {!e ? (
        !ladefehler && <p className="muted">Lade…</p>
      ) : (
        <div className="bv-branding">
          <FeuerwehrName einstellungen={e} onSaved={gespeichert} />
          <WappenUpload einstellungen={e} onSaved={gespeichert} />
        </div>
      )}
    </section>
  );
}

function FeuerwehrName({ einstellungen, onSaved }: { einstellungen: Einstellungen; onSaved: (e: Einstellungen) => void }) {
  const [value, setValue] = useState(einstellungen.fuehrendeFeuerwehr ?? '');
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const dirty = value.trim() !== (einstellungen.fuehrendeFeuerwehr ?? '');

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setMeldung(null);
    try {
      const body: EinstellungenUpdate = { fuehrendeFeuerwehr: value.trim() || null };
      const res = await api<Einstellungen>('/einstellungen', { method: 'PUT', body });
      onSaved(res);
      setValue(res.fuehrendeFeuerwehr ?? '');
      setMeldung({ ok: true, text: res.fuehrendeFeuerwehr ? 'Gespeichert' : 'Entfernt' });
    } catch (err) {
      setMeldung({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack bv-branding-part" onSubmit={save}>
      <div className="field">
        <label htmlFor="bv-ff">Führende Feuerwehr</label>
        <input
          id="bv-ff"
          maxLength={120}
          placeholder="z. B. FF Musterdorf"
          value={value}
          onChange={(ev) => {
            setValue(ev.target.value);
            setMeldung(null);
          }}
        />
        <p className="field-hint">Leer lassen und speichern, um den Namen zu entfernen.</p>
      </div>
      <div className="btn-row">
        <button className="btn btn-secondary" type="submit" disabled={busy || !dirty} aria-busy={busy}>
          Speichern
        </button>
        <MeldungText meldung={meldung} />
      </div>
    </form>
  );
}

function WappenUpload({ einstellungen, onSaved }: { einstellungen: Einstellungen; onSaved: (e: Einstellungen) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const wappen = einstellungen.wappen;

  const hochladen = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // the same file can be picked again after an error
    if (!file) return;
    setMeldung(null);
    if (!WAPPEN_TYPEN.includes(file.type)) {
      setMeldung({ ok: false, text: 'Nur PNG-, JPG-, WebP- oder SVG-Bilder sind als Wappen erlaubt' });
      return;
    }
    if (file.size > WAPPEN_MAX_BYTES) {
      setMeldung({ ok: false, text: 'Das Wappen darf höchstens 2 MB groß sein' });
      return;
    }
    setBusy(true);
    try {
      onSaved(await api<Einstellungen>('/einstellungen/wappen', { method: 'PUT', raw: file }));
      setMeldung({ ok: true, text: 'Wappen gespeichert' });
    } catch (err) {
      setMeldung({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const entfernen = async () => {
    if (!confirm('Wappen entfernen? Es wird danach nirgends mehr angezeigt.')) return;
    setBusy(true);
    setMeldung(null);
    try {
      onSaved(await api<Einstellungen>('/einstellungen/wappen', { method: 'DELETE' }));
      setMeldung({ ok: true, text: 'Wappen entfernt' });
    } catch (err) {
      setMeldung({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack bv-branding-part">
      <div>
        <span className="bv-label" id="bv-wappen-label">
          Wappen
        </span>
        <div className="bv-wappen-preview">
          {wappen ? (
            <img src={apiUrl(wappen.pfad)} alt={einstellungen.fuehrendeFeuerwehr ?? 'Wappen'} />
          ) : (
            <span className="muted">Kein Wappen hinterlegt.</span>
          )}
        </div>
        <p className="field-hint">PNG, JPG, WebP oder SVG, höchstens 2 MB.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={WAPPEN_CONTENT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby="bv-wappen-label"
        onChange={hochladen}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-busy={busy}
        >
          <Icon name="upload" />
          {busy ? 'Lädt…' : wappen ? 'Wappen ersetzen' : 'Wappen hochladen'}
        </button>
        {wappen && (
          <button type="button" className="btn btn-ghost bv-delete" onClick={entfernen} disabled={busy}>
            <Icon name="trash-2" />
            Entfernen
          </button>
        )}
      </div>
      <MeldungText meldung={meldung} />
    </div>
  );
}
