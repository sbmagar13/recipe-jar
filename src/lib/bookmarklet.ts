import type { Recipe } from './types'
import { parseRecipeFromJsonLdStrings } from './parse'

/** Payload the bookmarklet hands to the app through the URL hash. */
interface ImportPayload {
  u: string // page URL
  t: string // document title (fallback name)
  j: string[] // raw JSON-LD script contents
}

// The one canonical home the bookmarklet always opens, so imported recipes land
// in the same jar no matter which page you dragged the bookmarklet from.
// Overridable at build time (e.g. for a self-hosted copy).
const CANONICAL_ORIGIN = import.meta.env.VITE_CANONICAL_ORIGIN || 'https://recipejar.app'

export function appOrigin(): string {
  const h = location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return location.origin
  return CANONICAL_ORIGIN
}

/**
 * The bookmarklet source. It runs on the recipe page's own origin, so bot
 * walls that block our server proxy don't apply. It grabs every JSON-LD block
 * plus the URL and title, then opens Recipe Jar with them in the hash.
 */
export function bookmarkletCode(): string {
  // Kept as one line; `APP` is substituted with the canonical origin.
  const src = `(function(){try{var d=document,j=[].map.call(d.querySelectorAll('script[type=\\"application/ld+json\\"]'),function(e){return e.textContent||''}),p={u:location.href,t:d.title,j:j};var h=encodeURIComponent(JSON.stringify(p));window.open('APP/#import='+h,'_blank')}catch(e){alert('Recipe Jar: could not read this page.')}})()`
  return 'javascript:' + src.replace('APP', appOrigin())
}

const PREFIX = '#import='

/** If the current URL hash carries a bookmarklet payload, parse it into a Recipe. */
export function consumeImportHash(): Recipe | null {
  const hash = location.hash
  if (!hash.startsWith(PREFIX)) return null
  // Clear the hash immediately so a reload doesn't re-import.
  history.replaceState(null, '', location.pathname + location.search)
  try {
    const payload = JSON.parse(decodeURIComponent(hash.slice(PREFIX.length))) as ImportPayload
    if (!payload || !Array.isArray(payload.j)) return null
    return parseRecipeFromJsonLdStrings(payload.j, payload.u ?? '', payload.t ?? '')
  } catch {
    return null
  }
}
