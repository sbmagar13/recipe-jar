// Cloudflare Pages Function: GET /api/proxy?url=<encoded>
// Fetches a recipe page on behalf of the user (reader-mode posture: user-initiated,
// result rendered client-side, nothing stored). Keeps the app itself fully static.
//
// Hardening (this is the only internet-facing surface):
//  - caller gating: only our own pages may call it, so it can't be used as a
//    general-purpose open proxy;
//  - SSRF guards: no localhost / private / link-local / metadata IPs, no IPv6
//    literals, no non-web ports;
//  - content-type allowlist: only HTML-ish pages, never megabytes of binary;
//  - size + time caps; edge caching so we don't hammer the target sites.

const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 12_000
const CACHE_SECONDS = 3_600

// Origins our own app is served from. Same-origin calls are recognised via
// Sec-Fetch-Site/Referer regardless of host, so this is only a belt-and-braces
// allowlist for the (rare) cross-origin-but-ours case.
const ALLOWED_ORIGINS = new Set([
  'https://recipejar.sagarbudhathoki.com',
  'https://recipe-jar.pages.dev',
])

function originOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/** True when the request demonstrably came from one of our own pages. */
export function isAllowedCaller(headers: Headers, selfOrigin: string): boolean {
  // Modern browsers stamp every fetch with Sec-Fetch-Site. Our app calls the
  // proxy same-origin, so this is the reliable signal.
  const site = headers.get('Sec-Fetch-Site')
  if (site) return site === 'same-origin' || site === 'same-site'
  // Older engines (iOS Safari < 16.4) omit it: fall back to Origin/Referer,
  // both of which a same-origin fetch still sends.
  const origin = headers.get('Origin') ?? originOf(headers.get('Referer'))
  if (!origin) return false // no provenance at all → treat as open-proxy abuse
  return origin === selfOrigin || ALLOWED_ORIGINS.has(origin)
}

function isBlockedHost(host: string): boolean {
  return (
    host === 'localhost' ||
    !host.includes('.') || // single-label / internal names
    host.includes(':') || // raw IPv6 literal
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
}

const HTMLISH = /text\/html|application\/xhtml|\/xml|text\/plain/i

export const onRequestGet: PagesFunction = async (context) => {
  const request = context.request
  const selfOrigin = new URL(request.url).origin

  if (!isAllowedCaller(request.headers, selfOrigin)) {
    return json({ error: 'This proxy only serves the Recipe Jar app.' }, 403)
  }

  const target = new URL(request.url).searchParams.get('url')
  if (!target) return json({ error: 'Missing url parameter' }, 400)

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json({ error: 'Only http(s) URLs are supported' }, 400)
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return json({ error: 'URL not allowed' }, 400)
  }
  if (isBlockedHost(parsed.hostname)) {
    return json({ error: 'URL not allowed' }, 400)
  }

  // Edge cache: recipe pages are public, so one fetch can serve everyone and we
  // stay a good citizen to the source site. Keyed on the normalized target URL.
  const cache = typeof caches !== 'undefined' ? caches.default : undefined
  const cacheKey = new Request(`https://recipe-jar-proxy.cache/${encodeURIComponent(parsed.toString())}`)
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return hit
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en,sv;q=0.8,ne;q=0.6',
      },
    })
    if (!upstream.ok) {
      return json({ error: `Site responded with ${upstream.status}` }, 502)
    }
    const contentType = upstream.headers.get('content-type') ?? ''
    if (contentType && !HTMLISH.test(contentType)) {
      return json({ error: 'That link is not a web page we can read' }, 415)
    }

    const reader = upstream.body?.getReader()
    if (!reader) return json({ error: 'Empty response' }, 502)
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        reader.cancel()
        break
      }
      chunks.push(value)
    }
    const html = new TextDecoder('utf-8').decode(concat(chunks, Math.min(total, MAX_BYTES)))
    const response = new Response(html, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
    if (cache) context.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'TimeoutError' ? 'Site took too long to respond' : 'Could not reach the site'
    return json({ error: message }, 502)
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    if (offset + c.byteLength > total) {
      out.set(c.subarray(0, total - offset), offset)
      break
    }
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
