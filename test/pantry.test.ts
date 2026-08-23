import { describe, it, expect } from 'vitest'
import { rankByPantry } from '../src/lib/pantry'
import type { SavedRecipe } from '../src/lib/db'

function entry(id: number, title: string, ings: string[]): SavedRecipe {
  return {
    id,
    title,
    sourceUrl: '',
    savedAt: 0,
    tags: [],
    recipe: {
      title,
      description: '',
      image: null,
      author: null,
      sourceUrl: '',
      servings: null,
      yieldText: null,
      totalTime: null,
      prepTime: null,
      cookTime: null,
      ingredients: ings.map((raw) => ({ raw, qty: null, qtyEnd: null, rest: raw })),
      steps: [],
    },
  }
}

const dal = entry(1, 'Red Lentil Dal', ['1 cup lentils', '1 onion', '2 tomatoes', '1 tsp turmeric'])
const paneer = entry(2, 'Palak Paneer', ['250 g paneer', '400 g spinach', '1 onion', '2 tomatoes', 'cream', 'garam masala'])
const bread = entry(3, 'Banana Bread', ['3 bananas', 'flour', 'sugar'])

describe('rankByPantry', () => {
  it('ranks by coverage fraction, best-covered dish first', () => {
    const out = rankByPantry([paneer, dal, bread], ['onion', 'tomato', 'lentils'])
    expect(out.map((m) => m.entry.title)).toEqual(['Red Lentil Dal', 'Palak Paneer'])
    expect(out[0].matchedLines).toBe(3)
    expect(out[0].totalLines).toBe(4)
    expect(out[1].matchedLines).toBe(2)
  })

  it('drops recipes with no coverage and reports which terms matched', () => {
    const out = rankByPantry([dal, bread], ['banana'])
    expect(out).toHaveLength(1)
    expect(out[0].entry.title).toBe('Banana Bread')
    expect(out[0].matchedTerms).toEqual(['banana'])
  })

  it('a line covered by two terms counts once', () => {
    const soup = entry(4, 'Tomato Onion Soup', ['2 tomatoes and 1 onion, chopped', 'salt'])
    const out = rankByPantry([soup], ['tomato', 'onion'])
    expect(out[0].matchedLines).toBe(1)
    expect(out[0].matchedTerms.sort()).toEqual(['onion', 'tomato'])
  })

  it('ignores empty and one-letter terms; empty pantry ranks nothing', () => {
    expect(rankByPantry([dal], [])).toEqual([])
    expect(rankByPantry([dal], ['', 'x', ' '])).toEqual([])
  })

  it('tiebreak: same fraction sorts by covered count, then title', () => {
    const a = entry(5, 'Aloo Gobi', ['potato', 'cauliflower'])
    const b = entry(6, 'Zucchini Fry', ['zucchini', 'oil'])
    const out = rankByPantry([b, a], ['potato', 'cauliflower', 'zucchini', 'oil'])
    expect(out.map((m) => m.entry.title)).toEqual(['Aloo Gobi', 'Zucchini Fry'])
  })
})
