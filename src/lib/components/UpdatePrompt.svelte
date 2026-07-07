<script lang="ts">
  import { updateState, applyUpdate, dismissUpdate } from '../pwa.svelte'
</script>

{#if updateState.available}
  <div class="update-tip" role="status">
    <span class="update-spark" aria-hidden="true">✨</span>
    <span class="update-text">A new version of Recipe Jar is ready.</span>
    <button class="update-go" onclick={applyUpdate}>Refresh</button>
    <button class="update-x" onclick={dismissUpdate} aria-label="Not now">✕</button>
  </div>
{/if}
