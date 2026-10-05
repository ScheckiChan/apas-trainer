import {
  SYSTEM_ROLLE_LABELS,
  type BuchungsKonflikt,
  type KalenderPerson,
  type Ressource,
  type Termin,
  type TerminInput,
  type TerminSaveResponse,
  type TerminTyp,
  type TruppIcon,
} from '@apas/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { rolleShort } from '../components/Rollen';
import { TruppName } from '../components/TruppName';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, formatTime, localToIso, toLocalDateKey, toLocalTime } from '../lib/format';
import { useMe } from '../lib/session';
import './Calendar.css';

interface CalendarProps {
  /** Ausbilder manage Fixtermine and Ressourcen and may edit every Termin. */
  ausbilder: boolean;
  /** The signed-in account — creator of new Termine, may edit its own Individualübungen. */
  currentId: string;
}

type EditorState =
  | { mode: 'create'; typ: TerminTyp; date: string }
  | { mode: 'edit'; termin: Termin }
  | null;

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Fixtermin vs. Individualübung: icon + fill style + label, never colour alone. */
function TypIcon({ typ }: { typ: TerminTyp }) {
  return (
    <span className={`cal-typ ${typ === 'fix' ? 'cal-typ-fix' : 'cal-typ-individual'}`}>
      <Icon name={typ === 'fix' ? 'users' : 'user'} size="1em" />
      <span className="sr-only">{typ === 'fix' ? 'Fixtermin' : 'Individualübung'}</span>
    </span>
  );
}
const monthFmt = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });

const OHNE_TRUPP = 'Ohne Trupp';

/**
 * Personen grouped by Trupp, in the server's order (Trupp name, then name). Accounts without
 * a Trupp (e.g. Ausbilder, Prüfer, freshly registered) form the last group "Ohne Trupp".
 */
type TruppGruppe = { key: string; truppName: string; truppIcon: TruppIcon | null; personen: KalenderPerson[] };

function byTrupp(personen: KalenderPerson[]): TruppGruppe[] {
  const groups = new Map<string, TruppGruppe>();
  for (const p of personen) {
    const key = p.truppId ?? '';
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, truppName: p.truppName ?? OHNE_TRUPP, truppIcon: p.truppIcon, personen: [] }));
    g.personen.push(p);
  }
  const list = [...groups.values()];
  return [...list.filter((g) => g.key), ...list.filter((g) => !g.key)];
}

/**
 * "ATF/ATM1 · FF Fels" — the systemRolle instead of the APAS-Rolle for Ausbilder / Prüfer,
 * no APAS-Rolle at all for people without a Trupp.
 */
function personDetail(p: KalenderPerson): string {
  const rolle =
    p.systemRolle !== 'teilnehmer' ? SYSTEM_ROLLE_LABELS[p.systemRolle] : p.truppId ? rolleShort(p.rolle) : null;
  return [rolle, p.ff].filter(Boolean).join(' · ');
}

/** /kalender — the one shared calendar of this Ausbildung, for every account. */
export function KalenderPage() {
  const me = useMe();

  return (
    <>
      <AppHeader backTo="/" />
      <main className="page stack">
        <div>
          <h1>Kalender</h1>
          <p className="muted">Ein gemeinsamer Kalender für alle Trupps dieser Ausbildung.</p>
        </div>
        <Calendar ausbilder={me.benutzer.systemRolle === 'ausbilder'} currentId={me.benutzer.id} />
      </main>
    </>
  );
}

