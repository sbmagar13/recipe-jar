<script lang="ts">
  import type { Recipe } from '../types'
  import { formatQty } from '../quantity'
  import { recipeShareUrl } from '../share'
  import { extractStepTimers, formatClock } from '../timers'
  import ShoppingList from './ShoppingList.svelte'

  interface Props {
    recipe: Recipe
    savedId: number | null
    notes?: string
    cookedCount?: number
    lastCooked?: number | null
    tags?: string[]
    onsave: () => void
    onremove: () => void
    onback: () => void
    onsavenotes?: (notes: string) => void
    oncooked?: () => void
    onsavetags?: (tags: string[]) => void
  }

  let {
    recipe,
    savedId,
    notes = '',
    cookedCount = 0,
    lastCooked = null,
    tags = [],
    onsave,
    onremove,
    onback,
    onsavenotes = () => {},
    oncooked = () => {},
    onsavetags = () => {},
  }: Props = $props()

  let baseServings = $derived(recipe.servings ?? 4)
  let servings = $state(0)
  let checked = $state<Set<number>>(new Set())
  let imageOk = $state(true)
  let showShopping = $state(false)

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
    alarming = {}
    cooking = false
    showShopping = false
    stepIndex = 0
    noteDirty = false
    noteSaved = false
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

  // Ingredient lines, scaled to the chosen servings, for the shopping list.
  const shoppingItems = $derived(recipe.ingredients.map(scaledLine))

  // --- Step timers: turn "simmer 20 minutes" into a tappable kitchen timer ---
  const stepTimers = $derived(recipe.steps.map((s) => extractStepTimers(s)))
  type TimerState = { remaining: number; running: boolean; done: boolean }
  let timers = $state<Record<string, TimerState>>({})
  let audioCtx: AudioContext | null = null

  // Keys of finished timers still sounding their alarm, each with a countdown of
  // how many more beeps to give before we stop (so a left-open tab can't ring
  // forever). A finished timer keeps gently alerting until you tap it or move
  // steps, so a single short beep missed while you stepped away doesn't leave
  // the pot going.
  let alarming = $state<Record<string, number>>({})
  const ALARM_BEEPS = 48 // ~2 minutes at one alert every 2.5s

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

  function silenceAlarm(key: string) {
    if (!(key in alarming)) return
    const { [key]: _drop, ...rest } = alarming
    alarming = rest
  }

  function silenceAllAlarms() {
    if (Object.keys(alarming).length > 0) alarming = {}
  }

  function toggleTimer(key: string, seconds: number) {
    ensureAudio()
    silenceAlarm(key) // tapping a ringing timer stops its alarm
    const cur = timers[key]
    if (!cur || cur.done) {
      timers = { ...timers, [key]: { remaining: seconds, running: true, done: false } }
    } else {
      timers = { ...timers, [key]: { ...cur, running: !cur.running } }
    }
  }

  // Clear a timer back to its untouched "⏱ label" state, for when you start one
  // too early or just want it gone.
  function resetTimer(key: string) {
    silenceAlarm(key)
    if (!(key in timers)) return
    const { [key]: _drop, ...rest } = timers
    timers = rest
  }

  // One ticker drives every timer. Reads/writes happen in the callback (not the
  // effect's sync body), so this effect sets up once and isn't re-run each tick.
  $effect(() => {
    const id = setInterval(() => {
      let changed = false
      const next: Record<string, TimerState> = { ...timers }
      const justFinished: string[] = []
      for (const k in next) {
        const t = next[k]
        if (t.running && t.remaining > 0) {
          const remaining = t.remaining - 1
          next[k] = { remaining, running: remaining > 0, done: remaining === 0 }
          if (remaining === 0) justFinished.push(k)
          changed = true
        }
      }
      if (changed) timers = next
      if (justFinished.length > 0) {
        fireAlarm() // the first alert, right as it finishes
        const nextAlarming = { ...alarming }
        for (const k of justFinished) nextAlarming[k] = ALARM_BEEPS
        alarming = nextAlarming
      }
    }, 1000)
    return () => clearInterval(id)
  })

  // Keep a finished timer gently alarming until it's acknowledged: one alert
  // every 2.5s, each ring counting down so a forgotten tab won't ring forever.
  $effect(() => {
    const id = setInterval(() => {
      const keys = Object.keys(alarming)
      if (keys.length === 0) return
      fireAlarm()
      const next: Record<string, number> = {}
      for (const k of keys) {
        const left = alarming[k] - 1
        if (left > 0) next[k] = left
      }
      alarming = next
    }, 2500)
    return () => clearInterval(id)
  })

  // --- Focus cook mode: one big step at a time, hands-free at the stove ---
  let cooking = $state(false)
  let stepIndex = $state(0)
  let showCookIngredients = $state(false)
  let lockFromCook = false

  function startCooking() {
    ensureAudio() // unlock audio on this gesture so step timers can beep
    stepIndex = 0
    showCookIngredients = false
    cooking = true
    if (wakeLockSupported && !awake) {
      lockFromCook = true
      acquireLock()
    }
  }

  function stopCooking() {
    silenceAllAlarms()
    cooking = false
    if (lockFromCook) {
      lockFromCook = false
      if (awake) toggleAwake()
    }
  }

  function nextStep() {
    silenceAllAlarms() // moving on counts as "I've got it"
    if (stepIndex < recipe.steps.length - 1) stepIndex++
    else stopCooking()
  }

  function prevStep() {
    silenceAllAlarms()
    if (stepIndex > 0) stepIndex--
  }

  // Jump straight to a step — e.g. tapping a background timer in the cook tray.
  function goToStep(i: number) {
    silenceAllAlarms()
    if (i >= 0 && i < recipe.steps.length) stepIndex = i
  }

  // Every timer still going on a step you're not currently looking at. Drives the
  // always-visible tray in cook mode, so a timer set on an earlier step can't get
  // lost when you move on. Tapping one jumps back to its step.
  type ActiveTimer = { key: string; stepIndex: number; label: string; state: TimerState }
  const bgTimers = $derived<ActiveTimer[]>(
    Object.entries(timers)
      .flatMap(([key, state]) => {
        const [i, j] = key.split('-').map(Number)
        const meta = stepTimers[i]?.[j]
        return meta && i !== stepIndex ? [{ key, stepIndex: i, label: meta.label, state }] : []
      })
      .sort((a, b) => a.stepIndex - b.stepIndex || a.key.localeCompare(b.key))
  )

  // Arrow keys / space / Escape while cooking (desktop + keyboards).
  $effect(() => {
    if (!cooking) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      } else if (e.key === 'Escape') {
        stopCooking()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Swipe left/right to move between steps (touch).
  let touchX = 0
  function onTouchStart(e: TouchEvent) {
    touchX = e.changedTouches[0].clientX
  }
  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX
    if (Math.abs(dx) > 60) {
      if (dx < 0) nextStep()
      else prevStep()
    }
  }

  // --- Personal notes + "I cooked this" (only for saved recipes) ---
  let noteText = $state('')
  let noteDirty = $state(false)
  let noteSaved = $state(false)
  let noteTimer: ReturnType<typeof setTimeout> | undefined

  // Pull the saved note in, unless the user is mid-edit (don't clobber typing).
  $effect(() => {
    if (!noteDirty) noteText = notes
  })

  function persistNote() {
    onsavenotes(noteText.trim())
    noteDirty = false
    noteSaved = true
  }

  function onNoteInput() {
    noteDirty = true
    noteSaved = false
    clearTimeout(noteTimer)
    noteTimer = setTimeout(persistNote, 800)
  }

  function onNoteBlur() {
    clearTimeout(noteTimer)
    if (noteDirty) persistNote()
  }

  function fmtCookedDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // --- Tags ---
  let tagInput = $state('')

  function normalizeTag(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30)
  }

  function addTag() {
    const t = normalizeTag(tagInput)
    if (t && !tags.includes(t)) onsavetags([...tags, t])
    tagInput = ''
  }

  function removeTag(tag: string) {
    onsavetags(tags.filter((x) => x !== tag))
  }

  function onTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

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
      shareMsg = 'Link copied. Send it to anyone.'
    } catch {
      shareMsg = 'Could not copy the link.'
    }
    clearTimeout(shareMsgTimer)
    shareMsgTimer = setTimeout(() => (shareMsg = ''), 4000)
  }
