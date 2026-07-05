<script lang="ts">
  import type { Recipe } from '../types'
  import { formatQty } from '../quantity'

  interface Props {
    recipe: Recipe
    savedId: number | null
    onsave: () => void
    onremove: () => void
    onback: () => void
  }

  let { recipe, savedId, onsave, onremove, onback }: Props = $props()

  let baseServings = $derived(recipe.servings ?? 4)
  let servings = $state(0)
  let checked = $state<Set<number>>(new Set())

  // Reset per-recipe state whenever a different recipe is shown
  $effect(() => {
    void recipe
    servings = recipe.servings ?? 4
    checked = new Set()
  })

  const factor = $derived(baseServings > 0 && servings > 0 ? servings / baseServings : 1)

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
</script>

<article class="card">
  {#if recipe.image}
    <img class="photo" src={recipe.image} alt={recipe.title} loading="lazy" />
  {/if}
  <div class="card-body">
    <div class="card-actions">
      {#if savedId === null}
        <button class="save" onclick={onsave}>+ Save to my jar</button>
      {:else}
        <span class="saved-badge">✓ In your jar</span>
        <button class="remove" onclick={onremove}>Remove</button>
      {/if}
    </div>
    <h2>{recipe.title}</h2>
    {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}
    <div class="meta">
      {#if recipe.totalTime}<span>⏱ {recipe.totalTime}</span>{/if}
      {#if recipe.author}<span>by {recipe.author}</span>{/if}
      {#if recipe.sourceUrl}
        <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
      {:else}
        <span>your own recipe</span>
      {/if}
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

    <button class="again" onclick={onback}>← Back</button>
  </div>
</article>
