import { describe, it, expect } from 'vitest'
import { pickHighlights, WHATS_NEW } from '../src/lib/whatsnew'

const MAP = { '1.1.0': ['Timer tray.'], '1.2.0': ['Something else.'] }

describe('pickHighlights', () => {
  it('shows a returning reader the notes for a version they have not seen', () => {
    expect(pickHighlights('1.1.0', '1.0.0', true, MAP)).toEqual(['Timer tray.'])
  })

  it('also shows a pre-versioning reader (no marker) who clearly has data', () => {
    expect(pickHighlights('1.1.0', null, true, MAP)).toEqual(['Timer tray.'])
  })

  it('stays silent for a brand-new visitor: no marker and an empty jar', () => {
    expect(pickHighlights('1.1.0', null, false, MAP)).toBeNull()
  })

  it('stays silent once the reader has already seen this exact version', () => {
    expect(pickHighlights('1.1.0', '1.1.0', true, MAP)).toBeNull()
  })

  it('stays silent for a version that has no highlights at all', () => {
    expect(pickHighlights('9.9.9', '1.0.0', true, MAP)).toBeNull()
  })

  it('treats an empty highlight list as nothing to show', () => {
    expect(pickHighlights('1.0.0', '0.9.0', true, { '1.0.0': [] })).toBeNull()
  })

  // Fallback: a patch release with no note of its own should carry its minor's
  // x.y.0 note to someone who jumped straight past it.
  const MINOR = { '1.4.0': ['Bookmarkable recipes.'] }

  it('falls back to the minor x.y.0 note when a patch has no note of its own', () => {
    expect(pickHighlights('1.4.3', '1.3.0', true, MINOR)).toEqual(['Bookmarkable recipes.'])
  })

  it('shows the fallback even on a single patch bump the reader has not seen', () => {
    expect(pickHighlights('1.4.1', '1.4.0-not', true, MINOR)).toEqual(['Bookmarkable recipes.'])
  })

  it('does not repeat the fallback once the reader has seen that minor', () => {
    expect(pickHighlights('1.4.3', '1.4.0', true, MINOR)).toBeNull()
  })

  it('does not repeat the fallback once the reader has seen a later patch of it', () => {
    expect(pickHighlights('1.4.3', '1.4.1', true, MINOR)).toBeNull()
  })

  it('prefers a patch\'s own note over the minor fallback when it has one', () => {
    const map = { '1.4.0': ['Zero.'], '1.4.2': ['Two.'] }
    expect(pickHighlights('1.4.2', '1.3.0', true, map)).toEqual(['Two.'])
  })

  it('does not greet a first-time visitor who lands first on a patch', () => {
    expect(pickHighlights('1.4.3', null, false, MINOR)).toBeNull()
  })

  it('has no fallback to offer when the minor itself has no note', () => {
    expect(pickHighlights('2.0.3', '1.0.0', true, MINOR)).toBeNull()
  })

  it('every entry in the real WHATS_NEW map is a non-empty list of strings', () => {
    for (const [version, items] of Object.entries(WHATS_NEW)) {
      expect(/^\d+\.\d+\.\d+$/.test(version), `version key ${version} is semver`).toBe(true)
      expect(Array.isArray(items) && items.length > 0, `${version} has highlights`).toBe(true)
      for (const line of items) {
        expect(typeof line).toBe('string')
        // House style: no em dashes in user-facing copy.
        expect(line.includes('—'), `${version} highlight avoids em dashes`).toBe(false)
      }
    }
  })
})
