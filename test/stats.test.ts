import { describe, it, expect } from 'vitest'
import { aggregate, parseHitKey } from '../functions/api/stats'
import { hitKey, browserFamily, deviceClass } from '../functions/api/count'

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  firefoxIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0',
}

describe('browserFamily', () => {
  it('buckets the majors, in the order that matters', () => {
    expect(browserFamily(UA.chromeMac)).toBe('chrome')
    expect(browserFamily(UA.chromeAndroid)).toBe('chrome')
    expect(browserFamily(UA.chromeIos)).toBe('chrome')
    expect(browserFamily(UA.safariIphone)).toBe('safari')
    expect(browserFamily(UA.safariMac)).toBe('safari')
    expect(browserFamily(UA.firefox)).toBe('firefox')
    expect(browserFamily(UA.firefoxIos)).toBe('firefox')
    // These carry a Chrome token too, so they must win over the chrome check.
    expect(browserFamily(UA.edge)).toBe('edge')
    expect(browserFamily(UA.samsung)).toBe('samsung')
    expect(browserFamily(UA.opera)).toBe('opera')
  })

  it('never invents a bucket for junk', () => {
    expect(browserFamily('')).toBe('other')
    expect(browserFamily('curl/8.6.0')).toBe('other')
  })
})

describe('deviceClass', () => {
  it('splits mobile from desktop, coarsely', () => {
    expect(deviceClass(UA.chromeAndroid)).toBe('mobile')
    expect(deviceClass(UA.safariIphone)).toBe('mobile')
    expect(deviceClass(UA.chromeMac)).toBe('desktop')
    expect(deviceClass(UA.firefox)).toBe('desktop')
    expect(deviceClass('')).toBe('desktop')
  })
})

describe('hitKey / parseHitKey', () => {
  it('round-trips the current key format', () => {
    const key = hitKey('save', '2026-07-28', 'chrome', 'mobile', 'abc-123')
    expect(key).toBe('count:save:hit:2026-07-28:chrome:mobile:abc-123')
    expect(parseHitKey(key)).toEqual({ date: '2026-07-28', browser: 'chrome', device: 'mobile' })
  })

  it('still reads the first-generation keys with no dimensions', () => {
    expect(parseHitKey('count:save:hit:2026-07-28:a33fb4d7-838d-4123')).toEqual({
      date: '2026-07-28',
    })
  })

  it('rejects keys that are not hits', () => {
    expect(parseHitKey('count:save:total')).toBe(null)
    expect(parseHitKey('count:save:day:2026-07-10')).toBe(null)
  })
})

describe('aggregate', () => {
  const hit = (date: string, browser?: string, device?: string) => ({ date, browser, device })

  it('adds hits on top of the frozen legacy counters', () => {
    const out = aggregate(116, { '2026-07-27': 3 }, [
      hit('2026-07-28', 'chrome', 'mobile'),
      hit('2026-07-28', 'safari', 'mobile'),
    ])
    expect(out.total).toBe(118)
    expect(out.days).toEqual({ '2026-07-27': 3, '2026-07-28': 2 })
    expect(out.browsers).toEqual({ chrome: 1, safari: 1 })
    expect(out.devices).toEqual({ mobile: 2 })
  })

  it('merges hits into a legacy day by addition (the cutover day)', () => {
    const out = aggregate(10, { '2026-07-28': 2 }, [hit('2026-07-28')])
    expect(out.days['2026-07-28']).toBe(3)
    expect(out.total).toBe(11)
  })

  it('is exactly the legacy data when there are no hits yet', () => {
    const out = aggregate(116, { '2026-07-10': 6 }, [])
    expect(out.total).toBe(116)
    expect(out.days).toEqual({ '2026-07-10': 6 })
    expect(out.browsers).toEqual({})
  })

  it('counts dimensionless first-generation hits in days but not browsers', () => {
    const out = aggregate(0, {}, [hit('2026-07-28'), hit('2026-07-28', 'chrome', 'desktop')])
    expect(out.days).toEqual({ '2026-07-28': 2 })
    expect(out.browsers).toEqual({ chrome: 1 })
    expect(out.devices).toEqual({ desktop: 1 })
  })

  it('returns days in chronological order', () => {
    const out = aggregate(0, { '2026-07-12': 1 }, [hit('2026-07-10'), hit('2026-07-14')])
    expect(Object.keys(out.days)).toEqual(['2026-07-10', '2026-07-12', '2026-07-14'])
  })
})

describe('aggregateFails', () => {
  it('folds fail keys into per-host counts, worst first, skipping junk', async () => {
    const { aggregateFails } = await import('../functions/api/stats')
    const out = aggregateFails([
      'fail:2026-08-15:example.com:aaa',
      'fail:2026-08-15:example.com:bbb',
      'fail:2026-08-16:example.com:ccc',
      'fail:2026-08-16:other.se:ddd',
      'count:save:hit:2026-08-16:chrome:desktop:eee',
      'fail:broken',
    ])
    expect(Object.keys(out)).toEqual(['example.com', 'other.se'])
    expect(out['example.com']).toBe(3)
    expect(out['other.se']).toBe(1)
  })
})

describe('cleanHost (report endpoint)', () => {
  it('accepts hostnames and rejects junk that could pollute keys', async () => {
    const { cleanHost } = await import('../functions/api/report')
    expect(cleanHost('www.Example.COM')).toBe('www.example.com')
    expect(cleanHost('kwestiasmaku.com')).toBe('kwestiasmaku.com')
    expect(cleanHost('no-dots')).toBe('')
    expect(cleanHost('bad:colon.com')).toBe('')
    expect(cleanHost(42)).toBe('')
    expect(cleanHost('a'.repeat(200) + '.com')).toBe('')
  })
})
