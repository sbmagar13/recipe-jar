/**
 * Build the plain-text shopping list a cook copies or shares. Kept pure and
 * apart from the component so it is easy to test and reuse. `items` are the
 * already-scaled ingredient lines the cook still needs (ticked-off ones are
 * dropped before they get here).
 */
export function buildShoppingText(title: string, servings: number, items: string[]): string {
  const serves = `${servings} ${servings === 1 ? 'serving' : 'servings'}`
  const header = title ? `Shopping list for ${title} (${serves})` : `Shopping list (${serves})`
  const body = items.map((line) => `- ${line}`)
  return [header, '', ...body].join('\n')
}
