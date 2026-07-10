import { describe, it, expect } from 'vitest'
import { buildShoppingText } from '../src/lib/shoplist'

describe('buildShoppingText', () => {
  it('lists items under a header with the serving count', () => {
    const text = buildShoppingText('Red Lentil Dal', 4, ['1 cup red lentils', '1 tsp salt'])
    expect(text).toBe('Shopping list for Red Lentil Dal (4 servings)\n\n- 1 cup red lentils\n- 1 tsp salt')
  })

  it('uses the singular for a single serving', () => {
    expect(buildShoppingText('Toast', 1, ['2 slices bread'])).toContain('(1 serving)')
  })

  it('drops the "for title" part when there is no title', () => {
    expect(buildShoppingText('', 2, ['x'])).toBe('Shopping list (2 servings)\n\n- x')
  })

  it('produces just the header when nothing is left to buy', () => {
    expect(buildShoppingText('Empty', 2, [])).toBe('Shopping list for Empty (2 servings)\n')
  })

  it('keeps house style: no em dashes in the output', () => {
    const text = buildShoppingText('Dal', 4, ['1 onion, diced'])
    expect(text.includes('—')).toBe(false)
  })
})
