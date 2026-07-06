import { chromium } from 'playwright'

const browser = await chromium.launch()
try {
  const p1 = await (await browser.newContext()).newPage()
  await p1.goto('https://recipe-jar.pages.dev/', { waitUntil: 'load' })
  await p1.waitForTimeout(1500)
  console.log('pages.dev  ->', new URL(p1.url()).host)

  const p2 = await (await browser.newContext()).newPage()
  await p2.goto('https://recipejar.sagarbudhathoki.com/', { waitUntil: 'load' })
  await p2.waitForTimeout(800)
  console.log('custom     ->', new URL(p2.url()).host, '(should stay, no loop)')
} catch (e) {
  console.log('ERR:', e instanceof Error ? e.message.split('\n')[0] : String(e))
}
await browser.close()
