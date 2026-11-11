<script lang="ts">
  import type { ModelForecast, Settings, Site } from '../types';
  import { MODELS, chartLevels, findHour, forecastDates, stepHour } from '../logic/forecast';
  import { clampToDaylight, daylightHours } from '../logic/daylight';
  import { formatDate } from '../lib/format';
  import WindAltChart from './WindAltChart.svelte';

  interface Props {
    forecast: ModelForecast;
    site: Site;
    settings: Settings;
    date: string;
    hour: number;
    onChange: (date: string, hour: number) => void;
    onToggleHighAlt: (v: boolean) => void;
  }
  let { forecast, site, settings, date, hour, onChange, onToggleHighAlt }: Props = $props();

  const dates = $derived(forecastDates(forecast, site));
  const current = $derived(findHour(forecast, date, hour));
  const levels = $derived(chartLevels(current, settings.showHighAlt));
  const modelName = $derived(MODELS.find((m) => m.id === settings.model)!.name);
  const hours = $derived(daylightHours(date, site.lat, site.lon));

  // Keep the selected hour inside this day's daylight (e.g. 07:00 is dark in December)
  $effect(() => {
    const valid = clampToDaylight(hours, hour);
    if (valid !== hour) onChange(date, valid);
  });

  function step(delta: 1 | -1) {
    const next = stepHour(dates, date, hour, delta, site);
    if (next) onChange(next.date, next.hour);
  }

  // Horizontal swipe on the chart moves between hours
  let startX = 0;
  let startY = 0;
  function touchStart(e: TouchEvent) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }
  function touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }
</script>

<div class="detail">
<div class="days" role="tablist" aria-label="Day">
  {#each dates as d (d)}
    <button role="tab" aria-selected={d === date} class:active={d === date} onclick={() => onChange(d, hour)}>
      {formatDate(d, { weekday: 'short' })}<small>{formatDate(d, { day: 'numeric', month: 'short' })}</small>
    </button>
  {/each}
</div>

<div class="hours">
  <div class="stepper">
    <button class="nav" onclick={() => step(-1)} aria-label="Previous hour">‹</button>
    <select value={hour} onchange={(e) => onChange(date, Number(e.currentTarget.value))} aria-label="Hour">
      {#each hours as h (h)}<option value={h}>{String(h).padStart(2, '0')}:00</option>{/each}
    </select>
    <button class="nav" onclick={() => step(1)} aria-label="Next hour">›</button>
  </div>
  <label class="switch">
    High altitude
    <input type="checkbox" role="switch" checked={settings.showHighAlt} onchange={(e) => onToggleHighAlt(e.currentTarget.checked)} />
  </label>
</div>

<div class="chart" ontouchstart={touchStart} ontouchend={touchEnd}>
  <WindAltChart
    {levels}
    siteName={site.name}
    elevation={site.elevation}
    time={current?.time ?? `${date}T${String(hour).padStart(2, '0')}:00`}
    {modelName}
    speedUnits={settings.speedUnits}
    altitudeUnits={settings.altitudeUnits}
    colourRedKph={settings.colourRedKph}
  />
</div>
<p class="hint">Swipe the chart left or right to change hour.</p>
</div>

<style>
  .detail { display: flex; flex-direction: column; gap: 14px; }
  .days { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 4px; margin: -2px -2px 0; }
  .days button { flex: 1 0 auto; min-width: 52px; border: 1px solid var(--control-border); border-radius: 10px; padding: 6px 8px; background: var(--control-bg); box-shadow: var(--shadow-raised); font: inherit; color: var(--fg-strong); display: flex; flex-direction: column; align-items: center; line-height: 1.15; }
  .days button.active { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
  .days small { font-size: 0.75em; }
  .hours { display: flex; align-items: center; gap: 12px; }
  /* one joined control: ‹ 11:00 › */
  .stepper { display: inline-flex; border: 1px solid var(--control-border); border-radius: 10px; overflow: hidden; background: var(--control-bg); box-shadow: var(--shadow-raised); }
  .nav { width: 44px; height: 44px; border: 0; background: transparent; font-size: 26px; line-height: 1; color: var(--primary-text); }
  .nav:active { background: var(--primary-soft); }
  select { height: 44px; font: inherit; font-size: 16px; font-weight: 700; padding: 0 8px; border: 0; border-left: 1px solid var(--control-border); border-right: 1px solid var(--control-border); border-radius: 0; background: transparent; color: var(--fg-strong); }
  .switch { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 0.95em; color: var(--fg-strong); }
  .switch input { appearance: none; margin: 0; width: 44px; height: 26px; border-radius: 999px; background: var(--track); border: 1px solid var(--control-border); position: relative; cursor: pointer; transition: background 0.15s; }
  .switch input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--control-bg); box-shadow: var(--shadow-raised); transition: transform 0.15s; }
  .switch input:checked { background: var(--primary); border-color: var(--primary); }
  .switch input:checked::after { transform: translateX(18px); background: #fff; }
  .chart { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 2px; }
  .hint { font-size: 0.85em; color: var(--muted); text-align: center; margin: -6px 0 0; }
</style>
