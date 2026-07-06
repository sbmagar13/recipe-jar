// Record the launch demo video by driving the real app. Phone-sized frame,
// deliberate pauses for readability. Output: a .webm in the demo dir.
// Run with the dev server up: npx tsx scripts/record-demo.ts
import { chromium } from 'playwright'
import { readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const base = 'http://localhost:5199/'
const dir = process.env.DEMO_DIR || '/tmp/recipe-jar-demo'
const recipeUrl = process.env.RECIPE_URL || 'https://www.bbcgoodfood.com/recipes/classic-lasagne-0'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 400, height: 860 },
  recordVideo: { dir, size: { width: 400, height: 860 } },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

const pause = (ms: number) => page.waitForTimeout(ms)

await page.goto(base)
await page.evaluate(
  () =>
    new Promise<void>((r) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => r()
    })
)
await page.reload()
await pause(1200)

// 1. Type a real recipe link.
const input = page.getByLabel('Recipe URL')
await input.click()
await input.pressSequentially(recipeUrl, { delay: 40 })
await pause(500)
await page.getByRole('button', { name: 'Get the recipe' }).click()

// 2. Clean card appears.
await page.getByRole('heading', { level: 2 }).waitFor({ timeout: 20_000 })
await pause(1600)

// 3. Scale the servings up.
const more = page.getByRole('button', { name: 'More servings' })
await more.click()
await pause(500)
await more.click()
await pause(1400)

// 4. Save it.
await page.getByRole('button', { name: '+ Save to my jar' }).click()
await pause(1400)

// 5. Open the jar: it's kept.
await page.getByRole('button', { name: /My Jar/ }).click()
await pause(2400)

await context.close() // flushes the video
await browser.close()

// Give the video a stable name.
const file = readdirSync(dir).find((f) => f.endsWith('.webm'))
if (file) {
  renameSync(join(dir, file), join(dir, 'recipe-jar-demo.webm'))
  console.log('wrote', join(dir, 'recipe-jar-demo.webm'))
} else {
  console.log('no video produced')
}
