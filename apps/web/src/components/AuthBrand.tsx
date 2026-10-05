import type { ReactNode } from 'react';
import { useBranding } from './Branding';

/** Head of the pre-login pages (Login, Registrieren, Join): app name + instance branding. */
export function AuthBrand({ children }: { children?: ReactNode }) {
  const { ff, wappenSrc, wappenAlt, onWappenError } = useBranding();
  return (
    <div className="auth-brand">
      <img src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div className="auth-brand-text">
        <h1>APAS-Trainer</h1>
        {(ff || wappenSrc) && (
          <p className="auth-ff">
            {wappenSrc && <img src={wappenSrc} alt={wappenAlt} height={28} onError={onWappenError} />}
            {ff && <span>{ff}</span>}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
