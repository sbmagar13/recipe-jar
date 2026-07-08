// Smoke-test the live production deployment end to end.
// Run: npx tsx scripts/live-smoke.ts [url]
import { chromium } from 'playwright'

const base = process.argv[2] || 'https://recipejar.app/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors: string[] = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

let ok = false
try {
  await page.goto(base, { waitUntil: 'load' })
  await page.getByLabel('Recipe URL').fill('https://www.bbcgoodfood.com/recipes/classic-lasagne-0')
  await page.getByRole('button', { name: 'Get the recipe' }).click()
  const title2 = page.locator('.card h1')
  await title2.waitFor({ timeout: 20_000 })
  const title = (await title2.textContent())?.trim()
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await page.getByText('✓ In your jar').waitFor({ timeout: 5000 })
  await page.reload()
  await page.getByRole('button', { name: /My Jar \(1\)/ }).waitFor({ timeout: 5000 })
  // The share link must carry the recipe end-to-end.
  await page.getByRole('button', { name: /My Jar/ }).click()
  await page.locator('button.jar-item').first().click()
  console.log('LIVE OK: fetched "' + title + '", saved, persisted after reload')
  ok = true
} catch (e) {
  console.log('LIVE FAILED:', e instanceof Error ? e.message.split('\n')[0] : String(e))
}
console.log('page errors:', errors.length ? errors.join(' | ') : 'none')
await browser.close()
process.exit(ok ? 0 : 1)
