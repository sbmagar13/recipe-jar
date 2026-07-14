<script lang="ts">
  import { onMount } from 'svelte'
  import type { Recipe } from '../types'
  import { parseIngredientLine } from '../quantity'
  import { parseRecipeText } from '../textparse'
  import { imageToText } from '../ocr'

  interface Props {
    oncreate: (recipe: Recipe) => void
    onback: () => void
    // Text handed over from the home-screen photo picker: OCR runs there, and we
    // land here with the fields already filled and ready to review.
    initialText?: string
  }

  let { oncreate, onback, initialText = '' }: Props = $props()

  let title = $state('')
  let servingsText = $state('4')
  let ingredientsText = $state('')
  let stepsText = $state('')

  let pasteText = $state('')
  let pasteFilled = $state(false)

  let ocrBusy = $state(false)
  let ocrPct = $state(0)
  let ocrError = $state('')

  function autofillFromPaste() {
    const parsed = parseRecipeText(pasteText)
    if (parsed.title) title = parsed.title
    if (parsed.servings) servingsText = parsed.servings
    if (parsed.ingredients) ingredientsText = parsed.ingredients
    if (parsed.steps) stepsText = parsed.steps
    pasteFilled = true
  }

  onMount(() => {
    if (initialText.trim()) {
      pasteText = initialText
      autofillFromPaste()
    }
  })

  async function handlePhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // let the same file be picked again after an error
    if (!file) return
    ocrError = ''
    ocrPct = 0
    ocrBusy = true
    try {
      const text = await imageToText(file, (p) => (ocrPct = p))
      if (!text) {
        ocrError = 'No text found. Try a clearer, well-lit photo of a printed recipe.'
        return
      }
      pasteText = text
      autofillFromPaste()
    } catch {
      ocrError = 'Could not read that photo. The first use needs a connection to set up, then it works offline.'
    } finally {
      ocrBusy = false
    }
  }

  function create(e: Event) {
    e.preventDefault()
    const ingredients = ingredientsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((raw) => ({ raw, ...parseIngredientLine(raw) }))
    const steps = stepsText
      .split(/\n{2,}|\n/)
      .map((l) => l.trim().replace(/^\d+[.)]\s*/, ''))
      .filter(Boolean)
    const servings = parseInt(servingsText, 10)
    oncreate({
      title: title.trim() || 'My recipe',
      description: '',
      image: null,
      author: null,
      sourceUrl: '',
      servings: Number.isFinite(servings) && servings > 0 ? servings : null,
      yieldText: servingsText,
      totalTime: null,
      prepTime: null,
      cookTime: null,
      ingredients,
      steps,
    })
  }
</script>

<section class="manual">
  <h1 class="jar-title">Add or paste a recipe</h1>
  <p class="sub">For family recipes, or any page that would not import. Snap a photo or paste the text to auto-fill, then fix anything that looks off. Kept on this device, like everything else.</p>

  <div class="photo-box">
    <label class="photo-btn" class:busy={ocrBusy}>
      {#if ocrBusy}
        <span class="spin" aria-hidden="true"></span> Reading photo… {ocrPct}%
      {:else}
        📷 Add from a photo
      {/if}
      <input type="file" accept="image/*" onchange={handlePhoto} disabled={ocrBusy} hidden />
    </label>
    <small>Best for printed recipes and cookbook pages. For a website, paste the link on the home screen instead: it imports far cleaner. The first photo sets up a text engine once (about 6 MB), then works offline. The image never leaves your device.</small>
    {#if ocrError}<span class="ocr-error" role="alert">{ocrError}</span>{/if}
  </div>

  <div class="paste-box">
    <label>
      Or paste recipe text <small>(we will split it into fields)</small>
      <textarea
        bind:value={pasteText}
        rows="5"
        placeholder="Paste the whole recipe here: title, ingredients, and steps. Then click Auto-fill."
      ></textarea>
    </label>
    <button type="button" class="save" onclick={autofillFromPaste} disabled={!pasteText.trim()}>
      Auto-fill fields ↓
    </button>
    {#if pasteFilled}
      <span class="backup-msg">Filled below. Review and fix anything, then create.</span>
    {/if}
  </div>

  <form onsubmit={create} class="manual-form">
    <label>
      Recipe name
      <input type="text" bind:value={title} placeholder="Mum's dal" required />
    </label>
    <label>
      Servings
      <input type="number" bind:value={servingsText} min="1" inputmode="numeric" />
    </label>
    <label>
      Ingredients <small>(one per line, quantities first: "2 cups red lentils")</small>
      <textarea bind:value={ingredientsText} rows="8" required placeholder="2 cups red lentils&#10;1 tsp turmeric&#10;½ tsp cumin seeds"></textarea>
    </label>
    <label>
      Steps <small>(one per line)</small>
      <textarea bind:value={stepsText} rows="8" required placeholder="Rinse the lentils.&#10;Boil with turmeric for 20 minutes.&#10;Temper the cumin in ghee and pour over."></textarea>
    </label>
    <div class="manual-actions">
      <button type="submit" class="save">Create recipe</button>
      <button type="button" class="again" onclick={onback}>Cancel</button>
    </div>
  </form>
</section>

<style>
  .photo-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 18px;
  }
  .photo-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: flex-start;
    padding: 10px 16px;
    border: 1px solid var(--line, #d8d2c4);
    border-radius: 10px;
    background: var(--card, #fff);
    color: var(--ink, #2b2b2b);
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .photo-btn:hover:not(.busy) {
    border-color: var(--basil, #33663d);
    background: var(--card-hover, #faf8f2);
  }
  .photo-btn.busy {
    cursor: progress;
    opacity: 0.85;
  }
  .photo-box small {
    color: var(--muted, #7a7368);
    line-height: 1.45;
  }
  .ocr-error {
    color: #b3402a;
    font-size: 0.85rem;
  }
  .spin {
    width: 14px;
    height: 14px;
    border: 2px solid var(--muted, #7a7368);
    border-top-color: transparent;
    border-radius: 50%;
    animation: ocr-spin 0.7s linear infinite;
  }
  @keyframes ocr-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
