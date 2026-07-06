import { chromium, devices } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
const page = await ctx.newPage()
await page.goto('http://localhost:5244/')
await page.waitForTimeout(500)
await page.evaluate(async () => {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('recipe-jar')
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('recipes', 'readwrite')
      const store = tx.objectStore('recipes')
      const names = ['Miso Ramen', 'Dal Bhat', 'Kanelbullar', 'Green Curry']
      for (let i = 0; i < 4; i++) {
        const sourceUrl = 'https://example.com/s' + i
        store.add({ title: names[i], sourceUrl, savedAt: Date.now(), tags: [], recipe: { title: names[i], description: '', image: null, author: null, sourceUrl, servings: 2, yieldText: null, totalTime: null, prepTime: null, cookTime: null, ingredients: [{ raw: 'a', qty: 1, qtyEnd: null, rest: 'a' }], steps: [] } })
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
    open.onerror = () => reject(open.error)
  })
})
await page.reload()
await page.getByRole('button', { name: /My Jar/ }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/rj-nudge.png' })
console.log('shot saved')
await browser.close()
