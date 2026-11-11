<script lang="ts">
  // Port of R/draw_summary_table.R as a tappable list grouped by day.
  import type { GroundHour, SpeedUnits } from '../types';
  import { speed } from '../logic/units';
  import { windColour } from '../logic/windColour';
  import { weatherIcon } from '../logic/wmoCodes';
  import { formatDate } from '../lib/format';

  interface Props {
    rows: GroundHour[];
    speedUnits: SpeedUnits;
    colourRedKph: number;
    onPick: (date: string, hour: number) => void;
  }
  let { rows, speedUnits, colourRedKph, onPick }: Props = $props();

  const days = $derived.by(() => {
    const out = new Map<string, GroundHour[]>();
    for (const r of rows) out.set(r.date, [...(out.get(r.date) ?? []), r]);
    return [...out];
  });
  const red = $derived(speed(colourRedKph, speedUnits));
</script>

<p class="hint">Tap an hour to see wind at altitude</p>
{#each days as [date, hours] (date)}
  <section>
    <h3>{formatDate(date)}</h3>
    {#each hours as h (h.time)}
      {@const s = speed(h.windspeed, speedUnits)}
      {@const g = speed(h.gusts, speedUnits)}
      {@const icon = weatherIcon(h.weatherCode)}
      <button class="row" onclick={() => onPick(h.date, h.hour)}>
        <span class="time">{String(h.hour).padStart(2, '0')}:00</span>
        <span class="gust" style:background={g !== null ? windColour(Math.round(g), red) : 'transparent'}></span>
        <span class="wind">
          <svg class="dir" viewBox="-10 -16 20 32" style:transform="rotate({h.winddirection ?? 0}deg)" role="img" aria-label="wind from {h.winddirection}°">
            <path d="M0 15 L-8 2 L-3 2 L-3 -15 L3 -15 L3 2 L8 2 Z" />
          </svg>
          <span>
            <strong>{Math.round(s ?? 0)}{speedUnits}</strong>
            {#if g !== null}<small>max {Math.round(g)}{speedUnits}</small>{/if}
          </span>
        </span>
        <span class="wx">{#if icon}<img src={icon.src} alt={icon.description} title={icon.description} />{/if}</span>
        <span class="temp">{h.temperature !== null ? `${Math.round(h.temperature)}°c` : ''}</span>
      </button>
    {/each}
  </section>
{/each}

<style>
  .hint { font-weight: 700; margin: 4px 0 8px; }
  section { margin-bottom: 12px; }
  h3 { position: sticky; top: 0; z-index: 1; margin: 0; padding: 8px 4px; font-size: 15px; background: var(--bg); color: var(--fg-strong); border-bottom: 1px solid var(--border); }
  .row { width: 100%; display: grid; grid-template-columns: 54px 14px 1fr 54px 48px; align-items: center; gap: 8px; padding: 2px 4px; border: 0; border-bottom: 1px solid var(--border); background: none; font: inherit; font-size: 16px; color: var(--fg-strong); text-align: left; min-height: 56px; }
  .row:active { background: var(--primary-soft); }
  .gust { height: 44px; border-radius: 3px; }
  .wind { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .wind span:last-child { display: flex; flex-direction: column; line-height: 1.1; min-width: 64px; }
  .dir { width: 22px; height: 32px; flex: none; fill: var(--fg); }
  small { font-size: 0.75em; color: var(--fg); }
  img { height: 46px; width: 46px; display: block; }
  .temp { text-align: right; }
</style>
