# Distribution playbook — going wide

Every channel worth posting to, with timing, the community's rules, and
ready-to-paste copy. LinkedIn/Facebook/Instagram deliberately excluded.
Core posts (HN, r/InternetIsBeautiful, WhatsApp, video caption) live in
[POSTS.md](POSTS.md) — this file covers everything else.

**Golden rules that apply everywhere**
- Post from your own account, reply to every comment for the first 2–3 hours.
  A responsive maker is worth more than a perfect post.
- Never ask for upvotes, anywhere, ever (HN and PH shadow-kill for it).
- Stagger the Reddit posts across the week — same link to 8 subs in one hour
  trips the sitewide spam filter and can nuke the account.
- Every post links **https://recipejar.app** (no UTM params on HN — they strip
  or penalise them).
- If a site fails to import for a commenter, that's gold: ask for the URL,
  fix it, reply "fixed" — in public.

---

## Calendar — mass push THIS WEEK; Jul 13 stays free for the personal reveal

| When | Channel | Note |
|---|---|---|
| **Wed Jul 8 (today), morning** | Tag v1.0.0 + GitHub Release | The repo must look launched before the traffic arrives |
| Wed Jul 8, morning | Phone QA (PHONE-QA.md) | 15 min — do it BEFORE the HN post, not after |
| Wed Jul 8, morning | Uneed submit + PH draft + accounts | Uneed queue fills days ahead; schedule PH for **Thu Jul 9, 12:01 AM PT** |
| Wed Jul 8, midday | X + Bluesky + Mastodon | With the demo video |
| Wed Jul 8, **14:30 CEST** | **Show HN** | Copy in POSTS.md; stay at the keyboard 2–3h for comments |
| Wed Jul 8, 15:00 | r/InternetIsBeautiful | Copy in POSTS.md |
| Wed Jul 8, 15:00 | TikTok / Shorts | Caption in POSTS.md |
| Wed Jul 8, evening | AlternativeTo + SaaSHub | Listings, 10 min |
| **Thu Jul 9** | Product Hunt live (09:01 CEST) | Maker comment ready; reply all day |
| Thu Jul 9 | r/selfhosted | After PH is live, so the listing looks alive |
| Thu Jul 9 | r/Cooking modmail | Ask permission now; post whenever they say yes |
| **Fri Jul 10** | r/opensource + r/coolgithubprojects | |
| **Sat Jul 11** | r/webdev **Showoff Saturday thread** + r/SideProject | |
| **Sun Jul 12** | r/sveltejs + r/degoogle + r/Nepal | |
| Sun Jul 12 | Microlaunch, Fazier, opensourcealternative.to, selfh.st | Directories, ~30 min total |
| **Mon Jul 13** | 🎂 Personal reveal only (stories, WhatsApp, LinkedIn) | Phase 2 in POSTS.md — no new community posts today |
| Mon Jul 13 | Peerlist Launchpad | Launches Mondays — fits the reveal day |
| Week 2 | dev.to technical write-up, Indie Hackers retro | Second wave |
| **~Nov 8, 2026** | awesome-selfhosted PR | Their rule: first release must be 4+ months old. v1.0.0 today starts the clock — calendar it. |

---

## Product Hunt (launch Thu Jul 9, 12:01 AM PT)

Schedule it in advance (Launches → New). Thursday is a solid PH day, and it
lands the day after the HN wave, spacing the traffic across the week.

- **Name:** Recipe Jar
- **Tagline:** Just the recipe, yours to keep. Free, offline, unlimited
- **Topics:** Cooking, Open Source, Privacy, Productivity
- **Links:** https://recipejar.app + the GitHub repo
- **Gallery:** `public/og.png` first, then screenshots (`docs/screenshots/`:
  card, cook, jar), then `launch/recipe-jar-demo.mp4`.

**Description (~250 chars):**
> Paste a recipe link, get a clean card: ingredients and steps, nothing else.
> Save unlimited recipes; they live in your browser, not on a server. Cook mode
> with step timers. No account, no ads, works offline, open source (MIT).

**Maker's first comment:**
> Hi PH! I built Recipe Jar because recipe sites buried the food under life
> stories and ads, and the tools that clean them up now cap free saves at 20–40
> recipes and charge for more.
>
> Recipe Jar is the boring, honest version: paste a link → clean card → keep it
> forever. Everything is stored in your own browser (IndexedDB), so there's no
> account, no server copy of your data, and nothing that costs me money per
> user. That's why "free forever" is the architecture, not a pricing page.
>
> Nice bits: cook mode shows one step at a time and keeps your screen awake,
> "simmer 20 mins" becomes a tappable timer, servings scale with real fraction
> math, and sharing a recipe encodes the whole recipe into the link itself.
>
> It's MIT-licensed and self-hostable in one click. Honest scope: it keeps
> recipes; it doesn't plan meals or count calories. If a site fails to import,
> tell me; parser fixes are my favourite bug reports.

