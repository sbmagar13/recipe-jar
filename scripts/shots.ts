// Capture screenshots of key screens for visual review.
// Run against the dev server: npx tsx scripts/shots.ts
import { chromium } from 'playwright'
import { join } from 'node:path'

const base = 'http://localhost:5199/'
const out = process.env.SHOT_DIR || '/tmp'

const browser = await chromium.launch()

async function shot(name: string, width: number, height: number, steps: (p: import('playwright').Page) => Promise<void>) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(base)
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => r()
      })
  )
  await page.reload()
  await steps(page)
  await page.screenshot({ path: join(out, name) })
  await ctx.close()
  console.log('shot', name)
}

// Home, desktop
await shot('home-desktop.png', 1100, 800, async () => {})

// Sample recipe card, desktop
await shot('recipe-desktop.png', 1100, 950, async (p) => {
  await p.getByRole('button', { name: /see a sample recipe/ }).click()
  await p.getByRole('heading', { name: /Red Lentil Dal/ }).waitFor()
})

// Sample recipe card, mobile
await shot('recipe-mobile.png', 390, 844, async (p) => {
  await p.getByRole('button', { name: /see a sample recipe/ }).click()
  await p.getByRole('heading', { name: /Red Lentil Dal/ }).waitFor()
})

// Jar with a couple saved, mobile
await shot('jar-mobile.png', 390, 844, async (p) => {
  await p.getByRole('button', { name: /see a sample recipe/ }).click()
  await p.getByRole('button', { name: '+ Save to my jar' }).click()
  await p.getByRole('button', { name: /My Jar/ }).click()
})

await browser.close()
