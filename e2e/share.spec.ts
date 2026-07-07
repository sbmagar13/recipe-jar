import { test, expect } from '@playwright/test'

// Build a share payload the same way src/lib/share.ts does (base64url JSON).
function sharePayload(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

const SHARED = sharePayload({
  v: 1,
  t: 'Shared Chocolate Cake',
  a: 'A Friend',
  s: 8,
  n: ['200 g dark chocolate', '3 eggs', '1 dl socker'],
  p: ['Melt the chocolate.', 'Whisk in the eggs and sugar.', 'Bake 25 minutes.'],
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('recipe-jar')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
})

test('opening a shared #recipe= link shows the card, savable to my jar', async ({ page }) => {
  await page.goto(`/#recipe=${SHARED}`)

  await expect(page.getByRole('heading', { level: 1, name: 'Shared Chocolate Cake' })).toBeVisible()
  await expect(page.getByText('200 g dark chocolate')).toBeVisible()
  await expect(page.getByText('Melt the chocolate.')).toBeVisible()
  await expect(page.getByText('by A Friend')).toBeVisible()
  await expect(page.getByText('8 servings')).toBeVisible()

  // The hash is consumed so a reload doesn't trap the user on the shared card.
  expect(page.url()).not.toContain('#recipe=')

  // Receiver can save it into their own jar.
  await page.getByRole('button', { name: '+ Save to my jar' }).click()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  await expect(page.getByRole('button', { name: /My Jar \(1\)/ })).toBeVisible()
})

test('a mangled share link fails safe (stays on home, app alive)', async ({ page }) => {
  await page.goto('/#recipe=corrupted-not-a-recipe')
  await expect(page.getByRole('heading', { name: /Just the recipe/ })).toBeVisible()
})

test('Share button copies a working link (clipboard fallback)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only in Playwright')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  // Force the copy path even where the engine exposes navigator.share.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
  })

  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByRole('button', { name: '↗ Share' }).click()
  await expect(page.getByText(/Link copied/)).toBeVisible()

  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#recipe=')

  // The copied link renders the same recipe (swap origin for the test server).
  const hash = new URL(link).hash
  await page.goto('/' + hash)
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
})
