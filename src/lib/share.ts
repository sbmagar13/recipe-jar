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

// base64url keeps the link free of characters messengers like to mangle, and
// deflate (native CompressionStream, so zero library bytes) cuts the payload
// roughly in half, which matters when the whole recipe rides in a chat message.
function b64encode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function deflate(s: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(s)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

/** Only an https image of sane length travels: a crafted link must not make
 *  the receiver's browser ping an arbitrary host on open beyond the recipe's
 *  own site, and a photo-import data: URI would balloon the link tenfold. */
function safeImage(u: unknown): string | null {
  return typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 500 ? u : null
}

function toPayload(r: Recipe): SharePayload {
  const p: SharePayload = { v: 1, t: r.title, n: r.ingredients.map((i) => i.raw), p: r.steps }
  if (r.description) p.d = r.description
  const img = safeImage(r.image)
  if (img) p.i = img
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
    image: safeImage(p.i),
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

/** Encode a recipe into its shareable payload string (the part after #recipe=).
 *  Compressed ("z." prefix) where the browser can; plain base64url otherwise. */
export async function encodeShare(recipe: Recipe): Promise<string> {
  const json = JSON.stringify(toPayload(recipe))
  if (typeof CompressionStream !== 'undefined') {
    return `z.${b64encode(await deflate(json))}`
  }
  return b64encode(new TextEncoder().encode(json))
}

/** Decode a payload string back into a Recipe. Null if malformed/tampered.
 *  Understands both generations: compressed "z." links and the original plain
 *  base64url ones, so every link ever sent keeps working. */
export async function decodeShare(encoded: string): Promise<Recipe | null> {
  try {
    let json: string
    if (encoded.startsWith('z.')) {
      if (typeof DecompressionStream === 'undefined') return null
      json = await inflate(b64decode(encoded.slice(2)))
    } else {
      json = new TextDecoder().decode(b64decode(encoded))
    }
    const p = JSON.parse(json) as SharePayload
    if (!p || p.v !== 1 || typeof p.t !== 'string' || !Array.isArray(p.n) || !Array.isArray(p.p)) return null
    if (p.n.length === 0 && p.p.length === 0) return null
    return fromPayload({ ...p, n: p.n.map(String), p: p.p.map(String) })
  } catch {
    return null
  }
}

/** Full shareable URL for a recipe (always on the canonical origin). */
export async function recipeShareUrl(recipe: Recipe): Promise<string> {
  return `${appOrigin()}/${PREFIX}${await encodeShare(recipe)}`
}

/** If the current URL hash carries a shared recipe, peel off its payload.
 *  Synchronous on purpose: the caller decodes asynchronously. */
export function consumeShareHash(): string | null {
  const hash = location.hash
  if (!hash.startsWith(PREFIX)) return null
  // Clear the hash so a reload doesn't re-open the shared card over the jar.
  history.replaceState(null, '', location.pathname + location.search)
  return hash.slice(PREFIX.length)
}
