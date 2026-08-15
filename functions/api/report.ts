// Cloudflare Pages Function: POST /api/report
// A privacy-respecting telemetry sink. It stores NOTHING and logs a single
// structured line per beacon (visible via `wrangler pages deployment tail` or
// the Cloudflare dashboard logs). It never receives recipe content or full URLs
// — the client only sends a page hostname (for parse failures) and coarse codes.

import { isAllowedCaller } from './_caller'

interface Env {
  STATS?: KVNamespace
}

const MAX_BODY = 2_000 // bytes; beacons are tiny, reject anything larger
const MAX_FIELD = 300
const FAIL_TTL_S = 90 * 86_400

/** Keep only hostname-shaped values so junk never lands in storage keys. */
export function cleanHost(v: unknown): string {
  const h = typeof v === 'string' ? v.toLowerCase().trim() : ''
  return /^[a-z0-9.-]{4,100}$/.test(h) && h.includes('.') ? h : ''
}

function clip(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : ''
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const request = context.request
  const selfOrigin = new URL(request.url).origin
  if (!isAllowedCaller(request.headers, selfOrigin)) {
    return new Response(null, { status: 403 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 })

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response(null, { status: 400 })
  }

  const kind = body.kind === 'error' ? 'error' : 'parse-fail'
  // Structured, greppable, and free of anything user-identifying.
  const line = {
    t: 'recipe-jar-report',
    kind,
    host: clip(body.host), // page hostname only, never the path/query
    reason: clip(body.reason), // e.g. no-recipe, no-jsonld
    version: clip(body.version),
    message: kind === 'error' ? clip(body.message) : undefined,
    at: clip(body.at), // e.g. src file:line for errors
    ua: clip(request.headers.get('user-agent')),
  }
  console.log(JSON.stringify(line))

  // Parse failures also land in KV as one unique key per event, so "which
  // sites break the parser" survives past the live log tail. Hostname only,
  // exactly as the About page discloses; expires after 90 days.
  const host = cleanHost(body.host)
  if (kind === 'parse-fail' && host && context.env.STATS) {
    const date = new Date().toISOString().slice(0, 10)
    context.waitUntil(
      context.env.STATS.put(`fail:${date}:${host}:${crypto.randomUUID()}`, '1', {
        expirationTtl: FAIL_TTL_S,
      }),
    )
  }

  // 204: fire-and-forget, nothing to return.
  return new Response(null, { status: 204 })
}
