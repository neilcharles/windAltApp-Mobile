<script lang="ts">
  // SVG port of R/draw_wind_alt.R: wind profile (left, 3/4 width) and cloud/temperature
  // column (right, 1/4 width) sharing one altitude axis.
  import type { AltitudeUnits, Level, SpeedUnits } from '../types';
  import { interpolateProfile } from '../logic/forecast';
  import { altitude, speed } from '../logic/units';
  import { temperatureColour, windColour } from '../logic/windColour';
  import { spreadLabels } from '../logic/labelLayout';

  interface Props {
    levels: Level[];
    siteName: string;
    /** takeoff elevation in metres */
    elevation: number;
    time: string;
    modelName: string;
    speedUnits: SpeedUnits;
    altitudeUnits: AltitudeUnits;
    colourRedKph: number;
  }
  let { levels, siteName, elevation, time, modelName, speedUnits, altitudeUnits, colourRedKph }: Props = $props();

  const W = 400;
  const H = 540;
  const TOP = 56;
  const BOTTOM = 58;
  const WIND_LEFT = 8;
  const WIND_RIGHT = 296;
  const CLOUD_X = 352;
  /** guidelines stop here; a short leader joins each line to its (possibly shifted) cloud */
  const GUIDE_END = CLOUD_X - 34;
  /** vertical space one cloud + % + temperature group needs */
  const CLOUD_GAP = 46;
  const ALT_LABEL_GAP = 16;

  // Convert everything into display units first, like weather_selected_units() does.
  const pts = $derived(
    levels.map((l) => ({
      ...l,
      h: altitude(l.height, altitudeUnits) as number,
      s: speed(l.windspeed, speedUnits) as number,
    })),
  );
  const takeoff = $derived(altitude(elevation, altitudeUnits));
  const red = $derived(speed(colourRedKph, speedUnits));

  const maxH = $derived(Math.max(...pts.map((p) => p.h), takeoff) * 1.1);
  const maxS = $derived(Math.max(10, ...pts.map((p) => p.s)));
  const xMin = -5;
  const xMax = $derived(maxS * 1.2 + 4);

  const y = (h: number) => H - BOTTOM - (h / maxH) * (H - TOP - BOTTOM);
  const x = (s: number) => WIND_LEFT + ((s - xMin) / (xMax - xMin)) * (WIND_RIGHT - WIND_LEFT);

  const profile = $derived(
    interpolateProfile(pts.map((p) => ({ ...p, height: p.h, windspeed: p.s }))),
  );
  // ggplot scale_linewidth(range = c(1, 15), limits = c(0, 150)) in kph-equivalent
  const lineWidth = (s: number) => 2 + (Math.min(speed(150, speedUnits), s) / speed(150, speedUnits)) * 26;

  const segments = $derived(
    profile.slice(1).map((b, i) => {
      const a = profile[i];
      const mid = (a.speed + b.speed) / 2;
      return { x1: x(a.speed), y1: y(a.height), x2: x(b.speed), y2: y(b.height), colour: windColour(mid, red), width: lineWidth(mid) };
    }),
  );

  const ticks = $derived.by(() => {
    const step = maxS > 60 ? 20 : maxS > 25 ? 10 : 5;
    const out: number[] = [];
    for (let t = 0; t <= xMax; t += step) out.push(t);
    return out;
  });

  const roundTo10 = (h: number) => Math.round(h / 10) * 10;

  // When levels are close together (e.g. high altitude on), push labels apart so they don't overlap.
  const lineY = $derived(pts.map((p) => y(roundTo10(p.h))));
  const altLabelY = $derived(spreadLabels(lineY.map((v) => v - 4), ALT_LABEL_GAP, TOP + 14, H - BOTTOM - 2));
  const cloudY = $derived(spreadLabels(pts.map((p) => y(p.h)), CLOUD_GAP, TOP + 22, H - BOTTOM + 6));
  const subtitle = $derived(time.replace('T', ' '));
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label="Wind at altitude for {siteName} at {subtitle}">
  <rect width={W} height={H} fill="var(--chart-bg)" />

  <text x={WIND_LEFT} y="22" class="title">{siteName}</text>
  <text x={WIND_LEFT} y="42" class="subtitle">{subtitle}</text>

  {#if pts.length === 0}
    <text x={W / 2} y={H / 2} text-anchor="middle" class="subtitle">No altitude data for this hour</text>
  {:else}
    <!-- Level guidelines with altitude labels -->
    {#each pts as p, i (p.pressure)}
      <line x1={WIND_LEFT} x2={GUIDE_END} y1={lineY[i]} y2={lineY[i]} class="guide" />
      <path d="M {GUIDE_END} {lineY[i]} L {GUIDE_END + 8} {cloudY[i]} L {CLOUD_X - 20} {cloudY[i]}" class="guide leader" />
      <text x={x(-3)} y={altLabelY[i]} class="alt-label">{roundTo10(p.h)}</text>
    {/each}

    <!-- Takeoff -->
    <line x1={WIND_LEFT} x2={GUIDE_END} y1={y(takeoff)} y2={y(takeoff)} class="takeoff" />
    <text x={WIND_RIGHT} y={y(takeoff) + 15} text-anchor="end" class="takeoff-label">{siteName} Takeoff</text>

    <!-- Wind profile -->
    {#each segments as seg, i (i)}
      <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={seg.colour} stroke-width={seg.width} stroke-linecap="round" />
    {/each}

    <!-- Direction arrows (point downwind) and speed labels -->
    {#each pts as p (p.pressure)}
      <g transform="translate({x(p.s) + 20} {y(p.h)}) rotate({p.winddirection ?? 0})" class="arrow">
        <path d="M0 15 L-8 2 L-3 2 L-3 -15 L3 -15 L3 2 L8 2 Z" />
      </g>
      <!-- Low speeds sit near the altitude labels, so put the number right of the arrow instead -->
      {@const cramped = x(p.s) - 10 < x(-3) + 52}
      <text x={cramped ? x(p.s) + 42 : x(p.s) - 10} y={y(p.h) - 3} text-anchor={cramped ? 'start' : 'end'} class="speed-label">{Math.round(p.s)}</text>
    {/each}

    <!-- Cloud & temperature column -->
    {#each pts as p, i (p.pressure)}
      {@const cover = p.cloudCover ?? 0}
      <g transform="translate({CLOUD_X} {cloudY[i]})">
        <g opacity={Math.max(cover / 100, 0.08)} class="cloud">
          <circle cx="-9" cy="-4" r="9" />
          <circle cx="4" cy="-9" r="12" />
          <circle cx="15" cy="-2" r="8" />
          <rect x="-18" y="-4" width="40" height="11" rx="5.5" />
        </g>
        <text x="2" y="1" text-anchor="middle" class="cloud-label" class:dark={cover < 50}>{p.cloudCover ?? '–'}%</text>
        {#if p.temperature !== null}
          <text x="2" y="21" text-anchor="middle" class="temp-label" style:--t-light={temperatureColour(p.temperature)} style:--t-dark={temperatureColour(p.temperature, 'dark')}>{Math.round(p.temperature)}°c</text>
        {/if}
      </g>
    {/each}

    <!-- X axis -->
    {#each ticks as t (t)}
      <text x={x(t)} y={H - BOTTOM + 18} text-anchor="middle" class="tick">{t}</text>
    {/each}
    <text x={(WIND_LEFT + WIND_RIGHT) / 2} y={H - BOTTOM + 38} text-anchor="middle" class="axis-title">windspeed ({speedUnits})</text>
    <text x={W - 6} y={H - 8} text-anchor="end" class="caption">altitude amsl ({altitudeUnits}) · {modelName} via Open-Meteo</text>
  {/if}
</svg>

<style>
  svg { width: 100%; height: auto; display: block; font-family: inherit; touch-action: pan-y; }
  .title { font-size: 18px; font-weight: 700; fill: var(--fg-strong); }
  .subtitle { font-size: 13px; fill: var(--fg); }
  .guide { stroke: var(--grid); stroke-dasharray: 4 3; stroke-width: 0.8; }
  .leader { fill: none; stroke-dasharray: none; }
  .alt-label { font-size: 15px; fill: var(--muted); }
  .takeoff { stroke: var(--fg-strong); stroke-dasharray: 7 5; stroke-width: 2; }
  .takeoff-label { font-size: 12px; fill: var(--fg-strong); }
  .arrow path { fill: #696969; opacity: 0.65; }
  .speed-label { font-size: 16px; font-weight: 700; fill: var(--fg-strong); }
  .cloud { fill: #6b6b6b; }
  .cloud-label { font-size: 11px; font-weight: 700; fill: #fff; }
  .cloud-label.dark { fill: var(--fg-strong); }
  .temp-label { font-size: 12px; font-weight: 700; paint-order: stroke; stroke: var(--chart-bg); stroke-width: 3px; fill: var(--t-light); }
  @media (prefers-color-scheme: dark) { .temp-label { fill: var(--t-dark); } }
  .tick { font-size: 12px; fill: var(--fg); }
  .axis-title { font-size: 12px; fill: var(--fg); }
  .caption { font-size: 10px; fill: var(--muted); }
</style>