---

## Reddit

One post per sub, staggered per the calendar. Read each sub's sidebar rules the
day you post — they change. If a post gets removed, message the mods politely,
don't repost.

### r/selfhosted (Thu) — flair: Release
**Title:** Recipe Jar: a local-first recipe keeper, MIT, self-hostable as one static site + one tiny proxy function

> Paste a recipe URL, get a clean card (ingredients + steps), save unlimited
> recipes. Everything lives in the user's browser via IndexedDB. There's no
> database, no accounts, and nothing to back up server-side by design.
>
> Self-hosting is deliberately boring: `npm run build` gives you a static
> `dist/` that runs anywhere; the only server code is a stateless fetch proxy
> (Cloudflare Pages Function) with SSRF guards and caller checks. No Docker
> needed, though the proxy does want a CF-workers-compatible runtime; the
> in-browser bookmarklet import works even without it.
>
> Live: https://recipejar.app · Repo: https://github.com/sbmagar13/recipe-jar
> (ARCHITECTURE.md explains the whole thing in one page.)
>
> Honest scope: keeps recipes, nothing else. Feedback and parser-gap reports
> very welcome.

### r/opensource (Fri)
**Title:** Recipe Jar (MIT): paste a recipe link, get a clean card, save unlimited recipes on-device. No account, no ads, no server-side storage

> The "just the recipe" tools went freemium (20–40 saves, then pay). This one
> can't, structurally: recipes are stored in the browser (IndexedDB), the site
> is static, and the one server function is a stateless proxy. Free forever
> because there's nothing to charge for.
>
> Svelte 5 + TypeScript + Dexie, ~70 KB gzipped, WCAG-audited, e2e-tested on
> four engines. The most useful contribution is teaching the parser a recipe
> site that doesn't import; CONTRIBUTING.md has a step-by-step guide.
>
> Live: https://recipejar.app · Repo: https://github.com/sbmagar13/recipe-jar

### r/coolgithubprojects (Fri) — must link the repo, flair: TYPESCRIPT
**Title:** recipe-jar: local-first recipe keeper. Paste a URL, get a clean card, unlimited on-device saves (Svelte 5, MIT)
**Link post to:** https://github.com/sbmagar13/recipe-jar

### r/SideProject (Sat)
**Title:** I built a recipe keeper that can't rug-pull you: your recipes live in your browser, not my server

> Every recipe tool eventually caps free saves and charges. I wanted one that
> physically can't: Recipe Jar stores everything in your own browser, the site
> is static, and my hosting bill is $0 at any number of users. So "free
> forever" is the architecture, not a promise.
>
> Paste a link → clean card → cook mode with step timers. Works offline,
> installable, no account. Open source (MIT).
>
> https://recipejar.app. Would love feedback, especially recipe sites that
> fail to import.

### r/sveltejs (Sun)
**Title:** Recipe Jar, a Svelte 5 PWA with no backend: runes, Dexie, and one Cloudflare function (MIT)

> Things that might interest this sub: full runes ($state/$derived/$effect +
> snippets), shared reactive state in a `.svelte.ts` module for the SW update
> prompt, Dexie for unlimited on-device storage (gotcha: $state proxies throw
> DataCloneError in IndexedDB; JSON round-trip at the db boundary), history
> API wired to in-app views so Back works in the installed PWA, and a
> CI-enforced 78 KB gzip budget. Playwright e2e across 4 engines + axe a11y
> audits.
>
> Live: https://recipejar.app · Repo: https://github.com/sbmagar13/recipe-jar

### r/degoogle (Sun)
**Title:** FOSS alternative for recipe keeping: no account, no cloud, recipes stay on your device

> Recipe Jar: paste a recipe link, get a clean card, save unlimited recipes in
> your browser's own storage. No sign-in, no analytics profile, no server copy
> to subpoena. Honors DNT/GPC. MIT-licensed and self-hostable.
> https://recipejar.app

### r/Nepal (Sun) — flair: Technology
**Title:** Made a free recipe keeper: works offline on any phone, no account needed (Nepali UI coming)

> Namaste! I'm a Nepali dev living in Sweden. I built a free tool that turns
> any recipe link into a clean card: just ingredients and steps, no ads, no
> life story. It saves recipes on your own phone, so it works even with spotty
> internet once loaded, and it's free forever (no account, nothing to buy).
>
> It parses Nepali recipe sites too, and a Nepali (देवनागरी) UI is on the
> roadmap. Would love for people here to try it and tell me what breaks:
> https://recipejar.app

