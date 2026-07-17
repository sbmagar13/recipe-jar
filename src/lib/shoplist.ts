/**
 * Build the plain-text shopping list a cook copies or shares. Kept pure and
 * apart from the component so it is easy to test and reuse. `items` are the
 * already-scaled ingredient lines the cook still needs (ticked-off ones are
 * dropped before they get here).
 */
export function buildListText(header: string, items: string[]): string {
  return [header, '', ...items.map((line) => `- ${line}`)].join('\n')
}

/** The single-recipe flavour: "Shopping list for Dal (4 servings)". */
export function buildShoppingText(title: string, servings: number, items: string[]): string {
  const serves = `${servings} ${servings === 1 ? 'serving' : 'servings'}`
  const header = title ? `Shopping list for ${title} (${serves})` : `Shopping list (${serves})`
  return buildListText(header, items)
}

/** The merged flavour: "Shopping list for 3 recipes: Dal, Momo, Pasta". */
export function mergedHeader(titles: string[]): string {
  if (titles.length === 1) return `Shopping list for ${titles[0]}`
  const shown = titles.slice(0, 3).join(', ')
  const more = titles.length > 3 ? ` and ${titles.length - 3} more` : ''
  return `Shopping list for ${titles.length} recipes: ${shown}${more}`
}
