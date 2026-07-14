// Best-effort structuring of pasted recipe text into form fields. Heuristic by
// nature, so the caller shows the result in an editable form for review. Returns
// plain strings ready to drop into the manual-entry fields.

export interface ParsedText {
  title: string
  servings: string
  ingredients: string // newline-joined
  steps: string // newline-joined
}

const INGREDIENTS_HEADER = /^(ingredients|ingredienser|zutaten|ingr[eé]dients|you will need|shopping list)\b[:\s]*$/i
const STEPS_HEADER = /^(method|methods|instructions?|directions?|steps|preparation|g[öo]r s[åa] h[äa]r|instruktioner|tillagning|s[åa] h[äa]r g[öo]r du)\b[:\s]*$/i
const NOISE = /^(ingredients|method|instructions|directions|steps|preparation)\b/i

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

// Leading list bullets and checkbox glyphs.
const BULLET = /^\s*(?:[-*•·▢□☐●▪]|\d+[.)])\s+/

// A measurement-ish token at the start suggests an ingredient line.
const MEASURE = /^\s*(?:\d|½|¼|¾|⅓|⅔|⅛|a\s|an\s|one\s|two\s|three\s|pinch|dash|handful|clove|tsp|tbsp|cup|g\b|kg|ml|dl|l\b|oz|lb)/i

function stripBullet(s: string): string {
  return s.replace(BULLET, '').trim()
}

function detectServings(text: string): string {
  const m =
    text.match(/(?:serves|servings|yield|makes|portions?|portioner|f[öo]r)\D{0,4}(\d{1,3})/i) ||
    text.match(/(\d{1,3})\s*(?:servings|portions|portioner|people|personer)/i)
  return m ? m[1] : ''
}

function looksLikeIngredient(line: string): boolean {
  const l = line.trim()
  if (!l) return false
  if (MEASURE.test(l)) return true
  // Short, comma-listy, no sentence-ending period, few words.
  const words = l.split(/\s+/).length
  const endsSentence = /[.!?]$/.test(l)
  return words <= 8 && l.length <= 60 && !endsSentence
}

/** Parse pasted recipe text into editable form fields. */
export function parseRecipeText(text: string): ParsedText {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim())
  const lines = rawLines.filter((l) => l.length > 0 && !isChrome(l))
  const servings = detectServings(text)

  // Locate section headers.
  let ingIdx = -1
  let stepIdx = -1
  lines.forEach((l, i) => {
    if (ingIdx === -1 && INGREDIENTS_HEADER.test(l)) ingIdx = i
    if (stepIdx === -1 && STEPS_HEADER.test(l)) stepIdx = i
  })

  let title = ''
  const ingredients: string[] = []
  const steps: string[] = []

  if (ingIdx !== -1 || stepIdx !== -1) {
    // Header-driven split (the reliable case).
    const firstHeader = Math.min(...[ingIdx, stepIdx].filter((n) => n !== -1))
    title = lines.slice(0, firstHeader).find((l) => !NOISE.test(l)) ?? ''

    const ingEnd = stepIdx > ingIdx ? stepIdx : lines.length
    if (ingIdx !== -1) {
      for (const l of lines.slice(ingIdx + 1, ingEnd)) {
        if (STEPS_HEADER.test(l) || INGREDIENTS_HEADER.test(l)) continue
        ingredients.push(stripBullet(l))
      }
    }
    if (stepIdx !== -1) {
      for (const l of lines.slice(stepIdx + 1)) {
        if (STEPS_HEADER.test(l) || INGREDIENTS_HEADER.test(l)) continue
        steps.push(stripBullet(l))
      }
    }
  } else {
    // No headers: classify line by line. First line is the title.
    title = lines[0] ?? ''
    for (const l of lines.slice(1)) {
      const isNumbered = /^\s*\d+[.)]\s+/.test(l)
      if (isNumbered) steps.push(stripBullet(l))
      else if (looksLikeIngredient(l)) ingredients.push(stripBullet(l))
      else steps.push(stripBullet(l))
    }
  }

  return {
    title: title.trim(),
    servings,
    ingredients: ingredients.filter(Boolean).join('\n'),
    steps: steps.filter(Boolean).join('\n'),
  }
}
