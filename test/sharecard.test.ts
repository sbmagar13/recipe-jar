import { describe, it, expect } from 'vitest'
import { wrapLines } from '../src/lib/sharecard'

// A fake measurer: 10px per character.
const measure = (s: string) => s.length * 10

describe('wrapLines', () => {
  it('wraps at the width boundary without splitting words', () => {
    expect(wrapLines('one two three four', 90, measure)).toEqual(['one two', 'three', 'four'])
  })

  it('keeps a short text on one line', () => {
    expect(wrapLines('short text', 200, measure)).toEqual(['short text'])
  })

  it('keeps an overlong single word whole on its own line', () => {
    expect(wrapLines('tiny supercalifragilistic word', 120, measure)).toEqual([
      'tiny',
      'supercalifragilistic',
      'word',
    ])
  })

  it('collapses whitespace and survives empty input', () => {
    expect(wrapLines('  a   b  ', 500, measure)).toEqual(['a b'])
    expect(wrapLines('', 500, measure)).toEqual([])
  })
})
