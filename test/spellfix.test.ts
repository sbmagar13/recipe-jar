import { describe, it, expect, vi, afterEach } from 'vitest'
import { correctQuery, correctWord } from '../src/lib/spellfix'
import { searchSitesForgiving } from '../src/lib/sitesearch'

describe('correctQuery', () => {
  it('snaps a near-miss to the nearest food word', () => {
    expect(correctQuery('browny')).toBe('brownie')
    expect(correctQuery('chiken curry')).toBe('chicken curry')
    expect(correctQuery('panner tikka')).toBe('paneer tikka')
  })

  it('leaves exact known words alone', () => {
    expect(correctQuery('mutton curry')).toBe('mutton curry')
    expect(correctQuery('paneer tikka masala')).toBe('paneer tikka masala')
  })

  it('normalizes plurals to the known base on the retry pass', () => {
    // Correction only runs after a zero-hit search, where the singular
    // casts the wider net ("currys" and "brownies" both land on base form).
    expect(correctWord('currys')).toBe('curry')
    expect(correctWord('brownies')).toBe('brownie')
    expect(correctWord('berries')).toBe('berries') // not a food word we track
  })

  it('never touches short words or gibberish', () => {
    expect(correctWord('dal')).toBe('dal')
    expect(correctWord('xq')).toBe('xq')
    expect(correctQuery('zzzzzzz')).toBe('zzzzzzz')
  })

  it('requires the first letter to match before snapping', () => {
    expect(correctWord('rowny')).toBe('rowny')
  })
})

describe('searchSitesForgiving', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const RTE_PAGE = `<article><h2 class="entry-title"><a href="https://rte.example/best-brownies">Best Brownies</a></h2></article>`

  it('retries a zero-hit query with the corrected spelling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const target = decodeURIComponent(String(input))
        const isBrownie = /[?&]s=brownie\b|q=brownie\b/.test(target)
        const body = isBrownie && target.includes('recipetineats') ? RTE_PAGE : '<html></html>'
        return new Response(body, { status: 200 })
      }),
    )
    const updates: string[] = []
    const outcome = await searchSitesForgiving('browny', (_hits, usedQuery) => {
      updates.push(usedQuery)
    })
    expect(outcome.usedQuery).toBe('brownie')
    expect(outcome.hits[0]?.title).toBe('Best Brownies')
    expect(updates).toContain('brownie')
  })

  it('reports the original query when even the correction finds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })))
    const outcome = await searchSitesForgiving('chiken tikka masala xyz')
    expect(outcome.hits).toHaveLength(0)
    expect(outcome.usedQuery).toBe('chiken tikka masala xyz')
  })
})
