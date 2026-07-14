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
  import { imageToText } from './lib/ocr'
  import { reportParseIssue } from './lib/telemetry'
  import { demoRecipe } from './lib/demo'
  import { parseRoute, routeToHash, type Route } from './lib/route'
  import RecipeView from './lib/components/RecipeView.svelte'
  import JarView from './lib/components/JarView.svelte'
  import ManualEntry from './lib/components/ManualEntry.svelte'
  import ImportHelp from './lib/components/ImportHelp.svelte'
  import InstallTip from './lib/components/InstallTip.svelte'
  import AboutView from './lib/components/AboutView.svelte'
  import UpdatePrompt from './lib/components/UpdatePrompt.svelte'
  import WhatsNew from './lib/components/WhatsNew.svelte'

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

  // Home-screen "add from a photo": OCR runs here, then we hand the text to the
  // manual-entry form via initialText. Kept separate from ManualEntry's own
  // photo button so the home flow lands on a pre-filled form.
  let homePhotoInput = $state<HTMLInputElement | null>(null)
  let pendingPhotoText = $state('')
  let photoBusy = $state(false)
  let photoPct = $state(0)
  let photoError = $state('')

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

  // --- Hash-based routing. The URL fragment is the single source of truth for
  //     which screen shows, so saved recipes are bookmarkable, a refresh keeps
  //     your place, and Back/Forward move between screens. It all stays local:
  //     the hash is never sent anywhere. Shared (#recipe=) and bookmarklet
  //     (#import=) links are a separate, consumed hash format, handled below.
  let routeToken = 0

  async function applyRoute(r: Route) {
    errorMsg = ''
    if (r.view !== 'recipe') {
      view = r.view
      return
    }
    if (r.id === null) {
      // Transient card (a fetched or shared recipe not yet saved): valid only
      // while it is still in memory. A cold refresh has nothing to restore.
      if (recipe) {
        view = 'recipe'
      } else {
        view = 'home'
        replaceRoute({ view: 'home' })
      }
      return
    }
    if (savedId === r.id && recipe) {
      view = 'recipe' // already open; don't reload and reset the card
      return
    }
    const token = ++routeToken
    const entry = await getRecipeById(r.id)
    if (token !== routeToken) return // a newer navigation superseded this one
    if (entry) {
      recipe = entry.recipe
      savedId = entry.id
      view = 'recipe'
    } else {
      // Deep link to a recipe that isn't in this jar (deleted, or another device).
      recipe = null
      savedId = null
      view = 'jar'
      errorMsg = 'That recipe is not in this jar.'
      replaceRoute({ view: 'jar' })
    }
  }

  function navigate(r: Route) {
    if (typeof history !== 'undefined') {
      history.pushState(null, '', location.pathname + location.search + routeToHash(r))
    }
    applyRoute(r)
  }

  function replaceRoute(r: Route) {
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search + routeToHash(r))
    }
  }

  function go(next: 'home' | 'jar' | 'add' | 'import' | 'about') {
    navigate({ view: next })
  }

  // Open the manual-entry form, optionally pre-filled with photo text. Passing no
  // text (a plain "type your own") clears any leftover OCR so the form is blank.
  function goAdd(text = '') {
    pendingPhotoText = text
    go('add')
  }

  function triggerHomePhoto() {
    photoError = ''
    homePhotoInput?.click()
  }

  async function handleHomePhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // let the same file be picked again after an error
    if (!file) return
    photoError = ''
    photoPct = 0
    photoBusy = true
    try {
      const text = await imageToText(file, (p) => (photoPct = p))
      if (!text.trim()) {
        photoError = 'No text found. Try a clearer, well-lit photo of a printed recipe.'
        return
      }
      goAdd(text)
    } catch {
      photoError = 'Could not read that photo. The first use needs a connection to set up, then it works offline.'
    } finally {
      photoBusy = false
    }
  }

  function goBack() {
    if (typeof history !== 'undefined') history.back()
    else navigate({ view: 'home' })
  }

  // Back/Forward, plus a share or bookmarklet link pasted into the address bar
  // of an already-open tab, all land here.
  function onLocationChange() {
    const imported = consumeImportHash() ?? consumeShareHash()
    if (imported) {
      showImportedRecipe(imported)
      return
    }
    applyRoute(parseRoute(location.hash))
  }

  // A recipe handed over by the bookmarklet (#import=) or a shared link (#recipe=).
  async function showImportedRecipe(imported: Recipe) {
    recipe = imported
    const existing = imported.sourceUrl ? await findBySource(imported.sourceUrl) : undefined
    savedId = existing?.id ?? null
    navigate({ view: 'recipe', id: savedId })
  }

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

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onLocationChange)
    window.addEventListener('hashchange', onLocationChange)
  }

  // Initial dispatch: a share-target query wins, otherwise consume any share or
  // bookmarklet hash, otherwise route from the current hash (a bookmarked
  // #/r/<id>, #/jar, or plain home).
  if (sharedTargetUrl) fetchRecipe(sharedTargetUrl)
  else onLocationChange()

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
      navigate({ view: 'recipe', id: savedId })
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
      replaceRoute({ view: 'recipe', id: savedId }) // the card is now bookmarkable
    } catch (err) {
      errorMsg = `Could not save: ${err instanceof Error ? err.message : 'unknown error'}`
    }
  }

  async function handleRemove() {
    if (savedId === null) return
    await removeRecipe(savedId)
    savedId = null
    await refreshCount()
    replaceRoute({ view: 'recipe', id: null }) // back to a transient card
  }

  function openSaved(entry: SavedRecipe) {
    recipe = entry.recipe
    savedId = entry.id
    navigate({ view: 'recipe', id: entry.id })
  }

  async function handleCreate(r: Recipe) {
    recipe = r
    savedId = await saveRecipe(r)
    await refreshCount()
    navigate({ view: 'recipe', id: savedId })
  }

  function goHome() {
    navigate({ view: 'home' })
  }

  function tryDemo() {
    recipe = demoRecipe
    savedId = null // demo has no sourceUrl, so it's always shown as savable
    navigate({ view: 'recipe', id: null })
  }
</script>

<a class="skip-link" href="#content">Skip to content</a>
<main>
  <UpdatePrompt />
  <WhatsNew />
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
        Works with most recipe sites, in any language. Your saved recipes stay on your device.<br />
        <button class="linklike" onclick={() => goAdd()}>Type in one of your own</button>
        &nbsp;·&nbsp;
        <button class="linklike" onclick={triggerHomePhoto} disabled={photoBusy}>
          {photoBusy ? `Reading photo… ${photoPct}%` : 'Add from a photo'}
        </button>
        &nbsp;·&nbsp;
        <button class="linklike" onclick={() => go('import')}>Recipe from a blocked site?</button>
      </p>
      <input bind:this={homePhotoInput} type="file" accept="image/*" onchange={handleHomePhoto} hidden />
      {#if photoError}<p class="error" role="alert">{photoError}</p>{/if}
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
      <button class="linklike" onclick={() => goAdd()}>+ Add your own recipe</button>
    </p>
  {:else if view === 'add'}
    <ManualEntry oncreate={handleCreate} onback={goBack} initialText={pendingPhotoText} />
  {:else if view === 'import'}
    <ImportHelp onback={goBack} ontypein={() => goAdd()} />
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
