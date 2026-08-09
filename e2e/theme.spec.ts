import { test, expect } from '@playwright/test'

test('theme switch cycles auto -> light -> dark and survives a reload', async ({ page }) => {
  await page.goto('/')
  const toggle = page.getByRole('button', { name: /Theme:/ })
  await expect(toggle).toContainText('auto')

  await toggle.click()
  await expect(toggle).toContainText('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await toggle.click()
  await expect(toggle).toContainText('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // The override really restyles: paper goes deep olive even though the
  // browser itself is in light mode.
  await expect
    .poll(async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe('rgb(23, 26, 20)')

  // A pinned choice comes back before the app boots.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /Theme:/ })).toContainText('dark')

  // Full circle back to following the device.
  await page.getByRole('button', { name: /Theme:/ }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})
