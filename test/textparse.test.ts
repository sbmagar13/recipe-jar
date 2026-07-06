import { describe, it, expect } from 'vitest'
import { parseRecipeText } from '../src/lib/textparse'

describe('parseRecipeText — header-driven', () => {
  it('splits ingredients and steps on section headers', () => {
    const text = [
      'Grandma’s Bread',
      'Serves 8',
      'Ingredients',
      '- 500 g flour',
      '- 7 g yeast',
      '- 300 ml water',
      'Method',
      '1. Mix the flour and yeast.',
      '2. Add water and knead.',
      '3. Bake for 40 minutes.',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.title).toBe('Grandma’s Bread')
    expect(r.servings).toBe('8')
    expect(r.ingredients.split('\n')).toEqual(['500 g flour', '7 g yeast', '300 ml water'])
    expect(r.steps.split('\n')).toEqual(['Mix the flour and yeast.', 'Add water and knead.', 'Bake for 40 minutes.'])
  })

  it('recognises Swedish headers', () => {
    const text = ['Pannkakor', 'Ingredienser', '3 dl mjöl', '2 ägg', 'Gör så här', 'Vispa ihop.'].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual(['3 dl mjöl', '2 ägg'])
    expect(r.steps).toBe('Vispa ihop.')
  })
})

describe('parseRecipeText — heuristic (no headers)', () => {
  it('treats the first line as title and classifies the rest', () => {
    const text = ['Quick Omelette', '2 eggs', 'a pinch of salt', '1. Beat the eggs and season them well.', '2. Fry in butter until set.'].join('\n')
    const r = parseRecipeText(text)
    expect(r.title).toBe('Quick Omelette')
    expect(r.ingredients.split('\n')).toEqual(['2 eggs', 'a pinch of salt'])
    expect(r.steps.split('\n')).toEqual(['Beat the eggs and season them well.', 'Fry in butter until set.'])
  })

  it('detects servings from free text', () => {
    const r = parseRecipeText('Soup\nServes 6\n2 carrots\nBoil everything together for a while.')
    expect(r.servings).toBe('6')
  })
})
