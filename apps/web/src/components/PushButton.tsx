import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { enablePush, pushSupported } from '../lib/push';
import { Icon } from './Icon';

/** "Erinnerungen aktivieren" — subscribes this device for Termin reminders. */
export function PushButton({ auth }: { auth: 'leiter' | 'teilnehmer' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'on'>(
    pushSupported() && Notification.permission === 'granted' ? 'on' : 'idle',
  );
  if (!pushSupported()) return null;

  const onClick = async () => {
    setState('busy');
    try {
      await enablePush(auth);
      setState('on');
    } catch (err) {
      setState('idle');
      alert(errorMessage(err));
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-small ${state === 'on' ? 'push-on' : ''}`}
      onClick={onClick}
      disabled={state === 'busy'}
      title={state === 'on' ? 'Push-Erinnerungen sind aktiv' : 'Push-Erinnerungen vor Terminen aktivieren'}
    >
      <Icon name={state === 'on' ? 'bell-ring' : 'bell'} />
      <span className="hide-sm">{state === 'on' ? 'Erinnerungen an' : 'Erinnerungen aktivieren'}</span>
    </button>
  );
}
