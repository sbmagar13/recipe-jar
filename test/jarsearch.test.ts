import { describe, it, expect } from 'vitest'
import { matchesQuery, type SavedRecipe } from '../src/lib/db'
import { correctToVocab } from '../src/lib/spellfix'

function entry(title: string, ingredients: string[], tags: string[] = []): SavedRecipe {
  return {
    id: 1,
    title,
    sourceUrl: '',
    savedAt: 0,
    tags,
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
      ingredients: ingredients.map((raw) => ({ raw, qty: null, qtyEnd: null, rest: raw })),
      steps: [],
    },
  }
}

const palak = entry('Palak Paneer', ['250 g paneer', '400 g spinach', '2 tomatoes'], ['indian'])
const bread = entry('Banana Bread', ['3 bananas', '2 cups flour'])

describe('matchesQuery: every word must match somewhere', () => {
  it('finds a dish by two ingredients on different lines', () => {
    expect(matchesQuery(palak, 'paneer spinach')).toBe(true)
    expect(matchesQuery(bread, 'paneer spinach')).toBe(false)
  })

  it('mixes title, tag, and ingredient words', () => {
    expect(matchesQuery(palak, 'palak tomato')).toBe(true)
    expect(matchesQuery(palak, 'indian paneer')).toBe(true)
  })

  it('fails when any word misses', () => {
    expect(matchesQuery(palak, 'paneer chocolate')).toBe(false)
  })

  it('keeps single-word and empty behavior', () => {
    expect(matchesQuery(bread, 'banana')).toBe(true)
    expect(matchesQuery(bread, '')).toBe(true)
  })
})

describe('correctToVocab: the jar is the dictionary', () => {
  const vocab = ['Palak Paneer', '250 g paneer', '400 g spinach', 'Banana Bread', '3 bananas']

  it('snaps a typo to a word the jar actually contains', () => {
    expect(correctToVocab('panner', vocab)).toBe('paneer')
    expect(correctToVocab('spinch', vocab)).toBe('spinach')
  })

  it('leaves exact and short words alone', () => {
    expect(correctToVocab('paneer', vocab)).toBe('paneer')
    expect(correctToVocab('g', vocab)).toBe('g')
  })

  it('normalizes a plural the jar knows in singular', () => {
    expect(correctToVocab('paneers', vocab)).toBe('paneer')
  })

  it('never invents words the jar does not have', () => {
    expect(correctToVocab('qqqqq', vocab)).toBe('qqqqq')
    expect(correctToVocab('anner', vocab)).toBe('anner') // first letter must match
  })
})
