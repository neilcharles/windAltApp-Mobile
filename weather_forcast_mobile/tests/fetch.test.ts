import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/openmeteo.json';
import { ForecastFetchError, fetchForecast, retryDelayMinutes } from '../src/api/openMeteo';

const site = { name: 'Test', lat: 54, lon: -3, elevation: 300 };
afterEach(() => vi.unstubAllGlobals());

/** fetch that never resolves, but rejects like the real one when aborted */
const hangingFetch = (_url: string, init: RequestInit) =>
  new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

describe('fetchForecast', () => {
  it('parses a good response', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(fixture)));
    const f = await fetchForecast(site);
    expect(f.models.DWD_ICON.ground).toHaveLength(168);
  });

  it('reports 429 as busy with the server reason', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: true, reason: 'Too many concurrent requests' }), { status: 429 }));
    const e = await fetchForecast(site).catch((x) => x);
    expect(e).toBeInstanceOf(ForecastFetchError);
    expect(e.kind).toBe('busy');
    expect(e.message).toContain('Too many concurrent requests');
  });

  it('gives up on a stalled request', async () => {
    vi.stubGlobal('fetch', hangingFetch);
    const e = await fetchForecast(site, { timeoutMs: 20 }).catch((x) => x);
    expect(e.kind).toBe('timeout');
  });

  it('reports network failure as offline', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    const e = await fetchForecast(site).catch((x) => x);
    expect(e.kind).toBe('offline');
  });

  it('passes a caller cancel through untouched', async () => {
    vi.stubGlobal('fetch', hangingFetch);
    const ctrl = new AbortController();
    const p = fetchForecast(site, { signal: ctrl.signal }).catch((x) => x);
    ctrl.abort();
    const e = await p;
    expect(e).not.toBeInstanceOf(ForecastFetchError);
    expect(e.name).toBe('AbortError');
  });
});

describe('retryDelayMinutes', () => {
  it('backs off and caps at 30', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMinutes)).toEqual([2, 5, 15, 30, 30]);
  });
});
