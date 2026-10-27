// YouTube links. A watch page has no recipe markup and almost no visible text:
// the description, where creators often type the whole recipe, sits inside a
// script as JSON, which the page-text rescue drops along with every other
// script. This lifts the description out and sends it through the same rescue
// gate as any page with no markup, so a video lands in the editor pre-filled,
// link and thumbnail kept, for the cook to check before saving. Nothing here
// parses a recipe: the paste parser reads the text once it is in the editor.
//
// Two places carry the description. The player JSON
// (ytInitialPlayerResponse.videoDetails.shortDescription) has it when YouTube
// serves the real page. Behind YouTube's "confirm you're not a bot" wall,
// which it puts in front of server fetches at times, the player JSON is a
// stub, but the page data (ytInitialData) still carries the description and
// the title, so that is read too. When YouTube refuses the server outright,
// the bookmarklet lifts the description in the cook's own browser, where
// there is no wall, and rescueFromYouTubeText reads that.
//
// No DOM. Lazy loaded: only a YouTube link pays for these bytes.
import { pageImage, rescueFromLines, type Rescued } from './rescue'
import { isIngredientsHeader, isStepsHeader } from './textparse'

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/
const HOST = /^(?:www\.|m\.)?youtube\.com$|^youtu\.be$/i

export function isYouTubeUrl(url: string): boolean {
  try {
    return HOST.test(new URL(url).hostname)
  } catch {
    return false
  }
}

function videoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!HOST.test(parsed.hostname)) return null
  let id: string | undefined
  if (parsed.hostname === 'youtu.be') id = parsed.pathname.split('/')[1]
  else if (parsed.pathname === '/watch') id = parsed.searchParams.get('v') ?? undefined
  else id = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]
  return id && VIDEO_ID.test(id) ? id : null
}

/**
 * One canonical watch URL for every way a video gets linked (youtu.be, Shorts,
 * mobile, embed), so the proxy cache and the jar's dedupe see one page. Null
 * for anything that is not a link to a YouTube video.
 */
export function normalizeYouTubeWatchUrl(url: string): string | null {
  const id = videoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

/** YouTube's own thumbnail for a video link; hqdefault exists for every video. */
export function youtubeThumbnail(url: string): string | null {
  const id = videoId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

// A JSON object assigned in a script, found by brace matching from its
// marker: the page is a megabyte of script, and a regex over it would be slow
// and fragile.
function jsonAfter(html: string, marker: RegExp): unknown {
  const m = html.match(marker)
  if (!m || m.index === undefined) return null
  const start = html.indexOf('{', m.index + m[0].length)
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

// The first value under `key` anywhere in a JSON tree, depth first. The page
// data is a deep tree of renderers whose nesting YouTube rearranges; the key
// names are the stable part.
function find(node: unknown, key: string, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 40) return undefined
  const rec = node as Record<string, unknown>
  if (key in rec) return rec[key]
  for (const v of Object.values(rec)) {
    const r = find(v, key, depth + 1)
    if (r !== undefined) return r
  }
  return undefined
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * The video's title and description, from the player JSON or, behind the bot
 * wall, from the page data. Null when neither has them: not a watch page, or
 * YouTube refused the fetch outright.
 */
export function youtubeDescription(html: string): { title: string; description: string } | null {
  const player = jsonAfter(html, /ytInitialPlayerResponse\s*=/) as {
    videoDetails?: { title?: unknown; shortDescription?: unknown }
  } | null
  let title = str(player?.videoDetails?.title)
  let description = str(player?.videoDetails?.shortDescription)
  if (!description) {
    const data = jsonAfter(html, /ytInitialData\s*=/)
    if (!data) return null
    description = str((find(data, 'attributedDescription') as { content?: unknown } | undefined)?.content)
    const runs = (find(data, 'videoPrimaryInfoRenderer') as { title?: { runs?: { text?: unknown }[] } } | undefined)?.title?.runs
    if (!title && Array.isArray(runs)) title = runs.map((r) => str(r?.text)).join('').trim()
  }
  return title && description ? { title, description } : null
}

// Lines that are the channel talking, not the recipe: the social footer and
// hashtag trailers. Narrow on purpose: "Serve with rice" stays a step.
const FOOTER = [
  /^(?:please\s+)?(?:follow|subscribe)\b/i,
  /\blike\s+(?:and|&)\s+subscribe\b/i,
  /\b(?:cookbook|recipe|links?)\s+in\s+(?:my\s+)?bio\b/i,
  /^thanks for watching\b/i,
  /^(?:#[\p{L}\p{N}_-]+)(?:\s+#[\p{L}\p{N}_-]+)*$/u, // "#cooking #salmon"
]
const HASHTAG = /#[\p{L}\p{N}_-]+/gu
// "this makes 6 meals" after the header: a yield note, carried as servings.
const YIELD = /^(?:this\s+)?(?:makes|serves|yields?)\b/i

function isFooter(line: string): boolean {
  return FOOTER.some((re) => re.test(line)) || (line.match(HASHTAG)?.length ?? 0) >= 3
}

/**
 * The description as lines for the rescue gate. "Ingredients: this makes 6
 * meals" and "Directions: 1. Preheat..." split so the header stands on a line
 * of its own, where the rescue and the paste parser look for it; a yield note
 * goes above the header so it is read as servings. Footer lines are dropped.
 */
export function descriptionLines(description: string): string[] {
  const out: string[] = []
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line || isFooter(line)) continue
    const colon = line.indexOf(':')
    const head = colon > 0 ? line.slice(0, colon).trim() : ''
    const rest = colon > 0 ? line.slice(colon + 1).trim() : ''
    if (rest && (isIngredientsHeader(head) || isStepsHeader(head))) {
      if (isIngredientsHeader(head) && YIELD.test(rest)) out.push(rest, head)
      else out.push(head, rest)
    } else {
      out.push(line)
    }
  }
  return out
}

/**
 * A fetched watch page whose description holds the recipe, as editor text
 * with the video's title and thumbnail, or null when the description is not
 * recipe-shaped (a vlog, a gear list, "cookbook in bio") or not there at all.
 * The thumbnail is the page's og:image, or YouTube's own for the id when the
 * bot wall left that out too.
 */
export function rescueFromYouTube(html: string, url: string): Rescued | null {
  const video = youtubeDescription(html)
  if (!video) return null
  return rescueFromLines(descriptionLines(video.description), video.title, pageImage(html) ?? youtubeThumbnail(url))
}

/**
 * The same read over what the bookmarklet lifted from the live video page in
 * the cook's own browser: the description text, and document.title with its
 * " - YouTube" suffix.
 */
export function rescueFromYouTubeText(text: string, title: string, url: string): Rescued | null {
  return rescueFromLines(descriptionLines(text), title.replace(/\s+-\s+YouTube$/i, '').trim(), youtubeThumbnail(url))
}
