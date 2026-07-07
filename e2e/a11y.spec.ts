import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Only run the accessibility audit on one engine — axe results are
// engine-independent and this keeps the matrix fast. Reduced motion disables the
// card's intro animation so axe doesn't sample colours mid-fade (a false positive).
test.skip(({ browserName }) => browserName !== 'chromium', 'axe audit runs on chromium only')
test.use({ reducedMotion: 'reduce' })

// Structural best-practice rules we also want to enforce even though axe rates
// them below "serious".
const ALSO_GATE = new Set(['heading-order', 'landmark-one-main', 'region', 'bypass', 'page-has-heading-one'])

async function audit(page: Page, context: string) {
  // Snap any entrance animation to its end-state so axe never samples a colour
  // mid-fade (which produces false-positive contrast failures under load).
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important}',
  })
  await page.waitForTimeout(50)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  const gated = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical' || ALSO_GATE.has(v.id)
  )
  const summary = gated
    .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n')
  expect(gated, `${context} has a11y violations:\n${summary}`).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('home view is accessible', async ({ page }) => {
  await audit(page, 'home')
})

test('sample recipe view is accessible', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await audit(page, 'recipe')
})

test('cook mode is accessible', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
  await audit(page, 'cook-mode')
})

test('jar view is accessible (with a saved recipe)', async ({ page }) => {
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
  await audit(page, 'jar')
})

test('manual entry view is accessible', async ({ page }) => {
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await expect(page.getByLabel('Recipe name')).toBeVisible()
  await audit(page, 'manual-entry')
})

test('import help view is accessible', async ({ page }) => {
  await page.getByRole('button', { name: /Recipe from a blocked site/i }).click()
  await audit(page, 'import')
})

test('about view is accessible', async ({ page }) => {
  await page.getByRole('button', { name: /About & Privacy/ }).click()
  await expect(page.getByRole('heading', { name: 'About & Privacy' })).toBeVisible()
  await audit(page, 'about')
})
