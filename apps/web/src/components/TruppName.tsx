import { DEFAULT_TRUPP_ICON, truppIconOrDefault, type TruppIcon } from '@apas/shared';
import { Icon, type IconName } from './Icon';
import './TruppName.css';

/**
 * Compile-time guard: every pickable Trupp icon and the default must exist in Icon.tsx.
 * Adding a name to TRUPP_ICONS in @apas/shared without its path data fails typecheck here.
 */
export function truppIconName(icon: TruppIcon | null | undefined): IconName {
  return truppIconOrDefault(icon) satisfies IconName;
}

/** German names of the mascot icons — used as the radio labels in the picker. */
export const TRUPP_ICON_LABELS: Record<TruppIcon, string> = {
  flame: 'Flamme',
  'fire-extinguisher': 'Feuerlöscher',
  droplets: 'Wassertropfen',
  siren: 'Blaulicht',
  axe: 'Axt',
  shield: 'Schild',
  zap: 'Blitz',
  target: 'Zielscheibe',
  trophy: 'Pokal',
  crown: 'Krone',
  rocket: 'Rakete',
  mountain: 'Berg',
  anchor: 'Anker',
  star: 'Stern',
  bird: 'Vogel',
  dog: 'Hund',
};

/**
 * A Trupp's name with its mascot icon in front. Without a chosen icon the neutral
 * DEFAULT_TRUPP_ICON shows in muted ink, so a picked mascot reads apart from "nothing chosen".
 * The icon is decorative; the name carries the meaning.
 */
export function TruppName({
  name,
  icon,
  className,
}: {
  name: string;
  icon: TruppIcon | null | undefined;
  className?: string;
}) {
  const iconName = truppIconName(icon);
  return (
    <span className={`trupp-name ${className ?? ''}`}>
      <Icon
        name={iconName}
        className={`trupp-name-icon ${iconName === DEFAULT_TRUPP_ICON ? 'trupp-name-icon-default' : ''}`}
      />
      <span className="trupp-name-text">{name}</span>
    </span>
  );
}
