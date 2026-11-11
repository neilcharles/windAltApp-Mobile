<script lang="ts">
  import type { Settings } from '../types';
  let { settings = $bindable() }: { settings: Settings } = $props();
</script>

<fieldset>
  <legend>Altitudes</legend>
  <label><input type="radio" bind:group={settings.altitudeUnits} value="feet" /> feet</label>
  <label><input type="radio" bind:group={settings.altitudeUnits} value="metres" /> metres</label>
</fieldset>
<fieldset>
  <legend>Speeds</legend>
  <label><input type="radio" bind:group={settings.speedUnits} value="kph" /> kph</label>
  <label><input type="radio" bind:group={settings.speedUnits} value="mph" /> mph</label>
</fieldset>
<fieldset>
  <legend>Red colour limit: {settings.colourRedKph} kph</legend>
  <input type="range" min="15" max="40" step="1" bind:value={settings.colourRedKph} />
  <p class="note">Wind at or above this speed shows red on the summary and chart.</p>
</fieldset>

<style>
  fieldset { border: 1px solid var(--border); border-radius: 10px; margin: 0 0 12px; padding: 10px 14px; }
  legend { font-weight: 700; padding: 0 4px; color: var(--fg-strong); }
  label { display: inline-flex; align-items: center; gap: 6px; margin-right: 20px; min-height: 40px; font-size: 16px; }
  input[type='range'] { width: 100%; accent-color: var(--primary); }
  input[type='radio'] { accent-color: var(--primary); width: 20px; height: 20px; }
  .note { margin: 4px 0 0; font-size: 0.9em; }
</style>
