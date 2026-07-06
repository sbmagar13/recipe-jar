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

test('restore from pasted backup text (in-app browser path)', async ({ page }) => {
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Paste Restore Soup')
  await page.getByLabel(/Ingredients/).fill('1 leek\n1 potato')
  await page.getByLabel(/Steps/).fill('Chop.\nBoil.')
  await page.getByRole('button', { name: 'Create recipe' }).click()

  // Grab the backup text via the download, then wipe.
  await page.getByRole('button', { name: /My Jar/ }).click()
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: /Back up my jar/ }).click()
  const stream = await (await dl).createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  const backupText = Buffer.concat(chunks).toString('utf-8')

  await page.evaluate(
    () => new Promise<void>((r) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => r()
    })
  )
  await page.reload()

  // Restore by pasting the text.
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Paste backup/ }).click()
  await page.getByLabel('Paste backup text').fill(backupText)
  await page.getByRole('button', { name: 'Restore', exact: true }).click()

  await expect(page.getByText('Paste Restore Soup')).toBeVisible()
  await expect(page.getByRole('button', { name: /My Jar \(1\)/ })).toBeVisible()
})
