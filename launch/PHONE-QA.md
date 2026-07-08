# On-phone QA checklist (~15 minutes)

Automated tests already cover Chromium, WebKit (the iOS Safari engine), and
emulated iPhone/Android touch. These are the things only a real phone inside
the real chat-app browsers can confirm. The live URL is **https://recipejar.app**.
Test on one iPhone and one Android if you can.

> If you installed the app or dragged the bookmarklet before the domain move,
> re-do both from https://recipejar.app first — the old ones point at the
> previous address (it redirects, but the fresh ones are the ones users get).

## Setup
- [ ] Send yourself https://recipejar.app in a WhatsApp chat. Check the preview
      card shows the jar image and "Just the recipe. Yours to keep." (that's the
      OG image working — it changed with the domain move, so this matters).
- [ ] Tap the link so it opens **inside** WhatsApp's browser, not Safari/Chrome.

## Core loop (in the WhatsApp in-app browser)
- [ ] Tap "see a sample recipe". The card shows in under 2 seconds.
- [ ] Paste a real recipe link (try one from koket.se, ica.se, bbcgoodfood.com).
      A clean card appears.
- [ ] Tap +/− on servings. Quantities change. Numbers stay readable (no iOS zoom
      on tap).
- [ ] Tap "Save to my jar". It flips to "✓ In your jar".
- [ ] Open "My Jar". The recipe is there.
- [ ] Fully close WhatsApp, reopen the link, open My Jar. Recipe still there.
      (This is the real persistence test; iOS is the one that can evict.)

## Cook mode, timers, tags (new since the last QA pass)
- [ ] On a saved recipe, tap **▶ Cook**. One step at a time, swipe left/right
      moves between steps.
- [ ] The screen does **not** dim/lock while cook mode is open (wake lock).
      Leave it 60–90s to be sure.
- [ ] Tap a timer chip (e.g. "20 min") in a step. It counts down. Set a short
      one if you can find it, or start one and wait: when it fires you should
      **hear a beep** (phone not on silent) and feel a buzz on Android.
      Real-device audio is the thing emulation can't test.
- [ ] Tap "🍳 I cooked this" — the count appears. Add a tag, then check the tag
      filter row shows up in My Jar and filters.
- [ ] Type a note on the recipe, leave the card, come back: the note is there.

## Share (new)
- [ ] On a recipe card, tap **↗ Share**. The system share sheet opens (or the
      link is copied). Send it to yourself in WhatsApp; the link should show a
      preview and open the same recipe on the other end — even for a typed-in
      recipe (the recipe travels inside the link).
- [ ] **Android only:** with the app installed, share a recipe page **from
      Chrome** (Share → Recipe Jar). The app should open and fetch it.

## The blocked-site path
- [ ] Paste an NYT Cooking or AllRecipes link. You get the "blocked site" notice
      with the bookmarklet offer and the "type/paste it in" fallback.
- [ ] Copy a recipe's text from any page, go to "Type in one of your own", paste,
      tap "Auto-fill fields", check the fields fill, then create.

## Backup (the in-app browser weak spot)
- [ ] In My Jar, tap "Back up my jar". Either a file downloads, or it opens the
      JSON. If neither works cleanly, tap "Copy backup" instead and confirm the
      toast says it copied.
- [ ] Paste that backup into a note. Then tap "Paste backup", paste it, Restore.
      Count goes up.

## Instagram in-app browser (repeat the quick version)
- [ ] Open the link from an Instagram DM to yourself.
- [ ] Sample recipe loads, save works, jar persists after closing.
- [ ] Backup: if download fails, "Copy backup" works.

## Add to Home Screen (makes iOS keep the data for good)
- [ ] In Safari (not the in-app browser), open https://recipejar.app, Share,
      "Add to Home Screen". Open it from the icon. It runs full-screen, and the
      jar you saved is still there.
- [ ] With the installed app open, press the phone's **Back** gesture/button
      from My Jar: it should go back inside the app, not close it.

## Report anything that
- shows a blank white screen (note the phone model and iOS/Android version),
- zooms in when you tap a field,
- loses the jar after closing the app,
- stays silent when a timer fires,
- or where a button is too small to tap.
