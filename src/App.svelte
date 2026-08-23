<script lang="ts">
  import type { Recipe } from './lib/types'
  import { parseRecipeFromHtml, parseAllRecipesFromHtml, pickBestRecipe } from './lib/parse'
  import { searchSitesForgiving, type SearchHit } from './lib/sitesearch'
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
  import { consumeShareHash, decodeShare } from './lib/share'
  import { imageToText } from './lib/ocr'
  import { countEvent, reportParseIssue } from './lib/telemetry'
  import { demoRecipe } from './lib/demo'
  import { parseRoute, routeToHash, type Route } from './lib/route'
  import RecipeView from './lib/components/RecipeView.svelte'
  import JarView from './lib/components/JarView.svelte'
  // ShopPlan loads on demand: it is only reachable from My Jar's plan button,
  // and the entry budget wants the bytes back (same treatment as AboutView).
  import ManualEntry from './lib/components/ManualEntry.svelte'
  import ImportHelp from './lib/components/ImportHelp.svelte'
  import InstallTip from './lib/components/InstallTip.svelte'
  // AboutView loads on demand: it is a page of legal prose most sessions
  // never open, and the entry budget wants those bytes back.
  import UpdatePrompt from './lib/components/UpdatePrompt.svelte'
  import WhatsNew from './lib/components/WhatsNew.svelte'

  type View = 'home' | 'recipe' | 'jar' | 'shop' | 'pantry' | 'add' | 'import' | 'about'

  let view = $state<View>('home')
  let url = $state('')
  let loading = $state(false)
  let errorMsg = $state('')
  let blocked = $state(false)
  let recipe = $state<Recipe | null>(null)
  // A dish name typed into the link box: offer a web search for it.
  let dishQuery = $state('')
  // A page that carries several recipes with no clear winner: let the cook pick.
  let choices = $state<Recipe[] | null>(null)
  // Dish-name search results from supported recipe sites, shown in a
  // dropdown anchored to the input, combobox style.
  let searchHits = $state<SearchHit[] | null>(null)
  // When a typo was forgiven ("browny" -> "brownie"), the query the results
  // actually answer, so the dropdown can say so.
  let searchedAs = $state<string | null>(null)
  let searching = $state(false)
  let hiIndex = $state(-1)
  let searchboxEl = $state<HTMLElement | null>(null)
  const dropdownOpen = $derived(searching || searchHits !== null)
  // Theme choice: follow the device (default) or pin light/dark. The boot
  // script in index.html applies a saved choice before first paint; this
  // keeps the attribute, storage, and browser-chrome color in step after.
  type ThemePref = 'system' | 'light' | 'dark'
  const THEME_KEY = 'recipe-jar:theme'
  const THEME_BAR: Record<'light' | 'dark', string> = { light: '#33663d', dark: '#171a14' }
  let themePref = $state<ThemePref>(
    (() => {
      try {
        const t = localStorage.getItem(THEME_KEY)
        if (t === 'light' || t === 'dark') return t
      } catch {}
      return 'system'
    })(),
  )
  $effect(() => {
    const root = document.documentElement
    if (themePref === 'system') delete root.dataset.theme
    else root.dataset.theme = themePref
    try {
      if (themePref === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, themePref)
    } catch {}
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      const systemScheme = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light'
      meta.setAttribute('content', THEME_BAR[themePref === 'system' ? systemScheme : themePref])
    }
  })
  function cycleTheme() {
    themePref = themePref === 'system' ? 'light' : themePref === 'light' ? 'dark' : 'system'
  }

  // Auto-backup resumes lazily: the module only loads for cooks who turned it on.
  if (localStorage.getItem('recipe-jar:autosync') === '1') {
    void import('./lib/autosync').then((m) => m.startAutosync())
  }

  let savedId = $state<number | null>(null)
  let savedEntry = $state<SavedRecipe | null>(null)
  let count = $state(0)
  // The living jar in the header: contents rise as the collection grows,
  // and the jar gives a happy plop when a save lands.
  const jarLevel = $derived(count === 0 ? 0 : Math.min(24, 5 + count * 2))
  let jarPlop = $state(false)
  let prevCount = -1
  $effect(() => {
    const c = count
    if (prevCount >= 0 && c > prevCount) {
      jarPlop = true
      setTimeout(() => (jarPlop = false), 500)
    }
    prevCount = c
  })

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
      sharedIn = false
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

  function go(next: 'home' | 'jar' | 'shop' | 'pantry' | 'add' | 'import' | 'about') {
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

  // True while the showing card arrived via someone's share link: the card
  // gets a quiet one-line note saying so. Cleared on any navigation.
  let sharedIn = $state(false)
  let shareDecodePending = false

  // Back/Forward, plus a share or bookmarklet link pasted into the address bar
  // of an already-open tab, all land here.
  function onLocationChange() {
    const imported = consumeImportHash()
    if (imported) {
      showImportedRecipe(imported)
      return
    }
    const sharedPayload = consumeShareHash()
    if (sharedPayload) {
      // Decoding is async (the compressed format inflates via the browser).
      shareDecodePending = true
      void decodeShare(sharedPayload).then((shared) => {
        shareDecodePending = false
        if (shared) {
          void showImportedRecipe(shared, true)
        } else {
          // A payload that will not decode is almost always a link that lost
          // its tail in a messaging app. Say so instead of a silent home page.
          void applyRoute(parseRoute(location.hash)).then(() => {
            errorMsg =
              'That shared recipe link looks cut short. Links sometimes lose their tail when copied through other apps; ask for it to be sent again with "Copy link".'
          })
        }
      })
      return
    }
    // Belt and braces: never let a stray event stomp an in-flight share decode.
    if (shareDecodePending) return
    applyRoute(parseRoute(location.hash))
  }

  // A recipe handed over by the bookmarklet (#import=) or a shared link (#recipe=).
  async function showImportedRecipe(imported: Recipe, viaShare = false) {
    recipe = imported
    const existing = imported.sourceUrl ? await findBySource(imported.sourceUrl) : undefined
    savedId = existing?.id ?? null
    sharedIn = viaShare
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
    // hashchange alone covers every transition in a pure-hash router (all
    // routes differ by hash). Listening to popstate as well made every hash
    // navigation fire the handler twice, and the twin call, seeing the
    // already-consumed hash of a share link, stomped its error handling.
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
    // A dish name is not a link: search supported recipe sites for it and
    // offer the results to pick from. (A real Show HN visitor typed a search
    // into this box expecting exactly that.)
    if (/\s/.test(target) || !target.includes('.')) {
      await searchDish(target)
      return
    }
    // Let people type a bare domain: "bbcgoodfood.com/recipes/..." works.
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target
    await fetchRecipe(target)
  }

  // Known-good example recipes, for visitors who arrive without a link in
  // hand (launch-day traffic mostly). One tap shows the real fetch-and-clean
  // magic, and since everyone taps the same URLs the proxy's edge cache makes
  // them fast.
  const EXAMPLES = [
    { label: 'chocolate brownies', url: 'https://www.bbcgoodfood.com/recipes/best-ever-chocolate-brownies-recipe' },
    { label: 'chicken curry', url: 'https://www.bbcgoodfood.com/recipes/easy-chicken-curry' },
  ]

  function tryExample(ex: (typeof EXAMPLES)[number]) {
    url = ex.url
    void fetchRecipe(ex.url)
  }

  // Guards a slow old search against overwriting a newer one.
  let searchToken = 0
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  async function searchDish(query: string) {
    clearTimeout(searchTimer)
    const token = ++searchToken
    blocked = false
    errorMsg = ''
    choices = null
    searchHits = null
    searchedAs = null
    hiIndex = -1
    dishQuery = query
    searching = true
    countEvent('search') // one executed search (the debounce already coalesces typing)
    try {
      // Results paint as each site answers; the slowest site never gates the first.
      const outcome = await searchSitesForgiving(query, (partial, usedQuery) => {
        if (token !== searchToken) return
        searchHits = partial.slice(0, 10)
        searchedAs = usedQuery !== query ? usedQuery : null
      })
      if (token !== searchToken) return
      // An empty array renders the dropdown's no-results state.
      searchHits = outcome.hits.slice(0, 10)
      searchedAs = outcome.usedQuery !== query ? outcome.usedQuery : null
    } catch {
      if (token !== searchToken) return
      searchHits = []
    } finally {
      if (token === searchToken) searching = false
    }
  }

  function closeSearch() {
    clearTimeout(searchTimer)
    searchToken++
    searching = false
    searchHits = null
    searchedAs = null
    hiIndex = -1
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeSearch()
      return
    }
    if (!searchHits || searchHits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      hiIndex = (hiIndex + 1) % searchHits.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      hiIndex = (hiIndex - 1 + searchHits.length) % searchHits.length
    } else if (e.key === 'Enter' && hiIndex >= 0) {
      e.preventDefault()
      chooseHit(searchHits[hiIndex])
    }
  }

  // Search on the fly: when the input reads like a dish and typing pauses,
  // run the search without waiting for the button. One polite fetch per
  // pause, never per keystroke.
  function onUrlInput() {
    clearTimeout(searchTimer)
    const t = url.trim()
    const dishLike = t.length >= 4 && (/\s/.test(t) || !t.includes('.'))
    if (!dishLike) {
      if (dropdownOpen) closeSearch()
      return
    }
    searchTimer = setTimeout(() => {
      if (url.trim() === t) void searchDish(t)
    }, 550)
  }

  function chooseHit(hit: SearchHit) {
    searchHits = null
    searchedAs = null
    hiIndex = -1
    url = hit.url
    void fetchRecipe(hit.url)
  }

  function chooseRecipe(c: Recipe) {
    choices = null
    recipe = c
    savedId = null
    void findBySource(c.sourceUrl).then((existing) => {
      savedId = existing?.id ?? null
      navigate({ view: 'recipe', id: savedId })
    })
    url = ''
  }

  async function fetchRecipe(target: string) {
    loading = true
    errorMsg = ''
    blocked = false
    dishQuery = ''
    choices = null
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Could not fetch that page' }))
        throw new Error(body.error ?? 'Could not fetch that page')
      }
      const html = await res.text()
      // A page can carry several recipes (the dish plus a related-recipes
      // carousel). Auto-pick when one matches the page title; otherwise ask.
      searchHits = null
      const all = parseAllRecipesFromHtml(html, target)
      if (all.length > 1 && !pickBestRecipe(all, html)) {
        choices = all.slice(0, 6)
        loading = false
        return
      }
      const parsed = parseRecipeFromHtml(html, target)
      if (!parsed) {
        blocked = true
        // Fetched fine but no recipe found. Two very different stories, told
        // apart so the failure tally triages itself: a page with recipe
        // markup we failed to read is a parser gap (signal); a page with no
        // recipe markup at all was probably never a recipe (noise). Sends
        // only the hostname and this coarse reason, never the page or URL.
        const hasMarkup = /recipeIngredient|itemtype="[^"]*schema\.org\/Recipe|"@type"\s*:\s*"[Rr]ecipe"/.test(html)
        reportParseIssue(target, hasMarkup ? 'markup-unread' : 'no-recipe')
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

