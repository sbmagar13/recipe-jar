import { test, expect, type ConsoleMessage } from '@playwright/test'

// Fresh IndexedDB per test so runs are independent.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
  await page.reload()
})

function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test('save a fetched recipe to the jar and it persists across reload @network', async ({ page }) => {
  const errors = collectPageErrors(page)

  // Fetch a real recipe through the dev proxy (Swedish site, reliable JSON-LD).
  await page.getByLabel('Recipe URL').fill('https://www.koket.se/klassisk-lasagne')
  await page.getByRole('button', { name: 'Get the recipe' }).click()

  // Recipe card renders.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })

  // Save it.
  await page.getByRole('button', { name: '+ Save to my jar' }).click()

  // The button should flip to the saved state. This is what fails when the
  // $state proxy can't be structured-cloned into IndexedDB.
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  // No DataCloneError (or any error) should have surfaced.
  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])

  // Jar shows a count and the recipe.
  await expect(page.getByRole('button', { name: /My Jar \(1\)/ })).toBeVisible()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
  await expect(page.getByText('Lasagne', { exact: false }).first()).toBeVisible()

  // Persistence: reload and the jar still has it.
  await page.reload()
  await expect(page.getByRole('button', { name: /My Jar \(1\)/ })).toBeVisible()
})

test('add a manual recipe and it appears in the jar', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Mums dal')
  await page.getByLabel('Servings').fill('4')
  await page.getByLabel(/Ingredients/).fill('2 cups red lentils\n1 tsp turmeric')
  await page.getByLabel(/Steps/).fill('Rinse lentils.\nBoil 20 minutes.')
  await page.getByRole('button', { name: 'Create recipe' }).click()

  await expect(page.getByRole('heading', { name: 'Mums dal' })).toBeVisible()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})

test('the sample recipe loads instantly and is savable', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { name: /Red Lentil Dal/ })).toBeVisible()
  await expect(page.getByText('1 cup red lentils, rinsed')).toBeVisible()
  // Servings scaler works on the sample too.
  await page.getByRole('button', { name: 'More servings' }).click()
  await expect(page.getByText('5 servings')).toBeVisible()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
})

test('a bare domain (no https://) still fetches @network', async ({ page }) => {
  await page.getByLabel('Recipe URL').fill('www.bbcgoodfood.com/recipes/classic-lasagne-0')
  await page.getByRole('button', { name: 'Get the recipe' }).click()
  await expect(page.getByRole('heading', { name: /lasagne/i })).toBeVisible({ timeout: 20000 })
})
