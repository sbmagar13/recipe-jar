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

  it('strips source numbering and renders markdown headings as dividers (issue #9)', () => {
    // Recipeland-style blob: self-numbered steps, then a markdown-heading
    // section whose numbering restarts.
    const blob =
      '1. Prep the escarole while the soup base cooks and wash the cut leaves in a large bowl of cold water to release all the grit. ' +
      '2. Heat the olive oil in a large heavy pot over medium-high heat and brown the ribs on all sides in batches so they do not steam. ' +
      '3. Ladle into bowls and serve hot with crusty bread for dipping and a drizzle of good olive oil over the top of each serving. ' +
      '### Using Dried Beans (Instead of Canned) ' +
      '1. Use one pound of dried beans and soak them covered by cold water overnight before draining and rinsing again.'
    const html = pageWithJsonLd({
      '@type': 'Recipe',
      name: 'Numbered Soup',
      recipeIngredient: ['1 head escarole'],
      recipeInstructions: blob,
    })
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r.steps).toEqual([
      'Prep the escarole while the soup base cooks and wash the cut leaves in a large bowl of cold water to release all the grit.',
      'Heat the olive oil in a large heavy pot over medium-high heat and brown the ribs on all sides in batches so they do not steam.',
      'Ladle into bowls and serve hot with crusty bread for dipping and a drizzle of good olive oil over the top of each serving.',
      '— Using Dried Beans (Instead of Canned) —',
      'Use one pound of dried beans and soak them covered by cold water overnight before draining and rinsing again.',
    ])
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

// Recipeland-shaped pages (issue #9): JSON-LD lists bare ingredient names while
// the amounts only exist in the visible table. The bookmarklet now also sends
// the visible lines; the parser swaps them in when they are clearly better.
describe('amount-less JSON-LD ingredients (Recipeland shape, issue #9)', () => {
  const NAMES_ONLY = JSON.stringify({
    '@type': 'Recipe',
    name: 'Escarole Soup',
    recipeYield: '12',
    recipeIngredient: ['pork ribs', 'olive oil', 'onions', 'escarole'],
    recipeInstructions: 'Simmer everything.',
  })

  it('uses captured visible lines when JSON-LD has no amounts', () => {
    // innerText of recipeland rows: amount, newline, UNIT NAME, newline, note
    const captured = [
      '2\nPOUNDS PORK RIB\ncountry style',
      '2\nTABLESPOONS OLIVE OIL',
      '2\nLARGE ONIONS',
      '1\nMEDIUM HEAD ESCAROLE',
    ]
    const r = parseRecipeFromJsonLdStrings([NAMES_ONLY], SRC, undefined, captured)!
    expect(r.ingredients.map((i) => i.raw)).toEqual([
      '2 pounds pork rib, country style',
      '2 tablespoons olive oil',
      '2 large onions',
      '1 medium head escarole',
    ])
    expect(r.ingredients[0].qty).toBe(2)
    expect(r.title).toBe('Escarole Soup') // everything else still from JSON-LD
    expect(r.servings).toBe(12)
  })

  it('keeps JSON-LD ingredients when they already have amounts', () => {
    const withAmounts = JSON.stringify({
      '@type': 'Recipe',
      name: 'Fine As Is',
      recipeIngredient: ['2 cups flour', '1 egg', '100 g butter'],
      recipeInstructions: 'Bake.',
    })
    const r = parseRecipeFromJsonLdStrings([withAmounts], SRC, undefined, ['9\nCUPS NONSENSE', '9\nCUPS MORE'])!
    expect(r.ingredients.map((i) => i.raw)).toEqual(['2 cups flour', '1 egg', '100 g butter'])
  })

  it('rejects captured lines that are no better (no amounts either)', () => {
    const r = parseRecipeFromJsonLdStrings([NAMES_ONLY], SRC, undefined, ['ribs', 'oil', 'onions', 'greens'])!
    expect(r.ingredients.map((i) => i.raw)).toEqual(['pork ribs', 'olive oil', 'onions', 'escarole'])
  })

  it('rejects a suspiciously incomplete captured list', () => {
    const r = parseRecipeFromJsonLdStrings([NAMES_ONLY], SRC, undefined, ['2 pounds pork ribs'])!
    expect(r.ingredients.map((i) => i.raw)).toEqual(['pork ribs', 'olive oil', 'onions', 'escarole'])
  })

  it('upgrades from microdata on the HTML path when JSON-LD is amount-less', () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${NAMES_ONLY}</script></head><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <li itemprop="recipeIngredient">2 pounds pork ribs</li>
        <li itemprop="recipeIngredient">2 tbsp olive oil</li>
        <li itemprop="recipeIngredient">2 onions</li>
        <li itemprop="recipeIngredient">1 head escarole</li>
      </div></body></html>`
    const r = parseRecipeFromHtml(html, SRC)!
    expect(r.title).toBe('Escarole Soup')
    expect(r.ingredients.map((i) => i.raw)).toEqual([
      '2 pounds pork ribs',
      '2 tbsp olive oil',
      '2 onions',
      '1 head escarole',
    ])
  })
})

describe('humanDuration', () => {
  it('converts ISO 8601 durations', () => {
    expect(humanDuration('PT30M')).toBe('30 min')
    expect(humanDuration('PT1H30M')).toBe('1 h 30 min')
    expect(humanDuration('P1DT2H')).toBe('1 d 2 h')
  })

  it('accepts sloppy durations missing the T (issue #9)', () => {
    expect(humanDuration('P1H')).toBe('1 h')
    expect(humanDuration('P30M')).toBe('30 min')
    expect(humanDuration('P1H30M')).toBe('1 h 30 min')
  })

  it('passes through non-ISO strings unchanged', () => {
    expect(humanDuration('about 20 minutes')).toBe('about 20 minutes')
  })

  it('returns null for empty input', () => {
    expect(humanDuration(null)).toBeNull()
    expect(humanDuration(undefined)).toBeNull()
  })
})
