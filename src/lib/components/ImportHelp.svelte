<script lang="ts">
  import { bookmarkletCode } from '../bookmarklet'

  interface Props {
    onback: () => void
    ontypein: () => void
  }

  let { onback, ontypein }: Props = $props()

  // Always the canonical home (or localhost in dev), so imports land in one jar.
  const code = bookmarkletCode()
</script>

<section class="import-help">
  <h1 class="jar-title">Recipes from blocked sites</h1>
  <p class="sub">
    A few big sites (NYT Cooking, AllRecipes, Serious Eats) block anyone from fetching
    their pages. So instead, grab the recipe from inside your own browser, where they
    can't block you. Drag this button to your bookmarks bar:
  </p>

  <p class="bm-wrap">
    <!-- The link text becomes the bookmark's name, so keep it short: a long name
         truncates in the bookmarks bar, and the emoji stands in for a favicon
         (browsers won't attach icons to javascript: bookmarks). -->
    <a class="bm-button" href={code} onclick={(e) => e.preventDefault()}>🫙 Recipe Jar</a>
  </p>

  <ol class="import-steps">
    <li>Drag the green button above onto your browser's bookmarks bar.</li>
    <li>Open any recipe page, even one that failed here.</li>
    <li>Click the <strong>🫙 Recipe Jar</strong> bookmark. The recipe opens here, ready to keep.</li>
  </ol>

  <figure class="bm-demo">
    <!-- Served from our own origin: no third-party embed, nothing loads until play. -->
    <video
      src="/bookmarklet-demo.mp4"
      poster="/bookmarklet-demo-poster.jpg"
      controls
      muted
      playsinline
      preload="none"
      aria-label="Silent half-minute demo: the Save to Recipe Jar button is dragged to the bookmarks bar, a blocked recipe page is opened, and clicking the bookmark imports it as a clean card"
    ></video>
    <figcaption>The whole flow, half a minute start to finish.</figcaption>
  </figure>

  <p class="hint">
    Want the bookmark to show the real jar icon? Bookmark this page normally first
    (the browser fetches our icon), then edit that bookmark and replace its address
    with the button's code (right-click the green button, copy link). The icon stays.
    Thanks to a launch-day Redditor for this trick.
  </p>

  <p class="hint">
    On a phone, or don't have a bookmarks bar? Copy the recipe text and
    <button class="linklike" onclick={ontypein}>paste it to auto-fill</button>,
    then fix anything that looks off. A one-tap phone version is coming with the installable app.
  </p>

  <button class="again" onclick={onback}>← Back</button>
</section>
