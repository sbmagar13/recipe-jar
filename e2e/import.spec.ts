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

test('the import help screen offers a draggable bookmarklet', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Recipe from a blocked site/ }).click()

  const bm = page.getByRole('link', { name: /Save to Recipe Jar/ })
  await expect(bm).toBeVisible()
  const href = await bm.getAttribute('href')
  expect(href).toContain('javascript:')
  expect(href).toContain('application/ld+json')
})
