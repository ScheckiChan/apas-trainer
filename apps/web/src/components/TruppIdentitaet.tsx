import {
  DEFAULT_TRUPP_ICON,
  TRUPP_ICONS,
  TRUPP_NAME_MAX,
  type Trupp,
  type TruppIcon,
  type TruppIdentitaetUpdate,
} from '@apas/shared';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { Icon } from './Icon';
import { TRUPP_ICON_LABELS, truppIconName } from './TruppName';
import './TruppIdentitaet.css';

/** Same normalisation the API applies (trim, collapse inner whitespace). */
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');

const DEFAULT_LABEL = 'Kein eigenes Icon (Standard)';

/**
 * Self-service "Name & Icon" of a Trupp (PATCH /trupps/:id/identitaet). Render it only where
 * kannTruppIdentitaetBearbeiten allows: Ausbilder, or members of this Trupp.
 * The icon picker is a native radio group — arrow keys move the choice, each option carries
 * its German name, and the selection shows as a ring plus a check mark, not by colour alone.
 */
export function TruppIdentitaet({
  trupp,
  onSaved,
  intro,
}: {
  trupp: Trupp;
  onSaved: (trupp: Trupp) => void;
  intro?: string;
}) {
  const uid = useId();
  const [name, setName] = useState(trupp.name);
  const [icon, setIcon] = useState<TruppIcon | null>(trupp.icon);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Another tab / the Ausbilder may have changed it meanwhile — follow the server copy.
  useEffect(() => {
    setName(trupp.name);
    setIcon(trupp.icon);
  }, [trupp.name, trupp.icon]);

  const nameNorm = normalize(name);
  const nameChanged = nameNorm !== trupp.name;
  const iconChanged = icon !== trupp.icon;
  const dirty = nameChanged || iconChanged;

  const edit = () => {
    setSaved(false);
    setError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    if (!nameNorm) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: TruppIdentitaetUpdate = {
        ...(nameChanged ? { name: nameNorm } : {}),
        ...(iconChanged ? { icon } : {}),
      };
      const updated = await api<Trupp>(`/trupps/${trupp.id}/identitaet`, { method: 'PATCH', body });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const options: (TruppIcon | null)[] = [null, ...TRUPP_ICONS];
  const label = (o: TruppIcon | null) => (o ? TRUPP_ICON_LABELS[o] : DEFAULT_LABEL);

  return (
    <form className="card stack ti" onSubmit={save} aria-labelledby={`${uid}-h`}>
      <div>
        <h2 id={`${uid}-h`}>Name &amp; Icon</h2>
        <p className="muted ti-intro">
          {intro ?? 'Euer Trupp-Name und Maskottchen — erscheint in der Trupp-Liste, der Rangliste und im Kalender.'}
        </p>
      </div>

      <div>
        <label htmlFor={`${uid}-name`}>Trupp-Name</label>
        <input
          id={`${uid}-name`}
          required
          maxLength={TRUPP_NAME_MAX}
          autoComplete="off"
          placeholder="z. B. Die Rauchfresser"
          aria-describedby={`${uid}-name-hint`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            edit();
          }}
        />
        <p className="field-hint num" id={`${uid}-name-hint`}>
          {nameNorm.length}/{TRUPP_NAME_MAX} Zeichen
        </p>
      </div>

      <fieldset className="ti-fieldset">
        <legend className="ti-legend">Icon des Trupps</legend>
        <div className="ti-grid">
          {options.map((o) => {
            const checked = icon === o;
            return (
              <label
                key={o ?? 'default'}
                className={`ti-opt ${checked ? 'ti-opt-checked' : ''} ${o ? '' : 'ti-opt-default'}`}
                title={label(o)}
              >
                <input
                  type="radio"
                  name={`${uid}-icon`}
                  value={o ?? ''}
                  checked={checked}
                  onChange={() => {
                    setIcon(o);
                    edit();
                  }}
                />
                <Icon name={o ?? DEFAULT_TRUPP_ICON} className="ti-opt-icon" />
                <span className="sr-only">{label(o)}</span>
                {checked && (
                  <span className="ti-opt-check">
                    <Icon name="check" size="0.75rem" />
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="ti-current" aria-hidden="true">
          <Icon name={truppIconName(icon)} className={icon ? 'ti-current-icon' : 'ti-current-icon ti-current-default'} />
          {icon ? TRUPP_ICON_LABELS[icon] : DEFAULT_LABEL}
        </p>
      </fieldset>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="triangle-alert" />
          <div className="alert-body">{error}</div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-secondary" type="submit" disabled={busy || !dirty} aria-busy={busy}>
          <Icon name="save" />
          {busy ? 'Speichere…' : 'Speichern'}
        </button>
        {saved && !dirty && (
          <span className="ti-saved" role="status">
            <Icon name="check" />
            Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}
