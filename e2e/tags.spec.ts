import { test, expect } from '@playwright/test'

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

test('tags attach to a saved recipe, filter the jar, and persist', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()

  // The tag editor only appears once the recipe is in the jar.
  await expect(page.getByLabel('Add a tag')).toHaveCount(0)

  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  const tagInput = page.getByLabel('Add a tag')
  await expect(tagInput).toBeVisible()

  // Enter commits a tag; it shows as a #chip and clears the input.
  await tagInput.fill('Dinner')
  await tagInput.press('Enter')
  await expect(page.getByText('#dinner')).toBeVisible() // normalised to lowercase
  await expect(tagInput).toHaveValue('')

  await tagInput.fill('vegan')
  await tagInput.press('Enter')
  await expect(page.getByText('#vegan')).toBeVisible()

  // A duplicate (any case) is ignored, not doubled.
  await tagInput.fill('VEGAN')
  await tagInput.press('Enter')
  await expect(page.getByText('#vegan')).toHaveCount(1)

  // Remove one tag via its ✕.
  await page.getByRole('button', { name: 'Remove tag dinner' }).click()
  await expect(page.getByText('#dinner')).toHaveCount(0)
  await expect(page.getByText('#vegan')).toBeVisible()

  // The jar exposes a tag filter and searching by tag works.
  await page.getByRole('button', { name: /My Jar/ }).click()
  const filter = page.getByRole('button', { name: '#vegan' })
  await expect(filter).toBeVisible()
  await filter.click()
  await expect(page.locator('button.jar-item', { hasText: 'Red Lentil Dal' })).toBeVisible()

  // Reopen from the jar: the tag is still there.
  await page.locator('button.jar-item', { hasText: 'Red Lentil Dal' }).click()
  await expect(page.getByText('#vegan')).toBeVisible()

  // Persists across a reload too.
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('button', { name: '#vegan' })).toBeVisible()
})