<svelte:window
  onpointerdown={(e) => {
    if (dropdownOpen && searchboxEl && !searchboxEl.contains(e.target as Node)) closeSearch()
  }}
/>

<a class="skip-link" href="#content">Skip to content</a>
<main>
  <UpdatePrompt />
  <WhatsNew />
  <header class="top">
    <button class="brand" onclick={goHome} aria-label="Recipe Jar home">
      <svg width="28" height="32" viewBox="0 0 64 72" aria-hidden="true">
        <rect x="18" y="6" width="28" height="8" rx="2" fill="currentColor" />
        <path d="M16 18 Q12 24 12 32 V58 Q12 66 20 66 H44 Q52 66 52 58 V32 Q52 24 48 18 Z" fill="none" stroke="currentColor" stroke-width="4" />
        <line x1="20" y1="34" x2="44" y2="34" stroke="var(--tomato)" stroke-width="3" stroke-linecap="round" />
        <line x1="20" y1="46" x2="40" y2="46" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.5" />
      </svg>
      <span>Recipe Jar</span>
    </button>
    <nav>
      <button class="navlink" class:active={view === 'jar'} onclick={() => go('jar')}>
        <svg class="jarfill" class:plop={jarPlop} width="15" height="19" viewBox="0 0 32 40" aria-hidden="true">
          <defs>
            <clipPath id="rj-jarclip">
              <path d="M9 8 Q6 12 6 17 V32 Q6 37 11 37 H21 Q26 37 26 32 V17 Q26 12 23 8 Z" />
            </clipPath>
          </defs>
          <rect x="9" y="1" width="14" height="4.5" rx="1.5" fill="currentColor" opacity="0.9" />
          <rect
            x="5"
            y={37 - jarLevel}
            width="22"
            height={jarLevel}
            fill="currentColor"
            opacity="0.3"
            clip-path="url(#rj-jarclip)"
            style="transition: y 0.45s ease, height 0.45s ease"
          />
          <path d="M9 8 Q6 12 6 17 V32 Q6 37 11 37 H21 Q26 37 26 32 V17 Q26 12 23 8 Z" fill="none" stroke="currentColor" stroke-width="2.6" />
        </svg>
        My Jar{count > 0 ? ` (${count})` : ''}
      </button>
    </nav>
  </header>

  {#if errorMsg && view !== 'home'}
    <p class="error" role="alert" style="text-align:center">{errorMsg}</p>
  {/if}

  <div id="content" tabindex="-1">
  {#key view}
  <div class="viewwrap">
  {#if view === 'home'}
    <section class="hero">
      <h1>Just the recipe.<br />Yours to keep.</h1>
      <svg class="hero-stroke" width="150" height="10" viewBox="0 0 150 10" aria-hidden="true">
        <path d="M4 6 C 40 2, 75 8, 110 5 S 140 4, 146 5" fill="none" stroke="var(--tomato)" stroke-width="3" stroke-linecap="round" pathLength="100" />
      </svg>
      <p class="sub">
        Paste a recipe link. Get a clean card: ingredients and steps, nothing else.
        No account, no ads, free forever.
      </p>
      <div class="searchbox" bind:this={searchboxEl}>
        <form class="fetchbar" onsubmit={getRecipe}>
          <div class="inputwrap">
            <input
              type="text"
              inputmode="url"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              bind:value={url}
              oninput={onUrlInput}
              onkeydown={onSearchKeydown}
              placeholder="paste a recipe link, or type a dish…"
              aria-label="Recipe URL"
              required
            />
            {#if searching}<span class="input-spin" aria-hidden="true"></span>{/if}
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Fetching…' : 'Get the recipe'}
          </button>
        </form>
        {#if dropdownOpen}
          <div class="dropdown" role="listbox" aria-label="Recipe results">
            {#if searching && !searchHits}
              {#each [0, 1, 2] as i (i)}
                <div class="drow skeleton" aria-hidden="true">
                  <span class="dthumb sk"></span>
                  <span class="dlines"><span class="sk sk-t"></span><span class="sk sk-s"></span></span>
                </div>
              {/each}
            {:else if searchHits && searchHits.length > 0}
              {#each searchHits as hit, i (hit.url)}
                <button
                  class="drow"
                  class:active={i === hiIndex}
                  role="option"
                  aria-selected={i === hiIndex}
                  onmouseenter={() => (hiIndex = i)}
                  onclick={() => chooseHit(hit)}
                >
                  {#if hit.image}
                    <img class="dthumb" src={hit.image} alt="" decoding="async" />
                  {:else}
                    <span class="dthumb dthumb-fallback" aria-hidden="true">🥘</span>
                  {/if}
                  <span class="dlines">
                    <strong>{hit.title}</strong>
                    <small>{hit.site}</small>
                  </span>
                </button>
              {/each}
              <div class="dfoot">
                {#if searchedAs}
                  <span>Showing results for “{searchedAs}”. </span>
                {/if}
                <a class="linklike" href={`https://www.google.com/search?q=${encodeURIComponent(dishQuery + ' recipe')}`} target="_blank" rel="noopener noreferrer">search the web instead →</a>
              </div>
            {:else}
              <div class="dfoot">
                No results for “{dishQuery}” on the sites we can search.
                <a class="linklike" href={`https://www.google.com/search?q=${encodeURIComponent(dishQuery + ' recipe')}`} target="_blank" rel="noopener noreferrer">search the web →</a>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      <p class="try-line">
        No recipe link handy? Try
        <button class="linklike" onclick={() => tryExample(EXAMPLES[0])} disabled={loading}>chocolate brownies</button>
        or
        <button class="linklike" onclick={() => tryExample(EXAMPLES[1])} disabled={loading}>chicken curry</button>,
        or <button class="linklike" onclick={tryDemo}>see a sample recipe</button> first
      </p>
      {#if errorMsg}
        <p class="error" role="alert">
          {errorMsg}
          {#if dishQuery}
            <a class="linklike" href={`https://www.google.com/search?q=${encodeURIComponent(dishQuery + ' recipe')}`} target="_blank" rel="noopener noreferrer">search the web for “{dishQuery}” →</a>
          {/if}
          {#if blocked}
            This site may block fetching.
            <button class="linklike" onclick={() => go('import')}>Use the bookmarklet →</button>
            or
            <button class="linklike" onclick={() => goAdd()}>paste the recipe text →</button>
          {/if}
        </p>
      {/if}
      {#if choices}
        <div class="choices" role="group" aria-label="Recipes found on that page">
          <p class="choices-title">That page has {choices.length} recipes. Which one?</p>
          {#each choices as c (c.title)}
            <button class="choice" onclick={() => chooseRecipe(c)}>
              <strong>{c.title}</strong>
              <small>{c.ingredients.length} {c.ingredients.length === 1 ? 'ingredient' : 'ingredients'}{c.totalTime ? ` · ${c.totalTime}` : ''}</small>
            </button>
          {/each}
        </div>
      {/if}
      <p class="hint">
        Works with most recipe sites, in any language. Your saved recipes stay on your device.
      </p>
      <div class="action-chips">
        <button class="action-chip" onclick={() => goAdd()}>Type in one of your own</button>
        <button class="action-chip" onclick={triggerHomePhoto} disabled={photoBusy}>
          {photoBusy ? `Reading photo… ${photoPct}%` : 'Add from a photo'}
        </button>
        <button class="action-chip" onclick={() => go('import')}>Recipe from a blocked site?</button>
      </div>
      <input bind:this={homePhotoInput} type="file" accept="image/*" onchange={handleHomePhoto} hidden />
      {#if photoError}<p class="error" role="alert">{photoError}</p>{/if}
    </section>
  {:else if view === 'recipe' && recipe}
    {#if sharedIn && savedId === null}
      <p class="shared-note">Someone shared this recipe with you · keep it below · Recipe Jar is free, no account</p>
    {/if}
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
    <JarView onopen={openSaved} onchanged={refreshCount} onshop={() => go('shop')} onpantry={() => go('pantry')} />
    <p class="jar-footer">
      <button class="linklike" onclick={() => goAdd()}>+ Add your own recipe</button>
    </p>
  {:else if view === 'shop'}
    {#await import('./lib/components/ShopPlan.svelte') then M}
      {@const ShopPlan = M.default}
      <ShopPlan onback={goBack} />
    {/await}
  {:else if view === 'pantry'}
    {#await import('./lib/components/PantryView.svelte') then M}
      {@const PantryView = M.default}
      <PantryView onopen={openSaved} onback={goBack} />
    {/await}
  {:else if view === 'add'}
    <ManualEntry oncreate={handleCreate} onback={goBack} initialText={pendingPhotoText} />
  {:else if view === 'import'}
    <ImportHelp onback={goBack} ontypein={() => goAdd()} />
  {:else if view === 'about'}
    {#await import('./lib/components/AboutView.svelte') then M}
      {@const AboutView = M.default}
      <AboutView onback={goBack} />
    {/await}
  {/if}
  </div>
  {/key}
  </div>

  <footer>
    <span>Free forever · No account · Your recipes stay on your device</span>
    <span class="footer-links">
      <button class="linklike" onclick={() => go('about')}>About &amp; Privacy</button>
      ·
      <button class="linklike" onclick={cycleTheme} title="Switch between auto, light, and dark">
        Theme: {themePref === 'system' ? 'auto' : themePref}
      </button>
      ·
      <span class="mono">free &amp; open source, for people who cook</span>
    </span>
  </footer>

  <InstallTip active={count > 0} />
</main>
