import { config } from './config.js';
import { db, type PushOwner, type TerminRecord } from './db.js';
import { formatTerminZeit } from './lib/format.js';
import { newId } from './lib/ids.js';
import { isPushEnabled, sendPushTo } from './push.js';

/**
 * One tick: finds Termine starting within the next REMINDER_HOURS_BEFORE hours that
 * have not been reminded yet (per terminId + start), pushes to the assigned
 * accounts (of any Trupp), everyone who confirmed "anwesend" and every Ausbilder, and
 * records the reminder.
 */
export async function reminderTick(now = new Date()): Promise<void> {
  const horizon = now.getTime() + config.reminderHoursBefore * 3600_000;
  const termine = await db.termine.find((t) => {
    const s = new Date(t.start).getTime();
    return s > now.getTime() && s <= horizon;
  });
  if (termine.length === 0) return;

  const [sent, ausbilder] = await Promise.all([
    db.reminders.all(),
    db.benutzer.find((b) => b.systemRolle === 'ausbilder'),
  ]);
  const due = termine.filter((t) => !sent.some((r) => r.terminId === t.id && r.start === t.start));

  for (const t of due) {
    // Mark first so a crash mid-send never leads to duplicate reminders.
    await db.reminders.insert({ id: newId(), terminId: t.id, start: t.start, sentAt: new Date().toISOString() });

    const ids = new Set([...t.teilnehmerIds, ...(t.anwesendIds ?? []), ...ausbilder.map((a) => a.id)]);
    const owners = [...ids].map((id): PushOwner => ({ kind: 'benutzer', id }));
    const art = t.typ === 'fix' ? 'Fixtermin' : 'Individualübung';
    const delivered = await sendPushTo(owners, {
      title: `Erinnerung: ${t.titel}`,
      body: `${art} am ${formatTerminZeit(t.start)}`,
      url: '/kalender',
      tag: `termin-${t.id}`,
    });
    console.log(`[reminders] Termin ${t.id} "${t.titel}": ${delivered} Push-Nachricht(en) zugestellt`);
  }
}

/**
 * Immediate push when a Fixtermin is created (not on edits, never for Individualübungen).
 * Same targeting as reminderTick — assigned teilnehmerIds + every Ausbilder — minus the
 * creator. Never throws: call fire-and-forget (`void notifyNewFixtermin(rec)`).
 */
export async function notifyNewFixtermin(t: TerminRecord): Promise<void> {
  if (t.typ !== 'fix') return;
  if (!isPushEnabled()) {
    console.log(`[push] Neuer Fixtermin ${t.id} "${t.titel}": Push deaktiviert (keine VAPID-Schlüssel), nichts gesendet`);
    return;
  }
  try {
    const ausbilder = await db.benutzer.find((b) => b.systemRolle === 'ausbilder');
    const ids = new Set([...t.teilnehmerIds, ...ausbilder.map((a) => a.id)]);
    ids.delete(t.createdBy);
    const owners = [...ids].map((id): PushOwner => ({ kind: 'benutzer', id }));
    const delivered = await sendPushTo(owners, {
      title: `Neuer Übungstermin: ${t.titel}`,
      body: formatTerminZeit(t.start),
      url: '/kalender',
      tag: `termin-neu-${t.id}`,
    });
    console.log(`[push] Neuer Fixtermin ${t.id} "${t.titel}": ${delivered} Push-Nachricht(en) zugestellt`);
  } catch (err) {
    console.log(`[push] Neuer Fixtermin ${t.id}: Benachrichtigung fehlgeschlagen — ${(err as Error).message}`);
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
