// Cloudflare Pages Function: GET /api/insights?token=SECRET
// The maker's private dashboard: the aggregate counters rendered as one
// self-contained HTML page (inline CSS, inline SVG, zero libraries) so the
// numbers read at a glance on a phone. Same token gate as /api/stats; 404
// without it. There is nothing personal here to leak either way: day counts
// per feature, coarse browser/device buckets, and parse-failure hostnames.

import { listKeys, parseHitKey, aggregate, aggregateFails, type Hit } from './stats'

interface Env {
  STATS?: KVNamespace
  STATS_TOKEN?: string
}

// Order is the display order. 'save' first: it is the number that matters.
const EVENTS = ['save', 'search', 'share-link', 'share-image', 'cook-finish', 'plan-day', 'pantry'] as const
const EVENT_LABELS: Record<string, string> = {
  save: 'Recipes saved',
  search: 'Dish searches',
  'share-link': 'Links shared',
  'share-image': 'Images shared',
  'cook-finish': 'Cooks finished',
  'plan-day': 'Days planned',
  pantry: 'Pantry lookups',
}

/** The last `n` daily counts ending at `today` (YYYY-MM-DD), zeros filled. */
export function lastDays(days: Record<string, number>, today: string, n: number): number[] {
  const out: number[] = []
  const end = new Date(`${today}T00:00:00Z`).getTime()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10)
    out.push(days[d] ?? 0)
  }
  return out
}

/** A polyline path for a sparkline, scaled into w×h with 1px breathing room.
 *  A flat all-zero series draws along the baseline. */
export function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? (w - 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = (1 + i * stepX).toFixed(1)
      const y = (h - 1 - (v / max) * (h - 2)).toFixed(1)
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tile(label: string, total: number, series: number[], today: number): string {
  const path = sparklinePath(series, 220, 44)
  return `<div class="tile">
    <p class="tlabel">${esc(label)}</p>
    <p class="tnum">${total.toLocaleString('en-US')}<span class="ttoday">${today > 0 ? `+${today} today` : ''}</span></p>
    <svg viewBox="0 0 220 44" width="220" height="44" role="img" aria-label="last 30 days">
      <path d="${path}" fill="none" stroke="#33663d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`
}

function bars(title: string, counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, n]) => n), 1)
  const rows = entries
    .map(
      ([k, n]) =>
        `<div class="bar"><span class="bk">${esc(k)}</span><span class="bt" style="width:${Math.max(3, (n / max) * 100).toFixed(0)}%"></span><span class="bn">${n}</span></div>`,
    )
    .join('')
  return `<div class="panel"><h2>${esc(title)}</h2>${rows || '<p class="muted">nothing yet</p>'}</div>`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  if (!env.STATS_TOKEN || url.searchParams.get('token') !== env.STATS_TOKEN) {
    return new Response(null, { status: 404 })
  }
  if (!env.STATS) return new Response('STATS KV namespace is not bound yet', { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  const tiles: string[] = []
  let saveBrowsers: Record<string, number> = {}
  let saveDevices: Record<string, number> = {}
  for (const event of EVENTS) {
    const hits = (await listKeys(env.STATS, `count:${event}:hit:`))
      .map(parseHitKey)
      .filter((h): h is Hit => h !== null)
    // Saves fold in the frozen first-generation counters too.
    let legacyTotal = 0
    const legacyDays: Record<string, number> = {}
    if (event === 'save') {
      legacyTotal = parseInt((await env.STATS.get('count:save:total')) ?? '0', 10) || 0
      const dayPrefix = 'count:save:day:'
      for (const name of await listKeys(env.STATS, dayPrefix)) {
        legacyDays[name.slice(dayPrefix.length)] = parseInt((await env.STATS.get(name)) ?? '0', 10) || 0
      }
    }
    const agg = aggregate(legacyTotal, legacyDays, hits)
    if (event === 'save') {
      saveBrowsers = agg.browsers
      saveDevices = agg.devices
    }
    const series = lastDays(agg.days, today, 30)
    tiles.push(tile(EVENT_LABELS[event] ?? event, agg.total, series, agg.days[today] ?? 0))
  }

  const fails = aggregateFails(await listKeys(env.STATS, 'fail:'))
  const failRows = Object.entries(fails)
    .map(([host, reasons]) => {
      const unread = reasons['markup-unread'] ?? 0
      const rest = Object.entries(reasons)
        .filter(([r]) => r !== 'markup-unread')
        .map(([r, n]) => `${esc(r)} ${n}`)
        .join(' · ')
      return `<tr class="${unread > 0 ? 'signal' : ''}"><td>${esc(host)}</td><td>${unread > 0 ? `markup-unread ${unread}` : ''}</td><td class="muted">${rest}</td></tr>`
    })
    .join('')

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Recipe Jar · insights</title>
<style>
  body{margin:0;background:#f6f3ec;color:#2a2a25;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;padding:24px}
  h1{font:700 28px Georgia,serif;color:#275231;margin:0 0 4px}
  h2{font:700 18px Georgia,serif;color:#2a2a25;margin:0 0 10px}
  .sub{color:#726c5c;margin:0 0 24px;font-size:.9rem}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:24px}
  .tile,.panel{background:#fcfaf4;border:1px solid #ddd7c7;border-radius:12px;padding:14px 16px}
  .tlabel{margin:0;color:#726c5c;font-size:.85rem}
  .tnum{margin:2px 0 8px;font:700 30px Georgia,serif;color:#275231}
  .ttoday{font:600 13px system-ui,sans-serif;color:#b8402e;margin-left:10px}
  .panel{margin-bottom:24px}
  .bar{display:flex;align-items:center;gap:10px;margin:6px 0}
  .bk{width:5.5em;color:#726c5c;font-size:.85rem}
  .bt{height:12px;background:#33663d;border-radius:6px;display:inline-block}
  .bn{font-size:.85rem}
  table{border-collapse:collapse;width:100%;font-size:.9rem}
  td{padding:6px 10px 6px 0;border-top:1px solid #ddd7c7;vertical-align:top}
  tr.signal td{color:#b8402e;font-weight:600}
  .muted{color:#726c5c;font-weight:400}
</style></head><body>
<h1>Recipe Jar 🫙</h1>
<p class="sub">private insights · ${today} · anonymous counters only, DNT-honoring, nothing identifies anyone</p>
<div class="tiles">${tiles.join('')}</div>
<div class="row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px">
${bars('Saves by browser', saveBrowsers)}
${bars('Saves by device', saveDevices)}
</div>
<div class="panel"><h2>Pages the parser could not read (90 days)</h2>
${failRows ? `<table><tbody>${failRows}</tbody></table>` : '<p class="muted">none, the parser is keeping up</p>'}
<p class="muted" style="font-size:.8rem;margin-bottom:0">markup-unread = a recipe page we failed to parse (worth chasing) · no-recipe = the page was never a recipe</p>
</div>
</body></html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
      'X-Robots-Tag': 'noindex',
    },
  })
}
