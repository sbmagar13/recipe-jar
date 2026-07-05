import { test, expect } from '@playwright/test'

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

const PASTED = `Grandma's Apple Cake
Serves 8

Ingredients
- 3 apples, peeled
- 200g flour
- 2 eggs

Method
1. Preheat oven to 180C.
2. Mix, fold in apples, bake 40 minutes.`

test('paste text auto-fills the fields and saves', async ({ page }) => {
  await page.getByRole('button', { name: /type in one of your own/i }).click()

  await page.getByPlaceholder(/Paste the whole recipe here/).fill(PASTED)
  await page.getByRole('button', { name: /Auto-fill fields/ }).click()

  // Fields should be populated from the paste.
  await expect(page.getByLabel('Recipe name')).toHaveValue("Grandma's Apple Cake")
  await expect(page.getByLabel('Servings')).toHaveValue('8')
  await expect(page.getByLabel(/Ingredients/)).toHaveValue(/200g flour/)
  await expect(page.getByLabel(/Steps/)).toHaveValue(/Preheat oven/)

  await page.getByRole('button', { name: 'Create recipe' }).click()
  await expect(page.getByRole('heading', { name: "Grandma's Apple Cake" })).toBeVisible()
  await expect(page.getByText('✓ In your jar')).toBeVisible()
  // Ingredient quantity was parsed, so scaling works.
  await page.getByRole('button', { name: 'More servings' }).click()
  await expect(page.getByText('9 servings')).toBeVisible()
})
