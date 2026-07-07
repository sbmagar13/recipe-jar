import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare } from '../src/lib/share'
import type { Recipe } from '../src/lib/types'
import { parseIngredientLine } from '../src/lib/quantity'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  const ingredients = (overrides.ingredients as Recipe['ingredients']) ?? [
    { raw: '2 cups flour', ...parseIngredientLine('2 cups flour') },
    { raw: '1½ dl mjölk', ...parseIngredientLine('1½ dl mjölk') },
  ]
  return {
    title: 'Test Cake',
    description: 'A cake for tests',
    image: 'https://example.com/cake.jpg',
    author: 'Åsa Öberg',
    sourceUrl: 'https://example.com/cake',
    servings: 6,
    yieldText: '6 slices',
    totalTime: '1 h',
    prepTime: '20 min',
    cookTime: '40 min',
    steps: ['Mix everything.', 'Bake at 180°C — enjoy! 🎂'],
    ...overrides,
    ingredients,
  }
}

describe('share link codec', () => {
  it('round-trips a full recipe, including Swedish chars and emoji', () => {
    const r = recipe()
    const decoded = decodeShare(encodeShare(r))!
    expect(decoded).not.toBeNull()
    expect(decoded.title).toBe('Test Cake')
    expect(decoded.author).toBe('Åsa Öberg')
    expect(decoded.steps[1]).toBe('Bake at 180°C — enjoy! 🎂')
    expect(decoded.ingredients.map((i) => i.raw)).toEqual(['2 cups flour', '1½ dl mjölk'])
    // Quantities are re-parsed on receipt, not shipped.
    expect(decoded.ingredients[0].qty).toBe(2)
    expect(decoded.ingredients[1].qty).toBe(1.5)
    expect(decoded.servings).toBe(6)
    expect(decoded.sourceUrl).toBe('https://example.com/cake')
  })

  it('round-trips a minimal own-recipe (no source, no image, no times)', () => {
    const r = recipe({
      description: '',
      image: null,
      author: null,
      sourceUrl: '',
      servings: null,
      yieldText: null,
      totalTime: null,
      prepTime: null,
      cookTime: null,
    })
    const decoded = decodeShare(encodeShare(r))!
    expect(decoded.sourceUrl).toBe('')
    expect(decoded.image).toBeNull()
    expect(decoded.servings).toBeNull()
    expect(decoded.steps.length).toBe(2)
  })

  it('produces URL-safe output (no + / = characters)', () => {
    const encoded = encodeShare(recipe())
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects garbage, tampered payloads, and empty recipes', () => {
    expect(decodeShare('not-base64!!!')).toBeNull()
    expect(decodeShare('aGVsbG8')).toBeNull() // "hello" — valid b64, not a recipe
    // Valid JSON but empty content
    const empty = Buffer.from(JSON.stringify({ v: 1, t: 'X', n: [], p: [] })).toString('base64url')
    expect(decodeShare(empty)).toBeNull()
    // Wrong version
    const v2 = Buffer.from(JSON.stringify({ v: 2, t: 'X', n: ['a'], p: ['b'] })).toString('base64url')
    expect(decodeShare(v2)).toBeNull()
  })

  it('keeps links reasonably small (typical recipe under 2.5 KB)', () => {
    expect(encodeShare(recipe()).length).toBeLessThan(2500)
  })
})
