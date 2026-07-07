<script lang="ts">
  import type { Recipe } from './lib/types'
  import { parseRecipeFromHtml } from './lib/parse'
  import {
    saveRecipe,
    removeRecipe,
    findBySource,
    jarCount,
    getRecipeById,
    setNotes,
    setTags,
    markCooked,
    type SavedRecipe,
  } from './lib/db'
  import { consumeImportHash } from './lib/bookmarklet'
  import { consumeShareHash } from './lib/share'
  import { reportParseIssue } from './lib/telemetry'
  import { demoRecipe } from './lib/demo'
  import RecipeView from './lib/components/RecipeView.svelte'
  import JarView from './lib/components/JarView.svelte'
  import ManualEntry from './lib/components/ManualEntry.svelte'
  import ImportHelp from './lib/components/ImportHelp.svelte'
  import InstallTip from './lib/components/InstallTip.svelte'
  import AboutView from './lib/components/AboutView.svelte'
  import UpdatePrompt from './lib/components/UpdatePrompt.svelte'

  type View = 'home' | 'recipe' | 'jar' | 'add' | 'import' | 'about'

  let view = $state<View>('home')
  let url = $state('')
  let loading = $state(false)
  let errorMsg = $state('')
  let blocked = $state(false)
  let recipe = $state<Recipe | null>(null)
  let savedId = $state<number | null>(null)
  let savedEntry = $state<SavedRecipe | null>(null)
  let count = $state(0)

  // Keep the saved entry (notes / cook stats) in sync with whatever is saved.
  $effect(() => {
    const id = savedId
    if (id === null) {
      savedEntry = null
      return
    }
    getRecipeById(id).then((entry) => {
      if (savedId === id) savedEntry = entry ?? null
    })
  })

  async function handleSaveNotes(notes: string) {
    if (savedId === null) return
    await setNotes(savedId, notes)
    if (savedEntry) savedEntry = { ...savedEntry, notes }
  }

  async function handleCooked() {
    if (savedId === null) return
    const cookedCount = await markCooked(savedId)
    if (savedEntry) savedEntry = { ...savedEntry, cookedCount, lastCooked: Date.now() }
  }

  async function handleSaveTags(tags: string[]) {
    if (savedId === null) return
    await setTags(savedId, tags)
    if (savedEntry) savedEntry = { ...savedEntry, tags }
  }

  async function refreshCount() {
    count = await jarCount()
  }
  refreshCount()

  // --- View navigation wired into browser history, so the Back button/gesture
  //     moves between in-app screens instead of leaving the app (matters most
  //     for the installed PWA). A forward move pushes a history entry; Back and
  //     the OS gesture come back as popstate.
  function go(next: View) {
    errorMsg = ''
    if (next !== view && typeof history !== 'undefined') history.pushState({ view: next }, '')
    view = next
  }

  function goBack() {
    if (typeof history !== 'undefined') history.back()
    else go('home')
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', (e) => {
      const state = e.state as { view?: View } | null
      view = state?.view ?? 'home'
      errorMsg = ''
    })
    // A share/import link opened in an already-running tab (pasted into the
    // address bar, or clicked while the app is open) arrives as a hash change,
    // not a page load — consume it the same way.
    window.addEventListener('hashchange', () => handleImportHash())
  }

  // Recipe handed over by the bookmarklet (#import=) or a shared link (#recipe=).
  async function handleImportHash() {
    const imported = consumeImportHash() ?? consumeShareHash()
    if (!imported) return
    recipe = imported
    const existing = imported.sourceUrl ? await findBySource(imported.sourceUrl) : undefined
    savedId = existing?.id ?? null
    go('recipe')
  }
  handleImportHash()

  // URL shared into the installed app via the Web Share Target (Android): the
  // OS puts it in ?url=/?text=/?title=. Pull out the first http(s) link.
  function consumeShareTargetQuery(): string | null {
    const params = new URLSearchParams(location.search)
    const raw = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')
    if (!raw) return null
    history.replaceState(null, '', location.pathname + location.hash)
    const m = raw.match(/https?:\/\/\S+/)
    return m ? m[0] : null
  }
  const sharedTargetUrl = consumeShareTargetQuery()

  // Baseline entry so the very first Back returns here rather than exiting. The
  // app always starts at 'home' (an import navigates forward asynchronously).
  if (typeof history !== 'undefined') history.replaceState({ view: 'home' }, '')
  if (sharedTargetUrl) fetchRecipe(sharedTargetUrl)

  async function getRecipe(e: Event) {
    e.preventDefault()
    let target = url.trim()
    if (!target) return
    // Let people type a bare domain: "bbcgoodfood.com/recipes/..." works.
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target
    await fetchRecipe(target)
  }

  async function fetchRecipe(target: string) {
    loading = true
    errorMsg = ''
    blocked = false
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Could not fetch that page' }))
        throw new Error(body.error ?? 'Could not fetch that page')
      }
      const html = await res.text()
      const parsed = parseRecipeFromHtml(html, target)
      if (!parsed) {
        blocked = true
        // Fetched fine but no recipe found: a parser gap worth knowing about.
        // Sends only the hostname, never the recipe or full URL.
        reportParseIssue(target, 'no-recipe')
        throw new Error('No recipe found on that page.')
      }
      recipe = parsed
      const existing = await findBySource(target)
      savedId = existing?.id ?? null
      go('recipe')
      url = ''
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Something went wrong'
      // Any fetch failure is a case the in-browser bookmarklet can rescue.
      blocked = true
    } finally {
      loading = false
    }
  }

  async function handleSave() {
    if (!recipe) return
    try {
      savedId = await saveRecipe(recipe)
      await refreshCount()
    } catch (err) {
      errorMsg = `Could not save: ${err instanceof Error ? err.message : 'unknown error'}`
    }
  }

  async function handleRemove() {
    if (savedId === null) return
    await removeRecipe(savedId)
    savedId = null
    await refreshCount()
  }

  function openSaved(entry: SavedRecipe) {
    recipe = entry.recipe
    savedId = entry.id
    go('recipe')
  }

  async function handleCreate(r: Recipe) {
    recipe = r
    savedId = await saveRecipe(r)
    await refreshCount()
    go('recipe')
  }

  function goHome() {
    go('home')
  }

  function tryDemo() {
    recipe = demoRecipe
    savedId = null // demo has no sourceUrl, so it's always shown as savable
    go('recipe')
  }
