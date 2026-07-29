// Cloudflare Pages Function: GET /api/fazier-badge
// The live "Featured on Fazier" badge, upvote count included, served from our
// own origin. Hotlinking Fazier's embed would send every visitor's IP and
// browser to a third party on every page view, which the About page promises
// not to do. So the edge fetches it here, caches it for a few hours, and falls
// back to the static parked badge if Fazier is slow or down. Visitors only
// ever talk to this domain.

interface Env {
  ASSETS: Fetcher
}

const SOURCE =
  'https://fazier.com/api/v1/public/badges/embed_image.svg?launch_id=10597&badge_type=featured&theme=light'
const EDGE_TTL = 21_600 // refresh the count roughly four times a day

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = caches.default
  const cacheKey = new Request(new URL('/api/fazier-badge', context.request.url).toString())

  const cached = await cache.match(cacheKey)
  if (cached) return cached

  try {
    const upstream = await fetch(SOURCE, { cf: { cacheTtl: EDGE_TTL } })
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
    const svg = await upstream.text()
    if (!svg.includes('<svg')) throw new Error('not an svg')
    const res = new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': `public, max-age=3600, s-maxage=${EDGE_TTL}`,
      },
    })
    context.waitUntil(cache.put(cacheKey, res.clone()))
    return res
  } catch {
    // Fazier being down should never break our footer: serve the static badge.
    return context.env.ASSETS.fetch(new Request(new URL('/fazier-badge.svg', context.request.url).toString()))
  }
}
