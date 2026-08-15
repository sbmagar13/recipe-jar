import { test, expect } from '@playwright/test'

// Auto-backup rides on the File System Access API. Headless runs cannot open
// a real save dialog, so the picker is stubbed with a fake handle that records
// every write into window.__autosyncWrites. The rest of the pipeline (Dexie
// hooks, debounce, status line, nudge bookkeeping) is the real code.

declare global {
  interface Window {
    __autosyncWrites: string[]
  }
}

// The real API is Chromium-only; webkit runs would only exercise the stub.
test.skip(({ browserName }) => browserName !== 'chromium', 'File System Access API is Chromium-only')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__autosyncWrites = []
    const fakeHandle = {
      name: 'recipe-jar-backup.json',
      kind: 'file',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      createWritable: async () => {
        let buffer = ''
        return {
          write: async (chunk: string) => {
            buffer += chunk
          },
          close: async () => {
            window.__autosyncWrites.push(buffer)
          },
        }
      },
    }
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => fakeHandle,
    })
  })
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('setting up auto-backup writes the jar and keeps writing on changes', async ({ page }) => {
  // One recipe in the jar so the auto-backup line appears.
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Autosync Dal')
  await page.getByLabel(/Ingredients/).fill('1 cup lentils')
  await page.getByLabel(/Steps/).fill('Boil.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Auto-backup: pick a file once/ }).click()

  // The setup write lands immediately and the status line flips on.
  await expect(page.getByText(/Auto-backup: recipe-jar-backup\.json/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__autosyncWrites.length)).toBeGreaterThan(0)
  const first = await page.evaluate(() => JSON.parse(window.__autosyncWrites.at(-1)!))
  expect(first.format).toBe('recipe-jar-backup')
  expect(first.recipes).toHaveLength(1)
  expect(first.recipes[0].title).toBe('Autosync Dal')

  // The automatic write also satisfies the manual-backup bookkeeping.
  const stamped = await page.evaluate(() => localStorage.getItem('recipe-jar:lastBackup'))
  expect(Number(stamped)).toBeGreaterThan(0)

  // A change to the jar (delete) triggers a fresh debounced write.
  const before = await page.evaluate(() => window.__autosyncWrites.length)
  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Delete Autosync Dal/ }).click()
  await expect
    .poll(() => page.evaluate(() => window.__autosyncWrites.length), { timeout: 10_000 })
    .toBeGreaterThan(before)
  const latest = await page.evaluate(() => JSON.parse(window.__autosyncWrites.at(-1)!))
  expect(latest.recipes).toHaveLength(0)
})

test('auto-backup shows the reconnect state after a reload', async ({ page }) => {
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Reload Curry')
  await page.getByLabel(/Ingredients/).fill('1 onion')
  await page.getByLabel(/Steps/).fill('Cook.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Auto-backup: pick a file once/ }).click()
  await expect(page.getByText(/Auto-backup: recipe-jar-backup\.json/)).toBeVisible()

  // After a reload the stored handle loses its methods (structured clone strips
  // the stub), which mirrors a real browser demanding a fresh permission tap.
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByText(/Auto-backup is paused/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible()

  // Reconnect goes through the (stubbed) picker again and resumes.
  await page.getByRole('button', { name: 'Reconnect' }).click()
  await expect(page.getByText(/Auto-backup: recipe-jar-backup\.json/)).toBeVisible()
})

test('turning auto-backup off returns to the setup line', async ({ page }) => {
  await page.getByRole('button', { name: /type in one of your own/i }).click()
  await page.getByLabel('Recipe name').fill('Off Test')
  await page.getByLabel(/Ingredients/).fill('1 egg')
  await page.getByLabel(/Steps/).fill('Fry.')
  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()

  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /Auto-backup: pick a file once/ }).click()
  await expect(page.getByText(/Auto-backup: recipe-jar-backup\.json/)).toBeVisible()
  await page.getByRole('button', { name: 'Turn off' }).click()
  await expect(page.getByRole('button', { name: /Auto-backup: pick a file once/ })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('recipe-jar:autosync'))).toBeNull()
})
