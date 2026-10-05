import {
  type BuchungsKonflikt,
  type Ressource,
  type Teilnehmer,
  type Termin,
  type TerminInput,
  type TerminSaveResponse,
  type TerminTyp,
} from '@apas/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { rolleShort } from '../components/Rollen';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, formatTime, localToIso, toLocalDateKey, toLocalTime } from '../lib/format';
import './Calendar.css';

type Auth = 'leiter' | 'teilnehmer';

interface CalendarProps {
  truppId: string;
  auth: Auth;
  /** Set when a Teilnehmer is viewing — used for permissions and defaults. */
  currentTeilnehmerId?: string;
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

/** 6×7 grid starting on the Monday on/before the 1st of the month. */
function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function Calendar({ truppId, auth, currentTeilnehmerId }: CalendarProps) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [termine, setTermine] = useState<Termin[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
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
          `/trupps/${truppId}/termine?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
          { auth },
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [grid, truppId, auth]);

  useEffect(() => {
    void loadTermine();
  }, [loadTermine]);

  useEffect(() => {
    Promise.all([
      api<Teilnehmer[]>(`/trupps/${truppId}/teilnehmer`, { auth }),
      api<Ressource[]>(`/trupps/${truppId}/ressourcen`, { auth }),
    ])
      .then(([t, r]) => {
        setTeilnehmer(t);
        setRessourcen(r);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [truppId, auth]);

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
          {auth === 'leiter' && (
            <button type="button" className="btn" onClick={() => setEditor({ mode: 'create', typ: 'fix', date: defaultDate() })}>
              <Icon name="plus" />
              Neuer Fixtermin
            </button>
          )}
          <button
            type="button"
            className={`btn ${auth === 'leiter' ? 'btn-secondary' : ''}`}
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
          <Icon name="users" size="1em" /> Fixtermin <span className="muted">— gemeinsam, vom Ausbildungsleiter</span>
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
              onClick={() => setEditor({ mode: 'create', typ: auth === 'leiter' ? 'fix' : 'individual', date: key })}
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

      {editor && (
        <TerminEditor
          key={editor.mode === 'edit' ? editor.termin.id : `${editor.typ}-${editor.date}`}
          state={editor}
          truppId={truppId}
          auth={auth}
          currentTeilnehmerId={currentTeilnehmerId}
          teilnehmer={teilnehmer}
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
  truppId,
  auth,
  currentTeilnehmerId,
  teilnehmer,
  ressourcen,
  onClose,
  onSaved,
}: {
  state: NonNullable<EditorState>;
  truppId: string;
  auth: Auth;
  currentTeilnehmerId?: string;
  teilnehmer: Teilnehmer[];
  ressourcen: Ressource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = state.mode === 'edit' ? state.termin : null;
  const typ: TerminTyp = existing ? existing.typ : state.mode === 'create' ? state.typ : 'individual';
  const canEdit =
    !existing || auth === 'leiter' || (existing.typ === 'individual' && existing.createdBy === currentTeilnehmerId);

  const [titel, setTitel] = useState(existing?.titel ?? (typ === 'fix' ? 'Gemeinsame Übung' : 'Individualübung'));
  const [date, setDate] = useState(
    existing ? toLocalDateKey(new Date(existing.start)) : state.mode === 'create' ? state.date : '',
  );
  const [startTime, setStartTime] = useState(existing ? toLocalTime(new Date(existing.start)) : '18:00');
  const [endTime, setEndTime] = useState(existing ? toLocalTime(new Date(existing.ende)) : '20:00');
  const [ressourceId, setRessourceId] = useState(existing?.ressourceId ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (existing) return new Set(existing.teilnehmerIds);
    if (typ === 'fix') return new Set(teilnehmer.map((t) => t.id));
    return new Set(currentTeilnehmerId ? [currentTeilnehmerId] : []);
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
      api<BuchungsKonflikt[]>(`/trupps/${truppId}/termine/konflikte`, {
        method: 'POST',
        auth,
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
  }, [ressourceId, date, startTime, endTime, timesValid, truppId, auth, existing?.id]);

  const toggleTn = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        existing ? `/trupps/${truppId}/termine/${existing.id}` : `/trupps/${truppId}/termine`,
        { method: existing ? 'PUT' : 'POST', auth, body },
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
      await api(`/trupps/${truppId}/termine/${existing.id}`, { method: 'DELETE', auth });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const ressourceName = (id: string) => ressourcen.find((r) => r.id === id)?.name ?? 'Ressource';
  const creatorLabel = (createdBy: string) =>
    createdBy === 'ausbildungsleiter' ? 'Ausbildungsleiter' : (teilnehmer.find((t) => t.id === createdBy)?.name ?? '—');

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
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(new Set(teilnehmer.map((t) => t.id)))}>
                    Alle
                  </button>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(new Set())}>
                    Keine
                  </button>
                </span>
              )}
            </div>
            {teilnehmer.length === 0 ? (
              <p className="muted">Noch keine Teilnehmer im Trupp.</p>
            ) : (
              <div className="cal-tn-list">
                {teilnehmer.map((t) => (
                  <label key={t.id} className="cal-tn">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTn(t.id)} />
                    <span>{t.name}</span>
                    <span className="muted">
                      {rolleShort(t.rolle)} · {t.ff}
                    </span>
                  </label>
                ))}
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
