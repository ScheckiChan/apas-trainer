import {
  CHECKLIST_ITEMS,
  CHECKLIST_LABELS,
  checklistAmpel,
  isChecklistItemRequired,
  type Ampel,
  type ChecklistItem,
  type Teilnehmer,
} from '@apas/shared';
import './Checklist.css';

const AMPEL_TITLE: Record<Ampel, string> = {
  gruen: 'Alle Voraussetzungen erfüllt',
  gelb: 'Teilweise erfüllt',
  rot: 'Noch offen',
};

export function AmpelDot({ teilnehmer }: { teilnehmer: Teilnehmer }) {
  const a = checklistAmpel(teilnehmer.rolle, teilnehmer.checkliste);
  return <span className={`ampel ampel-${a}`} title={AMPEL_TITLE[a]} aria-label={AMPEL_TITLE[a]} />;
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
              {CHECKLIST_LABELS[item]}
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
            {CHECKLIST_LABELS[item]}
            <small>{ok ? '✓ ok' : 'offen'}</small>
          </button>
        );
      })}
    </div>
  );
}
