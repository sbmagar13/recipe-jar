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

test('a timer set on one step stays visible from other steps, and tapping it jumps back', async ({ page }) => {
  // Start the 20 min timer that lives on step 1.
  await page.getByRole('button', { name: 'Start a 20 min timer' }).click()
  // While on its own step it is not a "background" timer, so the tray stays away.
  await expect(page.getByRole('group', { name: 'Timers running on other steps' })).toBeHidden()

  // Move off step 1: the still-running timer follows into the cross-step tray.
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 2 of 5')).toBeVisible()

  const tray = page.getByRole('group', { name: 'Timers running on other steps' })
  await expect(tray).toBeVisible()
  const trayTimer = tray.getByRole('button', { name: /Step 1 timer.*Go to step 1/ })
  await expect(trayTimer).toBeVisible()

  // Tapping the tray timer jumps back to its step, where its own chip is now a
  // Pause control and the tray (nothing running elsewhere) disappears again.
  await trayTimer.click()
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
  await expect(page.getByRole('button', { name: /Pause timer/ })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Timers running on other steps' })).toBeHidden()
})

test('a running timer can be reset back to the start', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a 20 min timer' }).click()
  await expect(page.getByRole('button', { name: /Pause timer/ })).toBeVisible()

  await page.getByRole('button', { name: 'Reset 20 min timer' }).click()
  // Back to the untouched "start" state, and the reset control is gone.
  await expect(page.getByRole('button', { name: 'Start a 20 min timer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset 20 min timer' })).toBeHidden()
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
