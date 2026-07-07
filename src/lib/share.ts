// Share a recipe as a plain link — the whole card rides in the URL hash, so
// nothing ever touches a server and the link works offline once the app shell
// is cached. Receiver opens it, sees the clean card, and can save it to their
// own jar. This is the app's growth loop: every shared recipe carries the app.

import type { Recipe } from './types'
import { parseIngredientLine } from './quantity'
import { appOrigin } from './bookmarklet'

const PREFIX = '#recipe='

/** Compact wire format: raw strings only; quantities are re-parsed on receipt. */
interface SharePayload {
  v: 1
  t: string // title
  d?: string // description
  i?: string // image URL
  a?: string // author
  u?: string // sourceUrl
  s?: number // servings
  y?: string // yieldText
  tt?: string // totalTime
  pt?: string // prepTime
  ct?: string // cookTime
  n: string[] // ingredient lines (raw)
  p: string[] // steps
}

// base64url keeps the link far shorter than percent-encoded JSON and free of
// characters that messengers like to mangle.
function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64decode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function toPayload(r: Recipe): SharePayload {
  const p: SharePayload = { v: 1, t: r.title, n: r.ingredients.map((i) => i.raw), p: r.steps }
  if (r.description) p.d = r.description
  if (r.image) p.i = r.image
  if (r.author) p.a = r.author
  if (r.sourceUrl) p.u = r.sourceUrl
  if (r.servings !== null) p.s = r.servings
  if (r.yieldText) p.y = r.yieldText
  if (r.totalTime) p.tt = r.totalTime
  if (r.prepTime) p.pt = r.prepTime
  if (r.cookTime) p.ct = r.cookTime
  return p
}

function fromPayload(p: SharePayload): Recipe {
  return {
    title: p.t || 'Untitled recipe',
    description: p.d ?? '',
    image: p.i ?? null,
    author: p.a ?? null,
    sourceUrl: p.u ?? '',
    servings: typeof p.s === 'number' ? p.s : null,
    yieldText: p.y ?? null,
    totalTime: p.tt ?? null,
    prepTime: p.pt ?? null,
    cookTime: p.ct ?? null,
    ingredients: p.n.map((raw) => ({ raw, ...parseIngredientLine(raw) })),
    steps: p.p,
  }
}

/** Encode a recipe into its shareable payload string (the part after #recipe=). */
export function encodeShare(recipe: Recipe): string {
  return b64encode(JSON.stringify(toPayload(recipe)))
}

/** Decode a payload string back into a Recipe. Null if malformed/tampered. */
export function decodeShare(encoded: string): Recipe | null {
  try {
    const p = JSON.parse(b64decode(encoded)) as SharePayload
    if (!p || p.v !== 1 || typeof p.t !== 'string' || !Array.isArray(p.n) || !Array.isArray(p.p)) return null
    if (p.n.length === 0 && p.p.length === 0) return null
    return fromPayload({ ...p, n: p.n.map(String), p: p.p.map(String) })
  } catch {
    return null
  }
}

/** Full shareable URL for a recipe (always on the canonical origin). */
export function recipeShareUrl(recipe: Recipe): string {
  return `${appOrigin()}/${PREFIX}${encodeShare(recipe)}`
}

/** If the current URL hash carries a shared recipe, decode it. */
export function consumeShareHash(): Recipe | null {
  const hash = location.hash
  if (!hash.startsWith(PREFIX)) return null
  // Clear the hash so a reload doesn't re-open the shared card over the jar.
  history.replaceState(null, '', location.pathname + location.search)
  return decodeShare(hash.slice(PREFIX.length))
}
