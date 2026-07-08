// Record the launch demo video by driving the real app. Phone-sized frame,
// deliberate pauses for readability. Output: a .webm in the demo dir, plus
// timing marks (JSON on stdout) so post-processing can trim precisely.
// Run with the dev server up: npx tsx scripts/record-demo.ts
//
// Story (~35s): paste a link → clean card → scale → save → tag it →
// cook mode with a live step timer → "I cooked this" → the jar, filtered by tag.
import { chromium } from 'playwright'
import { readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const base = 'http://localhost:5199/'
const dir = process.env.DEMO_DIR || '/tmp/recipe-jar-demo'
const recipeUrl = process.env.RECIPE_URL || 'https://www.bbcgoodfood.com/recipes/classic-lasagne-0'

const browser = await chromium.launch()

// Reset the jar in a throwaway context so the recorded page never reloads
// (a reload is a long white flash at the start of the video).
{
  const prep = await browser.newContext()
  const p = await prep.newPage()
  await p.goto(base)
  await p.evaluate(
    () =>
      new Promise<void>((r) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => r()
      })
  )
  await prep.close()
}

const t0 = Date.now()
const marks: Record<string, number> = {}
const mark = (name: string) => (marks[name] = (Date.now() - t0) / 1000)

const context = await browser.newContext({
  viewport: { width: 400, height: 860 },
  recordVideo: { dir, size: { width: 400, height: 860 } },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

const pause = (ms: number) => page.waitForTimeout(ms)

await page.goto(base)
await page.getByRole('heading', { name: /Just the recipe/ }).waitFor()
mark('hero')
await pause(1400)

// 1. Type a real recipe link.
const input = page.getByLabel('Recipe URL')
await input.click()
await input.pressSequentially(recipeUrl, { delay: 35 })
await pause(500)
await page.getByRole('button', { name: 'Get the recipe' }).click()
mark('fetchClick')

// 2. Clean card appears.
await page.locator('.card h1').waitFor({ timeout: 20_000 })
mark('card')
await pause(1800)

// 3. Scale the servings up.
const more = page.getByRole('button', { name: 'More servings' })
await more.click()
await pause(500)
await more.click()
await pause(1200)

// 4. Save it…
await page.getByRole('button', { name: '+ Save to my jar' }).click()
await pause(1200)

// 5. …and tag it.
const tagInput = page.getByLabel('Add a tag')
await tagInput.scrollIntoViewIfNeeded()
await pause(400)
for (const tag of ['dinner', 'family']) {
  await tagInput.click()
  await tagInput.pressSequentially(tag, { delay: 70 })
  await pause(250)
  await tagInput.press('Enter')
  await pause(450)
}
await pause(700)

// 6. Cook mode: one step at a time.
await page.getByRole('button', { name: '▶ Cook' }).click()
await pause(1800)

// 7. Step forward until a step has a timer, then start it and let it tick.
const chip = page.locator('.cook-timers .timer-chip').first()
for (let i = 0; i < 4 && !(await chip.isVisible()); i++) {
  await page.getByRole('button', { name: 'Next ▶' }).click()
  await pause(1100)
}
if (await chip.isVisible()) {
  await chip.click()
  await pause(2600) // countdown visibly ticking
}
await page.getByRole('button', { name: 'Next ▶' }).click()
await pause(1300)

// 8. Leave cook mode, mark it cooked.
await page.getByRole('button', { name: 'Exit cook mode' }).click()
await pause(900)
const cooked = page.getByRole('button', { name: '🍳 I cooked this' })
await cooked.scrollIntoViewIfNeeded()
await pause(400)
await cooked.click()
await pause(1400)

// 9. The jar: it's kept, tagged, searchable.
await page.getByRole('button', { name: /My Jar/ }).click()
await pause(1500)
await page.getByRole('button', { name: '#dinner' }).click()
await pause(2400)
mark('end')

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
console.log('MARKS ' + JSON.stringify(marks))