### r/webdev (Sat) — ONLY inside the Showoff Saturday thread
> Recipe Jar: paste a recipe URL, get a clean card, keep it on-device.
> Svelte 5 PWA, no backend, 70 KB gz, MIT. https://recipejar.app

### r/Cooking — modmail FIRST (their rules require it). Send this:
> Hi mods, I built a free, open-source recipe keeper (no account, no ads,
> recipes stored on the user's own device): https://recipejar.app. Would a
> single post sharing it be okay, and if so, with what flair? Happy to follow
> whatever format you prefer, or skip it entirely if it's not a fit. Thanks!

### Skip these (rules ban tool promotion — a post there hurts you)
r/privacy, r/PrivacyGuides, r/recipes, r/EatCheapAndHealthy, r/food.

---

## X / Bluesky / Mastodon (Mon 08:00, with the demo video attached)

### X — thread of 3
> 1/ Recipe sites: 1,400 words of life story, 4 ads, then the recipe.
> "Clean-up" tools: free for 20 saves, then pay.
>
> I built the version that can't do that to you. Recipe Jar: just the recipe,
> yours to keep. Free forever, no account. https://recipejar.app

> 2/ Paste a link → clean card → save unlimited recipes. They live in YOUR
> browser, not my server. Cook mode turns "simmer 20 mins" into a tappable
> timer and keeps your screen awake at the stove. Works offline. 🧵

> 3/ It's open source (MIT) and self-hostable in one click. No ads, no
> analytics profile, no server copy of your data. The architecture IS the
> privacy policy. Repo: https://github.com/sbmagar13/recipe-jar

### Mastodon (fosstodon.org — FOSS crowd, use the tags)
> Recipe Jar: a local-first recipe keeper. Paste a link, get a clean card
> (ingredients + steps, nothing else), save unlimited recipes in your own
> browser. No account, no ads, works offline, MIT.
>
> Self-hostable: static site + one stateless proxy function.
>
> https://recipejar.app
> #FOSS #selfhosted #cooking #privacy #localfirst #PWA

### Bluesky
> Just the recipe, yours to keep. Paste a recipe link → clean card → save
> unlimited, on your device. Free forever (that's the architecture, not a
> promise), no account, works offline, open source.
> https://recipejar.app

---

## Directories & listings (reusable blurbs at the bottom)

| Site | URL | Notes |
|---|---|---|
| Uneed | uneed.best/submit | **Submit NOW** — free queue fills days/weeks ahead; pick Jul 13 |
| AlternativeTo | alternativeto.net/manage-item/ | Add app, then suggest as alternative to **Paprika, Copy Me That, JustTheRecipe, Whisk/Samsung Food** — that's where the search traffic is |
| SaaSHub | saashub.com/submit-service | 5 min |
| Microlaunch | microlaunch.net | Week 1 |
| Fazier | fazier.com | Week 1 |
| Peerlist Launchpad | peerlist.io/launchpad | Launches Mondays — queue for Jul 20 |
| opensourcealternative.to | opensourcealternative.to (submit form) | Position as OSS alt to Paprika |
| selfh.st | selfh.st (content submission link in footer) | Weekly self-hosted roundup — submit week 1 |
| Indie Hackers | indiehackers.com | Product page + a "how it went" post after launch week with real numbers |
| lobste.rs | — | Invite-only; only if someone offers to submit it, don't chase |

**160-char blurb:**
> Paste a recipe link, get a clean card. Save unlimited recipes on your own
> device. No account, no ads, works offline. Free forever, open source (MIT).

**50-word blurb:**
> Recipe Jar turns any recipe link into a clean card (ingredients and steps,
> nothing else) and keeps it in your browser's own storage. Unlimited saves,
> serving scaler, cook mode with step timers, offline PWA, one-file backup.
> No account, no ads, no server-side storage. MIT-licensed and self-hostable.

---

## GitHub-side (Claude can prep these as PRs from your account)

| List | When | Note |
|---|---|---|
| awesome-selfhosted | **~Nov 13, 2026** | Hard rule: first release 4+ months old. Uses a YAML file in awesome-selfhosted-data |
| awesome-svelte | any time after launch | Short PR |
| awesome-pwa | any time after launch | Short PR |
| GitHub topics/description | done | Already set |

## Week-2 content (say the word and Claude drafts them)

- **dev.to / Hashnode:** "A recipe keeper with no backend: Svelte 5, IndexedDB,
  and one proxy function" — the DataCloneError gotcha, the iOS-lookbehind
  white-screen save, the 78 KB budget. Dev-story angle, links back to the repo.
- **Indie Hackers post:** launch-week numbers, honest retro.
- **Nepali-language post** for Nepali dev communities when the Devanagari UI
  ships (Phase 3) — that's the moment for the big r/Nepal + local push.
