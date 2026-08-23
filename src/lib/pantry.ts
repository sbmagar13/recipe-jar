// Pantry mode: "what can I cook right now?" The cook names what's at home
// and the jar ranks its own recipes by how much of each dish those items
// cover. Pure functions, no storage: the view owns persistence.

import type { SavedRecipe } from './db'

export interface PantryMatch {
  entry: SavedRecipe
  /** Ingredient lines covered by at least one pantry term. */
  matchedLines: number
  totalLines: number
  /** Which of the cook's terms actually matched this recipe. */
  matchedTerms: string[]
}

/**
 * Rank the jar against the pantry. A line is covered when any term appears in
 * it (case-insensitive substring, the same posture as jar search). Recipes
 * with no coverage at all are dropped. Order: coverage fraction, then covered
 * count, then title, so "you have 5 of 6" beats "you have 5 of 12".
 */
export function rankByPantry(entries: SavedRecipe[], terms: string[]): PantryMatch[] {
  const needles = terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2)
  if (needles.length === 0) return []
  const out: PantryMatch[] = []
  for (const entry of entries) {
    const lines = entry.recipe.ingredients
    if (lines.length === 0) continue
    let matchedLines = 0
    const matchedTerms = new Set<string>()
    for (const ing of lines) {
      const raw = ing.raw.toLowerCase()
      let hit = false
      for (const needle of needles) {
        if (raw.includes(needle)) {
          hit = true
          matchedTerms.add(needle)
        }
      }
      if (hit) matchedLines++
    }
    if (matchedLines > 0) {
      out.push({ entry, matchedLines, totalLines: lines.length, matchedTerms: [...matchedTerms] })
    }
  }
  return out.sort(
    (a, b) =>
      b.matchedLines / b.totalLines - a.matchedLines / a.totalLines ||
      b.matchedLines - a.matchedLines ||
      a.entry.title.localeCompare(b.entry.title),
  )
}
