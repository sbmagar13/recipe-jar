<script lang="ts">
  import { allRecipes, type SavedRecipe } from '../db'
  import { rankByPantry } from '../pantry'
  import { countEvent } from '../telemetry'

  interface Props {
    onopen: (entry: SavedRecipe) => void
    onback: () => void
  }
  let { onopen, onback }: Props = $props()

  const PANTRY_KEY = 'recipe-jar:pantry'

  let entries = $state<SavedRecipe[]>([])
  let loaded = $state(false)
  let terms = $state<string[]>([])
  let input = $state('')

  $effect(() => {
    allRecipes().then((all) => {
      entries = all
      loaded = true
    })
    try {
      const raw = localStorage.getItem(PANTRY_KEY)
      const v = raw ? (JSON.parse(raw) as unknown) : []
      if (Array.isArray(v)) terms = v.filter((t): t is string => typeof t === 'string').slice(0, 40)
    } catch {
      /* an unreadable pantry just starts empty */
    }
  })

  function persist() {
    try {
      localStorage.setItem(PANTRY_KEY, JSON.stringify(terms))
    } catch {
      /* storage full: the pantry just won't survive a reload */
    }
  }

  async function addTerm() {
    let t = input.trim().toLowerCase().replace(/,+$/, '')
    input = ''
    if (t.length < 2 || terms.includes(t)) return
    // A term the whole jar has never heard of gets one shot at the jar's own
    // vocabulary ("panner" finds their paneer), same as jar search.
    const anywhere = entries.some((e) => e.recipe.ingredients.some((i) => i.raw.toLowerCase().includes(t)))
    if (!anywhere && t.length >= 4) {
      try {
        const m = await import('../spellfix')
        const vocab = entries.flatMap((e) => e.recipe.ingredients.map((i) => i.raw))
        const alt = m.correctToVocab(t, vocab)
        if (alt !== t && entries.some((e) => e.recipe.ingredients.some((i) => i.raw.toLowerCase().includes(alt)))) {
          t = alt
        }
      } catch {
        /* no correction, the term stays as typed */
      }
    }
    if (!terms.includes(t)) {
      terms = [...terms, t]
      persist()
      countEvent('pantry')
    }
  }

  function removeTerm(t: string) {
    terms = terms.filter((x) => x !== t)
    persist()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      void addTerm()
    }
  }

  const matches = $derived(rankByPantry(entries, terms))
</script>

<section class="pantry">
  <h1 class="jar-title">What can I cook?</h1>
  <p class="sub">Name what's at home. Your jar answers with what those things can become.</p>

  <div class="pantry-entry">
    <input
      class="jar-search"
      type="text"
      bind:value={input}
      onkeydown={onKey}
      placeholder="an ingredient, then Enter… (paneer, rice, eggs)"
      aria-label="Add a pantry ingredient"
    />
    <button class="pantry-add" onclick={() => void addTerm()} disabled={input.trim().length < 2}>Add</button>
  </div>

  {#if terms.length > 0}
    <div class="pantry-chips" role="group" aria-label="Your pantry">
      {#each terms as t (t)}
        <button class="pantry-chip" onclick={() => removeTerm(t)} aria-label={`Remove ${t}`}>{t} ✕</button>
      {/each}
    </div>
  {/if}

  {#if loaded && entries.length === 0}
    <p class="jar-empty">Your jar is empty. Save a few recipes first, then ask it what to cook.</p>
  {:else if terms.length === 0}
    <p class="jar-empty">Add an ingredient or two above to see what your jar can make of them.</p>
  {:else if matches.length === 0}
    <p class="jar-empty">Nothing in your jar uses those yet. Try broader words, or go shopping 🛒</p>
  {:else}
    <ul class="pantry-list">
      {#each matches as m (m.entry.id)}
        <li>
          <button class="pantry-hit" onclick={() => onopen(m.entry)}>
            <span class="pantry-title">{m.entry.title}</span>
            <span class="pantry-cover">you have {m.matchedLines} of {m.totalLines}</span>
            <span class="pantry-terms">
              {#each m.matchedTerms as t (t)}<i>{t}</i>{/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="plan-actions"><button class="again" onclick={onback}>← Back to my jar</button></p>
</section>

<style>
  .pantry .sub {
    color: var(--muted, #7a7368);
    margin-bottom: 18px;
  }
  .pantry-entry {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
  .pantry-entry input {
    flex: 1;
  }
  .pantry-add {
    background: var(--basil, #33663d);
    color: #fdfbf4;
    border: none;
    border-radius: 10px;
    padding: 0 18px;
    font-weight: 600;
    cursor: pointer;
  }
  .pantry-add:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .pantry-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
  }
  .pantry-chip {
    background: var(--card, #fff);
    border: 1.5px solid var(--basil, #33663d);
    color: var(--accent-ink, #275231);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .pantry-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pantry-hit {
    width: 100%;
    text-align: left;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    padding: 12px 14px;
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 10px;
    background: var(--card, #fff);
    color: var(--ink, #2b2b2b);
    cursor: pointer;
  }
  .pantry-hit:hover {
    border-color: var(--basil, #33663d);
  }
  .pantry-title {
    font-weight: 600;
  }
  .pantry-cover {
    color: var(--tomato, #b8402e);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .pantry-terms {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pantry-terms i {
    font-style: normal;
    font-size: 0.78rem;
    color: var(--accent-ink, #275231);
    background: rgba(51, 102, 61, 0.09);
    border-radius: 6px;
    padding: 1px 7px;
  }
</style>
