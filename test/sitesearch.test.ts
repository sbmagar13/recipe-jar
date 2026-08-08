import { describe, it, expect } from 'vitest'
import { SITE_SEARCHES, titleFromSlug } from '../src/lib/sitesearch'

// Synthetic fixtures mimicking each site's search-result markup (CC0).

const bbc = SITE_SEARCHES.find((s) => s.id === 'bbc')!
const rte = SITE_SEARCHES.find((s) => s.id === 'rte')!

describe('titleFromSlug', () => {
  it('turns a slug into a readable title', () => {
    expect(titleFromSlug('30-minute-chicken-curry')).toBe('30 minute chicken curry')
    expect(titleFromSlug('dal')).toBe('Dal')
  })
})

describe('BBC Good Food extractor', () => {
  const html = `
    <a href="https://www.bbcgoodfood.com/recipes/chicken-bhuna">x</a>
    <a href="https://www.bbcgoodfood.com/recipes/chicken-bhuna">dupe</a>
    <a href="https://www.bbcgoodfood.com/recipes/chicken-pasanda">y</a>
    <a href="https://www.bbcgoodfood.com/recipes/collection">not a recipe</a>
    <a href="https://www.bbcgoodfood.com/recipes/one-pot-curry">z</a>
    <a href="https://www.bbcgoodfood.com/recipes/fourth-curry">4</a>
    <a href="https://www.bbcgoodfood.com/recipes/fifth-curry">5</a>`

  it('extracts deduped recipe links with slug-derived titles, capped at four', () => {
    const hits = bbc.extract(html, 'chicken curry')
    expect(hits).toHaveLength(4)
    expect(hits[0]).toEqual({
      title: 'Chicken bhuna',
      url: 'https://www.bbcgoodfood.com/recipes/chicken-bhuna',
      site: 'BBC Good Food',
      image: null,
    })
    expect(hits.map((h) => h.title)).not.toContain('Collection')
  })

  it('returns nothing from a page with no recipe links', () => {
    expect(bbc.extract('<html><body>no results</body></html>', 'chicken curry')).toEqual([])
  })

  it('drops trending-recipe chrome that does not match the query', () => {
    const page = `
      <a href="https://www.bbcgoodfood.com/recipes/white-sourdough">trending</a>
      <a href="https://www.bbcgoodfood.com/recipes/focaccia">trending</a>
      <a href="https://www.bbcgoodfood.com/recipes/easy-chicken-curry">result</a>`
    const hits = bbc.extract(page, 'chicken curry')
    expect(hits.map((h) => h.title)).toEqual(['Easy chicken curry'])
  })
})

describe('RecipeTin Eats extractor', () => {
  const html = `
    <article class="post">
      <img width="747" src="https://www.recipetineats.com/tachyon/curry.jpg?resize=747" class="x">
      <h2 class="entry-title"><a href="https://www.recipetineats.com/chicken-curry/">Chicken <em>Curry</em></a></h2>
    </article>
    <article class="post">
      <h2 class="entry-title ast-blog-single"><a class="x" href="https://www.recipetineats.com/thai-green-curry/">Thai Green Curry &amp; Rice &#8211; quick</a></h2>
    </article>`

  it('extracts titles, urls, and thumbnails, stripping markup and entities', () => {
    const hits = rte.extract(html, 'chicken curry')
    expect(hits).toEqual([
      {
        title: 'Chicken Curry',
        url: 'https://www.recipetineats.com/chicken-curry/',
        site: 'RecipeTin Eats',
        image: 'https://www.recipetineats.com/tachyon/curry.jpg?resize=747',
      },
      {
        title: 'Thai Green Curry & Rice \u2013 quick',
        url: 'https://www.recipetineats.com/thai-green-curry/',
        site: 'RecipeTin Eats',
        image: null,
      },
    ])
  })
})

import { interleave } from '../src/lib/sitesearch'

describe('interleave', () => {
  const h = (t: string, site: string) => ({ title: t, url: `https://x/${t}`, site, image: null })
  it('alternates sites so neither crowds the other out', () => {
    const out = interleave([
      [h('a1', 'A'), h('a2', 'A')],
      [h('b1', 'B'), h('b2', 'B'), h('b3', 'B')],
    ])
    expect(out.map((x) => x.title)).toEqual(['a1', 'b1', 'a2', 'b2', 'b3'])
  })
  it('handles an empty site', () => {
    expect(interleave([[], [h('b1', 'B')]]).map((x) => x.title)).toEqual(['b1'])
  })
})

describe('Budget Bytes extractor', () => {
  const bb = SITE_SEARCHES.find((s) => s.id === 'bb')!
  const html = `<article class="post-summary post-summary--default"><a href="https://www.budgetbytes.com/curry-chicken-salad/" aria-label="View Curry Chicken Salad"><div><img width="368" src="https://www.budgetbytes.com/wp-content/uploads/x-368x276.jpg" class="y"></div></a></article>`
  it('reads title from aria-label, url, and thumbnail', () => {
    expect(bb.extract(html, 'chicken curry')).toEqual([
      {
        title: 'Curry Chicken Salad',
        url: 'https://www.budgetbytes.com/curry-chicken-salad/',
        site: 'Budget Bytes',
        image: 'https://www.budgetbytes.com/wp-content/uploads/x-368x276.jpg',
      },
    ])
  })
})

describe('BBC Food extractor', () => {
  const bf = SITE_SEARCHES.find((s) => s.id === 'bbcfood')!
  const html = `
    <a href="/food/recipes/black_chicken_curry_00331">x</a>
    <a href="/food/recipes/black_chicken_curry_00331">dupe</a>
    <a href="/food/recipes/apple_pie_12345">chrome</a>`
  it('derives titles from slugs and filters non-matching chrome', () => {
    expect(bf.extract(html, 'chicken curry')).toEqual([
      {
        title: 'Black chicken curry',
        url: 'https://www.bbc.co.uk/food/recipes/black_chicken_curry_00331',
        site: 'BBC Food',
        image: null,
      },
    ])
  })
})
