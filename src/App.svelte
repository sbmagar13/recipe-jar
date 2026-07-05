<script lang="ts">
  import type { Recipe } from './lib/types'
  import { parseRecipeFromHtml } from './lib/parse'
  import { saveRecipe, removeRecipe, findBySource, jarCount, type SavedRecipe } from './lib/db'
  import { consumeImportHash } from './lib/bookmarklet'
  import { demoRecipe } from './lib/demo'
  import RecipeView from './lib/components/RecipeView.svelte'
  import JarView from './lib/components/JarView.svelte'
  import ManualEntry from './lib/components/ManualEntry.svelte'
  import ImportHelp from './lib/components/ImportHelp.svelte'

  type View = 'home' | 'recipe' | 'jar' | 'add' | 'import'

  let view = $state<View>('home')
  let url = $state('')
  let loading = $state(false)
  let errorMsg = $state('')
  let blocked = $state(false)
  let recipe = $state<Recipe | null>(null)
  let savedId = $state<number | null>(null)
  let count = $state(0)

  async function refreshCount() {
    count = await jarCount()
  }
  refreshCount()

  // Recipe handed over by the bookmarklet, if any.
  async function handleImportHash() {
    const imported = consumeImportHash()
    if (!imported) return
    recipe = imported
    const existing = await findBySource(imported.sourceUrl)
    savedId = existing?.id ?? null
    view = 'recipe'
  }
  handleImportHash()

  async function getRecipe(e: Event) {
    e.preventDefault()
    const target = url.trim()
    if (!target) return
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
        throw new Error('No recipe found on that page.')
      }
      recipe = parsed
      const existing = await findBySource(target)
      savedId = existing?.id ?? null
      view = 'recipe'
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
    errorMsg = ''
    view = 'recipe'
  }

  async function handleCreate(r: Recipe) {
    recipe = r
    savedId = await saveRecipe(r)
    await refreshCount()
    view = 'recipe'
  }

  function goHome() {
    view = 'home'
    errorMsg = ''
  }

  function tryDemo() {
    recipe = demoRecipe
    savedId = null // demo has no sourceUrl, so it's always shown as savable
    errorMsg = ''
    view = 'recipe'
  }
</script>

<main>
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
      <button class="navlink" class:active={view === 'jar'} onclick={() => { errorMsg = ''; view = 'jar' }}>
        My Jar{count > 0 ? ` (${count})` : ''}
      </button>
    </nav>
  </header>

  {#if errorMsg && view !== 'home'}
    <p class="error" role="alert" style="text-align:center">{errorMsg}</p>
  {/if}

  {#if view === 'home'}
    <section class="hero">
      <h1>Just the recipe.<br />Yours to keep.</h1>
      <p class="sub">
        Paste a recipe link. Get a clean card: ingredients and steps, nothing else.
        No account, no ads, free forever.
      </p>
      <form class="fetchbar" onsubmit={getRecipe}>
        <input
          type="url"
          bind:value={url}
          placeholder="https://any-recipe-site.com/…"
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
            This site may block fetching. <button class="linklike" onclick={() => (view = 'import')}>Use the bookmarklet →</button>
          {/if}
        </p>
      {/if}
      <p class="hint">
        Works with most recipe sites, in any language. Your recipes never touch a server.<br />
        <button class="linklike" onclick={() => (view = 'add')}>Type in one of your own</button>
        &nbsp;·&nbsp;
        <button class="linklike" onclick={() => (view = 'import')}>Recipe from a blocked site?</button>
      </p>
    </section>
  {:else if view === 'recipe' && recipe}
    <RecipeView {recipe} {savedId} onsave={handleSave} onremove={handleRemove} onback={goHome} />
  {:else if view === 'jar'}
    <JarView onopen={openSaved} onchanged={refreshCount} />
    <p class="jar-footer">
      <button class="linklike" onclick={() => (view = 'add')}>+ Add your own recipe</button>
    </p>
  {:else if view === 'add'}
    <ManualEntry oncreate={handleCreate} onback={goHome} />
  {:else if view === 'import'}
    <ImportHelp onback={goHome} ontypein={() => (view = 'add')} />
  {/if}

  <footer>
    Free forever · No account · Your recipes stay on your device ·
    <span class="mono">a birthday gift, July 13 2026</span>
  </footer>
</main>
