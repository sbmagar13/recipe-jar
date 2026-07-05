<script lang="ts">
  import { allRecipes, matchesQuery, removeRecipe, type SavedRecipe } from '../db'

  interface Props {
    onopen: (entry: SavedRecipe) => void
    onchanged: () => void
  }

  let { onopen, onchanged }: Props = $props()

  async function handleDelete(entry: SavedRecipe) {
    if (!confirm(`Remove "${entry.title}" from your jar?`)) return
    await removeRecipe(entry.id)
    await refresh()
    onchanged()
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
