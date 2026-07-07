// Shared caller-provenance check for the API endpoints. The leading underscore
// tells Cloudflare Pages this file is not itself a route.

// Origins our own app is served from. Same-origin calls are recognised via
// Sec-Fetch-Site/Referer regardless of host, so this is only a belt-and-braces
// allowlist for the (rare) cross-origin-but-ours case.
const ALLOWED_ORIGINS = new Set([
  'https://recipejar.app',
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
  // API same-origin, so this is the reliable signal.
  const site = headers.get('Sec-Fetch-Site')
  if (site) return site === 'same-origin' || site === 'same-site'
  // Older engines (iOS Safari < 16.4) omit it: fall back to Origin/Referer,
  // both of which a same-origin fetch still sends.
  const origin = headers.get('Origin') ?? originOf(headers.get('Referer'))
  if (!origin) return false // no provenance at all → treat as open-proxy abuse
  return origin === selfOrigin || ALLOWED_ORIGINS.has(origin)
}
