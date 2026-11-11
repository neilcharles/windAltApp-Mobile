<script lang="ts">
  import { untrack } from 'svelte';
  import { Capacitor } from '@capacitor/core';
  import { App as CapApp } from '@capacitor/app';
  import type { Forecast, ModelId, Settings, Site } from './types';
  import { loadSites } from './api/sites';
  import { ForecastFetchError, fetchForecast, retryDelayMinutes } from './api/openMeteo';
  import { getCached, isFresh, putCached } from './lib/cache';
  import { loadSettings, saveSettings, settingsFromQuery, settingsToQuery } from './lib/settings';
  import { ageText } from './lib/format';
  import { forecastDates, summaryRows } from './logic/forecast';
  import { altitude } from './logic/units';
  import SiteSelector from './components/SiteSelector.svelte';
  import ModelToggle from './components/ModelToggle.svelte';
  import SummaryList from './components/SummaryList.svelte';
  import HourlyDetail from './components/HourlyDetail.svelte';
  import SiteMap from './components/SiteMap.svelte';
  import SettingsPanel from './components/Settings.svelte';

  const isNative = Capacitor.isNativePlatform();

  let settings = $state<Settings>(isNative ? loadSettings() : settingsFromQuery(location.search, loadSettings()));
  let sites = $state<Site[]>([]);
  let forecast = $state<Forecast | null>(null);
  let loading = $state(false);
  let error = $state('');
  let tab = $state<'summary' | 'detail' | 'settings'>('summary');
  let detailDate = $state('');
  let detailHour = $state(12);
  let now = $state(Date.now());

  const site = $derived(sites.find((s) => s.name === settings.site));
  const model = $derived(forecast?.models[settings.model]);
  const rows = $derived(model && site ? summaryRows(model, site) : []);

  loadSites((fresh) => (sites = fresh)).then((s) => (sites = s));

  // Persist settings (and mirror to the URL on the web, Shiny-bookmark style)
  $effect(() => {
    const snapshot = $state.snapshot(settings) as Settings;
    saveSettings(snapshot);
    if (!isNative) history.replaceState(null, '', snapshot.site ? settingsToQuery(snapshot) : location.pathname);
  });

  // Load the forecast: cache first, network if stale. Only one request is ever in flight -
  // starting a new one cancels the previous. After a failure, automatic retries back off
  // (2, 5, 15, 30 min) so a busy or unreachable server isn't hammered; Refresh always tries now.
  let controller: AbortController | null = null;
  let failures = 0;
  let retryAt = 0;

  function describeError(e: unknown, cached: Forecast | undefined, retryMins: number) {
    const reason = e instanceof ForecastFetchError ? e.message : 'Something went wrong';
    return cached
      ? `${reason}. Showing the forecast from ${ageText(cached.fetchedAt)} - will retry in ${retryMins} min.`
      : `Couldn't load the forecast: ${reason}. Will retry in ${retryMins} min.`;
  }

  async function load(s: Site, force = false) {
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    error = '';
    const cached = await getCached(s.name);
    if (ctrl.signal.aborted) return;
    // Never leave the previous site's forecast on screen while a new site loads
    if (cached) forecast = cached;
    else if (!force) forecast = null;
    if (cached && isFresh(cached) && !force) { loading = false; return; }
    loading = true;
    try {
      const fresh = await fetchForecast(s, { signal: ctrl.signal });
      forecast = fresh;
      failures = 0;
      retryAt = 0;
      await putCached(s.name, $state.snapshot(fresh) as Forecast);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      failures++;
      const mins = retryDelayMinutes(failures);
      retryAt = Date.now() + mins * 60_000;
      error = describeError(e, cached, mins);
    } finally {
      if (controller === ctrl) loading = false;
    }
  }

  // Key on the site's identity so a background refresh of the sites list doesn't refetch.
  const siteKey = $derived(site ? `${site.name}|${site.lat}|${site.lon}` : '');
  $effect(() => {
    if (!siteKey) { controller?.abort(); forecast = null; loading = false; return; }
    failures = 0;
    retryAt = 0;
    untrack(() => site && load(site));
  });

  // Refetch when the forecast is over an hour old (or a backed-off retry is due): checked every
  // minute while the app is open, and immediately when it comes back to the foreground. Android's
  // WebView doesn't fire visibilitychange reliably, so on the phone we also use Capacitor's resume.
  $effect(() => {
    const refreshIfStale = () => {
      now = Date.now();
      if (document.visibilityState === 'hidden' || loading || !site) return;
      if (Date.now() < retryAt) return;
      if (!forecast || !isFresh(forecast) || failures > 0) load(site);
    };
    document.addEventListener('visibilitychange', refreshIfStale);
    const timer = setInterval(refreshIfStale, 60_000);
    const resume = isNative ? CapApp.addListener('resume', refreshIfStale) : null;
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale);
      clearInterval(timer);
      resume?.then((h) => h.remove());
    };
  });

  // Keep the detail date valid for the loaded forecast
  $effect(() => {
    if (!model) return;
    if (!site) return;
    const dates = forecastDates(model, site);
    if (!dates.includes(detailDate)) detailDate = dates[0] ?? '';
  });

  function selectSite(name: string) {
    settings.site = name;
    tab = 'summary';
  }
  function toggleFavourite(name: string) {
    settings.favourites = settings.favourites.includes(name)
      ? settings.favourites.filter((f) => f !== name)
      : [...settings.favourites, name];
  }
  function pickHour(date: string, hour: number) {
    detailDate = date;
    detailHour = hour;
    tab = 'detail';
    window.scrollTo({ top: 0 });
  }
