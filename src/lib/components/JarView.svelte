<script lang="ts">
  import { allRecipes, matchesQuery, removeRecipe, exportJar, importJar, type SavedRecipe } from '../db'

  interface Props {
    onopen: (entry: SavedRecipe) => void
    onchanged: () => void
  }

  let { onopen, onchanged }: Props = $props()

  let backupMsg = $state('')
  let lastBackup = $state<number | null>(null)
  let lastBackupCount = $state(0)
  let nudgeSnoozedUntil = $state(0)
  let fileInput: HTMLInputElement
  let showPasteRestore = $state(false)
  let pasteRestoreText = $state('')

  const LAST_BACKUP_KEY = 'recipe-jar:lastBackup'
  const LAST_BACKUP_COUNT_KEY = 'recipe-jar:lastBackupCount'
  const NUDGE_SNOOZE_KEY = 'recipe-jar:backupNudgeSnoozed'
  const SNOOZE_MS = 7 * 86_400_000

  function loadLastBackup() {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    lastBackup = v ? Number(v) : null
    lastBackupCount = Number(localStorage.getItem(LAST_BACKUP_COUNT_KEY) ?? 0)
    nudgeSnoozedUntil = Number(localStorage.getItem(NUDGE_SNOOZE_KEY) ?? 0)
  }
  loadLastBackup()

  /** Record a successful backup: stamp the time and the jar size it covered. */
  function markBackedUp(count: number) {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
    localStorage.setItem(LAST_BACKUP_COUNT_KEY, String(count))
    localStorage.removeItem(NUDGE_SNOOZE_KEY)
    loadLastBackup()
  }

  function backupAge(): string {
    if (lastBackup === null) return 'never backed up'
    const days = Math.floor((Date.now() - lastBackup) / 86_400_000)
    if (days <= 0) return 'backed up today'
    if (days === 1) return 'backed up yesterday'
    return `backed up ${days} days ago`
  }

  function snoozeNudge() {
    nudgeSnoozedUntil = Date.now() + SNOOZE_MS
    localStorage.setItem(NUDGE_SNOOZE_KEY, String(nudgeSnoozedUntil))
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
    markBackedUp(entries.length)
    backupMsg = `Backed up ${entries.length} ${entries.length === 1 ? 'recipe' : 'recipes'}.`
  }

  async function handleCopyBackup() {
    const json = await exportJar()
    try {
      await navigator.clipboard.writeText(json)
      markBackedUp(entries.length)
      backupMsg = 'Backup copied. Paste it somewhere safe (a note, an email to yourself).'
    } catch {
      backupMsg = 'Could not copy. Use "Back up my jar" to download a file instead.'
    }
  }

  async function runImport(text: string) {
    const { added, skipped } = await importJar(text)
    await refresh()
    onchanged()
    backupMsg = `Added ${added}, skipped ${skipped} already in your jar.`
  }

  async function handleImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      await runImport(await file.text())
    } catch (err) {
      backupMsg = err instanceof Error ? err.message : 'Could not read that file.'
    } finally {
      input.value = ''
    }
  }

  async function handlePasteRestore() {
    try {
      await runImport(pasteRestoreText)
      pasteRestoreText = ''
      showPasteRestore = false
    } catch (err) {
      backupMsg = err instanceof Error ? err.message : 'That backup text could not be read.'
    }
  }

  let entries = $state<SavedRecipe[]>([])
  let query = $state('')
  let activeTag = $state<string | null>(null)
  let loaded = $state(false)

  export async function refresh() {
    entries = await allRecipes()
    loaded = true
  }

  $effect(() => {
    refresh()
  })

  // Every tag in the jar, for the filter row.
  const allTags = $derived([...new Set(entries.flatMap((e) => e.tags ?? []))].sort())

  // Drop the active tag if its last recipe was removed/retagged.
  $effect(() => {
    if (activeTag !== null && !allTags.includes(activeTag)) activeTag = null
  })

  const visible = $derived(
    entries.filter((e) => matchesQuery(e, query) && (activeTag === null || (e.tags ?? []).includes(activeTag)))
  )

  // Recipes saved since the last backup (all of them if never backed up).
  const unbacked = $derived(Math.max(0, entries.length - lastBackupCount))

  // A gentle, dismissible reminder — IndexedDB can be evicted (iOS clears it
  // after ~7 idle days) or wiped by "clear browsing data", so nudge before loss.
  const showNudge = $derived.by(() => {
    if (entries.length === 0 || Date.now() < nudgeSnoozedUntil) return false
    if (lastBackup === null) return entries.length >= 3
    const ageDays = (Date.now() - lastBackup) / 86_400_000
    return unbacked >= 5 || (unbacked >= 1 && ageDays >= 21)
  })

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
      placeholder="Search by name, ingredient, or tag…"
      aria-label="Search saved recipes"
    />
  {/if}

  {#if allTags.length > 0}
    <div class="tag-filters" role="group" aria-label="Filter by tag">
      {#each allTags as tag (tag)}
        <button
          class="tag-filter"
          class:active={activeTag === tag}
          aria-pressed={activeTag === tag}
          onclick={() => (activeTag = activeTag === tag ? null : tag)}
        >
          #{tag}
        </button>
      {/each}
    </div>
  {/if}

  {#if showNudge}
    <div class="backup-nudge" role="status">
      <span class="nudge-icon" aria-hidden="true">🛟</span>
      <p class="nudge-text">
        {#if lastBackup === null}
          Your {entries.length} {entries.length === 1 ? 'recipe lives' : 'recipes live'} only on this device.
          Save a backup so clearing your browser can't erase them.
        {:else}
          {unbacked} new {unbacked === 1 ? 'recipe' : 'recipes'} since your last backup. Update it to keep them safe.
        {/if}
      </p>
      <div class="nudge-actions">
        <button class="nudge-primary" onclick={handleExport}>Back up now</button>
        <button class="nudge-later" onclick={snoozeNudge}>Later</button>
      </div>
    </div>
  {/if}

  <div class="backup-bar">
    {#if entries.length > 0}
      <button class="backup-btn" onclick={handleExport}>⤓ Back up my jar</button>
      <button class="backup-btn" onclick={handleCopyBackup}>⧉ Copy backup</button>
    {/if}
    <button class="backup-btn" onclick={() => fileInput.click()}>⤒ Restore from file</button>
    <button class="backup-btn" onclick={() => (showPasteRestore = !showPasteRestore)}>⧉ Paste backup</button>
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
      <span class="backup-msg" class:stale={lastBackup === null}>
        {backupAge()}{#if lastBackup !== null && unbacked > 0} · {unbacked} new since{/if}
      </span>
    {/if}
  </div>

  {#if showPasteRestore}
    <div class="paste-restore">
      <textarea
        bind:value={pasteRestoreText}
        rows="4"
        placeholder="Paste your backup text here…"
        aria-label="Paste backup text"
      ></textarea>
      <button class="save" onclick={handlePasteRestore} disabled={!pasteRestoreText.trim()}>Restore</button>
    </div>
  {/if}

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
                {entry.recipe.ingredients.length} {entry.recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
                {#if entry.recipe.totalTime}· {entry.recipe.totalTime}{/if}
                {#if entry.cookedCount}· cooked {entry.cookedCount}×{:else}· saved {fmtDate(entry.savedAt)}{/if}
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
