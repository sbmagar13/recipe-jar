<script lang="ts">
  import { allRecipes, type SavedRecipe } from '../db'
  import { mergeShoppingItems } from '../mergelist'
  import { mergedHeader } from '../shoplist'
  import { PLAN_KEY, WEEKDAYS_KEY, dayLabel, orderedDays, readPairs } from '../weekplan'
  import ShoppingList from './ShoppingList.svelte'
  import { countEvent } from '../telemetry'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

  const TICKS_PREFIX = 'recipe-jar:shop:plan:'
  const today = new Date().getDay()

  let entries = $state<SavedRecipe[]>([])
  let loaded = $state(false)
  // recipe id → servings to shop for
  let picked = $state<Map<number, number>>(new Map())
  // recipe id → weekday (JS getDay), for the "which night is this" plan
  let days = $state<Map<number, number>>(new Map())
  let listOpen = $state(false)

  // Remember the plan across visits: mid-week you add one recipe and remake
  // the list without re-picking the others.
  function loadPlan(validIds: Set<number>) {
    picked = new Map(
      readPairs(PLAN_KEY).filter(([id, s]) => validIds.has(id) && Number.isFinite(s) && s > 0),
    )
    days = new Map(
      readPairs(WEEKDAYS_KEY).filter(([id, d]) => validIds.has(id) && Number.isInteger(d) && d >= 0 && d <= 6),
    )
  }

  function persistPlan() {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify([...picked]))
      localStorage.setItem(WEEKDAYS_KEY, JSON.stringify([...days]))
    } catch {
      /* storage full or locked: the plan just won't survive a reload */
    }
  }

  function setDay(id: number, value: string) {
    const next = new Map(days)
    if (value === '') next.delete(id)
    else {
      next.set(id, Number(value))
      countEvent('plan-day')
    }
    days = next
    persistPlan()
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
    if (next.has(e.id)) {
      next.delete(e.id)
      // Unpicking a dish also takes it off its night.
      const nd = new Map(days)
      nd.delete(e.id)
      days = nd
    } else {
      next.set(e.id, baseServings(e))
    }
    picked = next
    persistPlan()
  }

  // The week at a glance: only days that have a dish, today first.
  const week = $derived(
    orderedDays(today)
      .map((d) => ({
        day: d,
        names: entries.filter((e) => picked.has(e.id) && days.get(e.id) === d).map((e) => e.title),
      }))
      .filter((w) => w.names.length > 0),
  )

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
              <select
                class="plan-day"
                aria-label={`Which day for ${e.title}`}
                value={days.has(e.id) ? String(days.get(e.id)) : ''}
                onchange={(ev) => setDay(e.id, ev.currentTarget.value)}
              >
                <option value="">Any day</option>
                {#each orderedDays(today) as d (d)}
                  <option value={String(d)}>{dayLabel(d, today)}</option>
                {/each}
              </select>
            {/if}
          </li>
        {/each}
      </ul>

      {#if week.length > 0}
        <div class="plan-week" role="group" aria-label="Your week">
          {#each week as w (w.day)}
            <p class="plan-week-day">
              <b class:today={w.day === today}>{dayLabel(w.day, today)}</b>
              <span>{w.names.join(', ')}</span>
            </p>
          {/each}
        </div>
      {/if}

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
  .plan-day {
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 8px;
    background: var(--card, #fff);
    color: var(--ink, #2b2b2b);
    font: inherit;
    font-size: 0.85rem;
    padding: 4px 6px;
    flex-shrink: 0;
  }
  .plan-week {
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 10px;
    background: var(--card, #fff);
    padding: 12px 16px;
    margin: 0 0 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .plan-week-day {
    margin: 0;
    font-size: 0.9rem;
    display: flex;
    gap: 10px;
  }
  .plan-week-day b {
    min-width: 5.5em;
    color: var(--accent-ink, #275231);
  }
  .plan-week-day b.today {
    color: var(--tomato, #b8402e);
  }
  .plan-week-day span {
    color: var(--ink, #2b2b2b);
  }
</style>
