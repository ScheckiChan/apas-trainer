import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { enablePush, pushSupported } from '../lib/push';
import { Icon } from './Icon';

/** "Erinnerungen aktivieren" — subscribes this device for Termin reminders (Konto menu). */
export function PushButton({ onDone }: { onDone?: () => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'on'>(
    pushSupported() && Notification.permission === 'granted' ? 'on' : 'idle',
  );
  if (!pushSupported()) return null;

  const onClick = async () => {
    setState('busy');
    try {
      await enablePush();
      setState('on');
      onDone?.();
    } catch (err) {
      setState('idle');
      alert(errorMessage(err));
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-ghost ${state === 'on' ? 'push-on' : ''}`}
      onClick={onClick}
      disabled={state === 'busy'}
      title={state === 'on' ? 'Push-Erinnerungen sind aktiv' : 'Push-Erinnerungen vor Terminen aktivieren'}
    >
      <Icon name={state === 'on' ? 'bell-ring' : 'bell'} />
      {state === 'on' ? 'Erinnerungen an' : 'Erinnerungen aktivieren'}
    </button>
  );
}
