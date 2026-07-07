import { test, expect } from '@playwright/test'

// Android's share sheet opens the installed PWA with the shared URL in the
// query string (?url=/?text=/?title=, per the manifest share_target). These
// tests drive that entry point directly, with /api/proxy mocked so no live
// network is involved.

const FIXTURE_HTML = `<!doctype html><html><head><title>Shared Site</title>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Share-Target Pancakes',
  recipeYield: '4 servings',
  recipeIngredient: ['300 ml milk', '2 eggs', '150 g flour'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Whisk and fry.' }],
})}</script></head><body></body></html>`

test.beforeEach(async ({ page }) => {
  await page.route('**/api/proxy*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: FIXTURE_HTML })
  )
})

test('a URL shared into the app (?text=) is fetched automatically', async ({ page }) => {
  await page.goto('/?text=' + encodeURIComponent('Look at this! https://example.com/pancakes yum'))

  await expect(page.getByRole('heading', { level: 1, name: 'Share-Target Pancakes' })).toBeVisible()
  await expect(page.getByText('300 ml milk')).toBeVisible()
  // The share query is cleaned from the address bar.
  expect(page.url()).not.toContain('text=')
})

test('?url= form works too', async ({ page }) => {
  await page.goto('/?url=' + encodeURIComponent('https://example.com/pancakes'))
  await expect(page.getByRole('heading', { level: 1, name: 'Share-Target Pancakes' })).toBeVisible()
})

test('shared text without any URL lands safely on home', async ({ page }) => {
  await page.goto('/?text=' + encodeURIComponent('just some words, no link'))
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()
  expect(page.url()).not.toContain('text=')
})
