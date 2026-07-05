<script lang="ts">
  import { allRecipes, matchesQuery, removeRecipe, exportJar, importJar, type SavedRecipe } from '../db'

  interface Props {
    onopen: (entry: SavedRecipe) => void
    onchanged: () => void
  }

  let { onopen, onchanged }: Props = $props()

  let backupMsg = $state('')
  let lastBackup = $state<number | null>(null)
  let fileInput: HTMLInputElement

  const LAST_BACKUP_KEY = 'recipe-jar:lastBackup'

  function loadLastBackup() {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    lastBackup = v ? Number(v) : null
  }
  loadLastBackup()

  function backupAge(): string {
    if (lastBackup === null) return 'never backed up'
    const days = Math.floor((Date.now() - lastBackup) / 86_400_000)
    if (days <= 0) return 'backed up today'
    if (days === 1) return 'backed up yesterday'
    return `backed up ${days} days ago`
  }

  async function handleDelete(entry: SavedRecipe) {
    if (!confirm(`Remove "${entry.title}" from your jar?`)) return
    await removeRecipe(entry.id)
    await refresh()
    onchanged()
  }

  async function handleExport() {
    const json = await exportJar()
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `recipe-jar-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
    loadLastBackup()
    backupMsg = `Backed up ${entries.length} ${entries.length === 1 ? 'recipe' : 'recipes'}.`
  }

  async function handleImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const { added, skipped } = await importJar(text)
      await refresh()
      onchanged()
      backupMsg = `Added ${added}, skipped ${skipped} already in your jar.`
    } catch (err) {
      backupMsg = err instanceof Error ? err.message : 'Could not read that file.'
    } finally {
      input.value = ''
    }
  }

  let entries = $state<SavedRecipe[]>([])
  let query = $state('')
  let loaded = $state(false)

  export async function refresh() {
    entries = await allRecipes()
    loaded = true
  }

  $effect(() => {
    refresh()
  })

  const visible = $derived(entries.filter((e) => matchesQuery(e, query)))

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
</script>

<section class="jar">
  <h1 class="jar-title">My Jar</h1>
  {#if entries.length > 3}
    <input
      class="jar-search"
      type="search"
      bind:value={query}
      placeholder="Search by name or ingredient…"
      aria-label="Search saved recipes"
    />
  {/if}

  <div class="backup-bar">
    {#if entries.length > 0}
      <button class="backup-btn" onclick={handleExport}>⤓ Back up my jar</button>
    {/if}
    <button class="backup-btn" onclick={() => fileInput.click()}>⤒ Restore from file</button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={handleImportFile}
      hidden
    />
    {#if backupMsg}
      <span class="backup-msg">{backupMsg}</span>
    {:else if entries.length > 0}
      <span class="backup-msg" class:stale={lastBackup === null}>{backupAge()}</span>
    {/if}
  </div>

  {#if loaded && entries.length === 0}
    <p class="jar-empty">
      Your jar is empty. Fetch a recipe from a link, or add one of your own, and it will be kept
      here on this device: no account, no limit.
    </p>
  {:else}
    <ul class="jar-list">
      {#each visible as entry (entry.id)}
        <li>
          <button class="jar-item" onclick={() => onopen(entry)}>
            {#if entry.recipe.image}
              <img src={entry.recipe.image} alt="" loading="lazy" />
            {:else}
              <span class="thumb-fallback" aria-hidden="true">🥘</span>
            {/if}
            <span class="jar-item-text">
              <strong>{entry.title}</strong>
              <small>
                {entry.recipe.ingredients.length} ingredients
                {#if entry.recipe.totalTime}· {entry.recipe.totalTime}{/if}
                · saved {fmtDate(entry.savedAt)}
              </small>
            </span>
          </button>
          <button class="jar-delete" onclick={() => handleDelete(entry)} aria-label={`Delete ${entry.title}`}>
            ✕
          </button>
        </li>
      {/each}
    </ul>
    {#if query && visible.length === 0}
      <p class="jar-empty">Nothing matches "{query}".</p>
    {/if}
  {/if}
</section>
