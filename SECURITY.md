# Security Policy

Recipe Jar is deliberately small and stores no user data on any server, so the
blast radius of most issues is small — but the parts that do touch the network
(the fetch proxy) and the content we render (parsed recipe HTML) matter, and we
take reports seriously.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report privately, either way:

- Use GitHub's **[private vulnerability reporting](https://github.com/sbmagar13/recipe-jar/security/advisories/new)**
  (Security → Report a vulnerability), or
- email **sbmagar.sbm99@gmail.com** with the details.

Please include:

- What you found and where (file, endpoint, or URL).
- Steps to reproduce, or a proof of concept.
- The impact you think it has.

You can expect an acknowledgement within a few days. We'll confirm the issue,
work on a fix, and credit you in the release notes if you'd like. Please give us
a reasonable window to ship a fix before disclosing publicly.

## What's most worth looking at

- **The proxy** (`functions/api/proxy.ts`, `functions/api/_caller.ts`) — SSRF is
  the headline risk. It already refuses internal/loopback targets, checks the
  request originated from our own app, and restricts responses to HTML. Bypasses
  of any of those are in scope.
- **Rendering parsed content** (`src/lib/parse.ts` → `RecipeView`) — recipe text
  comes from arbitrary third-party pages. Anything that could turn that into
  script execution (XSS) is in scope.
- **The telemetry sink** (`functions/api/report.ts`) — it should never persist or
  leak anything that identifies a user. If it can, that's a bug.

## Out of scope

- Denial-of-service against the free hosting tier.
- Findings that require a compromised device or browser.
- Reports about third-party recipe sites themselves.

## A note on user data

There is no account system and no server-side copy of anyone's recipes — they
live only in each visitor's browser (IndexedDB). There is no user database to
breach. Backups are files the user chooses to create and keep.
