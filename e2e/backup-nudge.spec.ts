import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
  await page.evaluate(() => {
    localStorage.removeItem('recipe-jar:lastBackup')
    localStorage.removeItem('recipe-jar:lastBackupCount')
    localStorage.removeItem('recipe-jar:backupNudgeSnoozed')
  })
  await page.reload()
})

// Seed N recipes straight into the Dexie-created object store so we don't have
// to drive the save flow N times.
async function seedJar(page: Page, n: number) {
  await page.evaluate(async (count) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('recipe-jar')
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction('recipes', 'readwrite')
        const store = tx.objectStore('recipes')
        for (let i = 0; i < count; i++) {
          const sourceUrl = `https://example.com/seeded-${i}`
          store.add({
            title: `Seeded recipe ${i}`,
            sourceUrl,
            savedAt: Date.now(),
            tags: [],
            recipe: {
              title: `Seeded recipe ${i}`, description: '', image: null, author: null,
              sourceUrl, servings: 2, yieldText: null, totalTime: null,
              prepTime: null, cookTime: null, ingredients: [], steps: [],
            },
          })
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      open.onerror = () => reject(open.error)
    })
  }, n)
  await page.reload()
}

test('nudges to back up when the jar has never been backed up, and stays dismissed', async ({ page }) => {
  await seedJar(page, 3)
  await page.getByRole('button', { name: /My Jar/ }).click()

  const nudge = page.getByRole('status').filter({ hasText: /only on this device/i })
  await expect(nudge).toBeVisible()

  // "Later" snoozes it and it does not come back on reload.
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(nudge).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByText(/only on this device/i)).toBeHidden()
})

test('no nudge for a small, freshly-started jar', async ({ page }) => {
  await seedJar(page, 1)
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByRole('heading', { name: 'My Jar' })).toBeVisible()
  await expect(page.getByText(/only on this device/i)).toBeHidden()
})
