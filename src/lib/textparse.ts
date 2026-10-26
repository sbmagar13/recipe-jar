// Best-effort structuring of pasted recipe text into form fields. Heuristic by
// nature, so the caller shows the result in an editable form for review. Returns
// plain strings ready to drop into the manual-entry fields.

export interface ParsedText {
  title: string
  servings: string
  ingredients: string // newline-joined
  steps: string // newline-joined
}

// Core header patterns, matched against normalizeHeaderCandidate output so
// "🛒 INGREDIENTS LIST", "### Ingredients:" and "Ingredients" share one
// allowlist. Exported for the page-text rescue (rescue.ts), which anchors on
// the same header so a page, a paste and a video description are read by one
// set of rules.
export const INGREDIENTS_HEADER =
  /^(?:ingredients(?:\s+list)?|ingredienser|zutaten|ingr[eé]dients|you will need|shopping list|المكونات|المقادير)[:\s]*$/i
export const STEPS_HEADER =
  /^(?:methods?|instructions?|directions?|(?:cooking|quick)\s+steps|steps|preparation|recipe|rezept|how to (?:make|cook|prepare)(?:\s+it)?|g[öo]r s[åa] h[äa]r|instruktioner|tillagning|s[åa] h[äa]r g[öo]r du|(?:ال)?طريقة(?:\s+(?:التحضير|الإعداد)(?:\s+.*)?)?)[:\s]*$/i

// "---" between the recipe and an outro or a translation of it.
const SECTION_DIVIDER = /^[-–—=*_]{2,}$/
// A "Serves 4" / "Yield: 12" line is metadata, never an ingredient.
const SERVINGS_LINE = /^(serves|servings|yield|makes|portions?|portioner)\b/i
// "Recipe: Dal Tadka" as a title line: the label is the page's, not the dish's.
const TITLE_LABEL = /^recipe\s*[:\-–]\s*/i

/** Strip emoji, Markdown and bullets so "🛒 INGREDIENTS LIST" matches the allowlist. */
export function normalizeHeaderCandidate(line: string): string {
  return line
    .trim()
    .replace(/^(?:[^\p{L}\p{N}]+)/u, '')
    .replace(/\*\*/g, '')
    .trim()
}

export function isIngredientsHeader(line: string): boolean {
  return INGREDIENTS_HEADER.test(normalizeHeaderCandidate(line))
}

export function isStepsHeader(line: string): boolean {
  return STEPS_HEADER.test(normalizeHeaderCandidate(line))
}

function isRecipeHeader(line: string): boolean {
  return isIngredientsHeader(line) || isStepsHeader(line)
}

/** A Latin-script header, as opposed to an Arabic one in the same bilingual paste. */
function isLatinRecipeHeader(line: string): boolean {
  return isRecipeHeader(line) && !/[\u0600-\u06FF]/.test(line)
}

// Lines that are website or app chrome, not recipe content. Dropped before
// parsing so an OCR'd or pasted page does not turn nav, ratings and badges into
// ingredients. Kept narrow on purpose so real recipe lines are never removed.
const CHROME_LINE = [
  /rating/i, // "3.3 | 3 ratings"
  /^\s*rate this\b/i, // "Rate this recipe"
  /^\s*\+?\s*(?:save|add) to\b/i, // "+ Save to My Food"
  /share\s*&\s*print/i, // "Share & Print"
  /^\s*shopping list\b/i,
  /^\s*(?:(?:dairy|gluten|egg|nut|soy|wheat|lactose|sugar)[ -]free\b[\s|]*)+$/i, // an allergen-badge-only line
  /^\s*ingredients\s+method\s*$/i, // merged two-column headers
  /^\s*by\b.{0,60}\bserves?\b/i, // "By Neneh Cherry and Andi Oliver Serve"
  /^\s*from\b.{0,60}\bserves?\s*\d/i, // "From ... Dish It Up Serves 4-6"
  /^\s*over\s+\d+\s*(?:hours?|mins?|minutes?)\s*$/i, // "Over 2 hours" badge
  /^\s*(?:prepare|overnight|save|cook)\s*$/i, // bare UI badges
  /^\s*[=<>«»]/, // OCR garbage rows ("= Lo . Dietar")
]

function isChrome(line: string): boolean {
  return CHROME_LINE.some((re) => re.test(line))
}

// "1. " / "2) " / "٣. ": a numbered step line, Western or Arabic-Indic digits.
// Exported for rescue.ts, which uses it to tell the list from the method.
export const NUMBERED = /^\s*[\d٠-٩۰-۹]+[.)]\s+/
// Leading list bullets and checkbox glyphs.
const GLYPH = /^[-*•·▢□☐●▪]+\s+/

// A measurement-ish token at the start suggests an ingredient line.
const MEASURE = /^\s*(?:\d|½|¼|¾|⅓|⅔|⅛|a\s|an\s|one\s|two\s|three\s|pinch|dash|handful|clove|tsp|tbsp|cup|g\b|kg|ml|dl|l\b|oz|lb)/i