</script>

<main>
  <!-- Logo scrolls with the page. The dark variant swaps the navy cloud for a light blue. -->
  <picture class="logo">
    <source srcset="./flyable-logo-dark.png" media="(prefers-color-scheme: dark)" />
    <img src="./flyable-logo.png" alt="flyable.uk" width="813" height="207" />
  </picture>
  <div class="group">
    <SiteSelector {sites} selected={settings.site} favourites={settings.favourites} onSelect={selectSite} onToggleFavourite={toggleFavourite} />
    {#if site}
      <details class="site-details">
        <summary>{site.name} · {Math.round(altitude(site.elevation, settings.altitudeUnits))} {settings.altitudeUnits}</summary>
        <p class="coords">{site.lat}, {site.lon}</p>
        <SiteMap lat={site.lat} lon={site.lon} />
      </details>
    {/if}
  </div>

  {#if site}
  <div class="group">
    <ModelToggle value={settings.model} onChange={(m: ModelId) => (settings.model = m)} />

    <nav class="tabs" aria-label="Views">
      {#each [['summary', 'Summary'], ['detail', 'Hourly Detail'], ['settings', 'Settings']] as [id, label] (id)}
        <button class:active={tab === id} aria-current={tab === id ? 'page' : undefined} onclick={() => (tab = id as typeof tab)}>{label}</button>
      {/each}
    </nav>

    <div class="status" aria-live="polite">
      {#if loading}<span class="spinner" aria-hidden="true"></span> Updating forecast…
      {:else if forecast}Forecast updated {ageText(forecast.fetchedAt, now)}
        <button class="link" onclick={() => site && load(site, true)}>Refresh</button>{/if}
    </div>
    {#if error}<p class="error">{error} {#if !loading}<button class="link" onclick={() => site && load(site, true)}>Try now</button>{/if}</p>{/if}

    {#if tab === 'settings'}
      <SettingsPanel bind:settings />
    {:else if model}
      {#if tab === 'summary'}
        <SummaryList {rows} speedUnits={settings.speedUnits} colourRedKph={settings.colourRedKph} onPick={pickHour} />
      {:else}
        <HourlyDetail forecast={model} {site} {settings} date={detailDate} hour={detailHour}
          onChange={(d, h) => { detailDate = d; detailHour = h; }}
          onToggleHighAlt={(v) => (settings.showHighAlt = v)} />
      {/if}
    {/if}
  </div>
  {:else}
  <div class="group">
    <section class="welcome">
      <h2>Wind at altitude for UK paragliding sites</h2>
      <ul>
        <li>Search for a site, or tap the location button to find sites near you</li>
        <li>Compare DWD ICON, Met Office and NOAA GFS</li>
        <li>Week-ahead ground level summary - tap an hour for the altitude chart</li>
        <li>Star sites to keep them as favourites</li>
        <li>Forecasts are kept on your phone for when you have no signal</li>
      </ul>
    </section>
    <nav class="tabs" aria-label="Views">
      <button class:active={tab === 'settings'} onclick={() => (tab = tab === 'settings' ? 'summary' : 'settings')}>Settings</button>
    </nav>
    {#if tab === 'settings'}<SettingsPanel bind:settings />{/if}
  </div>
  {/if}

  <p class="disclaimer">
    Weather data is provided for informational purposes only and no guarantees are made regarding accuracy,
    timeliness, or fitness for flight. Use this app at your own risk in combination with other sources and always
    perform your own on-site assessment before launching.
  </p>
</main>

<style>
  main { max-width: 750px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 24px); display: flex; flex-direction: column; gap: 28px; }
  /* related controls sit close together; groups are separated by main's larger gap */
  .group { display: flex; flex-direction: column; gap: 12px; }
  .logo { display: flex; justify-content: center; padding-bottom: 4px; }
  .logo img { height: 44px; width: auto; max-width: 100%; }
  .site-details { border: 1px solid var(--control-border); box-shadow: var(--shadow-raised); border-radius: 10px; padding: 10px 12px; background: var(--surface); }
  .site-details summary { font-weight: 700; color: var(--fg-strong); cursor: pointer; }
  .coords { margin: 6px 0; font-size: 0.9em; }
  /* view tabs are navigation, not buttons: underline style with an orange indicator */
  .tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tabs button { flex: 1 0 auto; border: 0; border-bottom: 3px solid transparent; margin-bottom: -1px; padding: 10px 12px 9px; background: transparent; font: inherit; color: var(--muted); font-weight: 700; }
  .tabs button.active { color: var(--fg-strong); border-bottom-color: var(--accent); }
  .status { font-size: 0.85em; color: var(--muted); display: flex; align-items: center; gap: 6px; min-height: 20px; }
  .link { border: 0; background: none; color: var(--primary-text); font: inherit; text-decoration: underline; padding: 0 4px; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error { color: var(--danger); margin: 0; }
  .welcome h2 { font-size: 1.2rem; color: var(--fg-strong); margin: 8px 0; }
  .welcome ul { padding-left: 20px; margin: 0; line-height: 1.6; }
  .disclaimer { font-size: 0.8em; color: var(--muted); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; }
</style>
