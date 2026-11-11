import type { Site } from '../types';
import { parseCsv } from './csv';

/** Parse uk_pg_sites/sites.csv, dropping excluded sites (same as the Shiny app). */
export function parseSites(csv: string): Site[] {
  const seen = new Set<string>();
  return parseCsv(csv)
    .filter((r) => !r.exclude)
    .map((r) => ({
      name: r.takeoff_name.trim(),
      lat: Number(r.takeoff_lat),
      lon: Number(r.takeoff_lon),
      elevation: Number(r.elevation),
    }))
    .filter((s) => {
      if (!s.name || !Number.isFinite(s.lat) || !Number.isFinite(s.lon) || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestSites(sites: Site[], lat: number, lon: number, n = 5) {
  return sites
    .map((site) => ({ site, km: distanceKm(lat, lon, site.lat, site.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
