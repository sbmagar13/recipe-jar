import { chromium } from 'playwright'

// Every non-canonical host should land on recipejar.app; the apex must stay put.
const browser = await chromium.launch()
try {
  for (const host of ['recipe-jar.pages.dev', 'recipejar.sagarbudhathoki.com', 'www.recipejar.app']) {
    const p = await (await browser.newContext()).newPage()
    await p.goto(`https://${host}/`, { waitUntil: 'load' })
    await p.waitForTimeout(1500)
    console.log(host.padEnd(30), '->', new URL(p.url()).host)
  }
  const apex = await (await browser.newContext()).newPage()
  await apex.goto('https://recipejar.app/', { waitUntil: 'load' })
  await apex.waitForTimeout(800)
  console.log('recipejar.app'.padEnd(30), '->', new URL(apex.url()).host, '(should stay, no loop)')
} catch (e) {
  console.log('ERR:', e instanceof Error ? e.message.split('\n')[0] : String(e))
}
await browser.close()
