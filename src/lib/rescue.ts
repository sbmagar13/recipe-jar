// Rescue for pages that carry no recipe markup at all (no JSON-LD, no
// microdata). The recipe is usually still on the page as plain text: a
// WordPress table, a list, or lines split by <br>. This turns the HTML into
// lines, finds the ingredients block by the same header the paste parser
// uses, and hands back text for the manual-entry form, where the cook checks
// it before saving. Heuristic by nature, so it never produces a card directly.
// youtube.ts sends a video's description through the same gate
// (rescueFromLines), so one set of rules decides what counts as a recipe.
//
// No DOM, like parse.ts, so it runs in unit tests and on the server. Lazy
// loaded from the import path: only a failed import pays for these bytes.
import { NUMBERED, isIngredientsHeader, isStepsHeader, looksLikeIngredient } from './textparse'

export interface Rescued {
  /** Title, the page's own ingredients header, then the block: ready for
   *  parseRecipeText. */
  text: string
  title: string
  image: string | null
}

// Whole elements that are never recipe content. Non-greedy to the first
// matching close tag: a nested same-name element leaks a few lines, which the
// block rules below ignore anyway.
const DROP = /<(script|style|noscript|template|svg|nav|header|footer|aside|form)\b[\s\S]*?<\/\1\s*>/gi
const COMMENT = /<!--[\s\S]*?-->/g
// Where a line ends: explicit breaks, block closers, and block openers (a <li>
// or <tr> with no closer still starts a fresh line).
const BREAK = /<br\s*\/?>|<\/(?:p|div|li|tr|td|th|h[1-6]|section|figcaption|blockquote|dd|dt|pre)\s*>|<(?:li|tr|p|h[1-6])\b[^>]*>/gi
// Where a container ends: once the steps have started, the recipe is over
// here, and the blogger's closing paragraph after the table is not a step.
const END = '\u0000'
const CONTAINER_END = /<\/(?:table|ul|ol|dl|figure|article|main)\s*>/gi
const TAG = /<[^>]+>/g
// The post is over: anything from here is the site talking, not the recipe.
const STOP =
  /^(related\b|share this|you may also like|leave a (?:comment|reply)|comments?\b|post navigation|previous post|next post|tags?:|categories|subscribe|follow (?:us|me)|print recipe|pin recipe|nutrition)/i
const SERVINGS = /\b(serves|servings|yield|makes|portions?|portioner)\b/i
// Site name glued to the page title: "Dal Tadka – Some Blog", "Dal Tadka | Blog".
const TITLE_SEP = /\s+[–—|\-]\s+/
const TITLE_SUFFIX = /\s+[–—|\-]\s+[^–—|\-]+$/

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  times: '×',
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
}

