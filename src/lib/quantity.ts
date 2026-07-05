const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('')

// Leading quantity: "1 1/2", "1½", "½", "1.5", "1,5" (Swedish), "3/4", "2"
const NUM = `(?:\\d+[.,]\\d+|\\d+\\s*/\\s*\\d+|\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+[${FRACTION_CHARS}]?|[${FRACTION_CHARS}])`
const RANGE_SEP = `(?:\\s*(?:-|–|—|to|till)\\s*)`
const LEADING_QTY = new RegExp(`^\\s*(${NUM})(?:${RANGE_SEP}(${NUM}))?\\s*`, 'u')

/** Parse a single number expression like "1 1/2", "1½", "0,5", "3/4" into a float. */
export function parseNumberExpr(s: string): number | null {
  s = s.trim()
  if (!s) return null
  // Trailing unicode fraction attached to an int, e.g. "1½"
  const uf = s.match(new RegExp(`^(\\d+)?([${FRACTION_CHARS}])$`, 'u'))
  if (uf) return (uf[1] ? parseInt(uf[1], 10) : 0) + UNICODE_FRACTIONS[uf[2]]
  // Mixed number "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)
  // Simple fraction "3/4"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10)
  // Decimal with comma or dot
  const dec = s.match(/^(\d+)[.,](\d+)$/)
  if (dec) return parseFloat(`${dec[1]}.${dec[2]}`)
  const int = s.match(/^\d+$/)
  if (int) return parseInt(s, 10)
  return null
}

/** Split an ingredient line into {qty, qtyEnd, rest}. */
export function parseIngredientLine(raw: string): { qty: number | null; qtyEnd: number | null; rest: string } {
  const m = raw.match(LEADING_QTY)
  if (!m) return { qty: null, qtyEnd: null, rest: raw.trim() }
  const qty = parseNumberExpr(m[1])
  const qtyEnd = m[2] ? parseNumberExpr(m[2]) : null
  if (qty === null) return { qty: null, qtyEnd: null, rest: raw.trim() }
  return { qty, qtyEnd, rest: raw.slice(m[0].length).trim() }
}

const DISPLAY_FRACTIONS: Array<[number, string]> = [
  [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'],
  [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.125, '⅛'], [0.875, '⅞'],
]

/** Format a scaled quantity for humans: 0.5 -> "½", 1.5 -> "1½", 2.333 -> "2⅓", 2.4 -> "2.4". */
export function formatQty(n: number): string {
  if (n <= 0) return '0'
  const whole = Math.floor(n)
  const frac = n - whole
  if (frac < 0.04) return String(whole)
  if (frac > 0.96) return String(whole + 1)
  for (const [v, sym] of DISPLAY_FRACTIONS) {
    if (Math.abs(frac - v) < 0.04) return whole > 0 ? `${whole}${sym}` : sym
  }
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}
