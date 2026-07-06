import { describe, it, expect } from 'vitest'
import { isAllowedCaller } from '../functions/api/_caller'

const SELF = 'https://recipejar.sagarbudhathoki.com'
const h = (init: Record<string, string>) => new Headers(init)

describe('isAllowedCaller (open-proxy guard)', () => {
  it('allows same-origin fetches (modern browsers)', () => {
    expect(isAllowedCaller(h({ 'Sec-Fetch-Site': 'same-origin' }), SELF)).toBe(true)
    expect(isAllowedCaller(h({ 'Sec-Fetch-Site': 'same-site' }), SELF)).toBe(true)
  })

  it('rejects cross-site and direct-navigation fetches', () => {
    expect(isAllowedCaller(h({ 'Sec-Fetch-Site': 'cross-site' }), SELF)).toBe(false)
    expect(isAllowedCaller(h({ 'Sec-Fetch-Site': 'none' }), SELF)).toBe(false)
  })

  it('falls back to Referer for older engines (iOS Safari < 16.4)', () => {
    expect(isAllowedCaller(h({ Referer: SELF + '/some/page' }), SELF)).toBe(true)
    expect(isAllowedCaller(h({ Origin: 'https://recipe-jar.pages.dev' }), SELF)).toBe(true)
  })

  it('rejects a foreign Referer/Origin', () => {
    expect(isAllowedCaller(h({ Referer: 'https://evil.example.com/' }), SELF)).toBe(false)
    expect(isAllowedCaller(h({ Origin: 'https://evil.example.com' }), SELF)).toBe(false)
  })

  it('rejects a request with no provenance headers at all', () => {
    expect(isAllowedCaller(h({}), SELF)).toBe(false)
  })
})
