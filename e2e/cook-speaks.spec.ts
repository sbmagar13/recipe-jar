import { test, expect, type Page } from '@playwright/test'

// Cook mode reads to you. The browser's speech engine is stubbed before the
// app loads: it records what it was asked to say and offers one voice, on
// device or not, so the tests can check both what is read and that the
// control hides itself when only a network voice exists.
function voiceStub(local: boolean): string {
  return `
    window.__spoken = [];
    class U { constructor(t) { this.text = t; this.onend = null; this.onerror = null } }
    window.SpeechSynthesisUtterance = U;
    // speechSynthesis is a read-only getter on Window: plain assignment is
    // silently ignored, so the stub has to be defined over it.
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ name: 'Test', lang: 'en-US', localService: ${local}, default: true, voiceURI: 'test' }],
        speak: (u) => { if (u.text) window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend({}), 5) },
        cancel: () => {}, pause: () => {}, resume: () => {},
        speaking: false, pending: false, paused: false,
        addEventListener: () => {}, removeEventListener: () => {},
      },
    });
  `
}

function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)
}

async function openSampleInCookMode(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
  await page.getByRole('button', { name: '▶ Cook' }).click()
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
}

test.describe('with an on-device voice', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(voiceStub(true))
    await openSampleInCookMode(page)
  })

  test('Read reads the current step, then every step you move to, until turned off', async ({ page }) => {
    const read = page.getByRole('button', { name: 'Read each step aloud' })
    await expect(read).toBeVisible()
    await read.click()
    await expect.poll(() => spoken(page)).toHaveLength(1)
    expect((await spoken(page))[0]).toMatch(/Simmer the lentils/)

    await page.getByRole('button', { name: 'Next' }).click()
    await expect.poll(() => spoken(page)).toHaveLength(2)
    expect((await spoken(page))[1]).toMatch(/fry the cumin seeds/)

    await page.getByRole('button', { name: 'Stop reading the steps aloud' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 3 of 5')).toBeVisible()
    expect(await spoken(page)).toHaveLength(2)
  })

  test('the choice is remembered: the next cook reads from step 1', async ({ page }) => {
    await page.getByRole('button', { name: 'Read each step aloud' }).click()
    await expect.poll(() => spoken(page)).toHaveLength(1)
    await page.getByRole('button', { name: 'Exit cook mode' }).click()
    await page.getByRole('button', { name: '▶ Cook' }).click()
    await expect.poll(() => spoken(page)).toHaveLength(2)
    expect((await spoken(page))[1]).toMatch(/Simmer the lentils/)
    await expect(page.getByRole('button', { name: 'Stop reading the steps aloud' })).toBeVisible()
  })
})

test('a finished timer is announced when reading is on', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(voiceStub(true))
  await openSampleInCookMode(page)
  await page.getByRole('button', { name: 'Read each step aloud' }).click()
  await expect.poll(() => spoken(page)).toHaveLength(1)

  await page.getByRole('button', { name: 'Start a 20 min timer' }).click()
  await page.clock.runFor(20 * 60 * 1000 + 1500)
  await expect.poll(() => spoken(page)).toContainEqual('Timer done: 20 minutes')
})

test('the control stays hidden when the only voice is a network voice', async ({ page }) => {
  await page.addInitScript(voiceStub(false))
  await openSampleInCookMode(page)
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read each step aloud' })).toHaveCount(0)
})
