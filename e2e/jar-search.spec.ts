import { test, expect } from '@playwright/test'

// "My jar knows me": word-AND search across title/tags/ingredients, and a
// typo snaps to the jar's own vocabulary. The search box appears above 3
// entries, so four recipes are seeded straight into IndexedDB via the app's
// own manual-entry flow being too slow for four; direct DB writes keep it fast.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
  await page.evaluate(async () => {
    const open = indexedDB.open('recipe-jar', 2)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onupgradeneeded = () => {
        const d = open.result
        const store = d.createObjectStore('recipes', { keyPath: 'id', autoIncrement: true })
        store.createIndex('title', 'title')
        store.createIndex('sourceUrl', 'sourceUrl')
        store.createIndex('savedAt', 'savedAt')
        d.createObjectStore('meta', { keyPath: 'key' })
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const mk = (title: string, ings: string[], tags: string[] = []) => ({
      title,
      sourceUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
      savedAt: Date.now(),
      tags,
      recipe: {
        title,
        description: '',
        image: null,
        author: null,
        sourceUrl: '',
        servings: null,
        yieldText: null,
        totalTime: null,
        prepTime: null,
        cookTime: null,
        ingredients: ings.map((raw) => ({ raw, qty: null, qtyEnd: null, rest: raw })),
        steps: ['Cook it.'],
      },
    })
    const tx = db.transaction('recipes', 'readwrite')
    for (const e of [
      mk('Palak Paneer', ['250 g paneer', '400 g spinach', '2 tomatoes'], ['indian']),
      mk('Banana Bread', ['3 bananas', '2 cups flour']),
      mk('Chicken Curry', ['500 g chicken', '1 onion']),
      mk('Tomato Soup', ['6 tomatoes', '1 carrot']),
    ]) {
      tx.objectStore('recipes').add(e)
    }
    await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()))
    db.close()
  })
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await expect(page.getByLabel('Search saved recipes')).toBeVisible()
})

test('every search word must match: "paneer spinach" finds only the dish with both', async ({ page }) => {
  await page.getByLabel('Search saved recipes').fill('paneer spinach')
  await expect(page.locator('.jar-item', { hasText: 'Palak Paneer' })).toBeVisible()
  await expect(page.locator('.jar-item', { hasText: 'Banana Bread' })).not.toBeVisible()
  await expect(page.locator('.jar-item', { hasText: 'Tomato Soup' })).not.toBeVisible()
})

test('a typo snaps to the jar\'s own vocabulary with a note', async ({ page }) => {
  await page.getByLabel('Search saved recipes').fill('panner')
  await expect(page.getByText(/Showing matches for “paneer”/)).toBeVisible()
  await expect(page.locator('.jar-item', { hasText: 'Palak Paneer' })).toBeVisible()
  await expect(page.locator('.jar-item', { hasText: 'Banana Bread' })).not.toBeVisible()
})

test('gibberish still says nothing matches', async ({ page }) => {
  await page.getByLabel('Search saved recipes').fill('zzzzzz')
  await expect(page.getByText(/Nothing matches/)).toBeVisible()
})