/** 6×7 grid starting on the Monday on/before the 1st of the month. */
function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function Calendar({ ausbilder, currentId }: CalendarProps) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [termine, setTermine] = useState<Termin[]>([]);
  const [personen, setPersonen] = useState<KalenderPerson[]>([]);
  const [ressourcen, setRessourcen] = useState<Ressource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const grid = useMemo(() => buildGrid(month), [month]);
  const todayKey = toLocalDateKey(new Date());

  const loadTermine = useCallback(async () => {
    const from = grid[0];
    const to = new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate() + 1);
    try {
      setTermine(
        await api<Termin[]>(
          `/termine?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [grid]);

  useEffect(() => {
    void loadTermine();
  }, [loadTermine]);

  useEffect(() => {
    Promise.all([
      api<KalenderPerson[]>('/termine/personen'),
      api<Ressource[]>('/ressourcen'),
    ])
      .then(([p, r]) => {
        setPersonen(p);
        setRessourcen(r);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const termineOn = (day: Date): Termin[] => {
    const start = day.getTime();
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    return termine.filter((t) => new Date(t.start).getTime() < end && new Date(t.ende).getTime() > start);
  };

  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const defaultDate = (): string => {
    const now = new Date();
    return now.getMonth() === month.getMonth() && now.getFullYear() === month.getFullYear()
      ? toLocalDateKey(now)
      : toLocalDateKey(month);
  };

  const upcoming = termine.filter((t) => new Date(t.ende).getTime() >= Date.now()).slice(0, 8);

  return (
    <div className="cal stack">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
            <Icon name="chevron-left" />
          </button>
          <h2 className="num">{monthFmt.format(month)}</h2>
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
            <Icon name="chevron-right" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Heute
          </button>
        </div>
        <div className="btn-row">
          {ausbilder && (
            <button type="button" className="btn" onClick={() => setEditor({ mode: 'create', typ: 'fix', date: defaultDate() })}>
              <Icon name="plus" />
              Neuer Fixtermin
            </button>
          )}
          <button
            type="button"
            className={`btn ${ausbilder ? 'btn-secondary' : ''}`}
            onClick={() => setEditor({ mode: 'create', typ: 'individual', date: defaultDate() })}
          >
            <Icon name="plus" />
            Neue Individualübung
          </button>
        </div>
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-swatch cal-fix" />
          <Icon name="users" size="1em" /> Fixtermin <span className="muted">— gemeinsam, von Ausbildern</span>
        </span>
        <span className="cal-legend-item">
          <span className="cal-swatch cal-individual" />
          <Icon name="user" size="1em" /> Individualübung <span className="muted">— selbst eingetragen</span>
        </span>
      </div>

      {error && (
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-weekday" role="columnheader">
            {d}
          </div>
        ))}
        {grid.map((day) => {
          const key = toLocalDateKey(day);
          const inMonth = day.getMonth() === month.getMonth();
          const items = termineOn(day);
          return (
            <div
              key={key}
              role="gridcell"
              className={`cal-day ${inMonth ? '' : 'cal-day-out'} ${key === todayKey ? 'cal-day-today' : ''}`}
              onClick={() => setEditor({ mode: 'create', typ: ausbilder ? 'fix' : 'individual', date: key })}
            >
              <div className="cal-day-num num">{day.getDate()}</div>
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cal-chip ${t.typ === 'fix' ? 'cal-fix' : 'cal-individual'}`}
                  title={`${formatTime(t.start)}–${formatTime(t.ende)} ${t.titel}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditor({ mode: 'edit', termin: t });
                  }}
                >
                  <span className="sr-only">{t.typ === 'fix' ? 'Fixtermin' : 'Individualübung'}: </span>
                  <span className="cal-chip-time num">{formatTime(t.start)}</span> {t.titel}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <section className="card">
        <h3>Nächste Termine</h3>
        {upcoming.length === 0 ? (
          <p className="muted">Keine anstehenden Termine in diesem Zeitraum.</p>
        ) : (
          <ul className="cal-agenda">
            {upcoming.map((t) => (
              <li key={t.id}>
                <button type="button" className="cal-agenda-item" onClick={() => setEditor({ mode: 'edit', termin: t })}>
                  <TypIcon typ={t.typ} />
                  <span className="cal-agenda-when num">{formatDateTime(t.start)}</span>
                  <span className="cal-agenda-title">{t.titel}</span>
                  {t.ressourceId && (
                    <span className="muted">· {ressourcen.find((r) => r.id === t.ressourceId)?.name ?? 'Ressource'}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ausbilder && (
        <RessourcenPanel
          ressourcen={ressourcen}
          onChange={setRessourcen}
          onRemoved={() => void loadTermine()}
        />
      )}

      {editor && (
        <TerminEditor
          key={editor.mode === 'edit' ? editor.termin.id : `${editor.typ}-${editor.date}`}
          state={editor}
          ausbilder={ausbilder}
          currentId={currentId}
          personen={personen}
          ressourcen={ressourcen}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void loadTermine();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Editor

function TerminEditor({
  state,
  ausbilder,
  currentId,
  personen,
  ressourcen,
  onClose,
  onSaved,
}: {
  state: NonNullable<EditorState>;
  ausbilder: boolean;
  currentId: string;
  personen: KalenderPerson[];
  ressourcen: Ressource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = state.mode === 'edit' ? state.termin : null;
  const typ: TerminTyp = existing ? existing.typ : state.mode === 'create' ? state.typ : 'individual';
  const canEdit =
    !existing || ausbilder || (existing.typ === 'individual' && existing.createdBy === currentId);

  const [titel, setTitel] = useState(existing?.titel ?? (typ === 'fix' ? 'Gemeinsame Übung' : 'Individualübung'));
  const [date, setDate] = useState(
    existing ? toLocalDateKey(new Date(existing.start)) : state.mode === 'create' ? state.date : '',
  );
  const [startTime, setStartTime] = useState(existing ? toLocalTime(new Date(existing.start)) : '18:00');
  const [endTime, setEndTime] = useState(existing ? toLocalTime(new Date(existing.ende)) : '20:00');
  const [ressourceId, setRessourceId] = useState(existing?.ressourceId ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (existing) return new Set(existing.teilnehmerIds);
    // Fixtermin: every Trupp member; Individualübung: yourself (an Ausbilder plans it for others).
    if (typ === 'fix') return new Set(personen.filter((p) => p.truppId).map((p) => p.id));
    return new Set(ausbilder ? [] : [currentId]);
  });
  const [konflikte, setKonflikte] = useState<BuchungsKonflikt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timesValid = !!date && !!startTime && !!endTime && endTime > startTime;

  // Live conflict check — informational only, never blocks saving.
  useEffect(() => {
    if (!ressourceId || !timesValid) {
      setKonflikte([]);
      return;
    }
    const handle = setTimeout(() => {
      api<BuchungsKonflikt[]>('/termine/konflikte', {
        method: 'POST',
        body: {
          ressourceId,
          start: localToIso(date, startTime),
          ende: localToIso(date, endTime),
          excludeTerminId: existing?.id,
        },
      })
        .then(setKonflikte)
        .catch(() => setKonflikte([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [ressourceId, date, startTime, endTime, timesValid, existing?.id]);

  const toggleTn = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Select a whole Trupp, or clear it if it is fully selected already. */
  const toggleTrupp = (ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const gruppen = byTrupp(personen);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!timesValid) {
      setError('Das Ende muss nach dem Beginn liegen.');
      return;
    }
    setBusy(true);
    setError(null);
    const body: TerminInput = {
      typ,
      titel,
      start: localToIso(date, startTime),
      ende: localToIso(date, endTime),
      teilnehmerIds: [...selected],
      ressourceId: ressourceId || null,
    };
    try {
      const res = await api<TerminSaveResponse>(
        existing ? `/termine/${existing.id}` : '/termine',
        { method: existing ? 'PUT' : 'POST', body },
      );
      if (res.konflikte.length > 0) {
        alert(
          `Gespeichert. Hinweis: Die Ressource ist gleichzeitig für ${res.konflikte.length} weitere(n) Termin(e) gebucht.`,
        );
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || !confirm(`Termin „${existing.titel}" löschen?`)) return;
    try {
      await api(`/termine/${existing.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const ressourceName = (id: string) => ressourcen.find((r) => r.id === id)?.name ?? 'Ressource';
  const creatorLabel = (createdBy: string) => {
    if (createdBy === 'ausbildungsleiter') return 'Ausbilder';
    const p = personen.find((t) => t.id === createdBy);
    return p ? `${p.name}${p.truppName ? ` (${p.truppName})` : ''}` : '—';
  };

  const heading = existing
    ? canEdit
      ? `${typ === 'fix' ? 'Fixtermin' : 'Individualübung'} bearbeiten`
      : typ === 'fix'
        ? 'Fixtermin'
        : 'Individualübung'
    : typ === 'fix'
      ? 'Neuer Fixtermin'
      : 'Neue Individualübung';

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <form
        className="card cal-modal stack"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-label={heading}
      >
        <div className="cal-modal-head">
          <h2>
            <TypIcon typ={typ} /> {heading}
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Schließen">
            <Icon name="x" />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <Icon name="triangle-alert" />
            <div className="alert-body">{error}</div>
          </div>
        )}

        <fieldset disabled={!canEdit || busy} className="cal-fieldset">
          <div className="field">
            <label htmlFor="t-titel">Titel</label>
            <input id="t-titel" required value={titel} onChange={(e) => setTitel(e.target.value)} />
          </div>
          <div className="cal-time-row">
            <div className="field">
              <label htmlFor="t-date">Datum</label>
              <input id="t-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="t-start">Beginn</label>
              <input id="t-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="t-end">Ende</label>
              <input id="t-end" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="t-res">Ressource (optional)</label>
            <select id="t-res" value={ressourceId} onChange={(e) => setRessourceId(e.target.value)}>
              <option value="">— keine —</option>
              {ressourcen.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.standort ? ` (${r.standort})` : ''}
                </option>
              ))}
            </select>
          </div>

          {konflikte.length > 0 && (
            <div className="alert alert-warn" role="status">
              <Icon name="triangle-alert" />
              <div className="alert-body">
                <strong>{ressourceName(ressourceId)} ist in diesem Zeitraum schon gebucht:</strong>
                <ul className="cal-conflicts num">
                  {konflikte.map((k) => (
                    <li key={k.terminId}>
                      {k.titel} — {formatDateTime(k.start)}–{formatTime(k.ende)}
                    </li>
                  ))}
                </ul>
                <span className="muted">Speichern geht trotzdem — bitte untereinander abstimmen.</span>
              </div>
            </div>
          )}

          <div className="field">
            <div className="cal-tn-head">
              <label>Teilnehmer ({selected.size})</label>
              {canEdit && (
                <span className="btn-row">
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(new Set(personen.map((t) => t.id)))}>
                    Alle
                  </button>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(new Set())}>
                    Keine
                  </button>
                </span>
              )}
            </div>
            {personen.length === 0 ? (
              <p className="muted">Noch keine Personen.</p>
            ) : (
              <div className="cal-tn-list">
                {gruppen.map((g) => {
                  const ids = g.personen.map((p) => p.id);
                  const count = ids.filter((id) => selected.has(id)).length;
                  return (
                    <div key={g.key || 'ohne'} role="group" aria-label={g.truppName}>
                      <div className="cal-tn-trupp">
                        <span>
                          {g.key ? <TruppName name={g.truppName} icon={g.truppIcon} /> : g.truppName}{' '}
                          <span className="muted num">
                            {count}/{ids.length}
                          </span>
                        </span>
                        {canEdit && (
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => toggleTrupp(ids)}>
                            {count === ids.length ? 'Abwählen' : g.key ? 'Ganzen Trupp' : 'Alle wählen'}
                          </button>
                        )}
                      </div>
                      {g.personen.map((t) => (
                        <label key={t.id} className="cal-tn">
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTn(t.id)} />
                          <span>
                            {t.name}
                            {t.truppName && (
                              <span className="muted">
                                {' ('}
                                <TruppName name={t.truppName} icon={t.truppIcon} />)
                              </span>
                            )}
                          </span>
                          <span className="muted">{personDetail(t)}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </fieldset>

        {existing && <p className="muted">Erstellt von: {creatorLabel(existing.createdBy)}</p>}

        <div className="btn-row cal-modal-actions">
          {canEdit && (
            <button type="submit" className="btn" disabled={busy} aria-busy={busy}>
              {busy ? 'Speichern…' : 'Speichern'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {canEdit ? 'Abbrechen' : 'Schließen'}
          </button>
          {existing && canEdit && (
            <button type="button" className="btn btn-ghost cal-delete" onClick={remove}>
              <Icon name="trash-2" />
              Löschen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Ressourcen (Ausbilder)

/**
 * Ressourcen are instance-wide, so they are managed here in the shared calendar rather than
 * per Trupp. Only Ausbilder create or delete them.
 */
function RessourcenPanel({
  ressourcen,
  onChange,
  onRemoved,
}: {
  ressourcen: Ressource[];
  onChange: (list: Ressource[]) => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState('');
  const [standort, setStandort] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<Ressource>('/ressourcen', { method: 'POST', body: { name, standort } });
      onChange([...ressourcen, r].sort((a, b) => a.name.localeCompare(b.name, 'de')));
      setName('');
      setStandort('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (r: Ressource) => {
    if (!confirm(`Ressource „${r.name}" löschen? Bestehende Termine verlieren die Buchung.`)) return;
    try {
      await api(`/ressourcen/${r.id}`, { method: 'DELETE' });
      onChange(ressourcen.filter((x) => x.id !== r.id));
      onRemoved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card stack">
      <h3>Ressourcen</h3>
      <p className="muted">
        Fahrzeuge, Übungsgelände oder Geräte, die alle Trupps gemeinsam nutzen. Doppelbuchungen werden beim Eintragen
        angezeigt — auch zwischen verschiedenen Trupps.
      </p>
      {error && (
        <div className="alert alert-error">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}
      {ressourcen.length > 0 && (
        <ul className="cal-res-list">
          {ressourcen.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                {r.standort && <span className="muted"> · {r.standort}</span>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon cal-res-remove"
                onClick={() => remove(r)}
                aria-label={`${r.name} löschen`}
                title="Ressource löschen"
              >
                <Icon name="trash-2" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="cal-res-form" onSubmit={add}>
        <input
          required
          placeholder="Name, z. B. HLF Fels"
          aria-label="Name der Ressource"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input placeholder="Standort" aria-label="Standort" value={standort} onChange={(e) => setStandort(e.target.value)} />
        <button className="btn btn-secondary" type="submit">
          <Icon name="plus" />
          Hinzufügen
        </button>
      </form>
    </section>
  );
}
