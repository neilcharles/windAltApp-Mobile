<script lang="ts">
  import type { ModelId } from '../types';
  import { MODELS } from '../logic/forecast';

  let { value, onChange }: { value: ModelId; onChange: (m: ModelId) => void } = $props();
</script>

<div class="toggle" role="radiogroup" aria-label="Forecast model">
  {#each MODELS as m (m.id)}
    <button role="radio" aria-checked={value === m.id} class:active={value === m.id} onclick={() => onChange(m.id)}>
      <strong>{m.name}</strong>
      <small>{m.blurb}</small>
    </button>
  {/each}
</div>

<style>
  /* segmented control: recessed track, selected model raised out of it */
  .toggle { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: var(--track); border-radius: 12px; }
  button { border: 0; border-radius: 9px; padding: 8px 4px; background: transparent; color: var(--fg); font: inherit; display: flex; flex-direction: column; gap: 2px; }
  button.active { background: var(--control-bg); color: var(--fg-strong); box-shadow: var(--shadow-raised); }
  button.active strong { color: var(--primary-text); }
  small { font-size: 0.72em; line-height: 1.2; }
</style>
