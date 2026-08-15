import { describe, it, expect } from 'vitest'
// The self-hosting server exports its pure guards for testing; it only starts
// listening when run directly.
// @ts-expect-error plain .mjs module without types
import { isBlockedHost, isPrivateAddress, isAllowedCaller } from '../server/server.mjs'

describe('self-host proxy: host blocklist (same rules as the Cloudflare function)', () => {
  it('blocks localhost, private ranges, bare hostnames, and IPv6 literals', () => {
    for (const host of [
      'localhost',
      'router',
      '10.0.0.5',
      '127.0.0.1',
      '192.168.1.10',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.1',
      'nas.local',
      'db.internal',
      '::1',
    ]) {
      expect(isBlockedHost(host), host).toBe(true)
    }
  })

  it('allows normal public hosts', () => {
    for (const host of ['www.bbcgoodfood.com', 'recipetineats.com', '172.32.0.1', '8.8.8.8']) {
      expect(isBlockedHost(host), host).toBe(false)
    }
  })
})

describe('self-host proxy: DNS answer screening', () => {
  it('rejects private, loopback, link-local, and mapped addresses', () => {
    for (const addr of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '169.254.169.254', '172.20.0.1', '::1', 'fe80::1', 'fd00::2', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(addr), addr).toBe(true)
    }
  })

  it('accepts public addresses', () => {
    for (const addr of ['142.250.74.110', '2606:4700::6810:84e5', '172.64.155.209']) {
      expect(isPrivateAddress(addr), addr).toBe(false)
    }
  })
})

describe('self-host proxy: caller gating', () => {
  const SELF = 'http://localhost:8080'
  it('accepts same-origin browser calls via Sec-Fetch-Site', () => {
    expect(isAllowedCaller({ 'sec-fetch-site': 'same-origin' }, SELF)).toBe(true)
  })
  it('rejects cross-site and provenance-free calls', () => {
    expect(isAllowedCaller({ 'sec-fetch-site': 'cross-site' }, SELF)).toBe(false)
    expect(isAllowedCaller({}, SELF)).toBe(false)
    expect(isAllowedCaller({ origin: 'https://evil.example' }, SELF)).toBe(false)
  })
  it('falls back to Origin/Referer for engines without Sec-Fetch-Site', () => {
    expect(isAllowedCaller({ origin: SELF }, SELF)).toBe(true)
    expect(isAllowedCaller({ referer: `${SELF}/some/page` }, SELF)).toBe(true)
  })
})
