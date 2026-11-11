import { parseSites } from '../logic/sites';
import type { Site } from '../types';

const REMOTE = 'https://raw.githubusercontent.com/neilcharles/uk_pg_sites/main/sites.csv';
const BUNDLED = './sites.csv';
const STORAGE_KEY = 'flyable.sitesCsv';

function stored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/**
 * Return sites immediately from the last download (or the copy bundled in the app),
 * and refresh from GitHub in the background via onUpdate.
 */
export async function loadSites(onUpdate: (sites: Site[]) => void): Promise<Site[]> {
  const csv: string = stored() ?? (await fetch(BUNDLED).then((r) => r.text()));

  fetch(REMOTE, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((fresh) => {
      if (fresh === csv || parseSites(fresh).length === 0) return;
      try { localStorage.setItem(STORAGE_KEY, fresh); } catch { /* ignore */ }
      onUpdate(parseSites(fresh));
    })
    .catch(() => { /* offline - keep what we have */ });

  return parseSites(csv);
}
