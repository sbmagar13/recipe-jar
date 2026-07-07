# Architecture

Recipe Jar is a **local-first single-page app**. Almost everything runs in the
browser; the only server-side code is one small stateless proxy. This document
is the map — read it before making a change so you know where it belongs.

## The shape of it

```
 ┌─────────────────────────────────────────────────────────────┐
 │  Browser (the whole app)                                     │
 │                                                              │
 │   paste a URL ──▶ fetch /api/proxy ──▶ HTML                  │
 │                                         │                    │
 │                                         ▼                    │
 │                                   parse.ts ──▶ Recipe        │
 │                                         │                    │
 │                    RecipeView ◀─────────┤                    │
 │                         │               ▼                    │
 │                    "Save" ──────▶  Dexie / IndexedDB         │
 │                                    (your jar, on-device)     │
 └──────────────────────────────┬──────────────────────────────┘
                                 │ (only for fetching a page)
                                 ▼
              Cloudflare Pages Function: /api/proxy
              (stateless: fetch the page, hand back HTML, store nothing)
```

There is **no application database**. A user's recipes live in their own
browser's IndexedDB and are never uploaded. "Free forever" is a property of this
architecture, not a pricing promise: static hosting + on-device storage costs
nothing per user.

## Client modules (`src/lib/`)

| Module | Responsibility |
|---|---|
| `parse.ts` | Turn page HTML into a `Recipe`. JSON-LD first, microdata fallback. **No DOM** — pure string/regex, so it's tiny and runs anywhere. |
| `types.ts` | The `Recipe` and `Ingredient` shapes everything agrees on. |
| `quantity.ts` | Parse ingredient lines ("2 cups red lentils") and do fraction/decimal-aware serving math. |
| `textparse.ts` | Best-effort split of pasted free text into title / ingredients / steps (the manual-entry auto-fill). |
| `timers.ts` | Extract cook durations from step text ("simmer 20 min") into tappable timers. |
| `db.ts` | The jar: Dexie/IndexedDB wrapper. Save, search, tags, notes, cook stats, and JSON backup/restore. |
| `share.ts` | Encode/decode a whole recipe into a shareable `#recipe=` link (base64url), and the Web Share glue. |
| `bookmarklet.ts` | The in-browser bookmarklet path for sites that block server fetching, via a `#import=` hash. |
| `telemetry.ts` | Optional, privacy-respecting signal: only a failing page's **hostname** and our own errors. Honors DNT/GPC. |
| `pwa.svelte.ts` | Service-worker update prompt state (offline install + "new version" nudge). |
| `site.ts` | Site-wide constants (contact address, repo URL, legal date). |

UI lives in `src/lib/components/` (`RecipeView`, `JarView`, `ManualEntry`,
`ImportHelp`, `AboutView`, `InstallTip`, `UpdatePrompt`), composed by
`src/App.svelte`, which also owns view routing wired into browser history.

## The parsing pipeline (`parse.ts`)

`parseRecipeFromHtml(html, sourceUrl)` is the entry point:

1. `extractJsonLdBlocks` pulls every `<script type="application/ld+json">` block.
2. `findRecipeNode` walks each block (including `@graph` and arrays) for a node
   whose `@type` is `Recipe`.
3. `blocksToRecipe` maps that node to our `Recipe` (title, ingredients via
   `quantity.ts`, steps via `extractSteps`, times via `humanDuration`, etc.).
4. If no JSON-LD recipe is found, `parseMicrodata` reads `itemprop` attributes as
   a fallback.

Adding a new site almost always means teaching one of those helpers a new shape.
See [CONTRIBUTING.md](CONTRIBUTING.md#how-to-add-support-for-a-new-recipe-site).

## The server-side piece (`functions/`)

Cloudflare Pages Functions. Files prefixed with `_` are shared helpers, not
routes.

- `api/proxy.ts` — fetches the page the user asked for and returns its HTML.
  It exists because many sites block cross-origin browser fetches. It is
  **hardened**: `_caller.ts` checks the request really came from our own app
  (`Sec-Fetch-Site` + Referer/Origin), an SSRF guard (`isBlockedHost`) refuses
  internal/loopback targets, a content-type allowlist keeps it to HTML, and
  successful fetches are edge-cached (`caches.default`). It stores nothing.
- `api/report.ts` — the telemetry sink. Storage-less; it accepts the coarse
  signal from `telemetry.ts` and drops it (or logs it), never persisting user
  data. See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

## Storage & offline

- **Jar:** Dexie over IndexedDB (`db.ts`). Non-indexed fields (notes, tags, cook
  stats) don't need a schema version bump. Backups are a single JSON file the
  user keeps; restore merges without ever deleting.
- **Offline:** vite-plugin-pwa / Workbox precaches the app shell so it loads and
  works with no network. Updates use a **prompt** flow (`pwa.svelte.ts` +
  `UpdatePrompt.svelte`) so a stale service worker can't silently pin an old build.

## Testing layers

| Layer | Where | What it guards |
|---|---|---|
| Unit | `test/` (Vitest) | Parser correctness, quantity math, proxy guards |
| Fixtures | `fixtures/` + `scripts/test-parse.ts` | Real-world pages keep parsing |
| E2E | `e2e/` (Playwright, 4 engines) | User flows on Chromium, WebKit, Android, iPhone |
| A11y | `e2e/a11y.spec.ts` (axe) | WCAG 2 A/AA on every view |
| Size | `scripts/size-budget.mjs` | Gzipped bundle stays within budget |

## Build & deploy

Vite builds a static `dist/`. Cloudflare Pages serves it and runs the Functions.
CI (`.github/workflows/ci.yml`) runs check → unit → build → size → a11y/e2e on
every push and PR, and auto-deploys `main`. See [docs/CI.md](docs/CI.md).
Anyone can run their own copy — see the [Self-host](README.md#self-host) section.
