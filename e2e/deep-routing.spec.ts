import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
})

test('a saved recipe gets a bookmarkable URL that survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  // Saving gives the card a stable, shareable URL.
  await expect(page).toHaveURL(/#\/r\/\d+$/)
  const url = page.url()

  // Opening that URL cold restores the recipe, not the home screen.
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
})

test('a deep link to a missing recipe falls back to the jar', async ({ page }) => {
  await page.goto('/#/r/999999')
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
  // The bad id is cleared so a reload does not keep retrying it.
  await expect(page).not.toHaveURL(/r\/999999/)
})

test('the view routes are directly linkable', async ({ page }) => {
  await page.goto('/#/about')
  await expect(page.getByRole('heading', { name: /About/ })).toBeVisible()

  await page.goto('/#/jar')
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
})
