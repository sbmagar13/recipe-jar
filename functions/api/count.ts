// Cloudflare Pages Function: POST /api/count
// An anonymous, aggregate product counter. It receives a single event name and
// records that it happened. It stores NO identifier, NO IP, and NO recipe
// content: just "a save happened, on which day, from which browser family and
// device class". The raw User-Agent header is bucketed into those two coarse
// labels (like "chrome" + "mobile") and immediately discarded, never stored.
// The client only calls it when the visitor has not asked to be left alone
// (Do Not Track / Global Privacy Control), and never sends anything but the
// event name.
//
// Storage is a KV namespace bound as `STATS`. If it isn't bound, the endpoint
// quietly accepts and does nothing, so nothing breaks before setup is finished.

import { isAllowedCaller } from './_caller'

interface Env {
  STATS?: KVNamespace
}

const EVENTS = new Set(['save'])
const MAX_BODY = 200 // bytes; the body is a tiny {"event":"save"}

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

// One unique key per event instead of incrementing counters. KV reads can be
// a minute stale per edge location, so read-modify-write counters lose
// increments under bursts, and a cached "not found" on a fresh day key could
// overwrite a whole day's tally with 1 (issue #14 cost the launch-week buckets
// ~40 saves that way). A unique key per hit cannot collide with anything, so
// counts stay exact. Keys are ~60 bytes and saves are dozens a day: decades of
// headroom before storage or list cost matters. /api/stats counts them.
export function hitKey(event: string, date: string, browser: string, device: string, id: string): string {
  return `count:${event}:hit:${date}:${browser}:${device}:${id}`
}

// Coarse, fixed buckets only. Five-ish browser families and two device classes
// cannot identify anyone, which is the whole point: never store the raw UA,
// versions, OS, or anything combinable into a fingerprint.
export function browserFamily(ua: string): string {
  if (/Edg(e|iOS|A)?\//.test(ua)) return 'edge'
  if (/SamsungBrowser\//.test(ua)) return 'samsung'
  if (/(OPR|Opera)\//.test(ua)) return 'opera'
  if (/(Firefox|FxiOS)\//.test(ua)) return 'firefox'
  if (/(Chrome|CriOS)\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

export function deviceClass(ua: string): string {
  return /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const selfOrigin = new URL(request.url).origin
  if (!isAllowedCaller(request.headers, selfOrigin)) {
    return new Response(null, { status: 403 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 })

  let event = ''
  try {
    event = String((JSON.parse(raw) as { event?: unknown }).event ?? '')
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!EVENTS.has(event)) return new Response(null, { status: 400 })

  // No storage bound yet (or intentionally off): accept and do nothing.
  if (!env.STATS) return new Response(null, { status: 204 })

  // The legacy `count:save:total` and `count:save:day:*` counters are frozen
  // as history; /api/stats folds them in.
  const ua = request.headers.get('User-Agent') ?? ''
  await env.STATS.put(hitKey(event, today(), browserFamily(ua), deviceClass(ua), crypto.randomUUID()), '1')

  return new Response(null, { status: 204 })
}
