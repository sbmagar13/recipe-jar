import { test, expect } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.reload()
})

test('export the jar to a file and restore it after wiping', async ({ page }) => {
  // Add one recipe by hand.
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Backup Test Curry')
  await page.getByLabel(/Ingredients/).fill('1 onion\n2 tomatoes')
  await page.getByLabel(/Steps/).fill('Fry.\nSimmer.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  // Export -> capture the download.
  await page.getByRole('button', { name: /My Jar/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Back up my jar/ }).click()
  const download = await downloadPromise
  const savedPath = join(tmpdir(), 'recipe-jar-e2e-backup.json')
  await download.saveAs(savedPath)
  expect(download.suggestedFilename()).toMatch(/recipe-jar-backup-\d{4}-\d{2}-\d{2}\.json/)

  // Wipe everything.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.reload()
  await expect(page.getByRole('button', { name: /My Jar \(/ })).toHaveCount(0)

  // Restore from the file.
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.locator('input[type="file"]').setInputFiles(savedPath)

  await expect(page.getByText('Added 1, skipped 0 already in your jar.')).toBeVisible()
  await expect(page.getByText('Backup Test Curry')).toBeVisible()
  await expect(page.getByRole('button', { name: /My Jar \(1\)/ })).toBeVisible()
})
