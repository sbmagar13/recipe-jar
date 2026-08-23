import { test, expect } from '@playwright/test'

// Kitchen memory: finishing cook mode on a saved recipe marks the cook and
// asks what you'd change; the answer becomes a dated line in the notes.

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
  await page.getByLabel('Recipe name').fill('Memory Dal')
  await page.getByLabel(/Ingredients/).fill('1 cup lentils')
  await page.getByLabel(/Steps/).fill('Rinse.\nBoil.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
})

test('finishing cook mode asks the question and files a dated note', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  // The moment: cooked count bumped, question on screen.
  await expect(page.getByText(/Cooked it 🎉/)).toBeVisible()
  await expect(page.getByText(/Cooked 1 time/)).toBeVisible()

  await page.getByLabel("What you'd change next time").fill('less salt next time')
  await page.getByRole('button', { name: 'Add to my notes' }).click()

  await expect(page.getByText(/Cooked it 🎉/)).not.toBeVisible()
  // The note landed, dated, in the personal notes.
  // Engines disagree on date order ("23 Aug" vs "Aug 23"); both are fine.
  await expect(page.locator('.notes-input')).toHaveValue(/^(\d+ \w+|\w+ \d+): less salt next time/)

  // Cooking again appends rather than overwrites.
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(/Cooked 2 times/)).toBeVisible()
  await page.getByLabel("What you'd change next time").fill('perfect as is')
  await page.getByRole('button', { name: 'Add to my notes' }).click()
  await expect(page.locator('.notes-input')).toHaveValue(/less salt next time/)
  await expect(page.locator('.notes-input')).toHaveValue(/perfect as is/)
})

test('"Not this time" closes the moment without a note, cook still counted', async ({ page }) => {
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(/Cooked it 🎉/)).toBeVisible()
  await page.getByRole('button', { name: 'Not this time' }).click()
  await expect(page.getByText(/Cooked it 🎉/)).not.toBeVisible()
  await expect(page.getByText(/Cooked 1 time/)).toBeVisible()
  await expect(page.locator('.notes-input')).toHaveValue('')
})

test('an unsaved recipe finishing cook mode gets no memory prompt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '▶ Cook' }).click()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(/Cooked it 🎉/)).not.toBeVisible()
})
