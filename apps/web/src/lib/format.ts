const dateFmt = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Formats a YYYY-MM-DD date string without timezone shifting. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

export const formatTime = (iso: string): string => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso));

/** Whole days from today (local) until a YYYY-MM-DD date. Negative if in the past. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function countdownLabel(pruefungstermin: string | null | undefined): string {
  if (!pruefungstermin) return 'Kein Prüfungstermin';
  const days = daysUntil(pruefungstermin);
  if (days > 1) return `noch ${days} Tage`;
  if (days === 1) return 'morgen';
  if (days === 0) return 'heute!';
  return 'vorbei';
}

/** YYYY-MM-DD in local time. */
export function toLocalDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** HH:MM in local time. */
export function toLocalTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Combines local date + time inputs into an ISO string (with offset → UTC). */
export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
