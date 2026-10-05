import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import './EinmalPasswort.css';

/**
 * A generated password the API returns exactly once (new account / Passwort zurücksetzen).
 * Shown until closed, with a copy button; it can't be retrieved again.
 */
export function EinmalPasswort({
  password,
  children,
  onClose,
}: {
  password: string;
  /** What happened, e.g. "<b>Max</b> wurde hinzugefügt." */
  children: ReactNode;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      prompt('Passwort kopieren:', password);
    }
  };

  return (
    <div className="alert alert-ok einmal-pw" role="status">
      <Icon name="circle-check" />
      <div className="alert-body einmal-pw-body">
        <div>{children} Einmaliges Passwort — jetzt weitergeben, es wird nicht erneut angezeigt:</div>
        <code className="einmal-pw-code">{password}</code>
        <div className="muted">Anmeldung auf der Startseite mit Name + diesem Passwort.</div>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} />
            {copied ? 'Kopiert' : 'Passwort kopieren'}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
