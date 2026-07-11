// Tiny hash router. The URL fragment is the single source of truth for which
// screen shows, so saved recipes are bookmarkable and a refresh or Back/Forward
// keeps your place. Everything stays local: the hash is never sent to a server.
//
// Note: the share (#recipe=) and bookmarklet (#import=) links use a different,
// self-contained hash format and are consumed before routing ever runs. Those
// are deliberately parsed as `home` here so a leftover one can never wedge the
// router; App.svelte handles them first.

export type Route =
  | { view: 'home' }
  | { view: 'jar' }
  | { view: 'add' }
  | { view: 'import' }
  | { view: 'about' }
  // id === null is a transient card (a fetched or shared recipe not yet saved),
  // which only survives while it is still in memory.
  | { view: 'recipe'; id: number | null }

/** The hash string (including the leading '#', or '' for home) for a route. */
export function routeToHash(r: Route): string {
  switch (r.view) {
    case 'home':
      return ''
    case 'jar':
      return '#/jar'
    case 'add':
      return '#/add'
    case 'import':
      return '#/import'
    case 'about':
      return '#/about'
    case 'recipe':
      return r.id != null ? `#/r/${r.id}` : '#/recipe'
  }
}

/** Parse a location hash into a route. Anything unrecognised is home. */
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '').replace(/^\//, '')
  if (h === '') return { view: 'home' }
  if (h === 'jar') return { view: 'jar' }
  if (h === 'add') return { view: 'add' }
  if (h === 'import') return { view: 'import' }
  if (h === 'about') return { view: 'about' }
  if (h === 'recipe') return { view: 'recipe', id: null }
  const m = h.match(/^r\/(\d+)$/)
  if (m) return { view: 'recipe', id: parseInt(m[1], 10) }
  return { view: 'home' }
}
