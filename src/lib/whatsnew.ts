// Short, friendly highlights shown once to returning cooks after the app updates
// to a new version. Keep each release to a couple of plain-language bullets: this
// is the "here is what you can now do" note, not the full history. The complete,
// detailed record lives in CHANGELOG.md.
//
// Release checklist (see RELEASING.md): when you cut a version users should
// notice, add an entry here keyed by the exact version string in package.json.
// Not every release needs one.
export const WHATS_NEW: Record<string, string[]> = {
  '1.1.0': [
    'Cook mode now keeps a strip of every timer running on other steps, so nothing gets lost when you have a few going at once for different parts of the dish. Tap one to jump straight to that step.',
  ],
  '1.2.0': [
    'Turn any recipe into a shopping list. Tick off what you already have, then copy or share what is left, scaled to the servings you picked.',
  ],
  '1.3.0': [
    'Kitchen timers got friendlier. A finished timer now keeps a gentle alarm going until you come back or tap it, instead of one short beep that is easy to miss. And every timer has a reset button for when you start it too early.',
  ],
  '1.4.0': [
    'Recipes are bookmarkable now. Each saved recipe has its own link, so you can bookmark it and reload without losing your place, and the browser Back and Forward buttons move between screens. It still all lives in the link, nothing leaves your device.',
  ],
}

// Pure decision used by WhatsNew.svelte and its unit test: given the running
// version, the last version the reader acknowledged, and whether they are a
// returning user (have saved recipes), return the highlights to show, or null to
// show nothing. The rules:
//   - use this version's highlights, or fall back to the x.y.0 note of the same
//     minor when this exact version has none. So someone who updates straight
//     past 1.4.0 to a later 1.4.x patch (which happens when a few patches ship
//     close together) still learns what 1.4 introduced,
//   - nothing if there is no such note,
//   - nothing if they have already seen that note, or a newer version,
//   - nothing on a first-ever visit (an empty jar with no prior marker): a
//     changelog popup on your very first open is noise,
//   - otherwise show the highlights.
export function pickHighlights(
  version: string,
  seen: string | null,
  hasData: boolean,
  map: Record<string, string[]> = WHATS_NEW,
): string[] | null {
  // Which note applies, and which version it belongs to.
  let noteVersion = version
  let items = map[version]
  if (!items || items.length === 0) {
    const parsed = parseVersion(version)
    if (!parsed) return null
    const minorKey = `${parsed[0]}.${parsed[1]}.0`
    if (minorKey === version) return null // no exact note and nothing to fall back to
    const fallback = map[minorKey]
    if (!fallback || fallback.length === 0) return null
    noteVersion = minorKey
    items = fallback
  }
  // Already seen this note, or a newer version? Stay quiet.
  if (seen !== null && seenAtOrAfter(seen, noteVersion)) return null
  // Brand-new visitor with no marker and an empty jar: do not greet on first open.
  if (seen === null && !hasData) return null
  return items
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** True when `seen` is the same as or newer than `target`. Falls back to an
 *  exact string match if either side is not a plain x.y.z version. */
function seenAtOrAfter(seen: string, target: string): boolean {
  const a = parseVersion(seen)
  const b = parseVersion(target)
  if (!a || !b) return seen === target
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return true
}
