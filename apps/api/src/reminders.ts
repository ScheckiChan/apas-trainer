import { config } from './config.js';
import { db, type PushOwner } from './db.js';
import { newId } from './lib/ids.js';
import { isPushEnabled, sendPushTo } from './push.js';

const fmt = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: process.env.TZ || 'Europe/Vienna',
});

/**
 * One tick: finds Termine starting within the next REMINDER_HOURS_BEFORE hours that
 * have not been reminded yet (per terminId + start), pushes to the assigned
 * Teilnehmer and the Trupp's Ausbildungsleiter, and records the reminder.
 */
export async function reminderTick(now = new Date()): Promise<void> {
  const horizon = now.getTime() + config.reminderHoursBefore * 3600_000;
  const termine = await db.termine.find((t) => {
    const s = new Date(t.start).getTime();
    return s > now.getTime() && s <= horizon;
  });
  if (termine.length === 0) return;

  const sent = await db.reminders.all();
  const due = termine.filter((t) => !sent.some((r) => r.terminId === t.id && r.start === t.start));

  for (const t of due) {
    const trupp = await db.trupps.get(t.truppId);
    if (!trupp) continue;

    // Mark first so a crash mid-send never leads to duplicate reminders.
    await db.reminders.insert({ id: newId(), terminId: t.id, start: t.start, sentAt: new Date().toISOString() });

    const owners: PushOwner[] = [
      ...t.teilnehmerIds.map((id): PushOwner => ({ kind: 'teilnehmer', id })),
      { kind: 'leiter', id: trupp.ownerId },
    ];
    const art = t.typ === 'fix' ? 'Fixtermin' : 'Individualübung';
    const delivered = await sendPushTo(owners, {
      title: `Erinnerung: ${t.titel}`,
      body: `${art} am ${fmt.format(new Date(t.start))} — ${trupp.name}`,
      url: '/',
      tag: `termin-${t.id}`,
    });
    console.log(`[reminders] Termin ${t.id} "${t.titel}": ${delivered} Push-Nachricht(en) zugestellt`);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startReminderLoop(): void {
  if (!isPushEnabled()) {
    console.warn('[reminders] push disabled — reminder loop not started');
    return;
  }
  const intervalMs = Math.max(1, config.reminderIntervalMinutes) * 60_000;
  const run = () => reminderTick().catch((err) => console.error('[reminders] tick failed', err));
  void run();
  timer = setInterval(run, intervalMs);
  timer.unref();
  console.log(
    `[reminders] checking every ${config.reminderIntervalMinutes} min, ${config.reminderHoursBefore} h before each Termin`,
  );
}

export function stopReminderLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Cleanup helper: drop reminder records of deleted Termine. */
export async function forgetReminders(terminId: string): Promise<void> {
  await db.reminders.remove((r) => r.terminId === terminId);
}
