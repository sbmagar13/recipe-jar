// Self-hosting server: serves the static build and runs a portable port of the
// link-fetch proxy (functions/api/proxy.ts) with the same open-proxy and SSRF
// guards. Zero dependencies, Node 20+. See docs in README "Self-host with
// Docker". The Cloudflare deployment does not use this file.
//
// Differences from the Cloudflare function, on purpose:
//  - no telemetry: /api/count answers 204 and stores nothing, /api/stats is 404;
//  - the SSRF guard also checks the DNS answer and re-checks every redirect
//    hop, because a homelab has no edge network filtering private ranges;
//  - the 1-hour page cache is a small in-memory map instead of an edge cache.

import { createServer } from 'node:http'
import { promises as dns } from 'node:dns'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), process.env.DIST_DIR ?? 'dist')
const PORT = Number(process.env.PORT ?? 8080)
const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 12_000
const CACHE_SECONDS = 3_600
const MAX_REDIRECTS = 5
const CACHE_MAX_ENTRIES = 200

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.mp4': 'video/mp4',
}

export function isBlockedHost(host) {
  return (
    host === 'localhost' ||
    !host.includes('.') ||
    host.includes(':') ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
}

/** IPv4/IPv6 answers that must never be fetched from a homelab. */
export function isPrivateAddress(addr) {
  if (addr.includes(':')) {
    const a = addr.toLowerCase()
    return (
      a === '::1' ||
      a === '::' ||
      a.startsWith('fe80') ||
      a.startsWith('fc') ||
      a.startsWith('fd') ||
      a.startsWith('::ffff:127.') ||
      a.startsWith('::ffff:10.') ||
      a.startsWith('::ffff:192.168.')
    )
  }
  return (
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(addr) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr) ||
    addr === '255.255.255.255'
  )
}

/** The same caller test as functions/api/_caller.ts, minus the cloud origins. */
export function isAllowedCaller(headers, selfOrigin) {
  const site = headers['sec-fetch-site']
  if (site) return site === 'same-origin' || site === 'same-site'
  const raw = headers.origin ?? headers.referer
  if (!raw) return false
  try {
    return new URL(raw).origin === selfOrigin
  } catch {
    return false
  }
}

async function assertPublicHost(hostname) {
  if (isBlockedHost(hostname)) throw new Error('blocked')
  const answers = await dns.lookup(hostname, { all: true, verbatim: true })
  if (answers.length === 0 || answers.some((a) => isPrivateAddress(a.address))) throw new Error('blocked')
}

const HTMLISH = /text\/html|application\/xhtml|\/xml|text\/plain/i
const pageCache = new Map() // url -> { at, body }

async function handleProxy(req, res, reqUrl) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0] ?? 'http'
  const host = req.headers['x-forwarded-host']?.split(',')[0] ?? req.headers.host ?? `localhost:${PORT}`
  if (!isAllowedCaller(req.headers, `${proto}://${host}`)) {
    return sendJson(res, 403, { error: 'This proxy only serves the Recipe Jar app.' })
  }

  const target = reqUrl.searchParams.get('url')
  if (!target) return sendJson(res, 400, { error: 'Missing url parameter' })
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return sendJson(res, 400, { error: 'Invalid URL' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return sendJson(res, 400, { error: 'Only http(s) URLs are supported' })
  }

  const cached = pageCache.get(parsed.toString())
  if (cached && Date.now() - cached.at < CACHE_SECONDS * 1000) {
    return sendText(res, 200, cached.body, `public, max-age=${CACHE_SECONDS}`)
  }

  try {
    let current = parsed
    let upstream
    for (let hop = 0; ; hop++) {
      if (current.port && current.port !== '80' && current.port !== '443') throw new Error('blocked')
      await assertPublicHost(current.hostname)
      upstream = await fetch(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,sv;q=0.8,ne;q=0.6',
        },
      })
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location')
        if (!location || hop >= MAX_REDIRECTS) throw new Error('too many redirects')
        current = new URL(location, current)
        if (current.protocol !== 'http:' && current.protocol !== 'https:') throw new Error('blocked')
        continue
      }
      break
    }
    if (!upstream.ok) return sendJson(res, 502, { error: `Site responded with ${upstream.status}` })
    const contentType = upstream.headers.get('content-type') ?? ''
    if (contentType && !HTMLISH.test(contentType)) {
      return sendJson(res, 415, { error: 'That link is not a web page we can read' })
    }

    const reader = upstream.body?.getReader()
    if (!reader) return sendJson(res, 502, { error: 'Empty response' })
    const chunks = []
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
    const html = Buffer.concat(chunks).subarray(0, MAX_BYTES).toString('utf-8')
    if (pageCache.size >= CACHE_MAX_ENTRIES) {
      pageCache.delete(pageCache.keys().next().value)
    }
    pageCache.set(parsed.toString(), { at: Date.now(), body: html })
    return sendText(res, 200, html, `public, max-age=${CACHE_SECONDS}`)
  } catch (err) {
    if (err instanceof Error && err.message === 'blocked') {
      return sendJson(res, 400, { error: 'URL not allowed' })
    }
    const message =
      err instanceof Error && err.name === 'TimeoutError' ? 'Site took too long to respond' : 'Could not reach the site'
    return sendJson(res, 502, { error: message })
  }
}

async function handleStatic(res, pathname) {
  let filePath = normalize(join(ROOT, decodeURIComponent(pathname)))
  if (!filePath.startsWith(ROOT)) return sendJson(res, 400, { error: 'Bad path' })
  try {
    const s = await stat(filePath)
    if (s.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    // Unknown extensionless paths fall back to the app shell (hash routing
    // means this rarely happens, but a stray path should not 404 the app).
    if (extname(filePath) !== '') return sendJson(res, 404, { error: 'Not found' })
    filePath = join(ROOT, 'index.html')
  }
  try {
    const body = await readFile(filePath)
    const ext = extname(filePath)
    // Hashed assets never change; the shell and service worker must revalidate.
    const cache = filePath.includes(`${ROOT}/assets/`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(body)
  } catch {
    sendJson(res, 404, { error: 'Not found' })
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendText(res, status, body, cacheControl) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

export function createApp() {
  return createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://internal')
    const { pathname } = reqUrl
    if (pathname === '/healthz') return sendText(res, 200, 'ok', 'no-cache')
    if (pathname === '/api/proxy' && req.method === 'GET') return handleProxy(req, res, reqUrl)
    if (pathname === '/api/count' && req.method === 'POST') {
      res.writeHead(204)
      return res.end()
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' })
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed' })
    }
    return handleStatic(res, pathname)
  })
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (runDirectly) {
  createApp().listen(PORT, '0.0.0.0', () => {
    console.log(`Recipe Jar serving ${ROOT} on :${PORT}`)
  })
}
