# Observability

Recipe Jar's promise is that **your recipes never leave your device**. Observability
here is built to keep that promise: it collects only the minimum needed to keep the
app working, and nothing that identifies a person or reveals what they cook.

## What is (and isn't) collected

| Source | Sent | **Never** sent |
| --- | --- | --- |
| Parse failure (`/api/report`) | the page **hostname** (e.g. `example.com`), a coarse reason (`no-recipe`), app version | the URL path/query, recipe content, any cookie or ID |
| Uncaught app error (`/api/report`) | error message + source file:line (our own scripts only), app version | recipe content, personal data |
| Traffic (Cloudflare Web Analytics) | aggregate page views / referrers, edge-side | no cookies, no fingerprinting, no cross-site tracking |

The client (`src/lib/telemetry.ts`):

- **honours Do-Not-Track and Global Privacy Control** — if either is set, nothing is sent;
- **never runs on localhost / `.local`** (so development and e2e are silent);
- is **rate-limited** to 12 events per session and de-duplicates identical events;
- uses `navigator.sendBeacon` (fire-and-forget) and **can never throw** into the app.

The server (`functions/api/report.ts`) **stores nothing**. It validates the beacon is
small and came from our own pages (`_caller.ts`), then writes a single structured log
line and returns `204`. There is no database and no retention beyond Cloudflare's normal
request logs.

## Viewing the reports

Parse failures and errors are emitted as JSON log lines tagged `recipe-jar-report`:

```bash
npx wrangler pages deployment tail --project-name recipe-jar --format=pretty | grep recipe-jar-report
```

Example line:

```json
{"t":"recipe-jar-report","kind":"parse-fail","host":"somefoodblog.com","reason":"no-recipe","version":"rj-1.0.0"}
```

A cluster of the same `host` is the signal to add a parser rule (JSON-LD variant or a
site-specific microdata quirk) for that site.

## Enabling Cloudflare Web Analytics (traffic)

Privacy-first, cookieless, no code change required:

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics**.
2. **Add a site** → choose the `recipe-jar` Pages project (or the custom domain).
3. Enable **automatic setup** — Cloudflare injects the beacon at the edge; nothing to
   commit. (If you prefer manual, paste the `<script defer src="…beacon.min.js" …>` snippet
   into `index.html`, but automatic keeps the repo clean.)

Web Analytics reports page views, top pages, and referrers in aggregate. It does not set
cookies and cannot see recipe content.

## Turning telemetry off entirely

Delete `functions/api/report.ts` and the `initTelemetry()` / `reportParseIssue()` calls
(`src/main.ts`, `src/App.svelte`). The app works identically without them.
