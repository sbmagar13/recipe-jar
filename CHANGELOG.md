# Changelog

All notable changes to Recipe Jar are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Recipes whose instructions arrive as one numbered text blob no longer show
  doubled step numbers ("1. 1. Prep…"). Markdown headings inside the text
  ("### Using Dried Beans") now render as proper section dividers, stray bold
  markers are removed, and sloppy time formats like "P1H" display as "1 h".
  More fallout from the Recipeland report. ([#9])

## [1.4.1] - 2026-07-11

### Fixed

- Some sites (like Recipeland) publish recipe data whose ingredient list has no
  amounts, so recipes imported with "olive oil" instead of "2 tablespoons olive
  oil". The save-a-recipe button (bookmarklet) now also reads the ingredient
  list you actually see on the page, and the app uses whichever list has real
  amounts. If you added the button to your bookmarks before, drag it in again
  to get the smarter version. ([#9])

[#9]: https://github.com/sbmagar13/recipe-jar/issues/9

## [1.4.0] - 2026-07-11

### Added

- **Bookmarkable recipes and real Back/Forward.** Each saved recipe now has its
  own link (like `#/r/12`), so you can bookmark it, reload without losing your
  place, and use the browser's Back and Forward buttons to move between screens.
  My Jar and About are directly linkable too. It all lives in the URL fragment,
  so nothing is sent to a server.

## [1.3.1] - 2026-07-10

### Fixed

- Tapping a finished timer now only stops its alarm; it no longer restarts the
  timer by accident. Use the reset button (↺) to clear it back to the start.

## [1.3.0] - 2026-07-10

### Added

- **Timer reset.** Every running or finished step timer now has a small reset
  button (↺) that clears it back to the start, for when you begin one too early.

### Changed

- **A finished timer keeps alerting** until you come back to it, instead of one
  short beep that is easy to miss once you have stepped away. It sounds a gentle
  alarm every couple of seconds; tapping the timer, hitting reset, or moving
  between steps in cook mode stops it.

## [1.2.1] - 2026-07-10

### Fixed

- On narrow phones, the recipe action buttons (Save, Share, Shopping list, Cook)
  now wrap onto a second row instead of overflowing. The Cook button no longer
  gets pushed out of view once the shopping list button is present.

## [1.2.0] - 2026-07-10

### Added

- **Shopping list.** Turn any recipe into a checkable shopping list, scaled to
  the servings you picked. Tick off what you already have, then copy or share
  what is left. Ticks are remembered per saved recipe.

### Changed

- Project contact email is now `sagar@sagarbudhathoki.com` (About page, security
  policy, and code of conduct).
- Persistent storage is now requested from your first save rather than on every
  cold boot, so browsers that prompt for it no longer ask on each visit. My Jar
  shows whether your recipes are protected from automatic cleanup, with a button
  to ask for it.

## [1.1.2] - 2026-07-10

### Changed

- Small copy polish across the paste screen, share toast, and About page.

## [1.1.1] - 2026-07-09

### Added

- Search-engine basics: a real `robots.txt` and `sitemap.xml`, `WebApplication`
  structured data (JSON-LD), and a no-JavaScript content fallback so crawlers and
  no-JS visitors get real text and a heading.

### Changed

- Keyword-focused, dash-free page title and meta description, so the landing page
  targets what people actually search (recipe keeper, no account, no ads, offline).

### Fixed

- Corrected the maker's location in the About page (Kathmandu, Nepal).

## [1.1.0] - 2026-07-09

### Added

- **Cross-step timer tray in cook mode.** Every timer running on a step you are
  not currently looking at now shows in a strip at the top of cook mode, so a few
  timers going at once for different parts of the dish never get lost. Tap one to
  jump straight to its step.
- **In-app "What's new" note.** After the app updates, returning cooks see a
  short, once-per-release summary of what changed, so new features do not go
  unnoticed. Brand-new visitors never see it.
- **Version shown in the app.** The About page now displays the running version,
  single-sourced from `package.json` and injected at build time.

### Changed

- **Scripted, gated release process** (`scripts/release.mjs` + `RELEASING.md`): a
  version bump, changelog stamp, git tag, and GitHub release in one command, only
  after typecheck, unit tests, build, and the size budget all pass.

## [1.0.0] - 2026-07-08

The first public release. Everything below ships on day one.

### Added

- **Paste a link → clean recipe card.** Reads the structured recipe data
  (`schema.org/Recipe` JSON-LD) most sites publish, with a microdata fallback.
  Works across languages.
- **Unlimited saved recipes**, kept on-device in IndexedDB. No account, no limit.
- **Serving scaler** with real fraction- and decimal-aware quantity math.
- **Type in your own** recipes, or paste free text and auto-fill the fields.
- **Bookmarklet path** for sites that block server fetching (NYT Cooking,
  AllRecipes, Serious Eats, …), running in the reader's own browser.
- **Backup & restore** the whole jar as a single JSON file, or as copyable text.
- **Offline-first PWA**: installable, works with no network, prints a clean card,
  and prompts when a new version is available.
- **Share a recipe** as a self-contained link, plus an Android share target.
- **Cook superpowers**: tap-to-start step timers with an alarm, a full-screen
  focus cook mode (swipe/keyboard, auto screen-wake-lock), personal notes, an
  "I cooked this" counter, and **tags** with a jar filter.
- **Privacy by architecture**: no user database; recipes never leave the device.
  Optional telemetry reports only a failing page's hostname and honors DNT/GPC.

### Security

- Hardened fetch proxy: caller verification, SSRF guards, HTML-only responses,
  and edge caching.

[Unreleased]: https://github.com/sbmagar13/recipe-jar/compare/v1.4.1...HEAD
[1.4.1]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.4.1
[1.4.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.4.0
[1.3.1]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.3.1
[1.3.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.3.0
[1.2.1]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.2.1
[1.2.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.2.0
[1.1.2]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.1.2
[1.1.1]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.1.1
[1.1.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.1.0
[1.0.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.0.0
