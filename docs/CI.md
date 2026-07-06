# CI / CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`.

## What runs

| Step | Command | Gate |
| --- | --- | --- |
| Typecheck | `npm run check` | svelte-check + tsc, 0 errors |
| Unit tests | `npm run test:unit` | Vitest (parser, quantity, textparse, proxy caller) |
| Build | `npm run build` | production Vite + PWA build |
| Size budget | `npm run size` | entry JS ≤ 70 KB gz, CSS ≤ 10 KB gz, all ≤ 80 KB gz |
| E2E | `npx playwright test --project=chromium --grep-invert "@network"` | app flows + axe a11y |

### The `@network` tag

E2E tests that fetch a live third-party site (e.g. koket.se, bbcgoodfood.com through the
proxy) have `@network` in their title. CI skips them with `--grep-invert "@network"` so the
pipeline never goes red because someone else's site was slow or down. Run the full set
locally with `npx playwright test` before a release.

## Deploy

The `deploy` job runs **only on push to `main`, after `test` passes**. It builds and
publishes to Cloudflare Pages with `wrangler pages deploy dist --project-name=recipe-jar`.

### Required GitHub secrets

Set these under **repo → Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → **My Profile → API Tokens → Create Token**. Use a custom token with **Account → Cloudflare Pages → Edit** permission (scope it to the account only). |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any domain/Workers & Pages overview → **Account ID** in the right sidebar. |

Until both secrets are set the `deploy` job will fail, but `test` still runs on every push
and PR. The manual deploy path (`npx wrangler pages deploy dist --project-name=recipe-jar
--branch=main`) keeps working regardless.

## Running the same checks locally

```bash
npm run check && npm run test:unit && npm run build && npm run size
npx playwright test --project=chromium --grep-invert "@network"
```
