import { parseIngredientLine } from './quantity'
import {
  isIngredientsHeader,
  isStepsHeader,
  normalizeHeaderCandidate,
  parseRecipeText,
} from './textparse'
import type { Recipe } from './types'

const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/
const YOUTUBE_HOST = /^(?:www\.|m\.)?youtube\.com$|^youtu\.be$/i

export function isYouTubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST.test(new URL(url).hostname)
  } catch {
    return false
  }
}

function extractYouTubeVideoId(url: string): string | null {
  if (!isYouTubeUrl(url)) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '').split('/')[0] ?? ''
    return YOUTUBE_VIDEO_ID.test(id) ? id : null
  }
  const pathMatch = parsed.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/)
  if (pathMatch) {
    const id = pathMatch[2]
    return YOUTUBE_VIDEO_ID.test(id) ? id : null
  }
  if (parsed.pathname === '/watch') {
    const v = parsed.searchParams.get('v')
    if (v && YOUTUBE_VIDEO_ID.test(v)) return v
  }
  return null
}

export function normalizeYouTubeWatchUrl(url: string): string | null {
  const id = extractYouTubeVideoId(url)
  if (!id) return null
  return `https://www.youtube.com/watch?v=${id}`
}

function extractYtInitialPlayerResponseJson(html: string): string | null {
  const markerMatch = html.match(/(?:var\s+)?ytInitialPlayerResponse\s*=/)
  if (!markerMatch || markerMatch.index === undefined) return null

  const braceStart = html.indexOf('{', markerMatch.index + markerMatch[0].length)
  if (braceStart === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return html.slice(braceStart, i + 1)
    }
  }
  return null
}

/** Yield / batch note that often sits on the Ingredients: line, not a food item. */
const YIELD_ONLY_LINE =
  /^(?:this\s+)?(?:makes|serves|yield(?:s)?)\s+\d[\d\s/-]*(?:\s*(?:meals?|servings?|portions?|people|personer))?\s*$/i

