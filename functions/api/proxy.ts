// Cloudflare Pages Function: GET /api/proxy?url=<encoded>
// Fetches a recipe page on behalf of the user (reader-mode posture: user-initiated,
// result rendered client-side, nothing stored). Keeps the app itself fully static.

const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 12_000

export const onRequestGet: PagesFunction = async (context) => {
  const target = new URL(context.request.url).searchParams.get('url')
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
  // Block obvious SSRF targets
  const host = parsed.hostname
  if (
    host === 'localhost' ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return json({ error: 'URL not allowed' }, 400)
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
    return new Response(html, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError' ? 'Site took too long to respond' : 'Could not reach the site'
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
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
