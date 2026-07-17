import { describe, it, expect } from 'vitest'
import { mergeShoppingItems, UNIT_ALIAS_TABLE, UNIT_DISPLAY, type PlanRecipe } from '../src/lib/mergelist'
import { parseIngredientLine } from '../src/lib/quantity'

/** Build a PlanRecipe the same way the app does: raw lines through the parser. */
function rec(title: string, lines: string[], servings = 4, baseServings = 4): PlanRecipe {
  return {
    title,
    baseServings,
    servings,
    ingredients: lines.map((raw) => ({ raw, ...parseIngredientLine(raw) })),
  }
}

describe('mergeShoppingItems', () => {
  it('adds the same ingredient across recipes: the roadmap example', () => {
    const items = mergeShoppingItems([rec('Bread', ['2 cups flour']), rec('Cake', ['1 cup flour'])])
    expect(items).toEqual(['3 cups flour'])
  })

  it('uses the singular unit when the total is one', () => {
    const items = mergeShoppingItems([rec('A', ['½ cup sugar']), rec('B', ['½ cup sugar'])])
    expect(items).toEqual(['1 cup sugar'])
  })

  it('never converts between units: honest separate lines', () => {
    const items = mergeShoppingItems([rec('A', ['200 g flour']), rec('B', ['1 cup flour'])])
    expect(items).toEqual(['200 g flour', '1 cup flour'])
  })

  it('keeps a lone line exactly as its author wrote it', () => {
    const items = mergeShoppingItems([rec('A', ['1 tablespoon soy sauce, plus more (optional)'])])
    expect(items).toEqual(['1 tablespoon soy sauce, plus more (optional)'])
  })

  it('merges spelled-out and abbreviated units', () => {
    const items = mergeShoppingItems([rec('A', ['1 tablespoon olive oil']), rec('B', ['1 tbsp olive oil'])])
    expect(items).toEqual(['2 tbsp olive oil'])
  })

  it('drops prep notes only when lines actually combine', () => {
    const items = mergeShoppingItems([rec('A', ['2 cups flour, sifted']), rec('B', ['1 cup flour'])])
    expect(items).toEqual(['3 cups flour'])
  })

  it('counts unit-less items and picks the plural the recipes used', () => {
    const items = mergeShoppingItems([rec('A', ['2 eggs']), rec('B', ['1 egg'])])
    expect(items).toEqual(['3 eggs'])
  })

  it('scales each recipe to its chosen servings before merging', () => {
    const items = mergeShoppingItems([
      rec('Dal', ['1 cup lentils'], 8, 4), // doubled
      rec('Soup', ['1 cup lentils'], 4, 4),
    ])
    expect(items).toEqual(['3 cups lentils'])
  })

  it('adds ranges end to end', () => {
    const items = mergeShoppingItems([rec('A', ['2-3 cloves garlic']), rec('B', ['2 cloves garlic'])])
    expect(items).toEqual(['4–5 cloves garlic'])
  })

  it('dedupes lines with no quantity instead of stacking them', () => {
    const items = mergeShoppingItems([rec('A', ['salt and pepper']), rec('B', ['salt and pepper'])])
    expect(items).toEqual(['salt and pepper'])
  })

  it('reads through "of": "1 cup of rice" meets "1 cup rice"', () => {
    const items = mergeShoppingItems([rec('A', ['1 cup of rice']), rec('B', ['1 cup rice'])])
    expect(items).toEqual(['2 cups rice'])
  })

  it('keeps first-seen order across recipes', () => {
    const items = mergeShoppingItems([
      rec('A', ['1 cup flour', '2 eggs']),
      rec('B', ['1 tsp salt', '1 cup flour']),
    ])
    expect(items).toEqual(['2 cups flour', '2 eggs', '1 tsp salt'])
  })

  it('merges plural and singular item names', () => {
    const items = mergeShoppingItems([rec('A', ['2 onions, finely chopped']), rec('B', ['1 onion'])])
    expect(items).toEqual(['3 onions'])
  })

  it('handles an empty pick', () => {
    expect(mergeShoppingItems([])).toEqual([])
  })

  it('keeps house style: no em dashes in any output', () => {
    const items = mergeShoppingItems([
      rec('A', ['2-3 cloves garlic', '1 cup flour']),
      rec('B', ['1-2 cloves garlic', '2 cups flour']),
    ])
    expect(items.join('\n').includes('—')).toBe(false)
  })

  it('every unit alias has a display form (table safety net)', () => {
    for (const canonical of Object.values(UNIT_ALIAS_TABLE)) {
      expect(UNIT_DISPLAY[canonical], `display for ${canonical}`).toBeDefined()
    }
  })
})
