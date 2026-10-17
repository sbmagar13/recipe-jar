import { parseRecipeFromHtml } from './parse'
import type { Recipe } from './types'

export async function parseImportedHtml(html: string, sourceUrl: string): Promise<Recipe | null> {
  const parsed = parseRecipeFromHtml(html, sourceUrl)
  if (parsed) return parsed
  // Cheap reject so a normal recipe page never downloads the YouTube parser.
  if (!/youtu\.?be/i.test(sourceUrl)) return null
  const { isYouTubeUrl, tryParseYouTubeRecipe } = await import('./youtube')
  if (!isYouTubeUrl(sourceUrl)) return null
  return tryParseYouTubeRecipe(html, sourceUrl)
}
