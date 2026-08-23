import { describe, it, expect } from 'vitest'
import { dayLabel, orderedDays, tonightIds } from '../src/lib/weekplan'

describe('weekplan', () => {
  it('labels today and tomorrow relative to the cook, wrapping the week', () => {
    expect(dayLabel(3, 3)).toBe('Today')
    expect(dayLabel(4, 3)).toBe('Tomorrow')
    expect(dayLabel(0, 6)).toBe('Tomorrow') // Saturday's tomorrow is Sunday
    expect(dayLabel(1, 3)).toBe('Mon')
  })

  it('orders all seven days starting from today', () => {
    expect(orderedDays(5)).toEqual([5, 6, 0, 1, 2, 3, 4])
    expect(orderedDays(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('tonight is what is assigned to today AND still picked', () => {
    const picked: Array<[number, number]> = [[1, 4], [2, 2]]
    const days: Array<[number, number]> = [
      [1, 3], // picked, today
      [2, 4], // picked, tomorrow
      [9, 3], // today but no longer picked
    ]
    expect(tonightIds(picked, days, 3)).toEqual([1])
    expect(tonightIds(picked, days, 4)).toEqual([2])
    expect(tonightIds([], days, 3)).toEqual([])
  })
})
