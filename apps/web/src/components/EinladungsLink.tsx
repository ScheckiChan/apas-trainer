import QRCode from 'qrcode';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import './EinladungsLink.css';

/**
 * A shareable link as a card: heading, optional explanation, the full URL (read-only, selects
 * on focus), "Kopieren" (falls back to a prompt where the clipboard API is blocked) and a QR
 * code to scan off the screen. Used for a Trupp's own invite link (TruppDetail) and the
 * instance-wide /registrieren link (TruppDashboard). `children` adds further buttons beside
 * "Kopieren" (e.g. "Neu erzeugen").
 */
export function EinladungsLink({
  titel,
  link,
  beschreibung,
  qrAlt,
  children,
}: {
  titel: string;
  link: string;
  beschreibung?: ReactNode;
  qrAlt: string;
  children?: ReactNode;
}) {
  const uid = useId();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Literal colours: the QR is a raster image (dark = --ink), kept dark-on-white in both schemes.
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#221716', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      prompt('Link kopieren:', link);
    }
  };

  return (
    <section className="card einladung" aria-labelledby={`${uid}-h`}>
      <div className="stack">
        <h2 id={`${uid}-h`}>{titel}</h2>
        {beschreibung && <p className="muted einladung-text">{beschreibung}</p>}
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={`${titel}: Link`} />
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} />
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
          {children}
        </div>
        <span className="sr-only" role="status">
          {copied ? 'Link kopiert' : ''}
        </span>
      </div>
      {qr && <img className="einladung-qr" src={qr} alt={qrAlt} width={150} height={150} />}
    </section>
  );
}
