// Merge the ingredients of several recipes into one shopping list.
//
// The rules, in cook terms:
//   - The same ingredient in the same unit adds up: "2 cups flour" in one
//     recipe plus "1 cup flour" in another becomes "3 cups flour".
//   - Each recipe is scaled to the cook's chosen servings before merging.
//   - Different units never convert ("200 g flour" and "1 cup flour" stay two
//     lines): converting means guessing densities, and a wrong guess in a
//     shopping list wastes money at the store.
//   - A line that merged with nothing keeps its original wording. Only lines
//     that actually combined are rewritten, and then prep notes (", sifted",
//     parentheticals) drop away, because you buy flour, not sifted flour.

import type { Ingredient } from './types'
import { formatQty } from './quantity'

export interface PlanRecipe {
  title: string
  /** The recipe's own serving count (recipe.servings, defaulted to 4). */
  baseServings: number
  /** The servings the cook wants to shop for. */
  servings: number
  ingredients: Ingredient[]
}

// Measure words we recognise at the start of an ingredient's text, mapped to a
// canonical unit so "1 tablespoon X" and "1 tbsp X" land in the same group.
const UNIT_ALIASES: Record<string, string> = {
  cup: 'cup', cups: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml',
  deciliter: 'dl', deciliters: 'dl', decilitre: 'dl', decilitres: 'dl', dl: 'dl',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can',
  tin: 'tin', tins: 'tin',
  slice: 'slice', slices: 'slice',
  bunch: 'bunch', bunches: 'bunch',
  handful: 'handful', handfuls: 'handful',
  sprig: 'sprig', sprigs: 'sprig',
  stick: 'stick', sticks: 'stick',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  piece: 'piece', pieces: 'piece',
  packet: 'packet', packets: 'packet',
  pack: 'pack', packs: 'pack',
  head: 'head', heads: 'head',
  stalk: 'stalk', stalks: 'stalk',
}

// How a merged unit reads, for a total of one and for more.
export const UNIT_DISPLAY: Record<string, [string, string]> = {
  cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'],
  g: ['g', 'g'], kg: ['kg', 'kg'], ml: ['ml', 'ml'], dl: ['dl', 'dl'], l: ['l', 'l'],
  oz: ['oz', 'oz'], lb: ['lb', 'lb'],
  clove: ['clove', 'cloves'], can: ['can', 'cans'], tin: ['tin', 'tins'],
  slice: ['slice', 'slices'], bunch: ['bunch', 'bunches'], handful: ['handful', 'handfuls'],
  sprig: ['sprig', 'sprigs'], stick: ['stick', 'sticks'], pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'], piece: ['piece', 'pieces'], packet: ['packet', 'packets'],
  pack: ['pack', 'packs'], head: ['head', 'heads'], stalk: ['stalk', 'stalks'],
}

/** Every alias must resolve to a displayable unit; a test pins this. */
export const UNIT_ALIAS_TABLE = UNIT_ALIASES

/** Split "cups of flour" into { unit: 'cup', item: 'flour' }. */
function splitUnit(rest: string): { unit: string | null; item: string } {
  const m = rest.match(/^(\S+)\s+(.*)$/)
  if (m) {
    const unit = UNIT_ALIASES[m[1].toLowerCase().replace(/\.$/, '')]
    if (unit) return { unit, item: m[2].trim().replace(/^of\s+/i, '') }
  }
  return { unit: null, item: rest.trim() }
}

/** What the cook buys: the item without prep notes or parentheticals. */
function cleanItem(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .trim()
}

/** "chocolate chips" → "chocolate chip", so plural and singular lines meet. */
function singularKey(clean: string): string {
  const words = clean.toLowerCase().split(' ')
  const last = words[words.length - 1]
  if (last && last.length > 3 && last.endsWith('s') && !last.endsWith('ss')) {
    words[words.length - 1] = last.slice(0, -1)
  }
  return words.join(' ')
}

function looksPlural(clean: string): boolean {
  const last = clean.toLowerCase().split(' ').pop() ?? ''
  return last.length > 3 && last.endsWith('s') && !last.endsWith('ss')
}

interface Group {
  unit: string | null
  qtyless: boolean
  low: number
  high: number
  hasRange: boolean
  count: number
  /** The first line's scaled text, used verbatim when nothing merged into it. */
  first: string
  /** Cleaned item for a rewritten (merged) line. */
  item: string
  itemSingular: string | null
  itemPlural: string | null
}

function noteForms(g: Group, clean: string) {
  if (looksPlural(clean)) g.itemPlural ??= clean
  else g.itemSingular ??= clean
}

/** Merge every picked recipe's ingredients into one list of display lines. */
export function mergeShoppingItems(recipes: PlanRecipe[]): string[] {
  const groups = new Map<string, Group>()

  for (const r of recipes) {
    const factor = r.baseServings > 0 && r.servings > 0 ? r.servings / r.baseServings : 1
    for (const ing of r.ingredients) {
      // No quantity ("salt and pepper"): nothing to sum, so just dedupe.
      if (ing.qty === null) {
        const key = `x|${cleanItem(ing.raw).toLowerCase()}`
        const g = groups.get(key)
        if (g) g.count++
        else {
          groups.set(key, {
            unit: null, qtyless: true, low: 0, high: 0, hasRange: false,
            count: 1, first: ing.raw.trim(), item: '', itemSingular: null, itemPlural: null,
          })
        }
        continue
      }

      const low = ing.qty * factor
      const high = (ing.qtyEnd ?? ing.qty) * factor
      const hasRange = ing.qtyEnd !== null
      const { unit, item } = splitUnit(ing.rest)
      const clean = cleanItem(item)
      const key = `q|${unit ?? ''}|${singularKey(clean)}`
      const qtyText = hasRange ? `${formatQty(low)}–${formatQty(high)}` : formatQty(low)

      const g = groups.get(key)
      if (!g) {
        const fresh: Group = {
          unit, qtyless: false, low, high, hasRange,
          count: 1, first: `${qtyText} ${ing.rest}`.trim(),
          item: clean, itemSingular: null, itemPlural: null,
        }
        noteForms(fresh, clean)
        groups.set(key, fresh)
      } else {
        g.low += low
        g.high += high
        g.hasRange ||= hasRange
        g.count++
        noteForms(g, clean)
      }
    }
  }

  const out: string[] = []
  for (const g of groups.values()) {
    // Untouched lines keep their author's wording.
    if (g.qtyless || g.count === 1) {
      out.push(g.first)
      continue
    }
    const n = g.hasRange ? g.high : g.low
    const qtyText = g.hasRange ? `${formatQty(g.low)}–${formatQty(g.high)}` : formatQty(g.low)
    if (g.unit) {
      const [one, many] = UNIT_DISPLAY[g.unit]
      out.push(`${qtyText} ${n === 1 ? one : many} ${g.item}`)
    } else {
      // Countable items ("3 eggs"): prefer a plural form we actually saw,
      // and only fabricate an s for the common regular case.
      const item =
        n === 1
          ? (g.itemSingular ?? g.item)
          : (g.itemPlural ?? (g.item.endsWith('s') ? g.item : `${g.item}s`))
      out.push(`${qtyText} ${item}`)
    }
  }
  return out
}
