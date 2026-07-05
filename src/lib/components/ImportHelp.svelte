<script lang="ts">
  import { bookmarkletCode } from '../bookmarklet'

  interface Props {
    onback: () => void
    ontypein: () => void
  }

  let { onback, ontypein }: Props = $props()

  // In dev this is localhost; in production it bakes in recipejar.app.
  const origin = location.origin
  const code = bookmarkletCode(origin)
</script>

<section class="import-help">
  <h1 class="jar-title">Recipes from blocked sites</h1>
  <p class="sub">
    A few big sites (NYT Cooking, AllRecipes, Serious Eats) block anyone from fetching
    their pages. So instead, grab the recipe from inside your own browser, where they
    can't block you. Drag this button to your bookmarks bar:
  </p>

  <p class="bm-wrap">
    <a class="bm-button" href={code} onclick={(e) => e.preventDefault()}>🫙 Save to Recipe Jar</a>
  </p>

  <ol class="import-steps">
    <li>Drag the green button above onto your browser's bookmarks bar.</li>
    <li>Open any recipe page, even one that failed here.</li>
    <li>Click the <strong>Save to Recipe Jar</strong> bookmark. The recipe opens here, ready to keep.</li>
  </ol>

  <p class="hint">
    On a phone, or don't have a bookmarks bar? Copy the recipe text and
    <button class="linklike" onclick={ontypein}>paste it to auto-fill</button>,
    then fix anything that looks off. A one-tap phone version is coming with the installable app.
  </p>

  <button class="again" onclick={onback}>← Back</button>
</section>
