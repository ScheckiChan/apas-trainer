/** Short de-AT date/time for push texts, e.g. "Mo., 06.10., 18:30" (server TZ, default Europe/Vienna). */
const terminZeitFmt = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: process.env.TZ || 'Europe/Vienna',
});

export const formatTerminZeit = (iso: string): string => terminZeitFmt.format(new Date(iso));
