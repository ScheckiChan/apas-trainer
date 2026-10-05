import {
  CHECKLIST_ITEMS,
  CHECKLIST_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  type Ampel,
  type ChecklistItem,
  type Teilnehmer,
} from '@apas/shared';
import { Icon, type IconName } from './Icon';
import './Checklist.css';

const AMPEL_TITLE: Record<Ampel, string> = {
  gruen: 'Alle Voraussetzungen erfüllt',
  gelb: 'Teilweise erfüllt',
  rot: 'Noch offen',
};

// Shape carries the state as well as colour (check / dashed / empty), for colour-blind users.
const AMPEL_ICON: Record<Ampel, IconName> = {
  gruen: 'circle-check',
  gelb: 'circle-dashed',
  rot: 'circle',
};

export function AmpelDot({ teilnehmer }: { teilnehmer: Teilnehmer }) {
  const a = checklistAmpel(teilnehmer.rolle, teilnehmer.checkliste);
  return (
    <span className={`ampel ampel-${a}`} title={AMPEL_TITLE[a]} role="img" aria-label={AMPEL_TITLE[a]}>
      <Icon name={AMPEL_ICON[a]} />
    </span>
  );
}

/**
 * Checklist toggles for one Teilnehmer. Items that don't apply to the Rolle
 * (Tauglichkeit for GKDT) are rendered greyed out as "N/A" instead of a toggle.
 */
export function ChecklistToggles({
  teilnehmer,
  onToggle,
  disabled,
  compact,
}: {
  teilnehmer: Teilnehmer;
  onToggle?: (item: ChecklistItem) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`checklist ${compact ? 'checklist-compact' : ''}`}>
      {CHECKLIST_ITEMS.map((item) => {
        if (!isChecklistItemRequired(teilnehmer.rolle, item)) {
          return (
            <span key={item} className="check check-na" title="Für GKDT nicht erforderlich">
              <span className="check-label">{CHECKLIST_LABELS[item]}</span>
              <small>N/A</small>
            </span>
          );
        }
        const ok = teilnehmer.checkliste[item] === 'ok';
        return (
          <button
            key={item}
            type="button"
            className={`check ${ok ? 'check-ok' : 'check-offen'}`}
            onClick={() => onToggle?.(item)}
            disabled={disabled || !onToggle}
            aria-pressed={ok}
            title={`${CHECKLIST_LABELS[item]}: ${ok ? 'ok' : 'offen'}`}
          >
            <Icon name={ok ? 'circle-check' : 'circle'} className="check-icon" />
            <span className="check-label">{CHECKLIST_LABELS[item]}</span>
            <small>{ok ? 'ok' : 'offen'}</small>
          </button>
        );
      })}
    </div>
  );
}
