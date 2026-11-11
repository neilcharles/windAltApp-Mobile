// Daylight window for flying: sunrise - 30 min to sunset + 30 min (pilots can fly while it's
// still light). Sun times use NOAA's general solar position equations (accurate to a minute or
// two at UK latitudes), computed on the device so they work offline and with cached forecasts.

/** Forecast times from Open-Meteo are local to this zone (see api/openMeteo.ts). */
export const TIMEZONE = 'Europe/London';
export const DAYLIGHT_PAD_MIN = 30;

const rad = Math.PI / 180;

/**
 * Sunrise and sunset for a calendar date, in minutes after 00:00 UTC.
 * Polar cases: null if the sun never rises; ±Infinity if it never sets.
 */
export function sunTimesUtc(date: string, lat: number, lon: number): { sunrise: number; sunset: number } | null {
  const [y, m, d] = date.split('-').map(Number);
  const doy = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000;
  const g = ((2 * Math.PI) / (isLeap(y) ? 366 : 365)) * (doy - 1); // fractional year at noon
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // 90.833° zenith = upper limb on the horizon, allowing for refraction
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa > 1) return null;
  if (cosHa < -1) return { sunrise: -Infinity, sunset: Infinity };
  const ha = Math.acos(cosHa) / rad;
  return { sunrise: 720 - 4 * (lon + ha) - eqTime, sunset: 720 - 4 * (lon - ha) - eqTime };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** UTC offset of TIMEZONE (minutes) at a given instant - handles GMT/BST changes. */
export function zoneOffsetMinutes(utcMs: number, timeZone = TIMEZONE): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((local - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
}

/** Sunrise/sunset in local minutes after midnight for TIMEZONE. */
export function sunTimesLocal(date: string, lat: number, lon: number) {
  const t = sunTimesUtc(date, lat, lon);
  if (!t) return null;
  const [y, m, d] = date.split('-').map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12);
  const offset = zoneOffsetMinutes(noonUtc);
  return { sunrise: t.sunrise + offset, sunset: t.sunset + offset };
}

const cache = new Map<string, number[]>();

/**
 * Whole hours (local) to show for a date and site: every hour whose timestamp falls between
 * sunrise - 30 min and sunset + 30 min. E.g. sunrise 07:20, sunset 16:10 -> 07:00 to 16:00.
 */
export function daylightHours(date: string, lat: number, lon: number, pad = DAYLIGHT_PAD_MIN): number[] {
  const key = `${date}|${lat.toFixed(3)}|${lon.toFixed(3)}|${pad}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = sunTimesLocal(date, lat, lon);
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    const mins = h * 60;
    if (t && mins >= t.sunrise - pad && mins <= t.sunset + pad) hours.push(h);
  }
  cache.set(key, hours);
  return hours;
}

/** Nearest daylight hour to `hour` on that date (for keeping a selection valid when the day changes). */
export function clampToDaylight(hours: number[], hour: number): number {
  if (!hours.length || hours.includes(hour)) return hour;
  return hours.reduce((best, h) => (Math.abs(h - hour) < Math.abs(best - hour) ? h : best), hours[0]);
}
