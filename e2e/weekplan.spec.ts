import { test, expect } from '@playwright/test'

// The planning release: assign picked recipes to days, see the week at a
// glance, and My Jar greets you with tonight's dinner.

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
  for (const [name, ing] of [
    ['Monday Dal', '1 cup lentils'],
    ['Someday Soup', '2 carrots'],
  ] as const) {
    await page.getByRole('button', { name: /type in one of your own/i }).click()
    await page.getByLabel('Recipe name').fill(name)
    await page.getByLabel(/Ingredients/).fill(ing)
    await page.getByLabel(/Steps/).fill('Cook.')
    await page.getByRole('button', { name: 'Create recipe' }).click()
    await expect(page.getByText('✓ In your jar')).toBeVisible()
    await page.goto('/')
  }
})

test('assigning days builds the week strip and the Tonight line, and it persists', async ({ page }) => {
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Plan a shopping list/ }).click()

  // Pick both; put one on Today, leave the other on Any day.
  await page.getByRole('checkbox', { name: /Monday Dal/ }).check()
  await page.getByRole('checkbox', { name: /Someday Soup/ }).check()
  await page.getByLabel('Which day for Monday Dal').selectOption({ label: 'Today' })

  // The week strip shows today's dish.
  await expect(page.locator('.plan-week-day b', { hasText: 'Today' })).toBeVisible()
  await expect(page.locator('.plan-week')).toContainText('Monday Dal')
  await expect(page.locator('.plan-week')).not.toContainText('Someday Soup')

  // The merged list still covers both picks.
  await page.getByRole('button', { name: /Make the list \(2\)/ }).click()
  await expect(page.getByText(/1 cup lentils/)).toBeVisible()
  await expect(page.getByText(/2 carrots/)).toBeVisible()
  await page.getByRole('button', { name: /Back to recipes/ }).click()

  // My Jar greets with tonight's dinner; the link opens the recipe.
  await page.getByRole('button', { name: /Back to my jar/ }).click()
  await expect(page.getByText(/🍳 Tonight:/)).toBeVisible()
  await page.locator('.tonight').getByRole('button', { name: 'Monday Dal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Monday Dal' })).toBeVisible()

  // Survives a reload.
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByText(/🍳 Tonight:/)).toBeVisible()
})

test('unpicking a dish takes it off its night', async ({ page }) => {
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Plan a shopping list/ }).click()
  await page.getByRole('checkbox', { name: /Monday Dal/ }).check()
  await page.getByLabel('Which day for Monday Dal').selectOption({ label: 'Today' })
  await expect(page.locator('.plan-week')).toContainText('Monday Dal')

  await page.getByRole('checkbox', { name: /Monday Dal/ }).uncheck()
  await expect(page.locator('.plan-week')).not.toBeVisible()

  await page.getByRole('button', { name: /Back to my jar/ }).click()
  await expect(page.getByText(/🍳 Tonight:/)).not.toBeVisible()
})
