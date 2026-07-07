<script lang="ts">
  import type { Recipe } from '../types'
  import { formatQty } from '../quantity'
  import { recipeShareUrl } from '../share'
  import { extractStepTimers, formatClock } from '../timers'

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
  let imageOk = $state(true)

  // Reset the image guard when the recipe changes.
  $effect(() => {
    void recipe.image
    imageOk = true
  })

  // Reset per-recipe state whenever a different recipe is shown
  $effect(() => {
    void recipe
    servings = recipe.servings ?? 4
    checked = new Set()
    timers = {}
  })

  // Cook mode: keep the screen awake while at the stove.
  const wakeLockSupported = 'wakeLock' in navigator
  let awake = $state(false)
  let sentinel: WakeLockSentinel | null = null

  async function acquireLock() {
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        if (awake) sentinel = null // released by the system; keep intent
      })
      awake = true
    } catch {
      awake = false
    }
  }

  async function toggleAwake() {
    if (awake) {
      awake = false
      await sentinel?.release()
      sentinel = null
    } else {
      await acquireLock()
    }
  }

  // Re-acquire after the tab was hidden (browsers drop the lock on blur).
  function onVisible() {
    if (awake && sentinel === null && document.visibilityState === 'visible') acquireLock()
  }

  $effect(() => {
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
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

  // --- Step timers: turn "simmer 20 minutes" into a tappable kitchen timer ---
  const stepTimers = $derived(recipe.steps.map((s) => extractStepTimers(s)))
  type TimerState = { remaining: number; running: boolean; done: boolean }
  let timers = $state<Record<string, TimerState>>({})
  let audioCtx: AudioContext | null = null

  function ensureAudio() {
    // Must be created/resumed from a user gesture (iOS unlocks audio that way).
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx ??= new Ctor()
      if (audioCtx.state === 'suspended') audioCtx.resume()
    } catch {
      /* no audio; timers still count down visually */
    }
  }

  function fireAlarm() {
    try {
      if (audioCtx) {
        const now = audioCtx.currentTime
        for (let i = 0; i < 3; i++) {
          const o = audioCtx.createOscillator()
          const g = audioCtx.createGain()
          o.type = 'sine'
          o.frequency.value = 880
          o.connect(g)
          g.connect(audioCtx.destination)
          const t = now + i * 0.3
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
          o.start(t)
          o.stop(t + 0.24)
        }
      }
    } catch {
      /* ignore */
    }
    navigator.vibrate?.([200, 100, 200, 100, 200])
  }

  function toggleTimer(key: string, seconds: number) {
    ensureAudio()
    const cur = timers[key]
    if (!cur || cur.done) {
      timers = { ...timers, [key]: { remaining: seconds, running: true, done: false } }
    } else {
      timers = { ...timers, [key]: { ...cur, running: !cur.running } }
    }
  }

  // One ticker drives every timer. Reads/writes happen in the callback (not the
  // effect's sync body), so this effect sets up once and isn't re-run each tick.
  $effect(() => {
    const id = setInterval(() => {
      let changed = false
      const next: Record<string, TimerState> = { ...timers }
      for (const k in next) {
        const t = next[k]
        if (t.running && t.remaining > 0) {
          const remaining = t.remaining - 1
          next[k] = { remaining, running: remaining > 0, done: remaining === 0 }
          if (remaining === 0) fireAlarm()
          changed = true
        }
      }
      if (changed) timers = next
    }, 1000)
    return () => clearInterval(id)
  })

  // Share the whole card as a link (no server: the recipe rides in the hash).
  let shareMsg = $state('')
  let shareMsgTimer: ReturnType<typeof setTimeout> | undefined

  async function shareRecipe() {
    const link = recipeShareUrl(recipe)
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, url: link })
        return
      } catch (err) {
        // User closed the sheet: done. Anything else: fall through to copy.
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      shareMsg = 'Link copied — send it to anyone.'
    } catch {
      shareMsg = 'Could not copy the link.'
    }
    clearTimeout(shareMsgTimer)
    shareMsgTimer = setTimeout(() => (shareMsg = ''), 4000)
  }
</script>

<article class="card">
  {#if recipe.image && imageOk}
    <img class="photo" src={recipe.image} alt={recipe.title} loading="lazy" onerror={() => (imageOk = false)} />
  {/if}
  <div class="card-body">
    <div class="card-actions">
      {#if savedId === null}
        <button class="save" onclick={onsave}>+ Save to my jar</button>
      {:else}
        <span class="saved-badge">✓ In your jar</span>
        <button class="remove" onclick={onremove}>Remove</button>
      {/if}
      <button class="share" onclick={shareRecipe}>↗ Share</button>
      {#if shareMsg}<span class="share-msg" role="status">{shareMsg}</span>{/if}
    </div>
    <h1>{recipe.title}</h1>
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
      {#if wakeLockSupported}
        <button class="cook-toggle" class:on={awake} onclick={toggleAwake} aria-pressed={awake}>
          {awake ? '☀ Screen stays on' : '☾ Keep screen on'}
        </button>
      {/if}
    </div>

    <div class="columns">
      <section aria-label="Ingredients">
        <h2>Ingredients</h2>
        {#if recipe.ingredients.length > 0}
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
        {:else}
          <p class="section-empty">No ingredients were found. Open the source to check.</p>
        {/if}
      </section>
      <section aria-label="Steps">
        <h2>Method</h2>
        {#if recipe.steps.length > 0}
          <ol class="steps">
            {#each recipe.steps as step, i}
              <li>
                <span class="step-text">{step}</span>
                {#each stepTimers[i] as t, j (j)}
                  {@const key = `${i}-${j}`}
                  <button
                    class="timer-chip"
                    class:running={timers[key]?.running}
                    class:paused={timers[key] && !timers[key].running && !timers[key].done}
                    class:done={timers[key]?.done}
                    onclick={() => toggleTimer(key, t.seconds)}
                    aria-label={timers[key]?.done
                      ? `Timer finished for ${t.label}. Restart`
                      : timers[key]?.running
                        ? `Pause timer, ${formatClock(timers[key].remaining)} remaining`
                        : timers[key]
                          ? `Resume timer, ${formatClock(timers[key].remaining)} remaining`
                          : `Start a ${t.label} timer`}
                  >
                    {#if timers[key]?.done}
                      ✓ Done
                    {:else if timers[key]}
                      {timers[key].running ? '⏸' : '▶'} {formatClock(timers[key].remaining)}
                    {:else}
                      ⏱ {t.label}
                    {/if}
                  </button>
                {/each}
              </li>
            {/each}
          </ol>
        {:else}
          <p class="section-empty">No steps were found. The <a href={recipe.sourceUrl || '#'} target="_blank" rel="noopener noreferrer">source</a> has the full method.</p>
        {/if}
      </section>
    </div>

    <button class="again" onclick={onback}>← Back</button>
  </div>
</article>
