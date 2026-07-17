# Changelog

All notable changes to Recipe Jar are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **One shopping list for the whole week.** In My Jar, tap "Plan a shopping
  list", pick the recipes you are cooking, and get a single merged list. The
  same ingredient adds up across recipes ("2 cups flour" plus "1 cup flour"
  becomes "3 cups flour"), each recipe scales to the servings you choose, and
  prep notes drop away so the list reads like something you would take to the
  store. Different units are never converted, they stay as separate lines, so
  the list never guesses. Tick off what you already have and copy or share the
  rest, like the single-recipe list. Your picks are remembered, so adding one
  more recipe mid-week does not mean starting over. ([#13])

## [1.5.1] - 2026-07-14

### Added

- **A photo shortcut on the home screen.** "Add from a photo" now sits next to
  "Type in one of your own" on the home screen, so you can go straight from a
  photo to a filled-in form without opening the add page first.

### Changed

- Cleaner results when reading a recipe from a photo. Ratings, badges, and
  "save" or "share" buttons are stripped out instead of turning into
  ingredients. The photo tip also points you to pasting the link when the recipe
  is a website, which imports far cleaner.

## [1.5.0] - 2026-07-14

### Added

- **Add a recipe from a photo.** The "Add or paste" screen has a new "From a
  photo" button. Snap or upload a printed recipe and it reads the text on your
  device and fills in the fields for you to check. The text engine runs entirely
  in your browser, so nothing is uploaded and there is no account. It downloads
  once on first use (about 6 MB), then works offline. Best on printed or typed
  pages; handwriting, especially cursive, is unreliable. ([#10])

## [1.4.4] - 2026-07-11

### Fixed

- The "What's new" note now reaches people who update several versions at once.
  Before, it only appeared if you landed exactly on the version that introduced
  a feature. So someone jumping straight from an older version to a later patch
  would skip the note entirely. It now falls back to the note for that release
  line, shown once and never repeated.

## [1.4.3] - 2026-07-11

### Changed

- Recipes with sections in their method (like an "Instant Pot Adaptation" or a
  dried-beans variant) now show real section headings on the card, with step
  numbers restarting under each one, the way the source page shows them. Cook
  mode shows the section name above the step and no longer counts section
  markers as steps you swipe past. ([#9])

## [1.4.2] - 2026-07-11

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
[#10]: https://github.com/sbmagar13/recipe-jar/issues/10
[#13]: https://github.com/sbmagar13/recipe-jar/issues/13

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

[Unreleased]: https://github.com/sbmagar13/recipe-jar/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.5.1
[1.5.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.5.0
[1.4.4]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.4.4
[1.4.3]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.4.3
[1.4.2]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.4.2
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
