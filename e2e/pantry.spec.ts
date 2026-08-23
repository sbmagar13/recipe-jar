import { test, expect } from '@playwright/test'

// Pantry mode: name what's at home, the jar ranks what it can become.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.evaluate(() => localStorage.clear())
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
    const mk = (title: string, ings: string[]) => ({
      title,
      sourceUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
      savedAt: Date.now(),
      tags: [],
      recipe: {
        title, description: '', image: null, author: null, sourceUrl: '',
        servings: null, yieldText: null, totalTime: null, prepTime: null, cookTime: null,
        ingredients: ings.map((raw) => ({ raw, qty: null, qtyEnd: null, rest: raw })),
        steps: ['Cook.'],
      },
    })
    const tx = db.transaction('recipes', 'readwrite')
    for (const e of [
      mk('Red Lentil Dal', ['1 cup lentils', '1 onion', '2 tomatoes', 'turmeric']),
      mk('Palak Paneer', ['250 g paneer', 'spinach', '1 onion', 'cream', 'garam masala', 'tomatoes']),
      mk('Banana Bread', ['3 bananas', 'flour', 'sugar']),
      mk('Tomato Soup', ['6 tomatoes', '1 carrot']),
    ]) {
      tx.objectStore('recipes').add(e)
    }
    await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()))
    db.close()
  })
  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /What can I cook right now/ }).click()
  await expect(page.getByRole('heading', { name: 'What can I cook?' })).toBeVisible()
})

async function addChip(page: import('@playwright/test').Page, term: string) {
  await page.getByLabel('Add a pantry ingredient').fill(term)
  await page.getByLabel('Add a pantry ingredient').press('Enter')
}

test('ranks the jar by coverage and opens a dish', async ({ page }) => {
  await addChip(page, 'onion')
  await addChip(page, 'tomato')
  await addChip(page, 'lentils')

  const hits = page.locator('.pantry-hit')
  await expect(hits.first()).toContainText('Red Lentil Dal')
  await expect(hits.first()).toContainText('you have 3 of 4')
  await expect(page.locator('.pantry-hit', { hasText: 'Banana Bread' })).not.toBeVisible()

  await hits.first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Red Lentil Dal' })).toBeVisible()
})

test('the pantry persists and chips remove to rerank', async ({ page }) => {
  await addChip(page, 'banana')
  await addChip(page, 'tomato')
  // Tomato Soup covers 1 of 2 (50%), Banana Bread 1 of 3 (33%).
  await expect(page.locator('.pantry-hit').first()).toContainText('Tomato Soup')
  await expect(page.locator('.pantry-hit', { hasText: 'Banana Bread' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.getByRole('button', { name: /What can I cook right now/ }).click()
  await expect(page.locator('.pantry-chip', { hasText: 'banana' })).toBeVisible()

  await page.locator('.pantry-chip', { hasText: 'tomato' }).click()
  await expect(page.locator('.pantry-hit').first()).toContainText('Banana Bread')
  await expect(page.locator('.pantry-hit', { hasText: 'Tomato Soup' })).not.toBeVisible()
})

test('a typo snaps to the jar\'s own ingredients', async ({ page }) => {
  await addChip(page, 'panner')
  await expect(page.locator('.pantry-chip', { hasText: 'paneer' })).toBeVisible()
  await expect(page.locator('.pantry-hit').first()).toContainText('Palak Paneer')
})

test('honest empty states', async ({ page }) => {
  await expect(page.getByText(/Add an ingredient or two/)).toBeVisible()
  await addChip(page, 'zzzchocolate')
  await expect(page.getByText(/Nothing in your jar uses those/)).toBeVisible()
})
