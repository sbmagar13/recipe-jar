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
const DAY_TTL = 63_072_000 // keep per-day tallies ~2 years, then let them expire

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

async function bump(kv: KVNamespace, key: string, ttl?: number): Promise<void> {
  const current = parseInt((await kv.get(key)) ?? '0', 10) || 0
  await kv.put(key, String(current + 1), ttl ? { expirationTtl: ttl } : undefined)
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

  await bump(env.STATS, `count:${event}:total`)
  await bump(env.STATS, `count:${event}:day:${today()}`, DAY_TTL)

  return new Response(null, { status: 204 })
}
