import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from './Branding';
import { Icon } from './Icon';
import './AppHeader.css';

export function AppHeader({ backTo, children }: { backTo?: string; children?: ReactNode }) {
  const { ff, wappenSrc, wappenAlt, onWappenError } = useBranding();
  const branded = !!(ff || wappenSrc);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {backTo && (
          <Link to={backTo} className="btn btn-ghost btn-icon app-header-back" aria-label="Zurück">
            <Icon name="arrow-left" />
          </Link>
        )}
        <Link
          to="/"
          className={`app-header-brand ${branded ? 'app-header-branded' : ''} ${wappenSrc ? 'app-header-has-wappen' : ''}`}
        >
          <img className="app-header-icon" src="/icons/icon-192.png" alt="" width={28} height={28} />
          <span className="app-header-app">APAS-Trainer</span>
          {branded && (
            <span className="app-header-ff">
              {wappenSrc && (
                <img className="app-header-wappen" src={wappenSrc} alt={wappenAlt} height={30} onError={onWappenError} />
              )}
              {ff && <span className="app-header-ff-name">{ff}</span>}
            </span>
          )}
        </Link>
        <div className="app-header-actions">{children}</div>
      </div>
    </header>
  );
}
