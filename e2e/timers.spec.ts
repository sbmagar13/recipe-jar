import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
})

test('a step with a cook time gets a tappable timer that runs and pauses', async ({ page }) => {
  // Step 1: "...for 20 minutes, until soft."
  const chip = page.getByRole('button', { name: 'Start a 20 min timer' })
  await expect(chip).toBeVisible()
  await expect(chip).toHaveText(/20 min/)

  await chip.click()
  // Running: shows a live countdown clock and can now be paused.
  const running = page.getByRole('button', { name: /Pause timer/ })
  await expect(running).toBeVisible()
  await expect(running).toHaveText(/\d+:\d\d/)
  await expect(running).toHaveClass(/running/)

  await running.click()
  await expect(page.getByRole('button', { name: /Resume timer/ })).toBeVisible()
})

test('it detects every cook time in the recipe (20 min, 2 min, 5 min)', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Start a 20 min timer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start a 2 min timer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start a 5 min timer' })).toBeVisible()
})

test('steps without a cook time have no timer chip', async ({ page }) => {
  // "...fry the cumin seeds until they pop." has no duration.
  const step = page.getByRole('listitem').filter({ hasText: 'until they pop' })
  await expect(step).toBeVisible()
  await expect(step.getByRole('button')).toHaveCount(0)
})
