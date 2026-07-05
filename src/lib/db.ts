import Dexie, { type EntityTable } from 'dexie'
import type { Recipe } from './types'

export interface SavedRecipe {
  id: number
  title: string
  sourceUrl: string
  savedAt: number
  tags: string[]
  recipe: Recipe
}

export const db = new Dexie('recipe-jar') as Dexie & {
  recipes: EntityTable<SavedRecipe, 'id'>
}

db.version(1).stores({
  // id auto-increments; title/sourceUrl/savedAt indexed for lookup and sorting
  recipes: '++id, title, sourceUrl, savedAt',
})

/** Save a recipe. If the same sourceUrl is already in the jar, update it instead. */
export async function saveRecipe(recipe: Recipe): Promise<number> {
  if (recipe.sourceUrl) {
    const existing = await db.recipes.where('sourceUrl').equals(recipe.sourceUrl).first()
    if (existing) {
      await db.recipes.update(existing.id, { recipe, title: recipe.title, savedAt: Date.now() })
      return existing.id
    }
  }
  return db.recipes.add({
    title: recipe.title,
    sourceUrl: recipe.sourceUrl,
    savedAt: Date.now(),
    tags: [],
    recipe,
  } as unknown as SavedRecipe)
}

export async function removeRecipe(id: number): Promise<void> {
  await db.recipes.delete(id)
}

/** Whole jar, newest first. */
export async function allRecipes(): Promise<SavedRecipe[]> {
  return db.recipes.orderBy('savedAt').reverse().toArray()
}

export async function jarCount(): Promise<number> {
  return db.recipes.count()
}

/** Find a saved entry matching a source URL (to show "already in your jar"). */
export async function findBySource(sourceUrl: string): Promise<SavedRecipe | undefined> {
  if (!sourceUrl) return undefined
  return db.recipes.where('sourceUrl').equals(sourceUrl).first()
}

/** Case-insensitive search across title and ingredient text. */
export function matchesQuery(entry: SavedRecipe, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (entry.title.toLowerCase().includes(needle)) return true
  return entry.recipe.ingredients.some((i) => i.raw.toLowerCase().includes(needle))
}
