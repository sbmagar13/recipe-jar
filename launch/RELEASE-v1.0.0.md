# Release notes — v1.0.0 (paste into the GitHub Release on launch day)

Tag: `v1.0.0` · Title: **Recipe Jar 1.0 — just the recipe, yours to keep**

---

Recipe Jar turns any recipe link into a clean card — ingredients and steps,
nothing else — and keeps it on **your** device. No account, no ads, no limits,
free forever. This is the first public release.

**Try it:** https://recipejar.sagarbudhathoki.com · **Self-host it:** [README → Self-host](https://github.com/sbmagar13/recipe-jar#self-host)

## Highlights

- 🔗 **Paste a link → clean recipe card.** Reads the structured recipe data most
  sites already publish (JSON-LD, with a microdata fallback). Works across
  languages.
- 🫙 **Unlimited saves, on your device.** Your jar lives in your browser's own
  storage (IndexedDB). Nothing is ever uploaded — there's no server to upload to.
- ⚖️ **Serving scaler** with real fraction- and decimal-aware quantity math.
- ✍️ **Your own recipes:** type them in, or paste free text and let it auto-fill.
- 🔖 **Bookmarklet** for sites that block fetching (NYT Cooking, AllRecipes,
  Serious Eats) — runs in your own browser, so it always works.
- 📴 **Offline-first PWA:** installable, works with no network, prints a clean
  card, and prompts when a new version is ready.
- 🍳 **Cook mode:** full-screen step-by-step with swipe/keyboard, tap-to-start
  timers parsed from the steps ("simmer 20 min"), and auto keep-screen-on.
- 📝 **Notes, tags, and "I cooked this":** scribble what you changed, tag and
  filter your jar, and keep a cook count per recipe.
- 📤 **Share a recipe** as a self-contained link (the recipe travels *in* the
  link — no server copy), plus an Android share target.
- 💾 **One-file backup & restore** of the whole jar, as a file or copyable text.

## Privacy, by architecture

There is no user database. The only server-side code is a small, hardened,
stateless fetch proxy (caller checks, SSRF guards, HTML-only) and a storage-less
telemetry sink that sees at most a failing page's hostname — and respects
DNT/GPC. Details: [ARCHITECTURE.md](https://github.com/sbmagar13/recipe-jar/blob/main/ARCHITECTURE.md)
and [SECURITY.md](https://github.com/sbmagar13/recipe-jar/blob/main/SECURITY.md).

## Under the hood

Svelte 5 + Vite + TypeScript, Dexie (IndexedDB), Workbox. ~70 KB gzipped.
Tested by 50+ unit tests, Playwright e2e across four browser engines, an axe
WCAG 2 A/AA audit on every view, and a CI-enforced bundle-size budget.

## Contributing

The most useful thing you can do: **report or fix a site that doesn't import.**
There's an [issue form](https://github.com/sbmagar13/recipe-jar/issues/new?template=parser-gap.yml)
for reports and a [step-by-step parser guide](https://github.com/sbmagar13/recipe-jar/blob/main/CONTRIBUTING.md#how-to-add-support-for-a-new-recipe-site)
for fixes.

---

*Free and open source (MIT), made for everyone who cooks.*
