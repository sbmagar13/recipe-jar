# Launch posts

Links point at https://recipejar.app (live). Attach
`launch/recipe-jar-demo.mp4` (30s) to the social posts.

**Two phases:**

1. **Mass push, THIS WEEK (Jul 8–12)** — HN, Reddit, Product Hunt, directories.
   These posts must NOT mention the birthday (it isn't yet). The full
   channel-by-channel calendar with per-community copy is in
   [DISTRIBUTION.md](DISTRIBUTION.md); the two flagship posts are below.
2. **July 13, the birthday reveal** — personal story on social media (stories),
   WhatsApp to family and friends, LinkedIn if wanted. Those posts keep the
   birthday framing and are at the bottom of this file.

Show HN timing: 14:30 CEST (early morning US East, when HN is most active).

---

# Phase 1 — mass push (this week, no birthday mentions)

---

## Show HN (14:30)

Title:

    Show HN: Recipe Jar – paste a recipe URL, get a clean card, keep it locally

First comment:

The problem: recipe sites buried the food under ads and AI slop, and the "just
the recipe" tools responded by capping free saves at 20 or 40. So this is the
boring, honest version: paste a URL, get a clean card, save unlimited recipes in
IndexedDB. No account, no server-side storage, free forever because there is
nothing to pay for.

Technical bits:

- JSON-LD (schema.org/Recipe) covers most sites since they publish it for Google
  rich results. A bookmarklet captures the rendered page for bot-walled sites
  (NYT, AllRecipes), so nothing is scraped server-side.
- Legal posture is reader-mode: user-initiated fetch of a page they can already
  read, stored privately on their own device, never republished.
- Step timers are parsed out of the instruction text ("simmer 20 mins" becomes a
  tappable countdown), and a focus cook mode shows one step at a time with a
  screen wake lock.
- Sharing a recipe encodes the whole thing into the URL hash (base64url), so a
  shared link carries the recipe itself — nothing is stored server-side.
- Svelte + Dexie + Workbox, ~70 KB gzipped, MIT. One tiny Cloudflare Pages
  Function as a stateless fetch proxy; no other backend, no database.
- Backup is a single JSON file (or copy/paste text, for in-app browsers that
  block downloads).

Try it with the built-in sample recipe, no typing needed. Scope note: it keeps
recipes, it does not plan meals or count calories. https://recipejar.app

---

## Reddit (r/InternetIsBeautiful) — one honest post, no upvote begging

Title: I made a free recipe keeper: paste a link, get a clean card, save unlimited, no account

Body: Recipe Jar strips a recipe page down to ingredients and steps, and lets
you save as many as you want on your own device. No account, no ads, works
offline, open source. The whole thing runs in your browser; your recipes never
touch a server. Feedback welcome, especially if a site fails to import.

---

## Video caption (TikTok / Reels / Shorts)

POV: you just want the recipe, not the life story. Paste the link → clean card →
scale it → save it → cook it step by step with built-in timers. Free forever, no
account, works offline. https://recipejar.app

---

# Phase 2 — July 13, the birthday reveal (personal channels only)

The app is already out by now; this is the personal story, not the launch.
Angle: "this past week I quietly launched something; today is my birthday, and
this was my gift to everyone who cooks."

## Social story caption (short, over a screenshot or the demo clip)

This week I quietly launched something I've been building. Today's my
birthday — so here's the reveal: a free recipe keeper, my gift to everyone
who cooks. 🫙 No ads, no account, yours forever. recipejar.app

## WhatsApp (08:30) — to family and friends

It's my birthday today! Instead of presents, I made everyone something: a free
recipe keeper. Paste any recipe link and it strips the ads and the life story,
just ingredients and steps. Save as many as you want, works offline in the
kitchen, no signup, free forever. Send it to whoever cooks in your family:
https://recipejar.app. Sharing it is the only gift I want.

## LinkedIn (optional) — attach the demo video

Today is my birthday. Instead of receiving a gift, I made one, for everyone who
cooks — and it's been quietly live all week.

You know the drill. You open a recipe and get a life story, four ad breaks, two
pop-ups, and an autoplaying video before the ingredients. And the tools that fix
this now cap you at 20 or 40 saved recipes and charge for more.

So I built Recipe Jar. Paste any recipe link, get a clean card: ingredients,
steps, nothing else. Save as many as you want. They live on your device, not my
server. That is why it is free forever: there is nothing for me to pay for, so
there is nothing for you to pay for.

No account. No ads. Works offline at the stove, with a step-by-step cook mode
that keeps the screen on and turns "simmer 20 minutes" into a tap-to-start
timer. Scale the servings with one tap. Type in your family recipes too, and
back up the whole jar as one file to pass on.

If someone cooks for you, send them this: https://recipejar.app
