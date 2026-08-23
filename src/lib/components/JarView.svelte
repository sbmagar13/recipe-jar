<script lang="ts">
  import { allRecipes, matchesQuery, removeRecipe, exportJar, importJar, type SavedRecipe } from '../db'
  import { persistState, requestPersist, type PersistState } from '../storage'
  import { PLAN_KEY, WEEKDAYS_KEY, readPairs, tonightIds } from '../weekplan'

  interface Props {
    onopen: (entry: SavedRecipe) => void
    onchanged: () => void
    onshop: () => void
  }

  let { onopen, onchanged, onshop }: Props = $props()

  let backupMsg = $state('')
  // Auto-backup (Chromium only): status mirrors the lazy autosync module.
  const autosyncSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window
  let autosync = $state<{ state: string; name?: string; lastWrite?: number }>({
    state: localStorage.getItem('recipe-jar:autosync') === '1' ? 'on' : 'off',
  })
  if (autosyncSupported && localStorage.getItem('recipe-jar:autosync') === '1') {
    void import('../autosync').then((m) => m.onStatus((s) => (autosync = s)))
  }
  async function handleAutosyncSetup() {
    try {
      const m = await import('../autosync')
      m.onStatus((s) => (autosync = s))
      await m.setupAutoBackup()
      loadLastBackup()
    } catch {
      // Picker dismissed: nothing changes.
    }
  }
  async function handleAutosyncReconnect() {
    const m = await import('../autosync')
    const s = await m.reconnect()
    // A missing handle means the file is gone: offer the picker again.
    if (s.state === 'reconnect' && !s.name) await handleAutosyncSetup()
  }
  async function handleAutosyncOff() {
    const m = await import('../autosync')
    await m.disableAutoBackup()
  }
  function writeAge(ts: number | undefined): string {
    if (!ts) return ''
    const mins = Math.floor((Date.now() - ts) / 60_000)
    if (mins < 1) return 'updated just now'
    if (mins < 60) return `updated ${mins} min ago`
    const days = Math.floor(mins / 1440)
    if (days < 1) return `updated ${Math.floor(mins / 60)} h ago`
    return `updated ${days} ${days === 1 ? 'day' : 'days'} ago`
  }
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

  // Whether the browser has promised to keep our storage (vs. evicting it when
  // space runs low). Shown as reassurance, with a button to ask when it hasn't.
  let persist = $state<PersistState>('unsupported')
  let persistBusy = $state(false)

  $effect(() => {
    persistState().then((s) => (persist = s))
  })

  async function handleProtect() {
    persistBusy = true
    persist = await requestPersist()
    persistBusy = false
    if (persist !== 'persisted') {
      backupMsg = 'Your browser grants this as you keep using the app. A backup is the sure way to keep your recipes.'
    }
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

  // When the typed query matches nothing, the lazy spelling module tries to
  // snap it to the jar's own vocabulary ("panner" finds their paneer). The
  // jar itself is the dictionary, so it only ever suggests dishes they have.
  let fuzzyAs = $state<string | null>(null)
  let fuzzyToken = 0
  $effect(() => {
    const q = query.trim()
    const token = ++fuzzyToken
    fuzzyAs = null
    if (q.length < 4 || entries.some((e) => matchesQuery(e, q))) return
    void import('../spellfix').then((m) => {
      if (token !== fuzzyToken) return
      const vocab: string[] = []
      for (const e of entries) {
        vocab.push(e.title, ...(e.tags ?? []))
        for (const i of e.recipe.ingredients) vocab.push(i.raw)
      }
      const alt = m.correctToVocab(q, vocab)
      if (alt.toLowerCase() !== q.toLowerCase() && entries.some((e) => matchesQuery(e, alt))) {
        fuzzyAs = alt
      }
    })
  })
  const effectiveQuery = $derived(fuzzyAs ?? query)

  const visible = $derived(
    entries.filter(
      (e) => matchesQuery(e, effectiveQuery) && (activeTag === null || (e.tags ?? []).includes(activeTag))
    )
  )

  // What the week plan says is for today: one warm line at the top of the jar.
  const tonight = $derived.by(() => {
    const ids = new Set(tonightIds(readPairs(PLAN_KEY), readPairs(WEEKDAYS_KEY), new Date().getDay()))
    return entries.filter((e) => ids.has(e.id))
  })

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
    {#if fuzzyAs}
      <p class="jar-fuzzy">Showing matches for “{fuzzyAs}”</p>
    {/if}
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

  {#if tonight.length > 0}
    <p class="tonight">
      🍳 Tonight:
      {#each tonight as e, i (e.id)}{#if i > 0}
        ·
      {/if}<button class="linklike" onclick={() => onopen(e)}>{e.title}</button>{/each}
    </p>
  {/if}

  {#if entries.length > 0}
    <p class="shop-cta">
      <button class="linklike" onclick={onshop}>🛒 Plan a shopping list from your recipes</button>
    </p>
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

  {#if autosyncSupported && entries.length > 0}
    <p class="autosync" data-state={autosync.state}>
      {#if autosync.state === 'on'}
        <span>⚡ Auto-backup: {autosync.name ?? 'your file'} · {writeAge(autosync.lastWrite) || 'ready'}</span>
        <button class="linklike" onclick={handleAutosyncOff}>Turn off</button>
      {:else if autosync.state === 'reconnect'}
        <span>⚡ Auto-backup is paused until you reconnect its file.</span>
        <button class="linklike" onclick={handleAutosyncReconnect}>Reconnect</button>
      {:else}
        <button class="linklike" onclick={handleAutosyncSetup}>
          ⚡ Auto-backup: pick a file once, it stays up to date
        </button>
        <span class="autosync-hint">Put it in a folder your cloud already syncs (iCloud, Dropbox, Syncthing).</span>
      {/if}
    </p>
  {/if}

  {#if entries.length > 0 && persist !== 'unsupported'}
    {#if persist === 'persisted'}
      <p class="storage-status protected">🔒 Your recipes are protected from your browser's automatic cleanup.</p>
    {:else}
      <p class="storage-status">
        <button class="linklike" onclick={handleProtect} disabled={persistBusy}>
          🛡 Keep my recipes on this device
        </button>
      </p>
    {/if}
  {/if}

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
