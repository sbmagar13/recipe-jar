import { test, expect } from '@playwright/test'

// Simulates what the bookmarklet does: it opens the app with a #import= hash
// carrying the page's JSON-LD. This is the path that makes bot-walled sites work.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Blocked Site Pancakes',
  recipeYield: '4 servings',
  recipeIngredient: ['2 cups flour', '2 eggs', '1 1/2 cups milk'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Whisk everything together.' },
    { '@type': 'HowToStep', text: 'Fry in a hot pan until golden.' },
  ],
})

test('bookmarklet import hash renders a recipe ready to save', async ({ page }) => {
  const payload = {
    u: 'https://www.nytimes.com/cooking/blocked-pancakes',
    t: 'Blocked Site Pancakes - NYT Cooking',
    j: [JSON_LD],
  }
  const hash = '#import=' + encodeURIComponent(JSON.stringify(payload))

  await page.goto('/' + hash)

  await expect(page.getByRole('heading', { name: 'Blocked Site Pancakes' })).toBeVisible()
  await expect(page.getByText('2 cups flour')).toBeVisible()

  // The import hash must be cleared so a reload doesn't re-import.
  expect(page.url()).not.toContain('#import=')

  // And it can be saved like any other recipe.
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
})

// A page with no markup at all: the bookmarklet sends the article's visible
// text instead, and the app reads the recipe out of it into the editor.
const PAGE_TEXT = [
  'Borboti was one of my least favorite vegetables as a kid.',
  'Recipe: Borboti bhorta',
  'Ingredients:',
  'Long beans – 200g',
  'Onion- 1 medium',
  'Garlic- 8 big cloves',
  'Oil',
  'Salt',
  '1. Toast the chili, onion and garlic in a pan.',
  '2. Cut the beans into small pieces.',
  'Serve with white rice.',
  'Share this:',
  'Twitter',
].join('\n')

test('bookmarklet text from a page without markup lands in the editor pre-filled', async ({ page }) => {
  const payload = {
    u: 'https://example.com/2024/02/25/longbeanspread/',
    t: 'Long Bean Spread – Borboti Bhorta – Some Vegan Blog',
    j: [],
    i: [],
    x: PAGE_TEXT,
    m: 'https://example.com/bhorta.jpg',
  }
  await page.goto('/#import=' + encodeURIComponent(JSON.stringify(payload)))

  await expect(page.getByRole('heading', { level: 1, name: 'Add or paste a recipe' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('no recipe markup')
  await expect(page.getByLabel('Recipe name')).toHaveValue('Long Bean Spread – Borboti Bhorta')
  await expect(page.getByLabel(/Ingredients/)).toHaveValue(/Long beans – 200g\nOnion- 1 medium/)
  await expect(page.getByLabel(/Steps/)).toHaveValue(/^Toast the chili.*\nCut the beans.*\nServe with white rice\.$/s)
  await expect(page.getByLabel(/Steps/)).not.toHaveValue(/Twitter/)
  expect(page.url()).not.toContain('#import=')

  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Long Bean Spread – Borboti Bhorta' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'source' })).toHaveAttribute('href', 'https://example.com/2024/02/25/longbeanspread/')
})

test('a bookmarklet press on a page with no recipe says so instead of a silent home page', async ({ page }) => {
  const payload = { u: 'https://example.com/lisbon', t: 'My trip to Lisbon', j: [], i: [], x: 'We ate a lot. 2 pastries a day.', m: '' }
  await page.goto('/#import=' + encodeURIComponent(JSON.stringify(payload)))

  await expect(page.getByRole('alert')).toContainText('found no recipe on that page')
  expect(page.url()).not.toContain('#import=')
})

test('the import help screen offers a draggable bookmarklet', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Recipe from a blocked site/ }).click()

  const bm = page.getByRole('link', { name: /Recipe Jar/ })
  await expect(bm).toBeVisible()
  const href = await bm.getAttribute('href')
  expect(href).toContain('javascript:')
  expect(href).toContain('application/ld+json')
  expect(href).toContain('ytInitialPlayerResponse')
})

test('bookmarklet text from a YouTube page lands in the editor, filed under the one watch URL', async ({ page }) => {
  // What the bookmarklet sends from a video page: the page's JSON-LD (a
  // VideoObject, not a recipe) and the description it lifted in the browser.
  const payload = {
    u: 'https://www.youtube.com/watch?v=abcdefghijk&t=12s',
    t: 'Salmon Meal Prep - YouTube',
    j: ['{"@context":"https://schema.org","@type":"VideoObject","name":"Salmon Meal Prep"}'],
    i: [],
    x: 'Ingredients: this makes 4 meals\n1 lb salmon fillet\n8 oz dry pasta\n2 cups cherry tomatoes\nDirections:\n1. Bake the salmon with the tomatoes.\n2. Toss with the pasta.\nFollow for more\n#cooking #salmon #mealprep',
    m: '',
  }
  await page.goto('/#import=' + encodeURIComponent(JSON.stringify(payload)))
  await expect(page.getByRole('heading', { level: 1, name: 'Add or paste a recipe' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('read its description')
  await expect(page.getByLabel('Recipe name')).toHaveValue('Salmon Meal Prep')
  await expect(page.getByLabel('Servings')).toHaveValue('4')
  await expect(page.getByLabel(/Steps/)).not.toHaveValue(/Follow for more|#cooking/)
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByRole('link', { name: 'source' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk')
})
