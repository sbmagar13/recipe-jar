import { describe, it, expect } from 'vitest'
import { parseNumberExpr, parseIngredientLine, formatQty } from '../src/lib/quantity'

describe('parseNumberExpr', () => {
  it('parses integers and decimals', () => {
    expect(parseNumberExpr('2')).toBe(2)
    expect(parseNumberExpr('1.5')).toBe(1.5)
  })

  it('parses Swedish decimal commas', () => {
    expect(parseNumberExpr('0,5')).toBe(0.5)
    expect(parseNumberExpr('2,25')).toBe(2.25)
  })

  it('parses simple and mixed fractions', () => {
    expect(parseNumberExpr('3/4')).toBe(0.75)
    expect(parseNumberExpr('1 1/2')).toBe(1.5)
  })

  it('parses unicode fractions, bare and attached', () => {
    expect(parseNumberExpr('½')).toBe(0.5)
    expect(parseNumberExpr('1½')).toBe(1.5)
    expect(parseNumberExpr('¼')).toBe(0.25)
  })

  it('returns null for non-numbers', () => {
    expect(parseNumberExpr('salt')).toBeNull()
    expect(parseNumberExpr('')).toBeNull()
  })
})

describe('parseIngredientLine', () => {
  it('splits a leading quantity from the rest', () => {
    expect(parseIngredientLine('2 cups flour')).toEqual({ qty: 2, qtyEnd: null, rest: 'cups flour' })
  })

  it('handles mixed-number quantities', () => {
    expect(parseIngredientLine('1 1/2 tsp salt')).toEqual({ qty: 1.5, qtyEnd: null, rest: 'tsp salt' })
  })

  it('captures ranges into qtyEnd', () => {
    const r = parseIngredientLine('2-3 cloves garlic')
    expect(r.qty).toBe(2)
    expect(r.qtyEnd).toBe(3)
    expect(r.rest).toBe('cloves garlic')
  })

  it('handles an en-dash range', () => {
    const r = parseIngredientLine('2–3 dl water')
    expect(r.qty).toBe(2)
    expect(r.qtyEnd).toBe(3)
  })

  it('leaves quantity-less lines untouched', () => {
    expect(parseIngredientLine('salt to taste')).toEqual({ qty: null, qtyEnd: null, rest: 'salt to taste' })
  })
})

describe('formatQty', () => {
  it('renders common fractions as unicode glyphs', () => {
    expect(formatQty(0.5)).toBe('½')
    expect(formatQty(1.5)).toBe('1½')
    expect(formatQty(0.25)).toBe('¼')
    expect(formatQty(2 + 1 / 3)).toBe('2⅓')
  })

  it('rounds whole numbers cleanly', () => {
    expect(formatQty(3)).toBe('3')
    expect(formatQty(2.99)).toBe('3')
    expect(formatQty(2.02)).toBe('2')
  })

  it('falls back to two-decimal numbers when no fraction fits', () => {
    expect(formatQty(2.45)).toBe('2.45')
  })

  it('never returns a negative or zero-ish mess', () => {
    expect(formatQty(0)).toBe('0')
    expect(formatQty(-1)).toBe('0')
  })
})
