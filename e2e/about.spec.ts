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
  // Source link and the maker's profile are both present.
  await expect(page.getByRole('link', { name: /github\.com\/sbmagar13\/recipe-jar/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Who made this/ })).toBeVisible()

  await page.getByRole('button', { name: '← Back' }).click()
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()
})
