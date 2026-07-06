// Verify the two live fixes against a deployed URL.
// Run: npx tsx scripts/verify-fixes.ts https://recipejar.sagarbudhathoki.com/
import { chromium } from 'playwright'

const base = process.argv[2] || 'https://recipejar.sagarbudhathoki.com/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const results: string[] = []

try {
  // 1. Bare domain (no https://) fetches.
  await page.goto(base, { waitUntil: 'load' })
  await page.getByLabel('Recipe URL').fill('www.bbcgoodfood.com/recipes/classic-lasagne-0')
  await page.getByRole('button', { name: 'Get the recipe' }).click()
  await page.getByRole('heading', { level: 2 }).waitFor({ timeout: 20_000 })
  results.push('bare-domain fetch: OK')

  // 2. Bookmarklet points at the canonical domain, not localhost.
  await page.goto(base, { waitUntil: 'load' }) // fresh load resets the SPA to home
  await page.getByRole('button', { name: /Recipe from a blocked site/ }).click()
  const href = (await page.getByRole('link', { name: /Save to Recipe Jar/ }).getAttribute('href')) ?? ''
  const host = new URL(base).host
  const pointsToCanonical = href.includes(host)
  const pointsToLocalhost = href.includes('localhost')
  results.push(`bookmarklet host: ${pointsToCanonical && !pointsToLocalhost ? 'OK (' + host + ')' : 'WRONG -> ' + href.slice(0, 120)}`)
} catch (e) {
  results.push('FAILED: ' + (e instanceof Error ? e.message.split('\n')[0] : String(e)))
}

console.log(results.join('\n'))
await browser.close()
