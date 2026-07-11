import { describe, it, expect } from 'vitest'
import { stepGroups, cookSteps } from '../src/lib/steps'

const STEPS = [
  'Wash the escarole.',
  'Brown the ribs.',
  '— Using Dried Beans (Instead of Canned) —',
  'Soak the beans overnight.',
  'Simmer for two hours.',
  '— Instant Pot Adaptation —',
  'Pressure cook for 35 minutes.',
]

describe('stepGroups', () => {
  it('keeps a plain recipe as one untitled group', () => {
    const g = stepGroups(['Chop.', 'Fry.'])
    expect(g).toEqual([{ title: null, steps: [{ text: 'Chop.', index: 0 }, { text: 'Fry.', index: 1 }] }])
  })

  it('splits on divider markers and keeps original indices', () => {
    const g = stepGroups(STEPS)
    expect(g.map((x) => x.title)).toEqual([null, 'Using Dried Beans (Instead of Canned)', 'Instant Pot Adaptation'])
    expect(g[1].steps).toEqual([
      { text: 'Soak the beans overnight.', index: 3 },
      { text: 'Simmer for two hours.', index: 4 },
    ])
    expect(g[2].steps[0].index).toBe(6)
  })

  it('handles a recipe that starts with a section', () => {
    const g = stepGroups(['— Dough —', 'Knead it.'])
    expect(g).toEqual([{ title: 'Dough', steps: [{ text: 'Knead it.', index: 1 }] }])
  })

  it('does not mistake an em dash inside a sentence for a divider', () => {
    const g = stepGroups(['Cook slowly — do not rush — until soft.'])
    expect(g[0].title).toBeNull()
    expect(g[0].steps.length).toBe(1)
  })
})

describe('cookSteps', () => {
  it('drops dividers and labels steps with their section', () => {
    const c = cookSteps(STEPS)
    expect(c.length).toBe(5)
    expect(c[0]).toEqual({ text: 'Wash the escarole.', index: 0, section: null })
    expect(c[2]).toEqual({ text: 'Soak the beans overnight.', index: 3, section: 'Using Dried Beans (Instead of Canned)' })
    expect(c[4].section).toBe('Instant Pot Adaptation')
  })

  it('preserves original indices as the timer key space', () => {
    const c = cookSteps(STEPS)
    expect(c.map((x) => x.index)).toEqual([0, 1, 3, 4, 6])
  })
})
