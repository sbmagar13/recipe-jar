// Render the social preview image (1200x630) with the Chromium Playwright
// installed. Run: npx tsx scripts/make-og.ts
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(import.meta.dirname, '..', 'public')

const html = `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;background:#f6f3ec;font-family:Georgia,serif;
     display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;position:relative">
  <div style="position:absolute;top:0;left:0;right:0;height:14px;background:#33663d"></div>
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:26px">
    <svg width="70" height="80" viewBox="0 0 64 72">
      <rect x="18" y="6" width="28" height="8" rx="2" fill="#33663D"/>
      <path d="M16 18 Q12 24 12 32 V58 Q12 66 20 66 H44 Q52 66 52 58 V32 Q52 24 48 18 Z" fill="#fff" stroke="#33663D" stroke-width="4"/>
      <line x1="20" y1="34" x2="44" y2="34" stroke="#B8402E" stroke-width="4" stroke-linecap="round"/>
      <line x1="20" y1="46" x2="40" y2="46" stroke="#33663D" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
    </svg>
    <span style="font-size:38px;font-weight:700;color:#275231;letter-spacing:0.5px">Recipe Jar</span>
  </div>
  <div style="font-size:72px;font-weight:700;color:#275231;line-height:1.08;margin-bottom:24px">
    Just the recipe.<br/>Yours to keep.
  </div>
  <div style="font-family:system-ui,sans-serif;font-size:30px;color:#4c5750;line-height:1.4;max-width:900px">
    Paste a recipe link, get a clean card. Save unlimited recipes on your own
    device. No account, no ads, free forever.
  </div>
  <div style="position:absolute;bottom:44px;left:90px;font-family:ui-monospace,monospace;
       font-size:22px;color:#767061">no account · works offline · open source</div>
</div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
const buf = await page.locator('div').first().screenshot()
writeFileSync(join(out, 'og.png'), buf)
console.log('wrote og.png 1200x630')
await browser.close()
