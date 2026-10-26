import { describe, it, expect } from 'vitest'
import {
  isIngredientsHeader,
  isStepsHeader,
  parseRecipeText,
} from '../src/lib/textparse'

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

  it('recognises Arabic ingredients and method headers', () => {
    const text = [
      'كبسة لحم',
      'المكونات',
      'كيلوغرام لحم',
      'كوبان أرز',
      'طريقة التحضير',
      '١. قلّب البصل.',
      '٢. أضف اللحم.',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual(['كيلوغرام لحم', 'كوبان أرز'])
    expect(r.steps.split('\n')).toEqual(['قلّب البصل.', 'أضف اللحم.'])
  })

  it('matches ingredients/steps headers with leading emoji and list synonyms', () => {
    expect(isIngredientsHeader('🛒 INGREDIENTS LIST')).toBe(true)
    expect(isIngredientsHeader('🛒 المقادير')).toBe(true)
    expect(isStepsHeader('👩‍🍳 QUICK STEPS')).toBe(true)
    expect(isStepsHeader('👩‍🍳 طريقة التحضير في قدر الضغط الكهربائي')).toBe(true)
    expect(isIngredientsHeader('✨ Why You’ll Love This Recipe:')).toBe(false)
    expect(isStepsHeader('⏱️ VIDEO CHAPTERS')).toBe(false)
  })

  it('matches Markdown-decorated Ingredients / Cooking Steps headers', () => {
    expect(isIngredientsHeader('### Ingredients:')).toBe(true)
    expect(isStepsHeader('### Cooking Steps:')).toBe(true)
    expect(isIngredientsHeader('**Ingredients**')).toBe(true)
    expect(isStepsHeader('#### Sauce:')).toBe(false)
  })

  it('treats bare RECIPE / Rezept lines as method headers, not prose mentioning recipes', () => {
    expect(isStepsHeader('RECIPE')).toBe(true)
    expect(isStepsHeader('Rezept:')).toBe(true)
    expect(isStepsHeader('Looking for more delicious recipes?')).toBe(false)
    expect(isStepsHeader('This recipe ensures tender beef.')).toBe(false)
  })

  it('treats How to make it lines as method headers', () => {
    expect(isStepsHeader('How to make it:')).toBe(true)
    expect(isStepsHeader('How to make:')).toBe(true)
    expect(isStepsHeader('How to cook it')).toBe(true)
    expect(isStepsHeader('Just whipped up homemade Mutabal – how to make it tonight!')).toBe(
      false,
    )
  })

  it('parses emoji-decorated Ingredients List / Quick Steps blocks', () => {
    const text = [
      'Easy Lamb Kabsa',
      '🛒 INGREDIENTS LIST',
      '* The Base: 1 large onion (chopped), 1–2 tbsp oil.',
      '* The Meat: 1kg Lamb, 6 cups hot water.',
      '👩‍🍳 QUICK STEPS',
      '* Sauté onions and whole spices until fragrant.',
      '* Brown the lamb and pressure cook for 25 mins.',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual([
      'The Base: 1 large onion (chopped), 1–2 tbsp oil.',
      'The Meat: 1kg Lamb, 6 cups hot water.',
    ])
    expect(r.steps.split('\n')).toEqual([
      'Sauté onions and whole spices until fragrant.',
      'Brown the lamb and pressure cook for 25 mins.',
    ])
  })

  it('recognises short Arabic method header الطريقة', () => {
    const text = [
      'كبسة دجاج',
      'المكونات',
      'دجاجة كاملة',
      'كوبان أرز',
      'الطريقة',
      '١. اغسل الأرز.',
      '٢. اطبخ الدجاج.',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual(['دجاجة كاملة', 'كوبان أرز'])
    expect(r.steps.split('\n')).toEqual(['اغسل الأرز.', 'اطبخ الدجاج.'])
  })

  it('prefers the English block when a bilingual description has both', () => {
    const text = [
      'كبسة',
      'المكونات',
      'لحم',
      'أرز',
      'الطريقة',
      '١. اطبخ اللحم.',
      'قدّم مع الزبادي.',
      'Ingredients:',
      '1 kg meat',
      '2 cups rice',
      'Instructions:',
      '1. Cook the meat.',
      'Serve your delicious kabsa!',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual(['1 kg meat', '2 cups rice'])
    expect(r.steps.split('\n')).toEqual(['Cook the meat.', 'Serve your delicious kabsa!'])
    expect(r.ingredients).not.toMatch(/لحم/)
    expect(r.steps).not.toMatch(/اطبخ/)
  })

  it('stops steps at a horizontal-rule divider before outro or translation', () => {
    const text = [
      'Kabsa',
      'Ingredients',
      '1 kg meat',
      '2 cups rice',
      'Instructions',
      '1. Cook the meat.',
      '---',
      'Enjoy your meal!',
      'Ingredients:',
      'extra line that must not become a step',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.steps.split('\n')).toEqual(['Cook the meat.'])
    expect(r.steps).not.toMatch(/Enjoy/i)
  })

  // A WordPress recipe table: an "Ingredients:" cell, then numbered steps in
  // the next cell with no "Method" heading between them (veganbangla.com).
  it('starts the steps at the first numbered line when there is no steps header', () => {
    const text = [
      'Recipe: Borboti bhorta / Long Bean Spread',
      'Ingredients:',
      'Long beans – 200g',
      'Onion- 1 medium',
      'Garlic- 8-9 big cloves',
      'Oil',
      'Salt',
      '1. Lightly toast the chili, onion and garlic in a pan. Keep them aside.',
      '2. Cut the beans into small pieces.',
      'Serve with white rice.',
    ].join('\n')
    const r = parseRecipeText(text)
    expect(r.title).toBe('Borboti bhorta / Long Bean Spread')
    expect(r.ingredients.split('\n')).toEqual(['Long beans – 200g', 'Onion- 1 medium', 'Garlic- 8-9 big cloves', 'Oil', 'Salt'])
    expect(r.steps.split('\n')).toEqual([
      'Lightly toast the chili, onion and garlic in a pan. Keep them aside.',
      'Cut the beans into small pieces.',
      'Serve with white rice.',
    ])
  })

  it('keeps a numbered ingredient from starting the steps early', () => {
    // "1 onion" is a measure, not a step number: no dot or bracket after it.
    const text = ['Soup', 'Ingredients', '1 onion', '2 carrots', '1. Chop everything.', '2. Simmer.'].join('\n')
    const r = parseRecipeText(text)
    expect(r.ingredients.split('\n')).toEqual(['1 onion', '2 carrots'])
    expect(r.steps.split('\n')).toEqual(['Chop everything.', 'Simmer.'])
  })

  it('reads the lines above a lone steps header as ingredients', () => {
    const text = ['Quick Dal', 'Serves 4', '1 cup red lentils', '1 tsp turmeric', 'Method', 'Rinse the lentils.', 'Boil for 20 minutes.'].join('\n')
    const r = parseRecipeText(text)
    expect(r.title).toBe('Quick Dal')
    expect(r.servings).toBe('4')
    expect(r.ingredients.split('\n')).toEqual(['1 cup red lentils', '1 tsp turmeric'])
    expect(r.steps.split('\n')).toEqual(['Rinse the lentils.', 'Boil for 20 minutes.'])
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

  it('detects Swedish för N servings', () => {
    const r = parseRecipeText('Soppa\nFör 4\n2 morötter\nKoka.')
    expect(r.servings).toBe('4')
  })

  it('does not treat cook-for-N-minutes as servings', () => {
    const r = parseRecipeText(
      [
        'Adana kebab',
        'Ingredients',
        '800 g lamb mince',
        'Method',
        '1. Mix the seasoning.',
        '2. Divide into 6-7 long kebabs. Cook for 12 minutes, then grill for 3-4 minutes.',
      ].join('\n'),
    )
    expect(r.servings).toBe('')
  })
})
