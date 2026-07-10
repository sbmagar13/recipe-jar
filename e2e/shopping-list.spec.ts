import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /see a sample recipe/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Red Lentil Dal/ })).toBeVisible()
})

test('builds a shopping list, ticks an item off, and returns to the recipe', async ({ page }) => {
  await page.getByRole('button', { name: /Shopping list/ }).click()

  await expect(page.getByRole('heading', { name: 'Shopping list' })).toBeVisible()
  await expect(page.getByText(/for 4 servings/)).toBeVisible()
  await expect(page.getByText('1 cup red lentils, rinsed')).toBeVisible()

  // Ticking an item as "already have" reveals the reset control.
  await page.getByRole('checkbox', { name: /red lentils/ }).check()
  await expect(page.getByRole('button', { name: 'Reset ticks' })).toBeVisible()

  await page.getByRole('button', { name: /Back to recipe/ }).click()
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible()
})

test('the list is scaled to the chosen servings', async ({ page }) => {
  await page.getByRole('button', { name: 'More servings' }).click() // 4 -> 5
  await page.getByRole('button', { name: /Shopping list/ }).click()

  await expect(page.getByText(/for 5 servings/)).toBeVisible()
  // 3 cups water at 5/4 servings = 3¾.
  await expect(page.getByText('3¾ cups water')).toBeVisible()
})
