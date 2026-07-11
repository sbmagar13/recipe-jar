<script lang="ts">
  import { APP_VERSION } from '../site'
  import { pickHighlights } from '../whatsnew'
  import { jarCount } from '../db'

  // Remembers the last version whose notes the reader has seen, so the card shows
  // once per release and never again.
  const KEY = 'rj:lastSeenVersion'

  let highlights = $state<string[] | null>(null)

  function readSeen(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(KEY, APP_VERSION)
    } catch {
      /* private mode / storage disabled: just don't nag */
    }
  }

  // Decide once, at startup. Cheap outs first so we only read the jar (async)
  // when the decision can actually depend on it: hasData only changes the
  // outcome for a marker-less first-time visitor (seen === null).
  async function decide() {
    const seen = readSeen()
    if (seen === APP_VERSION) return
    const hasData = seen === null ? (await jarCount().catch(() => 0)) > 0 : true
    const picked = pickHighlights(APP_VERSION, seen, hasData)
    if (picked) highlights = picked
    else markSeen() // nothing to show for this version: remember it so we do not re-check
  }
  decide()

  function dismiss() {
    markSeen()
    highlights = null
  }
</script>

{#if highlights}
  <div class="whatsnew" role="status">
    <div class="wn-top">
      <span class="wn-spark" aria-hidden="true">🫙</span>
      <strong class="wn-title">What's new in v{APP_VERSION}</strong>
      <button class="wn-x" onclick={dismiss} aria-label="Dismiss what's new">✕</button>
    </div>
    <ul class="wn-list">
      {#each highlights as h}
        <li>{h}</li>
      {/each}
    </ul>
  </div>
{/if}
