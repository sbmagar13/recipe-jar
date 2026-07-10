import Dexie, { type EntityTable } from 'dexie'
import type { Recipe } from './types'
import { autoRequestPersistOnce } from './storage'

export interface SavedRecipe {
  id: number
  title: string
  sourceUrl: string
  savedAt: number
  tags: string[]
  recipe: Recipe
  /** The cook's own scribbles ("used less sugar"). */
  notes?: string
  /** Timestamp of the last "I cooked this". */
  lastCooked?: number
  /** How many times they've cooked it. */
  cookedCount?: number
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
  // First save is a good moment to ask the browser to keep the jar around.
  void autoRequestPersistOnce()
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

/** Load a single saved entry by id (to read its notes / cooked stats). */
export async function getRecipeById(id: number): Promise<SavedRecipe | undefined> {
  return db.recipes.get(id)
}

/** Save the cook's personal notes on a jar entry. */
export async function setNotes(id: number, notes: string): Promise<void> {
  await db.recipes.update(id, { notes })
}

/** Save the tags on a jar entry. */
export async function setTags(id: number, tags: string[]): Promise<void> {
  await db.recipes.update(id, { tags })
}

/** Record an "I cooked this": bump the count and stamp the time. */
export async function markCooked(id: number): Promise<number> {
  const entry = await db.recipes.get(id)
  const cookedCount = (entry?.cookedCount ?? 0) + 1
  await db.recipes.update(id, { cookedCount, lastCooked: Date.now() })
  return cookedCount
}

const BACKUP_FORMAT = 'recipe-jar-backup'

interface Backup {
  format: string
  version: number
  exportedAt: number
  recipes: Array<{
    title: string
    sourceUrl: string
    savedAt: number
    tags: string[]
    recipe: Recipe
    notes?: string
    lastCooked?: number
    cookedCount?: number
  }>
}

/** The whole jar as a single JSON string: the one-file backup a user keeps or shares. */
export async function exportJar(): Promise<string> {
  const all = await allRecipes()
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    recipes: all.map((e) => ({
      title: e.title,
      sourceUrl: e.sourceUrl,
      savedAt: e.savedAt,
      tags: e.tags ?? [],
      recipe: e.recipe,
      ...(e.notes ? { notes: e.notes } : {}),
      ...(e.lastCooked ? { lastCooked: e.lastCooked } : {}),
      ...(e.cookedCount ? { cookedCount: e.cookedCount } : {}),
    })),
  }
  return JSON.stringify(backup, null, 2)
}

/**
 * Merge a backup file into the jar. Recipes with a sourceUrl already present are
 * skipped; own-recipes (no sourceUrl) and new ones are added. Never deletes.
 */
export async function importJar(json: string): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(json) as Partial<Backup>
  if (data.format !== BACKUP_FORMAT || !Array.isArray(data.recipes)) {
    throw new Error('That does not look like a Recipe Jar backup file.')
  }
  let added = 0
  let skipped = 0
  for (const entry of data.recipes) {
    if (!entry?.recipe || typeof entry.recipe !== 'object') {
      skipped++
      continue
    }
    if (entry.sourceUrl) {
      const existing = await db.recipes.where('sourceUrl').equals(entry.sourceUrl).first()
      if (existing) {
        skipped++
        continue
      }
    }
    await db.recipes.add({
      title: entry.title ?? entry.recipe.title ?? 'Untitled',
      sourceUrl: entry.sourceUrl ?? '',
      savedAt: entry.savedAt ?? Date.now(),
      tags: entry.tags ?? [],
      recipe: entry.recipe,
      notes: entry.notes ?? '',
      lastCooked: entry.lastCooked,
      cookedCount: entry.cookedCount ?? 0,
    } as unknown as SavedRecipe)
    added++
  }
  return { added, skipped }
}

/** Case-insensitive search across title and ingredient text. */
export function matchesQuery(entry: SavedRecipe, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (entry.title.toLowerCase().includes(needle)) return true
  if ((entry.tags ?? []).some((t) => t.toLowerCase().includes(needle))) return true
  return entry.recipe.ingredients.some((i) => i.raw.toLowerCase().includes(needle))
}
