# Contributing to Recipe Jar

Thanks for being here. Recipe Jar is a small, honest tool — a recipe link goes
in, a clean card comes out, and it's kept on the reader's own device. Keeping it
that way (fast, private, no account, no bloat) is the main design constraint, so
the best contributions are usually small and sharp.

## The single most useful thing you can do

**Fix a site that doesn't import.** Most recipe pages publish structured recipe
data for Google, and Recipe Jar reads it — but every so often a site does
something odd and the parse fails. Teaching the parser one new trick helps
everyone who cooks from that site. There's a step-by-step guide below.

If you don't write code, [**report the site**](https://github.com/sbmagar13/recipe-jar/issues/new?template=parser-gap.yml)
and that's genuinely a big help.

## Getting set up

You'll need Node 20+ and npm.

```bash
git clone https://github.com/sbmagar13/recipe-jar
cd recipe-jar
npm install
npm run dev        # http://localhost:5199
```

The commands you'll use:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run check` | Type-check (svelte-check + tsc) — must pass |
| `npm run test:unit` | Vitest unit tests (parser, quantities, proxy guard) |
| `npm run size` | Gzipped bundle-size budget (run after `build`) |
| `npx playwright test` | End-to-end tests across Chromium, WebKit, and mobile |
| `npx tsx scripts/test-parse.ts` | Run the parser over every fixture in `fixtures/` |

Before you open a PR, these should be green: `npm run check`,
`npm run test:unit`, `npm run build && npm run size`, and
`npx playwright test --project=chromium`.

To understand how the pieces fit together, read
**[ARCHITECTURE.md](ARCHITECTURE.md)** first — it's short.

## How to add support for a new recipe site

1. **Capture the page.** Save the recipe page's HTML into `fixtures/` with a
   descriptive name, e.g. `fixtures/mysite-curry.html`. (View source, or
   `curl -A "Mozilla/5.0" "<url>" -o fixtures/mysite-curry.html`.)

2. **See what the parser makes of it.**

   ```bash
   npx tsx scripts/test-parse.ts
   ```

   It runs `parseRecipeFromHtml` over every fixture and prints what parsed.

3. **Diagnose.** The parser (`src/lib/parse.ts`) tries two things, in order:
   - **JSON-LD** (`<script type="application/ld+json">` with a `schema.org/Recipe`
     node) — `extractJsonLdBlocks` → `findRecipeNode` → `blocksToRecipe`.
   - **Microdata** (`itemprop="..."` attributes) as a fallback — `parseMicrodata`.

   Open the fixture and search for `application/ld+json`. If it's there but the
   parse failed, the site is probably nesting the recipe unusually (inside
   `@graph`, an array, or a non-standard field). If there's no JSON-LD at all,
   the microdata fallback is your path.

4. **Make the smallest fix that works.** Add the case to the relevant helper.
   The parser deliberately runs **without a DOM** (it's plain string/regex work
   so it's tiny and runs anywhere), so keep new logic in that style.

5. **Lock it in with a test.** Add or extend a unit test under `test/` that
   loads your fixture and asserts the fields you care about (title, a couple of
   ingredients, step count). This stops a future change from silently breaking
   your site again.

6. **Check the budget.** `npm run build && npm run size` — the parser is on the
   critical path, so we keep it lean.

## Conventions

- **TypeScript, strict.** No `any` unless there's truly no alternative.
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`). Match the
  style of the file you're editing.
- **Comments explain _why_,** not what. The code says what.
- **No new runtime dependencies** without discussing it first — bundle size is a
  feature. (Dev dependencies are more flexible.)
- **Accessibility is not optional.** The axe audit (`e2e/a11y.spec.ts`) must stay
  green; new UI needs labels, focus states, and keyboard support.
- **Privacy is not optional.** Nothing about a user's recipes may leave their
  device. If a change would send data anywhere, it needs to be opt-in and
  documented in [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

## Opening a pull request

- Branch from `main`, keep the PR focused on one thing.
- Describe **what** changed and **why**. Link the issue it closes.
- Make sure the checks above pass locally; CI runs them all on the PR too.
- Screenshots or a short clip help a lot for UI changes.

There's no CLA and no ceremony. By contributing you agree your work is released
under the project's [MIT license](LICENSE), and that you'll follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

Not sure about something? Open a [Discussion](https://github.com/sbmagar13/recipe-jar/discussions)
or a draft PR and ask. Thank you for helping keep good recipes free.
