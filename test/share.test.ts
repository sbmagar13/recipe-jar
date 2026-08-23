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
  it('round-trips a full recipe, including Swedish chars and emoji', async () => {
    const r = recipe()
    const decoded = (await decodeShare(await encodeShare(r)))!
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

  it('round-trips a minimal own-recipe (no source, no image, no times)', async () => {
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
    const decoded = (await decodeShare(await encodeShare(r)))!
    expect(decoded.sourceUrl).toBe('')
    expect(decoded.image).toBeNull()
    expect(decoded.servings).toBeNull()
    expect(decoded.steps.length).toBe(2)
  })

  it('compresses: the payload carries the z. prefix and is URL-safe', async () => {
    const encoded = await encodeShare(recipe())
    expect(encoded.startsWith('z.')).toBe(true)
    expect(encoded.slice(2)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('still decodes first-generation uncompressed links', async () => {
    const legacy = Buffer.from(
      JSON.stringify({ v: 1, t: 'Old Link Cake', n: ['1 egg'], p: ['Bake.'] }),
    ).toString('base64url')
    const decoded = (await decodeShare(legacy))!
    expect(decoded.title).toBe('Old Link Cake')
    expect(decoded.steps).toEqual(['Bake.'])
  })

  it('rejects garbage, tampered payloads, and empty recipes', async () => {
    expect(await decodeShare('not-base64!!!')).toBeNull()
    expect(await decodeShare('aGVsbG8')).toBeNull() // "hello" — valid b64, not a recipe
    expect(await decodeShare('z.aGVsbG8')).toBeNull() // z-prefixed garbage
    const empty = Buffer.from(JSON.stringify({ v: 1, t: 'X', n: [], p: [] })).toString('base64url')
    expect(await decodeShare(empty)).toBeNull()
    const v2 = Buffer.from(JSON.stringify({ v: 2, t: 'X', n: ['a'], p: ['b'] })).toString('base64url')
    expect(await decodeShare(v2)).toBeNull()
  })

  it('only lets a sane https image travel, in either direction', async () => {
    // data: URIs (photo imports) would balloon the link; http and novel
    // schemes never ride along, and neither do absurdly long URLs.
    const dataUri = await decodeShare(await encodeShare(recipe({ image: 'data:image/png;base64,AAAA' })))
    expect(dataUri!.image).toBeNull()
    const longUrl = await decodeShare(await encodeShare(recipe({ image: 'https://x.example/' + 'a'.repeat(600) })))
    expect(longUrl!.image).toBeNull()
    // A crafted legacy payload with an http image gets it stripped on decode.
    const crafted = Buffer.from(
      JSON.stringify({ v: 1, t: 'X', i: 'http://tracker.example/p.gif', n: ['a'], p: ['b'] }),
    ).toString('base64url')
    expect((await decodeShare(crafted))!.image).toBeNull()
    // A normal https image still travels.
    const ok = await decodeShare(await encodeShare(recipe()))
    expect(ok!.image).toBe('https://example.com/cake.jpg')
  })

  it('compression genuinely shrinks the link for a real-sized recipe', async () => {
    const big = recipe({
      steps: Array.from({ length: 12 }, (_, i) => `Step ${i + 1}: stir the pot gently and season to taste.`),
    })
    const compressed = await encodeShare(big)
    const legacySize = Buffer.from(JSON.stringify({ t: big.title, p: big.steps })).toString('base64url').length
    expect(compressed.length).toBeLessThan(legacySize)
    expect(compressed.length).toBeLessThan(2000)
  })
})
