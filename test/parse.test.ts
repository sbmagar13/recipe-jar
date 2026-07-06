import { describe, it, expect } from 'vitest'
import { parseRecipeFromHtml, parseRecipeFromJsonLdStrings, humanDuration } from '../src/lib/parse'

// All HTML below is synthetic and hand-authored for these tests (CC0), so the
// suite is self-contained and CI never depends on copyrighted fixture pages.

function pageWithJsonLd(obj: unknown): string {
  return `<!doctype html><html><head><title>Test Page</title>
    <script type="application/ld+json">${JSON.stringify(obj)}</script>
    </head><body><h1>hi</h1></body></html>`
}

const SRC = 'https://example.com/recipe'

describe('parseRecipeFromHtml — JSON-LD', () => {
  it('parses a flat Recipe node', () => {
    const html = pageWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Tomato Soup',
      recipeYield: '4 servings',
      recipeIngredient: ['2 tomatoes', '1 tbsp olive oil', 'salt to taste'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Chop the tomatoes.' },
        { '@type': 'HowToStep', text: 'Simmer for 20 minutes.' },
      ],
      totalTime: 'PT30M',
      author: { '@type': 'Person', name: 'Sam Cook' },
    })
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r).not.toBeNull()
    expect(r.title).toBe('Tomato Soup')
    expect(r.servings).toBe(4)
    expect(r.ingredients.map((i) => i.raw)).toEqual(['2 tomatoes', '1 tbsp olive oil', 'salt to taste'])
    expect(r.ingredients[0].qty).toBe(2)
    expect(r.steps).toEqual(['Chop the tomatoes.', 'Simmer for 20 minutes.'])
    expect(r.totalTime).toBe('30 min')
    expect(r.author).toBe('Sam Cook')
    expect(r.sourceUrl).toBe(SRC)
  })

  it('finds a Recipe nested in an @graph', () => {
    const html = pageWithJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'A food blog' },
        {
          '@type': 'Recipe',
          name: 'Graph Pancakes',
          recipeIngredient: ['200 g flour'],
          recipeInstructions: 'Mix and fry.',
        },
      ],
    })
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r.title).toBe('Graph Pancakes')
    expect(r.ingredients[0].raw).toBe('200 g flour')
    expect(r.steps).toEqual(['Mix and fry.'])
  })

  it('accepts @type as an array containing Recipe', () => {
    const html = pageWithJsonLd({
      '@type': ['Recipe', 'NewsArticle'],
      name: 'Dual Type',
      recipeIngredient: ['1 egg'],
      recipeInstructions: 'Whisk.',
    })
    expect(parseRecipeFromHtml(html, SRC)!.title).toBe('Dual Type')
  })

  it('uses the author name only, never a raw URL', () => {
    const html = pageWithJsonLd({
      '@type': 'Recipe',
      name: 'X',
      recipeIngredient: ['1 egg'],
      recipeInstructions: 'Cook.',
      author: 'https://example.com/authors/team',
    })
    expect(parseRecipeFromHtml(html, SRC)!.author).toBeNull()
  })

  it('splits a long single-blob instruction into steps without regex lookbehind', () => {
    // A blob over 400 chars with numbered steps should split on the numbers.
    const blob =
      '1. Preheat the oven to 200C and line a tray with baking paper so nothing sticks to it later on. ' +
      '2. Mix the dry ingredients thoroughly in a large bowl until evenly combined and there are no lumps left. ' +
      '3. Fold in the wet ingredients slowly and gently so the batter stays airy and light throughout the process. ' +
      '4. Bake for twenty five minutes until golden brown and a skewer comes out clean from the centre.'
    const html = pageWithJsonLd({
      '@type': 'Recipe',
      name: 'Blob Cake',
      recipeIngredient: ['flour'],
      recipeInstructions: blob,
    })
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r.steps.length).toBe(4)
    expect(r.steps[0]).toContain('Preheat the oven')
    expect(r.steps[3]).toContain('Bake for twenty five minutes')
  })

  it('returns null when there is no recipe at all', () => {
    const html = '<!doctype html><html><head><title>Nothing</title></head><body>no recipe here</body></html>'
    expect(parseRecipeFromHtml(html, SRC)).toBeNull()
  })

  it('returns null for a Recipe node with no ingredients and no steps', () => {
    const html = pageWithJsonLd({ '@type': 'Recipe', name: 'Empty' })
    expect(parseRecipeFromHtml(html, SRC)).toBeNull()
  })
})

describe('parseRecipeFromHtml — microdata fallback', () => {
  it('parses schema.org microdata when JSON-LD is absent', () => {
    const html = `<!doctype html><html><head><title>Micro Site</title></head><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Microdata Muffins</h1>
        <span itemprop="recipeYield">6 muffins</span>
        <img itemprop="image" src="https://example.com/m.jpg" />
        <ul>
          <li itemprop="recipeIngredient">150 g flour</li>
          <li itemprop="recipeIngredient">2 eggs</li>
        </ul>
        <ol>
          <li itemprop="recipeInstructions">Mix everything.</li>
          <li itemprop="recipeInstructions">Bake at 180C.</li>
        </ol>
      </div></body></html>`
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r).not.toBeNull()
    expect(r.title).toBe('Microdata Muffins')
    expect(r.servings).toBe(6)
    expect(r.image).toBe('https://example.com/m.jpg')
    expect(r.ingredients.map((i) => i.raw)).toEqual(['150 g flour', '2 eggs'])
    expect(r.ingredients[0].qty).toBe(150)
    expect(r.steps).toEqual(['Mix everything.', 'Bake at 180C.'])
  })

  it('prefers JSON-LD over microdata when both are present', () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'From JSON-LD',
        recipeIngredient: ['1 cup rice'],
        recipeInstructions: 'Boil it.',
      })}</script></head><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">From Microdata</h1>
        <span itemprop="recipeIngredient">wrong</span>
      </div></body></html>`
    expect(parseRecipeFromHtml(html, SRC)!.title).toBe('From JSON-LD')
  })
})

describe('parseRecipeFromJsonLdStrings (bookmarklet path)', () => {
  it('parses raw JSON-LD script strings and honours the fallback title', () => {
    const strings = [
      JSON.stringify({ '@type': 'WebSite', name: 'blog' }),
      JSON.stringify({ '@type': 'Recipe', recipeIngredient: ['1 egg'], recipeInstructions: 'Fry.' }),
    ]
    const r = parseRecipeFromJsonLdStrings(strings, SRC, 'Fallback Title')!
    expect(r.title).toBe('Fallback Title')
    expect(r.steps).toEqual(['Fry.'])
  })

  it('skips invalid JSON blocks without throwing', () => {
    const strings = ['{ not valid json', JSON.stringify({ '@type': 'Recipe', name: 'Survivor', recipeIngredient: ['x'], recipeInstructions: 'y' })]
    expect(parseRecipeFromJsonLdStrings(strings, SRC)!.title).toBe('Survivor')
  })
})

describe('humanDuration', () => {
  it('converts ISO 8601 durations', () => {
    expect(humanDuration('PT30M')).toBe('30 min')
    expect(humanDuration('PT1H30M')).toBe('1 h 30 min')
    expect(humanDuration('P1DT2H')).toBe('1 d 2 h')
  })

  it('passes through non-ISO strings unchanged', () => {
    expect(humanDuration('about 20 minutes')).toBe('about 20 minutes')
  })

  it('returns null for empty input', () => {
    expect(humanDuration(null)).toBeNull()
    expect(humanDuration(undefined)).toBeNull()
  })
})
