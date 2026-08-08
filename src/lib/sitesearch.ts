// Type a dish, get options: search a couple of well-behaved recipe sites and
// list their results to pick from. Each site's search page is fetched through
// the same proxy as any recipe page and parsed client-side, so this adds no
// backend, no API keys, and no cost that grows with users. Adapters are pure
// (HTML in, hits out) so they test against fixtures.

export interface SearchHit {
  title: string
  url: string
  site: string
  /** Thumbnail from the site's own search results, when one is extractable. */
  image: string | null
}

interface SiteSearch {
  id: string
  label: string
  searchUrl: (query: string) => string
  extract: (html: string, query: string) => SearchHit[]
}

const PER_SITE = 4

/** "30-minute-chicken-curry" → "30 minute chicken curry". */
export function titleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** BBC Good Food: result links are /recipes/<slug>, and the slug IS the title,
 *  so nothing depends on their markup beyond hrefs. The page also carries
 *  trending-recipe links that are not results, so only slugs sharing a word
 *  with the query count. */
const bbcGoodFood: SiteSearch = {
  id: 'bbc',
  label: 'BBC Good Food',
  searchUrl: (q) => `https://www.bbcgoodfood.com/search?q=${encodeURIComponent(q)}`,
  extract: (html, query) => {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const seen = new Set<string>()
    const hits: SearchHit[] = []
    const re = /href="(https:\/\/www\.bbcgoodfood\.com\/recipes\/([a-z0-9-]+))"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null && hits.length < PER_SITE) {
      const [, url, slug] = m
      if (seen.has(slug) || slug === 'collection') continue
      seen.add(slug)
      if (words.length > 0 && !words.some((w) => slug.includes(w))) continue
      hits.push({ title: titleFromSlug(slug), url, site: 'BBC Good Food', image: null })
    }
    return hits
  },
}

/** Standard WordPress search page: each result is an <article> carrying an
 *  entry-title link and usually a food thumbnail. Shared by every WP site. */
function wpEntryExtract(siteLabel: string): (html: string) => SearchHit[] {
  return (html) => {
    const hits: SearchHit[] = []
    const chunks = html.split(/<article\b/).slice(1)
    for (const chunk of chunks) {
      if (hits.length >= PER_SITE) break
      const link = chunk.match(/<h2 class="entry-title[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
      if (!link) continue
      const title = stripTags(link[2])
      if (!title) continue
      const image = chunk.match(/<img[^>]*src="(https:[^"]+?\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ?? null
      hits.push({ title, url: link[1], site: siteLabel, image })
    }
    return hits
  }
}

const recipeTinEats: SiteSearch = {
  id: 'rte',
  label: 'RecipeTin Eats',
  searchUrl: (q) => `https://www.recipetineats.com/?s=${encodeURIComponent(q)}`,
  extract: (html, _query) => wpEntryExtract('RecipeTin Eats')(html),
}

const vegRecipesOfIndia: SiteSearch = {
  id: 'vri',
  label: 'Veg Recipes of India',
  searchUrl: (q) => `https://www.vegrecipesofindia.com/?s=${encodeURIComponent(q)}`,
  extract: (html, _query) => wpEntryExtract('Veg Recipes of India')(html),
}

/** Budget Bytes: WP theme with post-summary cards; the title travels in the
 *  result link's aria-label ("View Curry Chicken Salad"). */
const budgetBytes: SiteSearch = {
  id: 'bb',
  label: 'Budget Bytes',
  searchUrl: (q) => `https://www.budgetbytes.com/?s=${encodeURIComponent(q)}`,
  extract: (html, _query) => {
    const hits: SearchHit[] = []
    const chunks = html.split(/<article\b[^>]*post-summary/).slice(1)
    for (const chunk of chunks) {
      if (hits.length >= PER_SITE) break
      const link = chunk.match(/<a href="([^"]+)" aria-label="View ([^"]+)"/)
      if (!link) continue
      const image = chunk.match(/<img[^>]*src="(https:[^"]+?\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ?? null
      hits.push({ title: stripTags(link[2]), url: link[1], site: 'Budget Bytes', image })
    }
    return hits
  },
}

/** BBC Food (bbc.co.uk, distinct from BBC Good Food): result links are
 *  /food/recipes/<slug>_<id>, and the slug is the title. Same query-word
 *  filter as Good Food to drop the page's chrome links. */
const bbcFood: SiteSearch = {
  id: 'bbcfood',
  label: 'BBC Food',
  searchUrl: (q) => `https://www.bbc.co.uk/food/search?q=${encodeURIComponent(q)}`,
  extract: (html, query) => {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const seen = new Set<string>()
    const hits: SearchHit[] = []
    const re = /href="(\/food\/recipes\/([a-z0-9_]+))"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null && hits.length < PER_SITE) {
      const [, path, slug] = m
      if (seen.has(slug)) continue
      seen.add(slug)
      const base = slug.replace(/_\d+$/, '')
      if (words.length > 0 && !words.some((w) => base.includes(w))) continue
      hits.push({
        title: titleFromSlug(base.replace(/_/g, '-')),
        url: `https://www.bbc.co.uk${path}`,
        site: 'BBC Food',
        image: null,
      })
    }
    return hits
  },
}

export const SITE_SEARCHES: SiteSearch[] = [bbcGoodFood, recipeTinEats, bbcFood, budgetBytes, vegRecipesOfIndia]

/** Interleave per-site result lists so one site cannot crowd out the other. */
export function interleave(perSite: SearchHit[][]): SearchHit[] {
  const out: SearchHit[] = []
  for (let i = 0; i < PER_SITE; i++) {
    for (const hits of perSite) {
      if (hits[i]) out.push(hits[i])
    }
  }
  return out
}

// Session-lifetime cache: backspacing and retyping a query is instant, and no
// site gets asked the same question twice.
const cache = new Map<string, SearchHit[]>()

async function searchOneSite(siteIndex: number, query: string): Promise<SearchHit[]> {
  const site = SITE_SEARCHES[siteIndex]
  const key = `${site.id}|${query.toLowerCase()}`
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(site.searchUrl(query))}`)
    if (!res.ok) return []
    const hits = site.extract(await res.text(), query)
    cache.set(key, hits)
    return hits
  } catch {
    return []
  }
}

/**
 * Search all supported sites through the proxy, tolerating any of them
 * failing. `onUpdate` fires as each site's results land, so the first site to
 * answer paints the screen without waiting for the slowest.
 */
export async function searchSites(
  query: string,
  onUpdate?: (hits: SearchHit[]) => void,
): Promise<SearchHit[]> {
  const perSite: SearchHit[][] = SITE_SEARCHES.map(() => [])
  await Promise.all(
    SITE_SEARCHES.map(async (_site, i) => {
      perSite[i] = await searchOneSite(i, query)
      if (perSite[i].length > 0) onUpdate?.(interleave(perSite))
    }),
  )
  return interleave(perSite)
}
