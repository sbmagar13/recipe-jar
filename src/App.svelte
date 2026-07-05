<script lang="ts">
  import type { Recipe } from './lib/types'
  import { parseRecipeFromHtml } from './lib/parse'
  import { formatQty } from './lib/quantity'

  type Status = 'idle' | 'loading' | 'error'

  let url = $state('')
  let status = $state<Status>('idle')
  let errorMsg = $state('')
  let recipe = $state<Recipe | null>(null)
  let servings = $state(4)
  let baseServings = $state(4)
  let checked = $state<Set<number>>(new Set())

  const factor = $derived(baseServings > 0 ? servings / baseServings : 1)

  async function getRecipe(e: Event) {
    e.preventDefault()
    const target = url.trim()
    if (!target) return
    status = 'loading'
    errorMsg = ''
    recipe = null
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Could not fetch that page' }))
        throw new Error(body.error ?? 'Could not fetch that page')
      }
      const html = await res.text()
      const parsed = parseRecipeFromHtml(html, target)
      if (!parsed) {
        throw new Error(
          'No recipe data found on that page. Some sites hide recipes from fetchers; the upcoming bookmarklet will handle those.'
        )
      }
      recipe = parsed
      baseServings = parsed.servings ?? 4
      servings = baseServings
      checked = new Set()
      status = 'idle'
    } catch (err) {
      status = 'error'
      errorMsg = err instanceof Error ? err.message : 'Something went wrong'
    }
  }

  function toggleIngredient(i: number) {
    const next = new Set(checked)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    checked = next
  }

  function scaledLine(ing: Recipe['ingredients'][number]): string {
    if (ing.qty === null) return ing.raw
    const q = formatQty(ing.qty * factor)
    const end = ing.qtyEnd !== null ? `–${formatQty(ing.qtyEnd * factor)}` : ''
    return `${q}${end} ${ing.rest}`
  }

  function reset() {
    recipe = null
    url = ''
    status = 'idle'
    errorMsg = ''
  }
</script>

<main>
  <header class="top">
    <button class="brand" onclick={reset} aria-label="Recipe Jar home">
      <svg width="28" height="32" viewBox="0 0 64 72" aria-hidden="true">
        <rect x="18" y="6" width="28" height="8" rx="2" fill="var(--basil)" />
        <path d="M16 18 Q12 24 12 32 V58 Q12 66 20 66 H44 Q52 66 52 58 V32 Q52 24 48 18 Z" fill="none" stroke="var(--basil)" stroke-width="4" />
        <line x1="20" y1="34" x2="44" y2="34" stroke="var(--tomato)" stroke-width="3" stroke-linecap="round" />
        <line x1="20" y1="46" x2="40" y2="46" stroke="var(--basil)" stroke-width="3" stroke-linecap="round" opacity="0.5" />
      </svg>
      <span>Recipe Jar</span>
    </button>
  </header>

  {#if !recipe}
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
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Fetching…' : 'Get the recipe'}
        </button>
      </form>
      {#if status === 'error'}
        <p class="error" role="alert">{errorMsg}</p>
      {/if}
      <p class="hint">Works with most recipe sites, in any language. Your recipes never touch a server.</p>
    </section>
  {:else}
    <article class="card">
      {#if recipe.image}
        <img class="photo" src={recipe.image} alt={recipe.title} loading="lazy" />
      {/if}
      <div class="card-body">
        <h2>{recipe.title}</h2>
        {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}
        <div class="meta">
          {#if recipe.totalTime}<span>⏱ {recipe.totalTime}</span>{/if}
          {#if recipe.author}<span>by {recipe.author}</span>{/if}
          <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
        </div>

        <div class="servings" role="group" aria-label="Servings">
          <button onclick={() => (servings = Math.max(1, servings - 1))} aria-label="Fewer servings">−</button>
          <span>{servings} {servings === 1 ? 'serving' : 'servings'}</span>
          <button onclick={() => (servings = servings + 1)} aria-label="More servings">+</button>
          {#if servings !== baseServings}
            <button class="reset-servings" onclick={() => (servings = baseServings)}>reset</button>
          {/if}
        </div>

        <div class="columns">
          <section aria-label="Ingredients">
            <h3>Ingredients</h3>
            <ul class="ingredients">
              {#each recipe.ingredients as ing, i}
                <li class:done={checked.has(i)}>
                  <label>
                    <input type="checkbox" checked={checked.has(i)} onchange={() => toggleIngredient(i)} />
                    <span>{scaledLine(ing)}</span>
                  </label>
                </li>
              {/each}
            </ul>
          </section>
          <section aria-label="Steps">
            <h3>Method</h3>
            <ol class="steps">
              {#each recipe.steps as step}
                <li>{step}</li>
              {/each}
            </ol>
          </section>
        </div>

        <button class="again" onclick={reset}>← Another recipe</button>
      </div>
    </article>
  {/if}

  <footer>
    Free forever · No account · Your recipes stay on your device ·
    <span class="mono">a birthday gift, July 13 2026</span>
  </footer>
</main>
