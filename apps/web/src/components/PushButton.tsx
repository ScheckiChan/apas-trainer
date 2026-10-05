import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { enablePush, pushSupported } from '../lib/push';

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
      className="btn btn-ghost btn-small"
      onClick={onClick}
      disabled={state === 'busy'}
      title="Push-Erinnerungen vor Terminen"
    >
      {state === 'on' ? '🔔 Erinnerungen an' : '🔕 Erinnerungen aktivieren'}
    </button>
  );
}
