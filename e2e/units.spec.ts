import { test, expect } from '@playwright/test'

// Metric display: cups and ounces become grams/millilitres on the card and
// in cook mode's ingredient sheet, never in the shopping list.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Metric Cake')
  await page.getByLabel(/Ingredients/).fill('1 cup flour\n8 oz cream cheese\n1 tsp vanilla\n1 cup chopped celery')
  await page.getByLabel(/Steps/).fill('Mix.\nBake.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
})

test('the toggle converts known lines, honestly marks densities, and persists', async ({ page }) => {
  await expect(page.getByText('1 cup flour')).toBeVisible()

  await page.getByRole('button', { name: /⇄ metric/ }).click()
  await expect(page.getByText('≈ 120 g flour')).toBeVisible()
  await expect(page.getByText('225 g cream cheese')).toBeVisible()
  await expect(page.getByText('240 ml chopped celery')).toBeVisible()
  // Spoons stay spoons.
  await expect(page.getByText('1 tsp vanilla')).toBeVisible()

  // The choice sticks across a reload (via the deep link back to the card).
  await page.reload()
  await expect(page.getByText('≈ 120 g flour')).toBeVisible()
  await page.getByRole('button', { name: /⇄ original units/ }).click()
  await expect(page.getByText('1 cup flour')).toBeVisible()
})

test('cook mode sheet converts; the shopping list never does', async ({ page }) => {
  await page.getByRole('button', { name: /⇄ metric/ }).click()
  await expect(page.getByText('≈ 120 g flour')).toBeVisible()

  await page.getByRole('button', { name: '▶ Cook' }).click()
  await page.getByRole('button', { name: 'Show ingredients' }).click()
  await expect(page.locator('.cook-ingredients')).toContainText('≈ 120 g flour')
  await page.getByRole('button', { name: 'Exit cook mode' }).click()

  await page.getByRole('button', { name: /Shopping list/ }).click()
  await expect(page.getByText(/1 cup flour/)).toBeVisible()
})
