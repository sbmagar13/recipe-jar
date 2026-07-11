import { describe, it, expect } from 'vitest'
import { parseRoute, routeToHash } from '../src/lib/route'

describe('parseRoute', () => {
  it('treats an empty hash as home', () => {
    expect(parseRoute('')).toEqual({ view: 'home' })
    expect(parseRoute('#')).toEqual({ view: 'home' })
    expect(parseRoute('#/')).toEqual({ view: 'home' })
  })

  it('maps the plain view routes', () => {
    expect(parseRoute('#/jar')).toEqual({ view: 'jar' })
    expect(parseRoute('#/add')).toEqual({ view: 'add' })
    expect(parseRoute('#/import')).toEqual({ view: 'import' })
    expect(parseRoute('#/about')).toEqual({ view: 'about' })
  })

  it('reads a saved-recipe id', () => {
    expect(parseRoute('#/r/5')).toEqual({ view: 'recipe', id: 5 })
    expect(parseRoute('#/r/42')).toEqual({ view: 'recipe', id: 42 })
  })

  it('reads the transient recipe route', () => {
    expect(parseRoute('#/recipe')).toEqual({ view: 'recipe', id: null })
  })

  it('falls back to home for anything unknown', () => {
    expect(parseRoute('#/nonsense')).toEqual({ view: 'home' })
    expect(parseRoute('#/r/notanumber')).toEqual({ view: 'home' })
  })

  it('never mistakes a share or bookmarklet hash for a route', () => {
    expect(parseRoute('#recipe=abc123')).toEqual({ view: 'home' })
    expect(parseRoute('#import=abc123')).toEqual({ view: 'home' })
  })
})

describe('routeToHash', () => {
  it('maps routes back to hashes', () => {
    expect(routeToHash({ view: 'home' })).toBe('')
    expect(routeToHash({ view: 'jar' })).toBe('#/jar')
    expect(routeToHash({ view: 'about' })).toBe('#/about')
    expect(routeToHash({ view: 'recipe', id: 7 })).toBe('#/r/7')
    expect(routeToHash({ view: 'recipe', id: null })).toBe('#/recipe')
  })

  it('round-trips a saved-recipe route', () => {
    expect(parseRoute(routeToHash({ view: 'recipe', id: 99 }))).toEqual({ view: 'recipe', id: 99 })
  })
})
