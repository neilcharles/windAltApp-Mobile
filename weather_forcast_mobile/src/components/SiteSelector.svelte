<script lang="ts">
  import type { Site } from '../types';
  import { nearestSites } from '../logic/sites';

  interface Props {
    sites: Site[];
    selected: string;
    favourites: string[];
    onSelect: (name: string) => void;
    onToggleFavourite: (name: string) => void;
  }
  let { sites, selected, favourites, onSelect, onToggleFavourite }: Props = $props();

  let query = $state('');
  let open = $state(false);
  let nearby = $state<{ site: Site; km: number }[]>([]);
  let locating = $state(false);
  let locateError = $state('');

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sites.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
  });
  const favSites = $derived(favourites.map((f) => sites.find((s) => s.name === f)).filter((s): s is Site => !!s));

  function choose(name: string) {
    onSelect(name);
    query = '';
    open = false;
    nearby = [];
  }

  function locate() {
    locateError = '';
    if (!('geolocation' in navigator)) { locateError = 'Location is not available on this device.'; return; }
    locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { nearby = nearestSites(sites, pos.coords.latitude, pos.coords.longitude, 5); locating = false; open = true; },
      () => { locateError = 'Could not get your location.'; locating = false; },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  }
</script>

<div class="picker">
  <div class="row">
    <input
      type="search"
      placeholder={selected || 'Search flying sites…'}
      bind:value={query}
      onfocus={() => (open = true)}
      aria-label="Search flying sites"
    />
    <button class="icon-btn" onclick={locate} disabled={locating} aria-label="Find sites near me" title="Sites near me">
      {#if locating}…{:else}
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      {/if}
    </button>
    {#if selected}
      <button class="icon-btn star" class:on={favourites.includes(selected)} onclick={() => onToggleFavourite(selected)}
        aria-label={favourites.includes(selected) ? 'Remove from favourites' : 'Add to favourites'}>
        {favourites.includes(selected) ? '★' : '☆'}
      </button>
    {/if}
  </div>
  {#if locateError}<p class="error">{locateError}</p>{/if}

  {#if open && (matches.length || nearby.length)}
    <ul class="results">
      {#each nearby as n (n.site.name)}
        <li><button onclick={() => choose(n.site.name)}>{n.site.name} <span class="muted">{n.km.toFixed(0)} km</span></button></li>
      {/each}
      {#each matches as s (s.name)}
        <li><button onclick={() => choose(s.name)}>{s.name}</button></li>
      {/each}
    </ul>
  {/if}

  {#if favSites.length}
    <div class="chips" aria-label="Favourite sites">
      {#each favSites as s (s.name)}
        <button class="chip" class:active={s.name === selected} onclick={() => choose(s.name)}><span class="chip-star">★</span> {s.name}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .row { display: flex; gap: 8px; }
  input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 10px 12px; border: 1px solid var(--control-border); border-radius: 10px; background: var(--control-bg); color: var(--fg-strong); box-shadow: var(--shadow-raised); }
  input::placeholder { color: var(--fg); }
  .icon-btn { width: 44px; flex: none; border: 1px solid var(--control-border); border-radius: 10px; background: var(--control-bg); box-shadow: var(--shadow-raised); color: var(--primary-text); font-size: 22px; display: grid; place-items: center; }
  .star.on { color: var(--accent); }
  .chip-star { color: var(--accent); }
  .results { list-style: none; margin: 6px 0 0; padding: 0; border: 1px solid var(--border); border-radius: 10px; max-height: 50vh; overflow-y: auto; background: var(--surface); }
  .results button { width: 100%; text-align: left; padding: 12px; border: 0; border-bottom: 1px solid var(--border); background: none; font: inherit; color: var(--fg-strong); }
  .muted { color: var(--muted); font-size: 0.85em; margin-left: 6px; }
  .chips { display: flex; gap: 8px; overflow-x: auto; padding: 10px 2px 3px; }
  .chip { flex: none; border: 1px solid var(--control-border); border-radius: 999px; padding: 6px 12px; background: var(--control-bg); box-shadow: var(--shadow-raised); font: inherit; color: var(--fg-strong); }
  .chip.active { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
  .error { color: var(--danger); margin: 6px 0 0; }
</style>
