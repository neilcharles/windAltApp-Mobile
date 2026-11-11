/** "2026-11-10" -> "Tue 10 Nov" (dates are already local Europe/London from Open-Meteo). */
export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export function ageText(fetchedAt: number, now = Date.now()) {
  const mins = Math.round((now - fetchedAt) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}
