// Prove the PWA works offline: load the built app from `vite preview`, wait for
// the service worker to control the page, go offline, reload, assert it loads.
// Run: npm run build && npx tsx scripts/check-offline.ts
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4188
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: join(),
  stdio: 'ignore',
})

function join() {
  return new URL('..', import.meta.url).pathname
}

async function waitForServer(url: string, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

const base = `http://localhost:${PORT}/`
let ok = false
try {
  await waitForServer(base)
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(base)
  // Wait for the service worker to take control.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15_000 })

  // Cut the network and reload.
  await context.setOffline(true)
  await page.reload()

  const heading = await page.getByRole('heading', { name: /Just the recipe/ }).isVisible()
  const title = await page.title()
  ok = heading && title.includes('Recipe Jar')
  console.log(ok ? '✓ App loads offline (SW served the shell)' : '✗ App did NOT load offline')
  console.log('  heading visible:', heading, '| title:', title)
  await browser.close()
} finally {
  preview.kill('SIGTERM')
}

process.exit(ok ? 0 : 1)
