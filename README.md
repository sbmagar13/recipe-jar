# Recipe Jar

**Just the recipe. Yours to keep.**

[![CI](https://github.com/sbmagar13/recipe-jar/actions/workflows/ci.yml/badge.svg)](https://github.com/sbmagar13/recipe-jar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Local-first](https://img.shields.io/badge/local--first-no%20account-33663d.svg)](#how-its-private-and-free)

Paste a recipe link, or just type a dish, and get a clean card: ingredients and
steps, nothing else. Save as many recipes as you want. They live in your
browser, on your device, not on a server. That is why it is free forever: there
is nothing for anyone to pay for.

No account. No ads. Works offline. Open source.

👉 **[recipejar.app](https://recipejar.app)**

<p align="center">
  <a href="https://recipejar.app"><img src="docs/screenshots/hero.png" width="100%" alt="Recipe Jar: just the recipe, yours to keep. Paste a recipe link or type a dish, and get a clean card with no account and no ads." /></a>
</p>

<p align="center">
  <img src="docs/screenshots/search.png" width="22%" alt="Type a dish like paneer tikka and pick from ranked results with photos, from five real recipe sites" />
  &nbsp;
  <img src="docs/screenshots/card.png" width="22%" alt="A clean recipe card — ingredients and steps, nothing else" />
  &nbsp;
  <img src="docs/screenshots/shop.png" width="22%" alt="One merged shopping list from several recipes — 2 cloves here and 3 there become 7 cloves garlic" />
  &nbsp;
  <img src="docs/screenshots/cook.png" width="22%" alt="Step-by-step cook mode with built-in timers" />
</p>

## Why

Recipe sites buried the food under life stories, pop-ups, and autoplaying video,
and the AI-slop wave in 2025 made it worse. The tools that clean this up then
started capping how many recipes you can save for free. So this is the boring,
honest version: paste a link, get the recipe, keep it. Forever. For nothing.

## What it does

- **Paste any recipe URL** and get a clean card. Works with most recipe sites in
  any language (it reads the structured recipe data sites already publish for
  Google). If a page carries several recipes, you pick the right one.
- **Type a dish instead** — "dal tadka", "chicken curry" — and pick from ranked
  results with photos, searched live across five recipe sites (BBC Good Food,
  RecipeTin Eats, BBC Food, Budget Bytes, Veg Recipes of India) through the same
  proxy, with no API keys and nothing stored.
- **Scale servings** with real quantity math, including fractions and metric decimals.
- **One shopping list for the whole week**: pick several saved recipes and the
  same ingredient adds up across them ("2 cups flour" + "1 cup flour" = "3 cups
  flour"), scaled per recipe. Tick things off in the store, share the rest.
- **Cook mode**: one step at a time, wake lock, and "simmer 20 minutes" becomes
  a tappable timer.
- **Save unlimited recipes** to your own device (IndexedDB). Search them by name
  or ingredient, tag them, add notes, count your cooks.
- **Add from a photo**: snap a printed recipe and on-device OCR fills in the
  fields. The text engine is self-hosted and lazy-loaded; the image never
  leaves your device.
- **Type in your own** family recipes, or paste recipe text and let it auto-fill
  the fields.
- **Share any recipe as a link** — the whole recipe is encoded in the URL, no
  server copy.
- **Blocked sites** (NYT Cooking, AllRecipes, Serious Eats) that block fetching:
  use the one-click bookmarklet that runs in your own browser.
- **Back up the whole jar** to a single file, or copy it as text. Restore either way.
- **Works offline** as an installable app, and prints a clean recipe card.

## How it's private and free

There is no backend. No accounts, no database, no analytics beyond a cookieless
page count. Your recipes never leave your device, which also matters because
recipe PDFs are things people paid for. Static hosting plus on-device storage
costs nothing to run at any number of users, so "free forever" is a promise the
architecture keeps, not a pricing decision that can change.

The only server-side piece is a tiny stateless proxy (a Cloudflare Pages
Function) that fetches a page you ask for, the same way your browser's reader
mode does. It stores nothing.

## Honest comparison

| | Recipe Jar | JustTheRecipe | Copy Me That | Paprika | Recipe blogs |
|---|---|---|---|---|---|
| Free saved recipes | **Unlimited** | 20 | 40 | Paid app | n/a |
| Account required | **No** | For saving | For saving | No | No |
| Ads | **None** | Some | Some | None | Many |
| Works offline | **Yes** | Partial | Partial | Yes | No |
| Your data leaves device | **Never** | Yes | Yes | Syncs | n/a |
| Open source | **Yes** | No | No | No | n/a |
| Price | **Free** | Freemium | Freemium | ~$30 | Free + ads |

Scope, honestly: Recipe Jar keeps recipes. It does not plan meals, count
calories, or socialise. It does one daily chore well.

## Tech

Vite + Svelte + TypeScript, Dexie (IndexedDB), Workbox (offline). Static site on
Cloudflare Pages with Pages Functions for the fetch proxy and a storage-less
telemetry sink. ~75 KB gzipped core; the OCR engine (tesseract.js, self-hosted)
lazy-loads only when someone actually adds a photo. Recipes are parsed from
JSON-LD (`schema.org/Recipe`) with a microdata fallback, and dish search is
just more of the same: per-site adapters parse each site's own search page,
fetched through the proxy, ranked client-side.

## Self-host

Recipe Jar is a static site plus one tiny Cloudflare Pages Function (the fetch
proxy). You can run your own copy on Cloudflare's free tier in a couple of
minutes — there's no database to provision and no secrets required to serve it,
because every visitor's recipes live in their own browser.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sbmagar13/recipe-jar)

Or by hand:

```bash
git clone https://github.com/sbmagar13/recipe-jar
cd recipe-jar
npm install
npm run build
npx wrangler pages deploy dist   # deploys to your own <project>.pages.dev
```

The optional telemetry sink and the CI auto-deploy want the env vars documented
in [docs/CI.md](docs/CI.md) and [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md),
but the app runs perfectly without either.

## Develop

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # production build to dist/
npm run check      # type check
npm run test:unit  # Vitest unit tests (parser, quantity, proxy guard)
npm run size       # gzipped bundle-size budget (run after build)
npx playwright test        # e2e across Chromium, WebKit, and mobile
```

CI (typecheck, unit, build, size budget, and a11y + app e2e) runs on every push
and PR, and auto-deploys `main` to Cloudflare Pages — see [docs/CI.md](docs/CI.md).
Privacy-respecting telemetry is documented in [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

Handy scripts: `scripts/test-parse.ts` (parser over fixtures),
`scripts/check-offline.ts` (offline load against the built app),
`scripts/record-demo.ts` (the demo video), `scripts/make-icons.ts` /
`scripts/make-og.ts` (app icons and the social image).

## Contributing

Contributions are welcome — especially **parser fixes for sites that don't
import cleanly**, which is the single most useful thing you can do.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — dev setup, running the tests, and a
  step-by-step guide to adding support for a new recipe site.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the parser, the proxy, and
  on-device storage fit together, so you know where to make a change.
- **[Report a site that didn't import](https://github.com/sbmagar13/recipe-jar/issues/new?template=parser-gap.yml)** —
  the fastest way to help, even without writing code.
- Found a security issue? See **[SECURITY.md](SECURITY.md)**. Everyone taking
  part agrees to the **[Code of Conduct](CODE_OF_CONDUCT.md)**.

## License

MIT for the code. Recipe content belongs to whoever wrote it; Recipe Jar never
stores or republishes it server-side.

Free and open source, made for everyone who cooks.
