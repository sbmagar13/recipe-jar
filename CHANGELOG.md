# Changelog

All notable changes to Recipe Jar are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-08

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

[1.0.0]: https://github.com/sbmagar13/recipe-jar/releases/tag/v1.0.0
