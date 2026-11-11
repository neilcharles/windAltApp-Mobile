// On-device forecast cache (IndexedDB). Fresh for 1 hour, like the Shiny RDS cache;
// stale entries are still used when the phone is offline.
import { get, set, keys, del } from 'idb-keyval';
import type { Forecast } from '../types';

export const MAX_AGE_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 15;
const key = (site: string) => `forecast:${site}`;

export async function getCached(site: string): Promise<Forecast | undefined> {
  try { return await get<Forecast>(key(site)); } catch { return undefined; }
}

export async function putCached(site: string, forecast: Forecast) {
  try {
    await set(key(site), forecast);
    const all = (await keys()).filter((k) => String(k).startsWith('forecast:'));
    if (all.length > MAX_ENTRIES) {
      const entries = await Promise.all(all.map(async (k) => [k, (await get<Forecast>(k))?.fetchedAt ?? 0] as const));
      entries.sort((a, b) => a[1] - b[1]);
      await Promise.all(entries.slice(0, all.length - MAX_ENTRIES).map(([k]) => del(k)));
    }
  } catch { /* storage unavailable - just don't cache */ }
}

export const isFresh = (f: Forecast, now = Date.now()) => now - f.fetchedAt < MAX_AGE_MS;
