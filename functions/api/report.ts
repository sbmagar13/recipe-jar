// Cloudflare Pages Function: POST /api/report
// A privacy-respecting telemetry sink. It stores NOTHING and logs a single
// structured line per beacon (visible via `wrangler pages deployment tail` or
// the Cloudflare dashboard logs). It never receives recipe content or full URLs
// — the client only sends a page hostname (for parse failures) and coarse codes.

import { isAllowedCaller } from './_caller'

const MAX_BODY = 2_000 // bytes; beacons are tiny, reject anything larger
const MAX_FIELD = 300

function clip(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : ''
}

export const onRequestPost: PagesFunction = async (context) => {
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

  // 204: fire-and-forget, nothing to return.
  return new Response(null, { status: 204 })
}
