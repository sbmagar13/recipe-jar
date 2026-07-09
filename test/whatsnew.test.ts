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
