// Rasterize the jar logo into PWA PNG icons using the Chromium that Playwright
// already installed. Run: npx tsx scripts/make-icons.ts
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(import.meta.dirname, '..', 'public')

function svg(size: number, pad: number): string {
  // pad is the safe-area inset fraction for maskable icons
  const inset = size * pad
  const inner = size - inset * 2
  return `<!doctype html><html><body style="margin:0">
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#33663D"/>
    <g transform="translate(${inset},${inset}) scale(${inner / 64})">
      <rect x="18" y="6" width="28" height="8" rx="2" fill="#FBF7EC"/>
      <path d="M16 18 Q12 24 12 32 V58 Q12 66 20 66 H44 Q52 66 52 58 V32 Q52 24 48 18 Z" fill="#FCFAF4" stroke="#FBF7EC" stroke-width="2"/>
      <line x1="20" y1="34" x2="44" y2="34" stroke="#B8402E" stroke-width="4" stroke-linecap="round"/>
      <line x1="20" y1="44" x2="40" y2="44" stroke="#33663D" stroke-width="4" stroke-linecap="round" opacity="0.55"/>
      <line x1="20" y1="54" x2="42" y2="54" stroke="#33663D" stroke-width="4" stroke-linecap="round" opacity="0.35"/>
    </g>
  </svg></body></html>`
}

const browser = await chromium.launch()
const page = await browser.newPage()

async function render(name: string, size: number, pad: number) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(svg(size, pad))
  const el = await page.$('svg')
  const buf = await el!.screenshot({ omitBackground: false })
  writeFileSync(join(out, name), buf)
  console.log('wrote', name, size + 'x' + size)
}

await render('icon-192.png', 192, 0.06)
await render('icon-512.png', 512, 0.06)
await render('icon-maskable-512.png', 512, 0.14)
await browser.close()