</script>

<a class="skip-link" href="#content">Skip to content</a>
<main>
  <UpdatePrompt />
  <header class="top">
    <button class="brand" onclick={goHome} aria-label="Recipe Jar home">
      <svg width="28" height="32" viewBox="0 0 64 72" aria-hidden="true">
        <rect x="18" y="6" width="28" height="8" rx="2" fill="var(--basil)" />
        <path d="M16 18 Q12 24 12 32 V58 Q12 66 20 66 H44 Q52 66 52 58 V32 Q52 24 48 18 Z" fill="none" stroke="var(--basil)" stroke-width="4" />
        <line x1="20" y1="34" x2="44" y2="34" stroke="var(--tomato)" stroke-width="3" stroke-linecap="round" />
        <line x1="20" y1="46" x2="40" y2="46" stroke="var(--basil)" stroke-width="3" stroke-linecap="round" opacity="0.5" />
      </svg>
      <span>Recipe Jar</span>
    </button>
    <nav>
      <button class="navlink" class:active={view === 'jar'} onclick={() => go('jar')}>
        My Jar{count > 0 ? ` (${count})` : ''}
      </button>
    </nav>
  </header>

  {#if errorMsg && view !== 'home'}
    <p class="error" role="alert" style="text-align:center">{errorMsg}</p>
  {/if}

  <div id="content" tabindex="-1">
  {#if view === 'home'}
    <section class="hero">
      <h1>Just the recipe.<br />Yours to keep.</h1>
      <p class="sub">
        Paste a recipe link. Get a clean card: ingredients and steps, nothing else.
        No account, no ads, free forever.
      </p>
      <form class="fetchbar" onsubmit={getRecipe}>
        <input
          type="text"
          inputmode="url"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          bind:value={url}
          placeholder="paste or type a recipe link…"
          aria-label="Recipe URL"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Get the recipe'}
        </button>
      </form>
      <p class="try-line">
        or <button class="linklike" onclick={tryDemo}>see a sample recipe</button> first
      </p>
      {#if errorMsg}
        <p class="error" role="alert">
          {errorMsg}
          {#if blocked}
            This site may block fetching. <button class="linklike" onclick={() => go('import')}>Use the bookmarklet →</button>
          {/if}
        </p>
      {/if}
      <p class="hint">
        Works with most recipe sites, in any language. Your recipes never touch a server.<br />
        <button class="linklike" onclick={() => go('add')}>Type in one of your own</button>
        &nbsp;·&nbsp;
        <button class="linklike" onclick={() => go('import')}>Recipe from a blocked site?</button>
      </p>
    </section>
  {:else if view === 'recipe' && recipe}
    <RecipeView
      {recipe}
      {savedId}
      notes={savedEntry?.notes ?? ''}
      cookedCount={savedEntry?.cookedCount ?? 0}
      lastCooked={savedEntry?.lastCooked ?? null}
      tags={savedEntry?.tags ?? []}
      onsave={handleSave}
      onremove={handleRemove}
      onback={goBack}
      onsavenotes={handleSaveNotes}
      oncooked={handleCooked}
      onsavetags={handleSaveTags}
    />
  {:else if view === 'jar'}
    <JarView onopen={openSaved} onchanged={refreshCount} />
    <p class="jar-footer">
      <button class="linklike" onclick={() => go('add')}>+ Add your own recipe</button>
    </p>
  {:else if view === 'add'}
    <ManualEntry oncreate={handleCreate} onback={goBack} />
  {:else if view === 'import'}
    <ImportHelp onback={goBack} ontypein={() => go('add')} />
  {:else if view === 'about'}
    <AboutView onback={goBack} />
  {/if}
  </div>

  <footer>
    <span>Free forever · No account · Your recipes stay on your device</span>
    <span class="footer-links">
      <button class="linklike" onclick={() => go('about')}>About &amp; Privacy</button>
      ·
      <span class="mono">free &amp; open source, for people who cook</span>
    </span>
  </footer>

  <InstallTip active={count > 0} />
</main>
