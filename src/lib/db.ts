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

/**
 * Return a plain, structured-cloneable copy of a recipe. Svelte 5 wraps values
 * assigned to `$state` in a deep reactive Proxy, and IndexedDB's structured
 * clone throws DataCloneError on proxies. A JSON round-trip reads through the
 * proxy and yields a plain object. Our Recipe is JSON-only data, so this is loss-free.
 */
function toPlainRecipe(recipe: Recipe): Recipe {
  return JSON.parse(JSON.stringify(recipe)) as Recipe
}

/** Save a recipe. If the same sourceUrl is already in the jar, update it instead. */
export async function saveRecipe(recipe: Recipe): Promise<number> {
  const clean = toPlainRecipe(recipe)
  if (clean.sourceUrl) {
    const existing = await db.recipes.where('sourceUrl').equals(clean.sourceUrl).first()
    if (existing) {
      await db.recipes.update(existing.id, { recipe: clean, title: clean.title, savedAt: Date.now() })
      return existing.id
    }
  }
  return db.recipes.add({
    title: clean.title,
    sourceUrl: clean.sourceUrl,
    savedAt: Date.now(),
    tags: [],
    recipe: clean,
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
