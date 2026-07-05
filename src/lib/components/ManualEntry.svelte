<script lang="ts">
  import type { Recipe } from '../types'
  import { parseIngredientLine } from '../quantity'

  interface Props {
    oncreate: (recipe: Recipe) => void
    onback: () => void
  }

  let { oncreate, onback }: Props = $props()

  let title = $state('')
  let servingsText = $state('4')
  let ingredientsText = $state('')
  let stepsText = $state('')

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
  <h1 class="jar-title">Add your own recipe</h1>
  <p class="sub">For the family recipes that live in your head or on paper. Kept on this device, like everything else.</p>
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
