// Privacy-respecting telemetry. The whole point of Recipe Jar is that your
// recipes never leave your device, so this deliberately collects the bare
// minimum to keep the app working:
//   - parse failures: only the *hostname* of a page we couldn't read (so the
//     parser can be improved) plus a coarse reason. Never the path, query,
//     recipe content, or any user identifier.
//   - uncaught errors from our own scripts: message + source location, so a
//     white-screen bug (like the iOS Safari regex one) is visible in the wild.
// It honours Do-Not-Track / Global Privacy Control, never runs on localhost,
// is rate-limited per session, and can never throw.

const APP_VERSION = 'rj-1.0.0'
const ENDPOINT = '/api/report'
const MAX_PER_SESSION = 12

let sentCount = 0
const seen = new Set<string>()

function trackingAllowed(): boolean {
  if (typeof navigator === 'undefined' || typeof location === 'undefined') return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
  const dnt = nav.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack
  if (dnt === '1' || dnt === 'yes') return false
  if (nav.globalPrivacyControl === true) return false
  const h = location.hostname
  if (h === 'localhost' || h === '' || h === '0.0.0.0' || h.startsWith('127.') || h.endsWith('.local')) return false
  return true
}

type Payload = { kind: 'parse-fail' | 'error'; host?: string; reason?: string; message?: string; at?: string }

function send(payload: Payload): void {
  try {
    if (!trackingAllowed() || sentCount >= MAX_PER_SESSION) return
    const key = `${payload.kind}|${payload.host ?? ''}|${payload.reason ?? ''}|${payload.at ?? ''}|${payload.message ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    sentCount++
    const body = JSON.stringify({ ...payload, version: APP_VERSION })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
    }
  } catch {
    /* telemetry must never break the app */
  }
}

function pathOf(file?: string): string {
  if (!file) return ''
  try {
    return new URL(file).pathname
  } catch {
    return ''
  }
}

const COUNT_ENDPOINT = '/api/count'

/**
 * Anonymous, aggregate product counter. It tells the server only that "an event
 * happened" (e.g. a recipe was saved), with no identifier, no content, and no
 * hostname. It exists so the maker can see rough usage trends, nothing more.
 * Honors Do-Not-Track / Global Privacy Control via trackingAllowed(), and can
 * never throw. Unlike reportParseIssue it does not dedupe: each real save counts.
 */
export function countEvent(event: 'save'): void {
  try {
    if (!trackingAllowed()) return
    const body = JSON.stringify({ event })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(COUNT_ENDPOINT, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(COUNT_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* a counter must never break the app */
  }
}

/** Report that a fetched page couldn't be turned into a recipe. Hostname only. */
export function reportParseIssue(url: string, reason = 'no-recipe'): void {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    /* leave host empty */
  }
  send({ kind: 'parse-fail', host, reason })
}

/** Install global handlers for uncaught errors from our own code. */
export function initTelemetry(): void {
  if (typeof window === 'undefined' || !trackingAllowed()) return
  window.addEventListener('error', (e) => {
    // Only our own scripts — ignore extension noise and cross-origin resource errors.
    if (!e.message || (e.filename && !e.filename.startsWith(location.origin))) return
    send({ kind: 'error', message: String(e.message).slice(0, 300), at: `${pathOf(e.filename)}:${e.lineno ?? 0}` })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    const message = reason instanceof Error ? reason.message : String(reason ?? '')
    if (!message) return
    send({ kind: 'error', message: message.slice(0, 300), at: 'unhandledrejection' })
  })
}
