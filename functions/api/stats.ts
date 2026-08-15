// Cloudflare Pages Function: GET /api/stats?token=SECRET&event=save
// A private read-out of the aggregate counters, for the maker only. It returns
// 404 unless STATS_TOKEN is set and matches, so it isn't discoverable and never
// leaks numbers publicly. There is nothing personal to leak here anyway: just
// an all-time total and a per-day tally of anonymous event counts.
//
// Two generations of storage (see issue #14): the legacy incremented counters
// (`:total` and `:day:*`, frozen since the switch) and one unique `:hit:` key
// per save, which cannot lose counts. This endpoint folds both together.

interface Env {
  STATS?: KVNamespace
  STATS_TOKEN?: string
}

export interface Hit {
  date: string
  browser?: string
  device?: string
}

/** Parse a hit key. Two generations: `...hit:date:uuid` (first days after the
 *  counter fix) and `...hit:date:browser:device:uuid`. Pure, for tests. */
export function parseHitKey(name: string): Hit | null {
  const parts = name.split(':')
  if (parts.length < 5 || parts[2] !== 'hit') return null
  const hit: Hit = { date: parts[3] }
  if (parts.length >= 7) {
    hit.browser = parts[4]
    hit.device = parts[5]
  }
  return hit
}

/** Merge the frozen legacy counters with the per-hit keys. Pure, for tests. */
export function aggregate(
  legacyTotal: number,
  legacyDays: Record<string, number>,
  hits: Hit[],
): {
  total: number
  days: Record<string, number>
  browsers: Record<string, number>
  devices: Record<string, number>
} {
  const merged: Record<string, number> = { ...legacyDays }
  const browsers: Record<string, number> = {}
  const devices: Record<string, number> = {}
  for (const hit of hits) {
    merged[hit.date] = (merged[hit.date] ?? 0) + 1
    if (hit.browser) browsers[hit.browser] = (browsers[hit.browser] ?? 0) + 1
    if (hit.device) devices[hit.device] = (devices[hit.device] ?? 0) + 1
  }
  const days: Record<string, number> = {}
  for (const date of Object.keys(merged).sort()) {
    days[date] = merged[date]
  }
  return { total: legacyTotal + hits.length, days, browsers, devices }
}

/** Fold `fail:date:host:uuid` keys into per-host counts, worst first. Pure,
 *  for tests. Malformed keys are skipped rather than miscounted. */
export function aggregateFails(names: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const name of names) {
    const parts = name.split(':')
    if (parts.length < 4 || parts[0] !== 'fail') continue
    counts[parts[2]] = (counts[parts[2]] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

/** Every key under a prefix, following list cursors. */
async function listKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const names: string[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await kv.list({ prefix, cursor })
    for (const k of page.keys) names.push(k.name)
    if (page.list_complete) return names
    cursor = page.cursor
  }
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

  const legacyTotal = parseInt((await env.STATS.get(`count:${event}:total`)) ?? '0', 10) || 0

  const dayPrefix = `count:${event}:day:`
  const legacyDays: Record<string, number> = {}
  for (const name of await listKeys(env.STATS, dayPrefix)) {
    const date = name.slice(dayPrefix.length)
    legacyDays[date] = parseInt((await env.STATS.get(name)) ?? '0', 10) || 0
  }

  const hitPrefix = `count:${event}:hit:`
  const hits = (await listKeys(env.STATS, hitPrefix))
    .map(parseHitKey)
    .filter((h): h is Hit => h !== null)

  const { total, days, browsers, devices } = aggregate(legacyTotal, legacyDays, hits)
  const parseFails = aggregateFails(await listKeys(env.STATS, 'fail:'))
  return Response.json({ event, total, days, browsers, devices, parseFails })
}
