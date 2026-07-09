# Releasing Recipe Jar

Recipe Jar ships as a static PWA on Cloudflare Pages. There is no server to roll
out, so a "release" is three things: a versioned build on the CDN, a written
record of what changed, and a nudge that lets existing users pick up the new
version. This doc is the whole process.

## Versioning

`package.json` `version` is the single source of truth. Vite injects it at build
time as `__APP_VERSION__` (see `vite.config.ts`), which surfaces as `APP_VERSION`
in `src/lib/site.ts`, on the About page, and as the key for the in-app "What's
new" note. Never hand-edit the version anywhere else.

We follow [Semantic Versioning](https://semver.org):

- **patch** (`1.1.0 → 1.1.1`): fixes, copy, no new capability.
- **minor** (`1.1.0 → 1.2.0`): a new, backward-compatible feature.
- **major** (`1.1.0 → 2.0.0`): a change that breaks an existing behaviour, data
  format, or import.

## Before you cut a release

1. Land all the changes on `main` with a clean working tree.
2. Record them under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md), in
   [Keep a Changelog](https://keepachangelog.com) style (`Added`, `Changed`,
   `Fixed`, `Security`). This is the developer-facing record and becomes the
   GitHub release notes verbatim.
3. If users should *notice* something, add a short, friendly, once-per-release
   bullet to `WHATS_NEW` in [`src/lib/whatsnew.ts`](src/lib/whatsnew.ts), keyed by
   the exact version you are about to ship. Keep it to plain language: "here is
   what you can now do." Not every release needs one (a security fix or copy tweak
   usually does not).

## Cutting the release

Dry-run first. It runs every quality gate and shows you the exact version,
release notes, and file changes, then reverts the working tree without committing
anything:

```sh
node scripts/release.mjs minor --dry-run
```

When it looks right, cut it for real:

```sh
node scripts/release.mjs minor      # or: patch | major | an explicit x.y.z
```

The script refuses to run unless you are on `main` with a clean tree, then:

1. Runs the gates: `check` (typecheck), `test:unit`, `build`, `size` (bundle
   budget). Any failure aborts before a single file is touched.
2. Bumps `package.json`.
3. Stamps `CHANGELOG.md`: `[Unreleased]` becomes `[x.y.z] - <date>`, a fresh empty
   `[Unreleased]` is left behind, and the link references are updated.
4. Commits `Release vx.y.z`, creates an annotated tag, and pushes both.
5. Publishes a GitHub release with that version's changelog section as the notes.

## What happens after the push

- **Deploy**: Cloudflare Pages builds `main` and deploys to `recipejar.app`. A
  failed build never deploys, so the release gates plus Cloudflare's build are the
  production gate. (End-to-end tests run in CI on the same push.)
- **Delivery to users**: the PWA service worker is `registerType: 'prompt'`, so an
  open app shows a "A new version is ready — Refresh" banner rather than reloading
  mid-recipe. After they refresh onto the new version, returning cooks see the
  once-per-release "What's new" note (`src/lib/components/WhatsNew.svelte`);
  brand-new visitors never do.
- **Verify**: `.github/workflows/prod-smoke.yml` smoke-tests the live site every
  six hours. To check immediately, load `recipejar.app`, hard-refresh, and confirm
  the About page shows the new version.

## If something is wrong

Static hosting makes rollback cheap: in the Cloudflare Pages dashboard, promote
the previous deployment back to production. Then fix forward with a new patch
release rather than rewriting tags that are already public.
