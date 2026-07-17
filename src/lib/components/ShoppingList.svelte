<script lang="ts">
  import { buildListText, buildShoppingText } from '../shoplist'

  interface Props {
    /** Recipe title (or "3 recipes" for a merged list), for the list header. */
    title: string
    /** Servings the lines below are scaled to. Unused when `subtitle` is given. */
    servings?: number
    /** Already-scaled ingredient lines, one per item. */
    items: string[]
    /** localStorage key to remember ticks across visits, or null to keep them in memory. */
    storageKey: string | null
    /** Replaces the "{title} · for N servings" line (merged lists set this). */
    subtitle?: string | null
    /** Replaces the copied/shared text's first line (merged lists set this). */
    shareHeader?: string | null
    /** Label of the bottom back button. */
    backLabel?: string
    onclose: () => void
  }

  let {
    title,
    servings = 0,
    items,
    storageKey,
    subtitle = null,
    shareHeader = null,
    backLabel = '← Back to recipe',
    onclose,
  }: Props = $props()

  function listText(remaining: string[]): string {
    return shareHeader ? buildListText(shareHeader, remaining) : buildShoppingText(title, servings, remaining)
  }

  function loadHave(): Set<number> {
    if (!storageKey) return new Set()
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
    } catch {
      return new Set()
    }
  }

  // Ticked = "already have it", so it drops out of what you copy or share.
  let have = $state<Set<number>>(loadHave())

  function persist() {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify([...have]))
    } catch {
      /* storage full or locked: ticks just won't survive a reload */
    }
  }

  function toggle(i: number) {
    const next = new Set(have)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    have = next
    persist()
  }

  function resetTicks() {
    have = new Set()
    persist()
  }

  // What's left to buy, in the original order.
  const remaining = $derived(items.filter((_, i) => !have.has(i)))

  let msg = $state('')
  let msgTimer: ReturnType<typeof setTimeout> | undefined
  function flash(text: string) {
    msg = text
    clearTimeout(msgTimer)
    msgTimer = setTimeout(() => (msg = ''), 3500)
  }

  async function copyList() {
    if (remaining.length === 0) {
      flash('Nothing left to buy. Everything is ticked off.')
      return
    }
    const text = listText(remaining)
    try {
      await navigator.clipboard.writeText(text)
      flash(`Copied ${remaining.length} ${remaining.length === 1 ? 'item' : 'items'}.`)
    } catch {
      flash('Could not copy. Long-press to select the list instead.')
    }
  }

  async function shareList() {
    if (remaining.length === 0) {
      flash('Nothing left to buy. Everything is ticked off.')
      return
    }
    const text = listText(remaining)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Shopping list for ${title}`, text })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    copyList()
  }
</script>

<section class="shop" aria-label="Shopping list">
  <div class="shop-top">
    <h2 class="shop-title">Shopping list</h2>
    <button class="cook-exit" onclick={onclose} aria-label="Close shopping list">✕</button>
  </div>
  <p class="shop-sub">
    {#if subtitle}{subtitle}{:else}{title} · for {servings} {servings === 1 ? 'serving' : 'servings'}{/if}
  </p>

  {#if items.length > 0}
    <ul class="shop-list">
      {#each items as item, i}
        <li class:got={have.has(i)}>
          <label>
            <input type="checkbox" checked={have.has(i)} onchange={() => toggle(i)} />
            <span>{item}</span>
          </label>
        </li>
      {/each}
    </ul>

    <div class="shop-actions">
      <button class="save" onclick={copyList}>⧉ Copy list</button>
      <button class="backup-btn" onclick={shareList}>↗ Share</button>
      {#if have.size > 0}
        <button class="backup-btn" onclick={resetTicks}>Reset ticks</button>
      {/if}
    </div>
    {#if msg}
      <span class="backup-msg" role="status">{msg}</span>
    {:else}
      <span class="backup-msg">Tick off what you already have. Copy or share what's left.</span>
    {/if}
  {:else}
    <p class="section-empty">No ingredients to shop for.</p>
  {/if}

  <button class="again" onclick={onclose}>{backLabel}</button>
</section>
