<script lang="ts">
  import { allRecipes, type SavedRecipe } from '../db'
  import { mergeShoppingItems } from '../mergelist'
  import { mergedHeader } from '../shoplist'
  import ShoppingList from './ShoppingList.svelte'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

  const PLAN_KEY = 'recipe-jar:shopplan'
  const TICKS_PREFIX = 'recipe-jar:shop:plan:'

  let entries = $state<SavedRecipe[]>([])
  let loaded = $state(false)
  // recipe id → servings to shop for
  let picked = $state<Map<number, number>>(new Map())
  let listOpen = $state(false)

  // Remember the plan across visits: mid-week you add one recipe and remake
  // the list without re-picking the others.
  function loadPlan(validIds: Set<number>) {
    try {
      const raw = localStorage.getItem(PLAN_KEY)
      if (!raw) return
      const pairs = JSON.parse(raw) as Array<[number, number]>
      picked = new Map(pairs.filter(([id, s]) => validIds.has(id) && Number.isFinite(s) && s > 0))
    } catch {
      /* a broken plan just starts empty */
    }
  }

  function persistPlan() {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify([...picked]))
    } catch {
      /* storage full or locked: the plan just won't survive a reload */
    }
  }

  $effect(() => {
    allRecipes().then((all) => {
      entries = all
      loadPlan(new Set(all.map((e) => e.id)))
      loaded = true
    })
  })

  function baseServings(e: SavedRecipe): number {
    return e.recipe.servings ?? 4
  }

  function toggle(e: SavedRecipe) {
    const next = new Map(picked)
    if (next.has(e.id)) next.delete(e.id)
    else next.set(e.id, baseServings(e))
    picked = next
    persistPlan()
  }

  function bump(id: number, delta: number) {
    const next = new Map(picked)
    const cur = next.get(id) ?? 1
    next.set(id, Math.min(99, Math.max(1, cur + delta)))
    picked = next
    persistPlan()
  }

  const chosen = $derived(entries.filter((e) => picked.has(e.id)))

  const items = $derived(
    mergeShoppingItems(
      chosen.map((e) => ({
        title: e.title,
        baseServings: baseServings(e),
        servings: picked.get(e.id) ?? baseServings(e),
        ingredients: e.recipe.ingredients,
      })),
    ),
  )

  // Ticks are index-based, so the storage key pins this exact plan: change the
  // plan and the list starts clean instead of ticking the wrong items.
  const ticksKey = $derived(
    TICKS_PREFIX +
      [...picked.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, s]) => `${id}x${s}`)
        .join('.'),
  )

  function makeList() {
    // Sweep tick sets left behind by earlier plans.
    try {
      const dead: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(TICKS_PREFIX) && k !== ticksKey) dead.push(k)
      }
      dead.forEach((k) => localStorage.removeItem(k))
    } catch {
      /* sweeping is best-effort */
    }
    listOpen = true
  }

  const subtitle = $derived.by(() => {
    const names = chosen.map((e) => e.title)
    const shown = names.slice(0, 3).join(' · ')
    return names.length > 3 ? `${shown} +${names.length - 3} more` : shown
  })
</script>

{#if listOpen}
  <ShoppingList
    title={`${chosen.length} ${chosen.length === 1 ? 'recipe' : 'recipes'}`}
    {subtitle}
    shareHeader={mergedHeader(chosen.map((e) => e.title))}
    {items}
    storageKey={ticksKey}
    backLabel="← Back to recipes"
    onclose={() => (listOpen = false)}
  />
{:else}
  <section class="shopplan">
    <h1 class="jar-title">Shopping list</h1>
    <p class="sub">
      Pick what you plan to cook. The same ingredient across recipes merges into one line, scaled to
      your servings.
    </p>

    {#if loaded && entries.length === 0}
      <p class="jar-empty">
        Your jar is empty. Save a recipe or two first, then plan your shopping here.
      </p>
      <button class="again" onclick={onback}>← Back</button>
    {:else}
      <ul class="plan-list">
        {#each entries as e (e.id)}
          <li class:on={picked.has(e.id)}>
            <label class="plan-pick">
              <input type="checkbox" checked={picked.has(e.id)} onchange={() => toggle(e)} />
              <span class="plan-name">{e.title}</span>
            </label>
            {#if picked.has(e.id)}
              <span class="plan-servings">
                <button onclick={() => bump(e.id, -1)} aria-label={`Fewer servings of ${e.title}`}>−</button>
                <b aria-label={`Servings of ${e.title}`}>{picked.get(e.id)}</b>
                <button onclick={() => bump(e.id, 1)} aria-label={`More servings of ${e.title}`}>+</button>
              </span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="plan-actions">
        <button class="save" onclick={makeList} disabled={picked.size === 0}>
          🛒 Make the list{picked.size > 0 ? ` (${picked.size})` : ''}
        </button>
        <button class="again" onclick={onback}>← Back to my jar</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .shopplan .sub {
    color: var(--muted, #7a7368);
    margin-bottom: 18px;
  }
  .plan-list {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .plan-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 10px;
    background: var(--card, #fff);
  }
  .plan-list li.on {
    border-color: var(--basil, #33663d);
  }
  .plan-pick {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    min-width: 0;
    flex: 1;
  }
  .plan-pick input {
    width: 18px;
    height: 18px;
    accent-color: var(--basil, #33663d);
    flex-shrink: 0;
  }
  .plan-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plan-servings {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .plan-servings b {
    min-width: 1.6em;
    text-align: center;
  }
  .plan-servings button {
    width: 28px;
    height: 28px;
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 8px;
    background: var(--card, #fff);
    color: var(--ink, #2b2b2b);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .plan-servings button:hover {
    border-color: var(--basil, #33663d);
  }
  .plan-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
</style>
