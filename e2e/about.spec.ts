import { test, expect } from '@playwright/test'

test('About & Privacy is reachable from the footer and links back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /About & Privacy/ }).click()

  await expect(page.getByRole('heading', { name: 'About & Privacy' })).toBeVisible()
  await expect(page.getByText(/own storage \(IndexedDB\)/)).toBeVisible()
  await expect(page.getByText(/Do Not Track/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Recipes & copyright/ })).toBeVisible()

  // Copyright / opt-out contact is present as a mailto link.
  await expect(page.getByRole('link', { name: /@/ }).first()).toHaveAttribute('href', /^mailto:/)
  // Source link is present.
  await expect(page.getByRole('link', { name: /github\.com/ })).toBeVisible()

  await page.getByRole('button', { name: '← Back' }).click()
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()
})
