import { chromium, devices } from 'playwright'
const out = process.env.SHOT_DIR || '/tmp'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto('http://localhost:5199/')
await page.evaluate(
  () => new Promise<void>((r) => {
    const req = indexedDB.deleteDatabase('recipe-jar')
    req.onsuccess = req.onerror = req.onblocked = () => r()
  })
)
await page.evaluate(() => localStorage.removeItem('recipe-jar:installTipDismissed'))
await page.reload()
await page.getByRole('button', { name: /see a sample recipe/ }).click()
await page.getByRole('button', { name: '+ Save to my jar' }).click()
await page.getByRole('dialog', { name: /home screen/ }).waitFor()
await page.waitForTimeout(400)
await page.screenshot({ path: out + '/ios-install-tip.png' })
console.log('shot ios-install-tip.png')
await browser.close()
