import { describe, it, expect } from 'vitest'
import { extractStepTimers, formatClock } from '../src/lib/timers'

describe('extractStepTimers', () => {
  it('detects a simple minute duration', () => {
    expect(extractStepTimers('Simmer the lentils for 20 minutes, until soft.')).toEqual([
      { label: '20 min', seconds: 1200 },
    ])
  })

  it('detects seconds and short forms', () => {
    expect(extractStepTimers('Whisk for 90 seconds')).toEqual([{ label: '90 sec', seconds: 90 }])
    expect(extractStepTimers('rest 45 sec')).toEqual([{ label: '45 sec', seconds: 45 }])
    expect(extractStepTimers('cook 10 mins')).toEqual([{ label: '10 min', seconds: 600 }])
  })

  it('detects an hour + minute combo as one timer', () => {
    expect(extractStepTimers('Bake for 1 hour 30 minutes')).toEqual([{ label: '1 h 30 min', seconds: 5400 }])
    expect(extractStepTimers('chill 1 hr and 15 min')).toEqual([{ label: '1 h 15 min', seconds: 4500 }])
  })

  it('detects a plain hour', () => {
    expect(extractStepTimers('Let it rise for 1 hour')).toEqual([{ label: '1 h', seconds: 3600 }])
    expect(extractStepTimers('marinate 2 hours')).toEqual([{ label: '2 h', seconds: 7200 }])
  })

  it('uses the lower bound of a range and labels the range', () => {
    expect(extractStepTimers('Bake 20-25 minutes until golden')).toEqual([{ label: '20–25 min', seconds: 1200 }])
    expect(extractStepTimers('simmer 5 to 10 mins')).toEqual([{ label: '5–10 min', seconds: 300 }])
  })

  it('catches filler words like "more"', () => {
    expect(extractStepTimers('Simmer 5 more minutes and serve.')).toEqual([{ label: '5 min', seconds: 300 }])
  })

  it('finds multiple timers in one step, in order', () => {
    const t = extractStepTimers('Fry 2 minutes, then bake 30 minutes.')
    expect(t).toEqual([
      { label: '2 min', seconds: 120 },
      { label: '30 min', seconds: 1800 },
    ])
  })

  it('does NOT fire on temperatures, quantities, or pan sizes', () => {
    expect(extractStepTimers('Preheat the oven to 180°C.')).toEqual([])
    expect(extractStepTimers('Use a 9x13 inch pan.')).toEqual([])
    expect(extractStepTimers('Add 2 cups flour and 3 eggs.')).toEqual([])
    expect(extractStepTimers('Heat to 350 F, gas mark 4.')).toEqual([])
    expect(extractStepTimers('Serves 4-6 people.')).toEqual([])
  })

  it('ignores absurd values', () => {
    expect(extractStepTimers('leave 40 hours')).toEqual([]) // > 24h guard
    expect(extractStepTimers('0 minutes')).toEqual([])
  })
})

describe('formatClock', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatClock(120)).toBe('2:00')
    expect(formatClock(1500)).toBe('25:00')
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5400)).toBe('1:30:00')
    expect(formatClock(3661)).toBe('1:01:01')
  })

  it('never goes negative', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})