function stripBullet(s: string): string {
  return s
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(NUMBERED, '')
    .replace(GLYPH, '')
    .replace(/\*\*/g, '')
    .trim()
}

// "for 12 minutes" is a cook time. Swedish "för 4" is a serving count.
const SERVINGS =
  /(?:serves|servings|yield|makes|portions?|portioner)\D{0,4}(\d{1,3})(?!\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b)|(\d{1,3})\s*(?:servings|portions|portioner|people|personer)\b|\bför\s+(\d{1,3})\b/i

function detectServings(text: string): string {
  const m = text.match(SERVINGS)
  return m?.[1] || m?.[2] || m?.[3] || ''
}

export function looksLikeIngredient(line: string): boolean {
  const l = line.trim()
  if (!l) return false
  if (MEASURE.test(l)) return true
  // Short, comma-listy, no sentence-ending period, few words.
  const words = l.split(/\s+/).length
  const endsSentence = /[.!?]$/.test(l)
  return words <= 8 && l.length <= 60 && !endsSentence
}

/** First index at or after `from` matching `pred`, or -1. */
function findLine(lines: string[], pred: (line: string) => boolean, from = 0): number {
  for (let i = from; i < lines.length; i++) if (pred(lines[i]!)) return i
  return -1
}

/** Parse pasted recipe text into editable form fields. */
export function parseRecipeText(text: string): ParsedText {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isChrome(l))
  const servings = detectServings(text)

  // Locate the ingredients + steps header pair. A bilingual paste carries two
  // pairs; prefer the Latin-script (usually English) one.
  let ingIdx = -1
  let stepIdx = -1
  let latin = false
  for (let i = 0; i < lines.length; i++) {
    if (!isIngredientsHeader(lines[i]!)) continue
    const step = findLine(lines, isStepsHeader, i + 1)
    const nextIng = findLine(lines, isIngredientsHeader, i + 1)
    if (step === -1 || (nextIng !== -1 && step > nextIng)) continue
    const isLat = isLatinRecipeHeader(lines[i]!) && isLatinRecipeHeader(lines[step]!)
    if (ingIdx === -1 || (isLat && !latin)) {
      ingIdx = i
      stepIdx = step
      latin = isLat
    }
  }
  if (ingIdx === -1 && stepIdx === -1) {
    ingIdx = findLine(lines, isIngredientsHeader)
    stepIdx = findLine(lines, isStepsHeader)
  }

  let title = ''
  const ingredients: string[] = []
  const steps: string[] = []

  if (ingIdx !== -1 || stepIdx !== -1) {
    // Header-driven split (the reliable case).
    const firstHeader = Math.min(...[ingIdx, stepIdx].filter((n) => n !== -1))
    title = lines.slice(0, firstHeader).find((l) => !isRecipeHeader(l)) ?? ''

    const ingEnd = stepIdx > ingIdx ? stepIdx : lines.length
    if (ingIdx !== -1) {
      // With no steps header, the ingredient list runs to the end of the text,
      // so a "1. Toast the chili" line is where the method starts: from there
      // on, every line is a step (a WordPress recipe table reads like this).
      let inSteps = false
      for (const l of lines.slice(ingIdx + 1, ingEnd)) {
        if (isRecipeHeader(l) || SECTION_DIVIDER.test(l)) continue
        if (stepIdx === -1 && !inSteps && ingredients.length > 0 && NUMBERED.test(l)) inSteps = true
        ;(inSteps ? steps : ingredients).push(stripBullet(l))
      }
    } else {
      // A steps header with no ingredients header: the measure-looking lines
      // between the title and the header are the ingredients, not padding.
      for (const l of lines.slice(0, stepIdx)) {
        if (l === title || isRecipeHeader(l) || SERVINGS_LINE.test(l)) continue
        if (looksLikeIngredient(l)) ingredients.push(stripBullet(l))
      }
    }
    if (stepIdx !== -1) {
      for (const l of lines.slice(stepIdx + 1)) {
        // A divider or a second Ingredients header: the outro, or the same
        // recipe again in another language.
        if (SECTION_DIVIDER.test(l) || isIngredientsHeader(l)) break
        if (isStepsHeader(l)) continue
        steps.push(stripBullet(l))
      }
    }
  } else {
    // No headers: classify line by line. First line is the title.
    title = lines[0] ?? ''
    for (const l of lines.slice(1)) {
      if (NUMBERED.test(l)) steps.push(stripBullet(l))
      else if (looksLikeIngredient(l)) ingredients.push(stripBullet(l))
      else steps.push(stripBullet(l))
    }
  }

  return {
    title: title.replace(TITLE_LABEL, '').trim(),
    servings,
    ingredients: ingredients.filter(Boolean).join('\n'),
    steps: steps.filter(Boolean).join('\n'),
  }
}