</script>

{#snippet timerChip(i: number, j: number, t: { label: string; seconds: number })}
  {@const key = `${i}-${j}`}
  <span class="timer-chip-group">
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
    {#if timers[key]}
      <button
        class="timer-reset"
        onclick={() => resetTimer(key)}
        aria-label={`Reset ${t.label} timer`}
        title="Reset timer"
      >
        ↺
      </button>
    {/if}
  </span>
{/snippet}

<article class="card" class:cooking>
  {#if recipe.image && imageOk && !cooking}
    <img class="photo" src={recipe.image} alt={recipe.title} loading="lazy" onerror={() => (imageOk = false)} />
  {/if}
  <div class="card-body">
    {#if cooking}
      <div class="cook" role="group" aria-label="Cooking steps, swipe left or right to move" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
        <div class="cook-top">
          <h1 class="cook-title">{recipe.title}</h1>
          <button class="cook-exit" onclick={stopCooking} aria-label="Exit cook mode">✕</button>
        </div>
        <div class="cook-progress" aria-hidden="true">
          <div class="cook-progress-fill" style="width:{((stepIndex + 1) / recipe.steps.length) * 100}%"></div>
        </div>
        <p class="cook-counter">Step {stepIndex + 1} of {recipe.steps.length}</p>
        {#if bgTimers.length > 0}
          <div class="cook-tray" role="group" aria-label="Timers running on other steps">
            {#each bgTimers as at (at.key)}
              <button
                class="tray-timer"
                class:running={at.state.running}
                class:paused={!at.state.running && !at.state.done}
                class:done={at.state.done}
                onclick={() => goToStep(at.stepIndex)}
                aria-label={at.state.done
                  ? `Step ${at.stepIndex + 1} timer finished. Go to step ${at.stepIndex + 1}`
                  : at.state.running
                    ? `Step ${at.stepIndex + 1} timer, ${formatClock(at.state.remaining)} remaining. Go to step ${at.stepIndex + 1}`
                    : `Step ${at.stepIndex + 1} timer paused, ${formatClock(at.state.remaining)} remaining. Go to step ${at.stepIndex + 1}`}
              >
                <span class="tray-step">Step {at.stepIndex + 1}</span>
                <span class="tray-time">{at.state.done ? '✓' : formatClock(at.state.remaining)}</span>
              </button>
            {/each}
          </div>
        {/if}
        <p class="cook-step">{recipe.steps[stepIndex]}</p>
        {#if stepTimers[stepIndex].length > 0}
          <div class="cook-timers">
            {#each stepTimers[stepIndex] as t, j (j)}
              {@render timerChip(stepIndex, j, t)}
            {/each}
          </div>
        {/if}
        {#if recipe.ingredients.length > 0}
          <button
            class="cook-ing-toggle"
            onclick={() => (showCookIngredients = !showCookIngredients)}
            aria-expanded={showCookIngredients}
          >
            {showCookIngredients ? 'Hide ingredients' : 'Show ingredients'}
          </button>
          {#if showCookIngredients}
            <ul class="cook-ingredients">
              {#each recipe.ingredients as ing}
                <li>{scaledLine(ing)}</li>
              {/each}
            </ul>
          {/if}
        {/if}
        <div class="cook-nav">
          <button class="cook-prev" onclick={prevStep} disabled={stepIndex === 0}>◀ Back</button>
          {#if stepIndex < recipe.steps.length - 1}
            <button class="cook-next" onclick={nextStep}>Next ▶</button>
          {:else}
            <button class="cook-next cook-finish" onclick={stopCooking}>✓ Done</button>
          {/if}
        </div>
      </div>
    {:else if showShopping}
      <ShoppingList
        title={recipe.title}
        {servings}
        items={shoppingItems}
        storageKey={savedId !== null ? `recipe-jar:shop:${savedId}` : null}
        onclose={() => (showShopping = false)}
      />
    {:else}
      <div class="card-actions">
        {#if savedId === null}
          <button class="save" onclick={onsave}>+ Save to my jar</button>
        {:else}
          <span class="saved-badge">✓ In your jar</span>
          <button class="remove" onclick={onremove}>Remove</button>
        {/if}
        <button class="share" onclick={shareRecipe}>↗ Share</button>
        {#if recipe.ingredients.length > 0}
          <button class="shop-open" onclick={() => (showShopping = true)}>🛒 Shopping list</button>
        {/if}
        {#if recipe.steps.length > 0}
          <button class="cook-start" onclick={startCooking}>▶ Cook</button>
        {/if}
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

      {#if savedId !== null}
        <div class="cooked-row">
          <button class="cooked-btn" onclick={oncooked}>🍳 I cooked this</button>
          {#if cookedCount > 0}
            <span class="cooked-stat">
              Cooked {cookedCount} {cookedCount === 1 ? 'time' : 'times'}{lastCooked
                ? ` · last ${fmtCookedDate(lastCooked)}`
                : ''}
            </span>
          {/if}
        </div>

        <div class="tags-edit">
          {#each tags as tag (tag)}
            <span class="tag-chip">
              #{tag}
              <button class="tag-remove" onclick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>✕</button>
            </span>
          {/each}
          <input
            class="tag-input"
            bind:value={tagInput}
            onkeydown={onTagKey}
            onblur={addTag}
            placeholder={tags.length ? 'Add tag…' : 'Tag it (vegan, quick, dinner)…'}
            aria-label="Add a tag"
            autocapitalize="none"
            autocorrect="off"
          />
        </div>
      {/if}

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
                    {@render timerChip(i, j, t)}
                  {/each}
                </li>
              {/each}
            </ol>
          {:else}
            <p class="section-empty">No steps were found. The <a href={recipe.sourceUrl || '#'} target="_blank" rel="noopener noreferrer">source</a> has the full method.</p>
          {/if}
        </section>
      </div>

      {#if savedId !== null}
        <section class="notes" aria-label="Your notes">
          <h2>Your notes</h2>
          <textarea
            class="notes-input"
            bind:value={noteText}
            oninput={onNoteInput}
            onblur={onNoteBlur}
            rows="3"
            aria-label="Your notes for this recipe"
            placeholder="Tweaks, swaps, what worked… kept on this device."
          ></textarea>
          {#if noteSaved}<span class="notes-saved" role="status">Saved ✓</span>{/if}
        </section>
      {/if}

      <button class="again" onclick={onback}>← Back</button>
    {/if}
  </div>
</article>
