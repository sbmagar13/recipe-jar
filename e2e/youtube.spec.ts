import { test, expect } from '@playwright/test'

// A YouTube link. The watch page has no recipe markup and almost no visible
// text: the recipe sits in the video's description, inside the player JSON.
// The import lands in the editor pre-filled, link and thumbnail kept, like a
// page with no markup. /api/proxy is mocked: no live network.

const DESCRIPTION = [
  '480 cals 36g protein 18g fat 30g carbs',
  '',
  'Cookbook in bio 🔗',
  '',
  'Ingredients: this makes 4 meals',
  '',
  '1 lb salmon fillet',
  '8 oz dry pasta',
  '2 cups cherry tomatoes',
  '1 tbsp olive oil',
  '',
  'Directions:',
  '',
  '1. Preheat oven to 400°F. Bake the salmon with the tomatoes and oil.',
  '2. Cook the pasta, then toss everything together.',
  '',
  'Follow for more',
  '#cooking #salmon #mealprep',
].join('\n')

function watchPage(title: string, description: string): string {
  const player = JSON.stringify({ videoDetails: { videoId: 'abcdefghijk', title, shortDescription: description } })
  return `<!DOCTYPE html><html><head><title>${title} - YouTube</title>
<meta property="og:image" content="https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg">
</head><body><script>var ytInitialPlayerResponse = ${player};</script></body></html>`
}

const WATCH_PAGE = watchPage('Salmon Meal Prep', DESCRIPTION)
const VLOG_PAGE = watchPage('Weekly vlog', 'Cookbook in bio 🔗\n\n#cooking')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('recipe-jar')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
  )
  await page.reload()
})

test('a YouTube link lands in the editor pre-filled from the description, link kept', async ({ page }) => {
  const proxied: string[] = []
  await page.route('**/api/proxy*', (route) => {
    proxied.push(new URL(route.request().url()).searchParams.get('url') ?? '')
    return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: WATCH_PAGE })
  })
  await page.getByLabel('Recipe URL').fill('https://youtu.be/abcdefghijk?t=12')
  await page.getByLabel('Recipe URL').press('Enter')

  await expect(page.getByRole('heading', { level: 1, name: 'Add or paste a recipe' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('read its description')
  await expect(page.getByLabel('Recipe name')).toHaveValue('Salmon Meal Prep')
  await expect(page.getByLabel('Servings')).toHaveValue('4')
  await expect(page.getByLabel(/Ingredients/)).toHaveValue(/^1 lb salmon fillet\n8 oz dry pasta\n2 cups cherry tomatoes\n1 tbsp olive oil$/)
  await expect(page.getByLabel(/Steps/)).toHaveValue(/^Preheat oven to 400°F\..*\nCook the pasta, then toss everything together\.$/s)
  // The macros line, the bio plug, the footer and the hashtags are not recipe.
  await expect(page.getByLabel(/Steps/)).not.toHaveValue(/Follow for more|#cooking/)
  await expect(page.getByLabel(/Ingredients/)).not.toHaveValue(/cals|bio/)
  // Every form of the link fetches the one watch page.
  expect(proxied).toEqual(['https://www.youtube.com/watch?v=abcdefghijk'])

  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Salmon Meal Prep' })).toBeVisible()
  await expect(page.getByText('1 lb salmon fillet')).toBeVisible()
  await expect(page.getByRole('link', { name: 'source' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk')
})

test('a video whose description is not a recipe still says so', async ({ page }) => {
  await page.route('**/api/proxy*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: VLOG_PAGE })
  )
  await page.getByLabel('Recipe URL').fill('https://www.youtube.com/shorts/abcdefghijk')
  await page.getByLabel('Recipe URL').press('Enter')
  await expect(page.getByRole('alert')).toContainText('No recipe found on that page.')
})
