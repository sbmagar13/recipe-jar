import type { Recipe } from './types'

// A freely-licensed sample so first-time visitors see a real card instantly,
// with no network call. Written for Recipe Jar (CC0), not scraped from anyone.
export const demoRecipe: Recipe = {
  title: 'Everyday Red Lentil Dal',
  description: 'A quick, forgiving dal that scales from a weeknight bowl to a full table. This is the built-in sample: paste your own recipe link to make your first real card.',
  image: null,
  author: 'Recipe Jar',
  sourceUrl: '',
  servings: 4,
  yieldText: '4 bowls',
  totalTime: '30 min',
  prepTime: '5 min',
  cookTime: '25 min',
  ingredients: [
    '1 cup red lentils, rinsed',
    '3 cups water',
    '1 tsp turmeric',
    '1 tsp salt',
    '2 tbsp ghee or oil',
    '1 tsp cumin seeds',
    '3 cloves garlic, sliced',
    '1 small onion, diced',
    '1 tomato, chopped',
    '1/2 tsp chilli flakes',
  ].map((raw) => parse(raw)),
  steps: [
    'Simmer the lentils with water, turmeric, and salt for 20 minutes, until soft.',
    'In a small pan, heat the ghee and fry the cumin seeds until they pop.',
    'Add the garlic and onion; cook until golden.',
    'Stir in the tomato and chilli, cook 2 minutes, then pour over the lentils.',
    'Simmer 5 more minutes and serve with rice or flatbread.',
  ],
}

function parse(raw: string): Recipe['ingredients'][number] {
  const m = raw.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s+(.*)$/)
  if (!m) return { raw, qty: null, qtyEnd: null, rest: raw }
  const q = m[1].includes('/')
    ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1])
    : Number(m[1])
  return { raw, qty: q, qtyEnd: null, rest: m[2] }
}
