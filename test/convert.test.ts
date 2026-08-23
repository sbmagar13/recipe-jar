import { describe, it, expect } from 'vitest'
import { metricLine, densityFor } from '../src/lib/convert'

describe('metricLine', () => {
  it('converts ounces and pounds exactly, no ≈ marker', () => {
    expect(metricLine(8, null, 'oz cream cheese')).toBe('225 g cream cheese')
    expect(metricLine(1, null, 'lb potatoes')).toBe('455 g potatoes')
    expect(metricLine(3, null, 'lbs mutton')).toBe('1.4 kg mutton')
  })

  it('converts cups of known staples through the density table, marked ≈', () => {
    expect(metricLine(1, null, 'cup flour')).toBe('≈ 120 g flour')
    expect(metricLine(1, null, 'cup brown sugar')).toBe('≈ 220 g brown sugar')
    expect(metricLine(0.5, null, 'cup butter, softened')).toBe('≈ 115 g butter, softened')
    expect(metricLine(2, null, 'cups of basmati rice')).toBe('≈ 390 g basmati rice')
  })

  it('multi-word densities beat their substrings', () => {
    expect(densityFor('brown sugar')).toBe(220)
    expect(densityFor('powdered sugar')).toBe(120)
    expect(densityFor('plain sugar')).toBe(200)
  })

  it('unknown cup contents fall back to exact millilitres', () => {
    expect(metricLine(1, null, 'cup chopped celery')).toBe('240 ml chopped celery')
    expect(metricLine(3, null, 'cups vegetable stock')).toBe('720 ml vegetable stock')
  })

  it('converts ranges at both ends', () => {
    expect(metricLine(1, 2, 'cups flour')).toBe('≈ 120 g–240 g flour')
    expect(metricLine(4, 6, 'oz cheddar')).toBe('115 g–170 g cheddar')
  })

  it('leaves spoons, metric units, counts, and unitless lines alone', () => {
    expect(metricLine(1, null, 'tsp turmeric')).toBeNull()
    expect(metricLine(2, null, 'tbsp oil')).toBeNull()
    expect(metricLine(200, null, 'g paneer')).toBeNull()
    expect(metricLine(1, null, 'dl milk')).toBeNull()
    expect(metricLine(2, null, 'onions, sliced')).toBeNull()
    expect(metricLine(1, null, 'clove garlic')).toBeNull()
    expect(metricLine(null, null, 'salt to taste')).toBeNull()
  })
})
