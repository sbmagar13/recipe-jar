// Cloudflare Pages Function: POST /api/count
// An anonymous, aggregate product counter. It receives a single event name and
// bumps a number. It stores NO identifier, NO IP, NO recipe content, and NO user
// agent: literally just "a save happened, and on which day". The client only
// calls it when the visitor has not asked to be left alone (Do Not Track /
// Global Privacy Control), and never sends anything but the event name.
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
export function hitKey(event: string, date: string, id: string): string {
  return `count:${event}:hit:${date}:${id}`
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
  await env.STATS.put(hitKey(event, today(), crypto.randomUUID()), '1')

  return new Response(null, { status: 204 })
}
