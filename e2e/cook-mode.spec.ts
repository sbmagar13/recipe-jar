import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
  await page.getByRole('button', { name: '▶ Cook' }).click()
})

test('steps forward and back through the recipe, then finishes', async ({ page }) => {
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
  await expect(page.getByText(/Simmer the lentils/)).toBeVisible()
  // The current step's timer travels into cook mode.
  await expect(page.getByRole('button', { name: 'Start a 20 min timer' })).toBeVisible()

  // Back is disabled on the first step.
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled()

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 2 of 5')).toBeVisible()
  await expect(page.getByText(/fry the cumin seeds/)).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByText('Step 1 of 5')).toBeVisible()

  // Walk to the last step; Next becomes Done.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 5 of 5')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Back to the normal card.
  await expect(page.getByRole('heading', { name: 'Method' })).toBeVisible()
  await expect(page.getByRole('button', { name: '▶ Cook' })).toBeVisible()
})

test('ingredients can be peeked without leaving the step', async ({ page }) => {
  await page.getByRole('button', { name: 'Show ingredients' }).click()
  await expect(page.getByText('1 cup red lentils, rinsed')).toBeVisible()
  await page.getByRole('button', { name: 'Hide ingredients' }).click()
  await expect(page.getByText('1 cup red lentils, rinsed')).toBeHidden()
})

test('exit (✕) returns to the full recipe', async ({ page }) => {
  await page.getByRole('button', { name: 'Exit cook mode' }).click()
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible()
  await expect(page.getByText('Step 1 of 5')).toBeHidden()
})
