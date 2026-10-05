import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './AppHeader.css';

export function AppHeader({ backTo, children }: { backTo?: string; children?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        {backTo && (
          <Link to={backTo} className="app-header-back" aria-label="Zurück">
            ←
          </Link>
        )}
        <Link to="/" className="app-header-brand">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} />
          APAS-Trainer
        </Link>
        <div className="app-header-actions">{children}</div>
      </div>
    </header>
  );
}
