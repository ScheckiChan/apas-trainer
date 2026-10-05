import { SYSTEM_ROLLE_LABELS } from '@apas/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Icon } from './Icon';
import { PushButton } from './PushButton';
import { TruppName } from './TruppName';

/**
 * Header actions of the home screens: Kalender, Rangliste, Benutzerverwaltung (Ausbilder
 * only) and the Konto menu (who is signed in, Mein Konto, Erinnerungen, Abmelden). Visibility is decided
 * by the account's systemRolle from /auth/me.
 */
export function HauptNav() {
  const { me } = useSession();
  if (!me) return null;
  const ausbilder = me.benutzer.systemRolle === 'ausbilder';
  return (
    <>
      <NavLink to="/kalender" className="btn btn-ghost btn-small hn-btn" title="Kalender">
        <Icon name="calendar-days" />
        <span className="hide-md">Kalender</span>
      </NavLink>
      <NavLink to="/rangliste" className="btn btn-ghost btn-small hn-btn" title="Rangliste">
        <Icon name="trophy" />
        <span className="hide-md">Rangliste</span>
      </NavLink>
      {!ausbilder && me.benutzer.systemRolle === 'pruefer' && (
        <NavLink to="/stationen" className="btn btn-ghost btn-small hn-btn" title="Stationen">
          <Icon name="book-open-check" />
          <span className="hide-md">Stationen</span>
        </NavLink>
      )}
      {ausbilder && (
        <>
          <NavLink to="/stationen" className="btn btn-ghost btn-small hn-btn" title="Stationen">
            <Icon name="book-open-check" />
            <span className="hide-md">Stationen</span>
          </NavLink>
          <NavLink to="/benutzer" className="btn btn-ghost btn-small hn-btn" title="Benutzerverwaltung">
            <Icon name="user-cog" />
            <span className="hide-md">Benutzer</span>
          </NavLink>
        </>
      )}
      <KontoMenu />
    </>
  );
}

function KontoMenu() {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside tap, Escape and navigation.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [location.pathname]);

  if (!me) return null;
  const { benutzer, trupp } = me;
  const vorname = benutzer.name.split(' ')[0];

  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="hn-konto" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-small hn-btn"
        aria-expanded={open}
        aria-controls={menuId}
        title={`Konto: ${benutzer.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="circle-user-round" />
        <span className="hide-md hn-konto-name">{vorname}</span>
      </button>
      {open && (
        <div className="hn-menu" id={menuId}>
          <div className="hn-menu-who">
            <strong>{benutzer.name}</strong>
            <span className="muted">
              {SYSTEM_ROLLE_LABELS[benutzer.systemRolle]}
              {trupp && (
                <>
                  {' · '}
                  <TruppName name={trupp.name} icon={trupp.icon} />
                </>
              )}
            </span>
          </div>
          <Link to="/konto" className="btn btn-ghost" onClick={() => setOpen(false)}>
            <Icon name="settings" />
            Mein Konto
          </Link>
          <PushButton onDone={() => setOpen(false)} />
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <Icon name="log-out" />
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
