import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => r()
      })
  )
  await page.evaluate(() => localStorage.removeItem('recipe-jar:installTipDismissed'))
  await page.reload()
})

test('iOS gets an Add-to-Home-Screen tip after saving; it stays dismissed', async ({ page }, testInfo) => {
  const tip = page.getByRole('dialog', { name: /Add Recipe Jar to your home screen/ })

  // Before saving anything, no tip.
  await expect(tip).toBeHidden()

  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  if (testInfo.project.name === 'iphone') {
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Add to Home Screen')
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(tip).toBeHidden()
    // Dismissal persists across reloads.
    await page.reload()
    await expect(tip).toBeHidden()
  } else {
    // Desktop/Android in headless: no beforeinstallprompt, not iOS, so no tip.
    await expect(tip).toBeHidden()
  }
})
