import { test, expect } from '@playwright/test'

// The image card renders on a real canvas; with the OS file-share stubbed out
// the fallback is a PNG download, which makes the whole pipeline testable.

test('the Image button draws the recipe card and downloads a real PNG', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'download assertions are simplest on chromium')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
    Object.defineProperty(navigator, 'canShare', { value: undefined })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Image/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.png$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  const png = Buffer.concat(chunks)
  // PNG magic bytes, and a card with real content is not a tiny file.
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.length).toBeGreaterThan(20_000)
  await expect(page.getByText(/Image saved/)).toBeVisible()
})
