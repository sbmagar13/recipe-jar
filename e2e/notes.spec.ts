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

test('notes and "I cooked this" attach to a saved recipe and persist', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()

  // Personal section only appears once the recipe is in the jar.
  await expect(page.getByLabel('Your notes for this recipe')).toHaveCount(0)

  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  const notes = page.getByLabel('Your notes for this recipe')
  await expect(notes).toBeVisible()
  await notes.fill('Used less chilli, added spinach at the end.')
  await notes.blur()
  await expect(page.getByText('Saved ✓')).toBeVisible()

  const cook = page.getByRole('button', { name: '🍳 I cooked this' })
  await cook.click()
  await expect(page.getByText(/Cooked 1 time\b/)).toBeVisible()
  await cook.click()
  await expect(page.getByText(/Cooked 2 times/)).toBeVisible()

  // Persists across a reload, reopened from the jar.
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByText(/cooked 2×/)).toBeVisible()

  await page.locator('button.jar-item', { hasText: 'Red Lentil Dal' }).click()
  await expect(page.getByLabel('Your notes for this recipe')).toHaveValue('Used less chilli, added spinach at the end.')
  await expect(page.getByText(/Cooked 2 times/)).toBeVisible()
})

test('a backup carries notes and cook stats', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard read is chromium-only in Playwright')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await page.getByLabel('Your notes for this recipe').fill('My note')
  await page.getByLabel('Your notes for this recipe').blur()
  await page.getByRole('button', { name: '🍳 I cooked this' }).click()
  await expect(page.getByText(/Cooked 1 time\b/)).toBeVisible()

  // Back up through the real UI and confirm the personal data rode along.
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Copy backup/ }).click()
  const backup = await page.evaluate(() => navigator.clipboard.readText())
  const parsed = JSON.parse(backup)
  expect(parsed.recipes[0].notes).toBe('My note')
  expect(parsed.recipes[0].cookedCount).toBe(1)
})