// Text lines with an END marker where a container closes.
function linesWithEnds(html: string): string[] {
  return decode(
    html.replace(COMMENT, '').replace(DROP, '').replace(CONTAINER_END, `\n${END}\n`).replace(BREAK, '\n').replace(TAG, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** The page as trimmed, non-empty text lines, chrome dropped. */
export function htmlToLines(html: string): string[] {
  return linesWithEnds(html).filter((l) => l !== END)
}

function looksLikeStep(l: string): boolean {
  return NUMBERED.test(l) || (/[.!]$/.test(l) && l.split(' ').length >= 4)
}

function meta(html: string, property: string): string | null {
  // Attribute order varies by plugin: property first or content first.
  const re = new RegExp(
    `<meta\\s+(?:[^>]*?\\s)?(?:property|name)=["']${property}["'][^>]*?\\scontent=["']([^"']+)["']|<meta\\s+(?:[^>]*?\\s)?content=["']([^"']+)["'][^>]*?\\s(?:property|name)=["']${property}["']`,
    'i',
  )
  const m = html.match(re)
  const v = m ? (m[1] ?? m[2]) : null
  return v ? decode(v).trim() : null
}

function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const tag = m ? decode(m[1]).replace(/\s+/g, ' ').trim() : ''
  // A dish can carry its own dash ("Long Bean Spread – Borboti Bhorta"), so
  // only a suffix that is the site's name gets dropped: og:site_name when the
  // page says it, else whatever the <title> tag ends with.
  const site = meta(html, 'og:site_name') ?? (TITLE_SEP.test(tag) ? tag.split(TITLE_SEP).pop() : null)
  const og = meta(html, 'og:title')
  if (og) {
    const parts = og.split(TITLE_SEP)
    return site && parts.length > 1 && parts[parts.length - 1] === site ? og.replace(TITLE_SUFFIX, '') : og
  }
  return tag.replace(TITLE_SUFFIX, '')
}

/**
 * Find a recipe-shaped block in a page with no recipe markup. Returns null
 * unless there is an ingredients header followed by at least three
 * ingredient-looking lines and at least one step-looking line, so a page that
 * was never a recipe still gets the honest "no recipe found".
 */
export function rescueFromHtml(html: string): Rescued | null {
  return rescueFromLines(linesWithEnds(html), pageTitle(html), meta(html, 'og:image'))
}

/**
 * The same read over text the bookmarklet lifted from the live page (the
 * article's innerText: line breaks kept, no container ends, site name still
 * glued to the title).
 */
export function rescueFromText(text: string, title: string, image: string | null): Rescued | null {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return rescueFromLines(lines, title.replace(/\s+/g, ' ').trim().replace(TITLE_SUFFIX, ''), image)
}

/** The page's og:image, for a rescue whose lines come from elsewhere (youtube.ts). */
export function pageImage(html: string): string | null {
  return meta(html, 'og:image')
}

/**
 * The gate every rescue goes through: lines in, editor text out, or null when
 * the lines are not recipe-shaped. Exported for youtube.ts, whose lines are a
 * video's description rather than a page.
 */
export function rescueFromLines(lines: string[], title: string, image: string | null): Rescued | null {
  // Anchor on the ingredients header. A bilingual page or description has
  // two; prefer the Latin-script one, as the paste parser does.
  const headers = lines.map((l, i) => (isIngredientsHeader(l) ? i : -1)).filter((i) => i !== -1)
  const at = headers.find((i) => !/[\u0600-\u06FF]/.test(lines[i]!)) ?? headers[0] ?? -1
  if (at === -1) return null

  const block: string[] = []
  let stepsStarted = false
  for (const l of lines.slice(at + 1, at + 1 + 100)) {
    if (l === END) {
      if (stepsStarted) break
      continue // the ingredient list closing; the method may still follow
    }
    if (STOP.test(l) || isIngredientsHeader(l)) break
    block.push(l)
    if (looksLikeStep(l)) stepsStarted = true
  }

  // With a steps header the author has said where the method starts: all we
  // ask is a line on each side of it. Without one, the lines themselves must
  // read like a list and a method, so a page that was never a recipe still
  // gets the honest "no recipe found".
  const header = block.findIndex(isStepsHeader)
  if (header !== -1) {
    if (header === 0 || header === block.length - 1) return null
  } else {
    // The list is what comes before the first numbered line (or the whole
    // block when the steps are prose, which textparse splits).
    const firstStep = block.findIndex((l) => NUMBERED.test(l))
    const list = firstStep === -1 ? block : block.slice(0, firstStep)
    const ingredientLines = list.filter(looksLikeIngredient).length
    const stepLines = block.filter(looksLikeStep).length
    if (ingredientLines < 3 || stepLines < 1) return null
  }

  // "Serves 4" tends to sit just above the list; carry it along for servings.
  const servings = lines.slice(Math.max(0, at - 6), at).find((l) => SERVINGS.test(l) && l.length <= 40)

  const text = [title, servings, lines[at], ...block].filter((l): l is string => Boolean(l)).join('\n')
  return { text, title, image }
}
