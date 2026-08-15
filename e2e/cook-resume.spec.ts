import { test, expect } from '@playwright/test'

// The kitchen release: cook mode remembers your place and moves on a
// knuckle-tap. Resume only applies to saved recipes, so these seed one by hand.

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
  await page.getByLabel('Recipe name').fill('Resume Dal')
  await page.getByLabel(/Ingredients/).fill('1 cup lentils\n1 onion')
  await page.getByLabel(/Steps/).fill('Rinse the lentils.\nFry the onion.\nSimmer everything.\nServe warm.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
})

test('cook mode picks up where you left off, and start over resets', async ({ page }) => {
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 3 of 4')).toBeVisible()

  // Leave mid-recipe (the ✕, same as a stray Escape).
  await page.getByRole('button', { name: 'Exit cook mode' }).click()
  await expect(page.getByRole('button', { name: '▶ Cook' })).toBeVisible()

  // Coming back resumes at the same step and says so.
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await expect(page.getByText('Step 3 of 4')).toBeVisible()
  await expect(page.getByText(/picked up where you left off/)).toBeVisible()

  await page.getByRole('button', { name: 'start over' }).click()
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
  await expect(page.getByText(/picked up where you left off/)).not.toBeVisible()
})

test('finishing with Done forgets the place', async ({ page }) => {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 4 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: '▶ Cook' }).click()
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
  await expect(page.getByText(/picked up where you left off/)).not.toBeVisible()
})

test('a clean tap on the step moves forward, the left edge goes back', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'tap zones are a touch affordance')

  const step = page.locator('.cook-step')
  const box = (await step.boundingBox())!
  const viewport = page.viewportSize()!

  // Tap on the right side of the step text: forward.
  await page.touchscreen.tap(viewport.width * 0.75, box.y + box.height / 2)
  await expect(page.getByText('Step 2 of 4')).toBeVisible()

  // Tap near the left edge: back.
  const box2 = (await step.boundingBox())!
  await page.touchscreen.tap(viewport.width * 0.1, box2.y + box2.height / 2)
  await expect(page.getByText('Step 1 of 4')).toBeVisible()

  // A tap on a real control does not navigate: the ingredients toggle opens.
  await page.getByRole('button', { name: 'Show ingredients' }).click()
  await expect(page.getByText('1 cup lentils')).toBeVisible()
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
})
