import {
  ROLLE_LABELS,
  ROLLE_SHORT,
  ROLLEN,
  rollenBesetzung,
  type Rolle,
  type RolleUpdate,
  type Teilnehmer,
} from '@apas/shared';
import { api } from '../lib/api';
import { Icon } from './Icon';
import './Rollen.css';

/** PATCH /teilnehmer/:id/rolle (APAS-Rolle) — usable by Ausbilder and every member of the Trupp. */
export function saveRolle(teilnehmerId: string, rolle: Rolle | null) {
  const body: RolleUpdate = { rolle };
  return api<Teilnehmer>(`/teilnehmer/${teilnehmerId}/rolle`, { method: 'PATCH', body });
}

export function RolleSelect({
  teilnehmer,
  onChange,
  disabled,
}: {
  teilnehmer: Teilnehmer;
  onChange: (rolle: Rolle | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="rolle-select"
      value={teilnehmer.rolle ?? ''}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as Rolle | null)}
      aria-label={`Rolle von ${teilnehmer.name}`}
      title={teilnehmer.rolle ? ROLLE_LABELS[teilnehmer.rolle] : 'Noch keine Rolle'}
    >
      <option value="">— keine Rolle —</option>
      {ROLLEN.map((r) => (
        <option key={r} value={r}>
          {ROLLE_SHORT[r]} — {ROLLE_LABELS[r].replace(/\s*\(.*\)$/, '')}
        </option>
      ))}
    </select>
  );
}

/**
 * "3/4 Rollen besetzt" plus one chip per Rolle. Informational only — a Rolle may be held
 * by several Teilnehmer (Ergänzungsteilnehmer), shown as "×2".
 */
export function RollenAbdeckung({ teilnehmer }: { teilnehmer: Teilnehmer[] }) {
  const counts = rollenBesetzung(teilnehmer);
  const besetzt = ROLLEN.filter((r) => counts[r] > 0).length;
  return (
    <div className="rollen-abdeckung">
      <span className={`rollen-count ${besetzt === ROLLEN.length ? 'rollen-voll' : ''}`}>
        {besetzt}/{ROLLEN.length} Rollen besetzt
      </span>
      <span className="rollen-chips">
        {ROLLEN.map((r) => (
          <span
            key={r}
            className={`rollen-chip ${counts[r] > 0 ? 'rollen-chip-ok' : ''}`}
            title={`${ROLLE_LABELS[r]}: ${counts[r] === 0 ? 'unbesetzt' : `${counts[r]}× besetzt`}`}
          >
            {counts[r] > 0 && <Icon name="check" size="1em" />}
            {ROLLE_SHORT[r]}
            {counts[r] > 1 && <span> ×{counts[r]}</span>}
          </span>
        ))}
      </span>
    </div>
  );
}

export const rolleShort = (rolle: Rolle | null): string => (rolle ? ROLLE_SHORT[rolle] : 'keine Rolle');
export const rolleLabel = (rolle: Rolle | null): string => (rolle ? ROLLE_LABELS[rolle] : 'noch keine Rolle');
