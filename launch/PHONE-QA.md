# On-phone QA checklist (10 minutes)

Automated tests already cover Chromium, WebKit (the iOS Safari engine), and
emulated iPhone/Android touch. These are the things only a real phone inside
the real chat-app browsers can confirm. Do this once the site is deployed to a
real URL. Test on one iPhone and one Android if you can.

## Setup
- [ ] Send yourself the link in a WhatsApp chat. Check the preview card shows the
      jar image and "Just the recipe. Yours to keep." (that's the OG image working).
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
- [ ] In Safari (not the in-app browser), open the site, Share, "Add to Home
      Screen". Open it from the icon. It runs full-screen, and the jar you saved
      is still there.

## Report anything that
- shows a blank white screen (note the phone model and iOS/Android version),
- zooms in when you tap a field,
- loses the jar after closing the app,
- or where a button is too small to tap.
