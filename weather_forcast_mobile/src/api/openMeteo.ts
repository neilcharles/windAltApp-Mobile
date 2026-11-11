import { MODELS, hourlyVariables, parseForecast, type OpenMeteoResponse } from '../logic/forecast';
import type { Forecast, Site } from '../types';

/** One request for all three models (the Shiny app made seven per site). */
export function forecastUrl(site: Pick<Site, 'lat' | 'lon'>): string {
  const params = new URLSearchParams({
    latitude: String(site.lat),
    longitude: String(site.lon),
    hourly: hourlyVariables().join(','),
    models: MODELS.map((m) => m.api).join(','),
    timezone: 'Europe/London',
    elevation: 'nan',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export type FetchErrorKind = 'offline' | 'timeout' | 'busy' | 'server';

export class ForecastFetchError extends Error {
  constructor(public kind: FetchErrorKind, message: string) {
    super(message);
  }
}

export const TIMEOUT_MS = 20_000;

/**
 * Fetch and parse a forecast. Gives up after `timeoutMs` so a stalled connection can't spin
 * forever. Failures are thrown as ForecastFetchError with a kind the UI can explain; if the
 * caller's `signal` aborts, the abort error is rethrown unchanged.
 */
export async function fetchForecast(
  site: Site,
  { signal, timeoutMs = TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Forecast> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onCancel = () => ctrl.abort();
  signal?.addEventListener('abort', onCancel);

  try {
    const res = await fetch(forecastUrl(site), { signal: ctrl.signal });
    if (!res.ok) {
      let reason = res.statusText;
      try { reason = (await res.json()).reason ?? reason; } catch { /* not JSON */ }
      throw new ForecastFetchError(
        res.status === 429 ? 'busy' : 'server',
        res.status === 429 ? `Open-Meteo is busy (${reason})` : `Open-Meteo error ${res.status}: ${reason}`,
      );
    }
    return parseForecast((await res.json()) as OpenMeteoResponse);
  } catch (e) {
    if (e instanceof ForecastFetchError || signal?.aborted) throw e;
    if (ctrl.signal.aborted) throw new ForecastFetchError('timeout', "Open-Meteo didn't respond in time");
    throw new ForecastFetchError('offline', 'No connection');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
  }
}

/** Minutes to wait before automatic retry number n (1-based) after a failure. */
export function retryDelayMinutes(failures: number): number {
  const steps = [2, 5, 15, 30];
  return steps[Math.min(Math.max(failures, 1), steps.length) - 1];
}
