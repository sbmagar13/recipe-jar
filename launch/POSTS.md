# Launch posts — Monday, July 13

Replace `[link]` with recipejar.app once the domain is live. Attach
`launch/recipe-jar-demo.mp4` to the LinkedIn and social posts.

Timing (CEST):
- 08:00 LinkedIn
- 08:30 WhatsApp to family and friends
- 14:30 Show HN (this is early morning US East, when HN is most active)
- 15:00 Reddit (r/InternetIsBeautiful, r/Cooking only if a mod okays it) + post the
  video to TikTok / Reels / Shorts
- Through the week: launch boards (Uneed, Microlaunch, Fazier). Skip Product Hunt
  as a strategy; it is a badge now, not a channel.

---

## LinkedIn (08:00) — attach the demo video

Today is my birthday. Instead of receiving a gift, I made one, for everyone who cooks.

You know the drill. You open a recipe and get a life story, four ad breaks, two
pop-ups, and an autoplaying video before the ingredients. And the tools that fix
this now cap you at 20 or 40 saved recipes and charge for more.

So I built Recipe Jar. Paste any recipe link, get a clean card: ingredients,
steps, nothing else. Save as many as you want. They live on your device, not my
server. That is why it is free forever: there is nothing for me to pay for, so
there is nothing for you to pay for.

No account. No ads. Works offline at the stove. Scale the servings with one tap.
Type in your family recipes too, and back up the whole jar as one file to pass on.

If someone cooks for you, send them this: [link]

---

## Show HN (14:30)

Title:

    Show HN: Recipe Jar – paste a recipe URL, get a clean card, keep it locally

First comment:

It's my birthday today, so instead of receiving a gift I made one for everyone
who cooks.

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
- Svelte + Dexie + Workbox, ~55 KB gzipped, MIT. One tiny Cloudflare Pages
  Function as a stateless fetch proxy; no other backend, no database.
- Backup is a single JSON file (or copy/paste text, for in-app browsers that
  block downloads).

Try it with the built-in sample recipe, no typing needed. Scope note: it keeps
recipes, it does not plan meals or count calories. [link]

---

## WhatsApp (08:30) — to family and friends

It's my birthday today! Instead of presents, I made everyone something: a free
recipe keeper. Paste any recipe link and it strips the ads and the life story,
just ingredients and steps. Save as many as you want, works offline in the
kitchen, no signup, free forever. Send it to whoever cooks in your family:
[link]. Sharing it is the only gift I want.

---

## Reddit (15:00, r/InternetIsBeautiful) — one honest post, no upvote begging

Title: I made a free recipe keeper: paste a link, get a clean card, save unlimited, no account

Body: It's my birthday, so instead of getting a gift I made one. Recipe Jar
strips a recipe page down to ingredients and steps, and lets you save as many as
you want on your own device. No account, no ads, works offline, open source. The
whole thing runs in your browser; your recipes never touch a server. Feedback
welcome, especially if a site fails to import.

---

## 15-second video caption (TikTok / Reels / Shorts)

POV: you just want the recipe, not the life story. Paste the link → clean card →
scale it → save it. Free forever, no account, works offline. My birthday gift to
everyone who cooks. [link]
