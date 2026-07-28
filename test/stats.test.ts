import { describe, it, expect } from 'vitest'
import { aggregate } from '../functions/api/stats'
import { hitKey } from '../functions/api/count'

describe('hitKey', () => {
  it('builds the per-save key with the date where stats expects it', () => {
    const key = hitKey('save', '2026-07-28', 'abc-123')
    expect(key).toBe('count:save:hit:2026-07-28:abc-123')
    // stats.ts extracts the date as the 10 chars after the prefix
    const prefix = 'count:save:hit:'
    expect(key.slice(prefix.length, prefix.length + 10)).toBe('2026-07-28')
  })
})

describe('aggregate', () => {
  it('adds hits on top of the frozen legacy counters', () => {
    const out = aggregate(116, { '2026-07-27': 3 }, ['2026-07-28', '2026-07-28'])
    expect(out.total).toBe(118)
    expect(out.days).toEqual({ '2026-07-27': 3, '2026-07-28': 2 })
  })

  it('merges hits into a legacy day by addition (the cutover day)', () => {
    // The day the fix deploys has a partial legacy tally plus new hit keys.
    const out = aggregate(10, { '2026-07-28': 2 }, ['2026-07-28'])
    expect(out.days['2026-07-28']).toBe(3)
    expect(out.total).toBe(11)
  })

  it('is exactly the legacy data when there are no hits yet', () => {
    const out = aggregate(116, { '2026-07-10': 6 }, [])
    expect(out).toEqual({ total: 116, days: { '2026-07-10': 6 } })
  })

  it('counts pure hits with no legacy history', () => {
    const out = aggregate(0, {}, ['2026-08-01', '2026-08-02', '2026-08-02'])
    expect(out.total).toBe(3)
    expect(out.days).toEqual({ '2026-08-01': 1, '2026-08-02': 2 })
  })

  it('returns days in chronological order', () => {
    const out = aggregate(0, { '2026-07-12': 1 }, ['2026-07-10', '2026-07-14'])
    expect(Object.keys(out.days)).toEqual(['2026-07-10', '2026-07-12', '2026-07-14'])
  })
})