/** Social / promo footer lines that trail many cooking Shorts descriptions. */
const DESCRIPTION_FOOTER_NOISE = [
  /^follow\b/i,
  /^subscribe\b/i,
  /^like\s+(?:and|&)\s+subscribe\b/i,
  /cookbook in bio/i,
  /^link in bio\b/i,
  /^thanks for watching\b/i,
  /^see you (?:next|in)\b/i,
  // ASCII or Unicode tags: "#cooking #kabsa", "#طبخ #كبسة_لحم"
  /^(?:#[\p{L}\p{N}_-]+)(?:\s+#[\p{L}\p{N}_-]+)*$/u,
  /^[-–—=*_]{2,}$/, // "---" bilingual / section dividers
  /^(?:serve your|enjoy your)\b/i, // promo closers, not "Serve hot with …"
  /^enjoy\b/i, // bare "Enjoy 😊" after the method
  /^perfect for\b/i, // "Perfect for dipping…" promo after the method
  /^(?:قدّم|استمتع)\b/,
  /^join the conversation\b/i,
  /^where are you watching\b/i,
  /\blike and subscribe\b/i,
  /^don['’]?t forget to\b/i,
]

function isYieldOnlyLine(line: string): boolean {
  return YIELD_ONLY_LINE.test(line.trim())
}

/** SEO trailers like "viral bars 🍫 #recipe #chocolate #dessert #shorts". */
function isHashtagHeavy(line: string): boolean {
  const tags = line.match(/#[\p{L}\p{N}_-]+/gu)
  return (tags?.length ?? 0) >= 3
}

function isDescriptionFooterNoise(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (isHashtagHeavy(t)) return true
  const bare = normalizeHeaderCandidate(t)
  return DESCRIPTION_FOOTER_NOISE.some((re) => re.test(t) || re.test(bare))
}

/**
 * Bare category line with nothing after the colon — "Meat sauce:", "For sautéing:",
 * "للتقليب:", "Pasta + cheese:". Real ingredients always have content after ":".
 */
function isSectionLabel(line: string): boolean {
  const t = line.trim()
  if (!/^[^:\n]{1,48}:\s*$/.test(t)) return false
  if (/^[\d\u0660-\u0669\u06F0-\u06F9½¼¾⅓⅔]/.test(t)) return false
  return true
}

/**
 * "Ingredients: …" / "Directions: …" on one line. textparse needs the header alone.
 * A yield note ("this makes 6 meals") stays above the header so it still counts as servings.
 */
function normalizeDescriptionForParsing(description: string): string {
  return description
    .split(/\r?\n/)
    .map((line) => {
      const colon = line.indexOf(':')
      if (colon <= 0) return line
      const header = line.slice(0, colon).trim()
      const rest = line.slice(colon + 1).trim()
      if (!rest || !(isIngredientsHeader(header) || isStepsHeader(header))) return line
      if (isIngredientsHeader(header) && isYieldOnlyLine(rest)) return `${rest}\n\n${header}`
      return `${header}\n${rest}`
    })
    .join('\n')
}

/** "Beef: 2 lbs" / "Baking Soda: 1.5 tsp" → amount-first for quantity parsing. */
const LABEL_QTY_LEAD =
  /^(?:\d|½|¼|¾|⅓|⅔|⅛|a\s|an\s|one\s|two\s|three\s|half\b|pinch|dash|handful|few\b)/i

function normalizeLabeledIngredient(line: string): string {
  const m = line.match(/^([^:]+):\s+(.+)$/)
  if (!m) return line
  const name = m[1]!.trim()
  const rest = m[2]!.trim()
  if (name.length > 40 || !LABEL_QTY_LEAD.test(rest)) return line
  // Keep category packs: "The Base: 1 onion, 1–2 tbsp oil"
  if (/,\s*(?:\d|½|¼|¾|a\s|an\s|one\s|two\s)/i.test(rest)) return line
  if (/^(?:the|for|whole|additional)\b/i.test(name)) return line
  return `${rest} ${name}`
}

/** Merge "Prepare the pot:" + following body into one step. */
function mergeTitledSteps(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const next = lines[i + 1]
    const titleLike =
      /:$/.test(line) &&
      line.length <= 80 &&
      !!next &&
      !/:$/.test(next) &&
      !isDescriptionFooterNoise(next) &&
      !isSectionLabel(next)
    if (titleLike) {
      out.push(`${line} ${next}`)
      i++
      continue
    }
    out.push(line)
  }
  return out
}

function cleanIngredientLines(lines: string[]): string[] {
  return lines
    .filter((l) => !isYieldOnlyLine(l) && !isDescriptionFooterNoise(l) && !isSectionLabel(l))
    .map(normalizeLabeledIngredient)
}

/**
 * Shorts often dump the whole method as one paragraph. Split on sentence
 * boundaries so each imperative becomes its own step. Trailing emoji after
 * "enjoy!" stays on that step rather than becoming its own.
 */
function splitProseInstructions(line: string): string[] {
  const trimmed = line.trim()
  if (trimmed.length < 80) return [trimmed]
  const parts = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return [trimmed]

  const out: string[] = []
  for (const part of parts) {
    if (out.length && /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(part)) {
      out[out.length - 1] = `${out[out.length - 1]} ${part}`.trim()
    } else {
      out.push(part)
    }
  }
  return out
}

function cleanStepLines(lines: string[]): string[] {
  const merged = mergeTitledSteps(
    lines.filter((l) => !isDescriptionFooterNoise(l) && !isYieldOnlyLine(l)),
  )
  // Only expand the "one giant paragraph" case — leave numbered multi-step lists alone.
  if (merged.length === 1) return splitProseInstructions(merged[0]!)
  return merged
}

function descriptionHasRecipeStructure(normalizedDescription: string): boolean {
  const lines = normalizedDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  let hasIngredientsHeader = false
  let hasStepsHeader = false
  for (const line of lines) {
    if (isIngredientsHeader(line)) hasIngredientsHeader = true
    if (isStepsHeader(line)) hasStepsHeader = true
  }
  return hasIngredientsHeader && hasStepsHeader
}

export function extractYouTubeDescription(
  html: string,
): { title: string; description: string } | null {
  const jsonText = extractYtInitialPlayerResponseJson(html)
  if (!jsonText) return null

  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch {
    return null
  }

  const videoDetails = (data as { videoDetails?: { title?: string; shortDescription?: string } })
    .videoDetails
  if (!videoDetails) return null

  const title = videoDetails.title?.trim()
  const description = videoDetails.shortDescription?.trim()
  if (!title || !description) return null

  return { title, description }
}

export function tryParseYouTubeRecipe(html: string, sourceUrl: string): Recipe | null {
  const meta = extractYouTubeDescription(html)
  if (!meta) return null

  const normalizedDescription = normalizeDescriptionForParsing(meta.description)
  if (!descriptionHasRecipeStructure(normalizedDescription)) return null

  const parsed = parseRecipeText(normalizedDescription)
  const ingredientLines = cleanIngredientLines(
    parsed.ingredients.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  )
  const stepLines = cleanStepLines(
    parsed.steps.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  )

  if (ingredientLines.length < 2 || stepLines.length < 1) return null

  const servingsParsed = parseInt(parsed.servings, 10)
  const servings = Number.isFinite(servingsParsed) && servingsParsed > 0 ? servingsParsed : null

  const title = meta.title.trim() || parsed.title.trim() || 'Untitled recipe'

  return {
    title,
    description: '',
    image: null,
    author: null,
    sourceUrl,
    servings,
    yieldText: null,
    totalTime: null,
    prepTime: null,
    cookTime: null,
    ingredients: ingredientLines.map((raw) => ({ raw, ...parseIngredientLine(raw) })),
    steps: stepLines,
  }
}
