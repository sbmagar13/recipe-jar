import { test, expect } from '@playwright/test'

// The app is a single-page app; these guard that in-app navigation is wired into
// browser history so the Back button/gesture moves between screens instead of
// leaving the app.
test('browser Back returns from My Jar to the previous screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()

  // Home -> My Jar
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()

  // Browser Back -> Home
  await page.goBack()
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()

  // Browser Forward -> My Jar again
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
})

test('Back steps through a multi-screen path (home -> sample recipe -> jar)', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()

  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()

  // Back: jar -> recipe
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()

  // Back: recipe -> home
  await page.goBack()
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()
})

test('the in-app "Back" button mirrors browser Back (recipe opened from jar)', async ({ page }) => {
  await page.goto('/')
  // Seed a recipe and open it from the jar.
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()

  await page.locator('button.jar-item', { hasText: 'Red Lentil Dal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()

  // In-app back should return to the jar (where we came from), not home.
  await page.getByRole('button', { name: '← Back' }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
})
