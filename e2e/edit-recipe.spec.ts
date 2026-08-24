import { test, expect } from '@playwright/test'

// The "your version" release: edit any saved recipe; tags, notes, and cook
// history survive; the cooked-history line grows with each finished cook.

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
  await page.getByLabel('Recipe name').fill('Family Dal')
  await page.getByLabel(/Ingredients/).fill('1 cup lentils\n2 tsp salt')
  await page.getByLabel(/Steps/).fill('Boil.\nServe.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
})

test('editing rewrites the dish and keeps its story', async ({ page }) => {
  // Give it a note and a cook first, so there is a story to keep.
  await page.locator('.notes-input').fill('too salty last time')
  await page.locator('.notes-input').blur()
  await page.getByRole('button', { name: /I cooked this/ }).click()
  await expect(page.getByText(/Cooked 1 time/)).toBeVisible()

  await page.getByRole('button', { name: '✎ Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit recipe' })).toBeVisible()
  // The touch-up form hides the import helpers.
  await expect(page.getByText(/Add from a photo/)).not.toBeVisible()
  // Fields arrive prefilled.
  await expect(page.getByLabel('Recipe name')).toHaveValue('Family Dal')
  await expect(page.getByLabel(/Ingredients/)).toHaveValue('1 cup lentils\n2 tsp salt')

  await page.getByLabel(/Ingredients/).fill('1 cup lentils\n1 tsp salt\n1 tsp cumin')
  await page.getByLabel('Recipe name').fill('Family Dal, My Way')
  await page.getByRole('button', { name: 'Save changes' }).click()

  // Straight back to the card, updated, still the same saved entry.
  await expect(page.getByRole('heading', { level: 1, name: 'Family Dal, My Way' })).toBeVisible()
  await expect(page.getByText('1 tsp cumin')).toBeVisible()
  await expect(page.getByText('2 tsp salt')).not.toBeVisible()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  await expect(page.getByText(/Cooked 1 time/)).toBeVisible()
  await expect(page.locator('.notes-input')).toHaveValue('too salty last time')

  // And it stuck in the database.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Family Dal, My Way' })).toBeVisible()
  await expect(page.getByText('1 tsp cumin')).toBeVisible()
})

test('cancelling an edit changes nothing', async ({ page }) => {
  await page.getByRole('button', { name: '✎ Edit' }).click()
  await page.getByLabel('Recipe name').fill('Should Not Stick')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Family Dal' })).toBeVisible()

  // A plain "add your own" afterwards starts blank, not in edit mode.
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Add your own recipe/ }).click()
  await expect(page.getByRole('heading', { name: 'Add or paste a recipe' })).toBeVisible()
  await expect(page.getByLabel('Recipe name')).toHaveValue('')
})

test('the cooked-history line appears from the second cook', async ({ page }) => {
  await page.getByRole('button', { name: /I cooked this/ }).click()
  await expect(page.getByText(/Cooked 1 time/)).toBeVisible()
  await expect(page.locator('.cooked-history')).not.toBeVisible()
  await page.getByRole('button', { name: /I cooked this/ }).click()
  await expect(page.getByText(/Cooked 2 times/)).toBeVisible()
  await expect(page.locator('.cooked-history')).toBeVisible()
  await expect(page.locator('.cooked-history')).toContainText('Your history:')
})
