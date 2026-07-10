// Cloudflare Pages Function: GET /api/stats?token=SECRET&event=save
// A private read-out of the aggregate counters, for the maker only. It returns
// 404 unless STATS_TOKEN is set and matches, so it isn't discoverable and never
// leaks numbers publicly. There is nothing personal to leak here anyway: just
// an all-time total and a per-day tally of anonymous event counts.

interface Env {
  STATS?: KVNamespace
  STATS_TOKEN?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // Hidden unless a token is configured and the caller presents the right one.
  if (!env.STATS_TOKEN || url.searchParams.get('token') !== env.STATS_TOKEN) {
    return new Response(null, { status: 404 })
  }
  if (!env.STATS) {
    return Response.json({ error: 'STATS KV namespace is not bound yet' })
  }

  const event = url.searchParams.get('event') || 'save'
  const total = parseInt((await env.STATS.get(`count:${event}:total`)) ?? '0', 10) || 0

  const prefix = `count:${event}:day:`
  const days: Record<string, number> = {}
  const list = await env.STATS.list({ prefix })
  for (const k of list.keys) {
    const date = k.name.slice(prefix.length)
    days[date] = parseInt((await env.STATS.get(k.name)) ?? '0', 10) || 0
  }

  return Response.json({ event, total, days })
}
