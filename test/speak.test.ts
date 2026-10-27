import { describe, expect, it } from 'vitest'
import { pickVoice, spokenText } from '../src/lib/speak'

describe('spokenText', () => {
  it('says fractions as words, on their own and after a whole number', () => {
    expect(spokenText('Add ½ tsp salt and 1½ cups water')).toBe('Add a half teaspoon salt and 1 and a half cups water')
    expect(spokenText('¾ cup, then ⅛ tsp')).toBe('three quarters cup, then an eighth teaspoon')
  })

  it('spells out degrees and reads ranges as "to"', () => {
    expect(spokenText('Bake at 400°F for 25-30 minutes, or 200 °C')).toBe('Bake at 400 degrees F for 25 to 30 minutes, or 200 degrees C')
    expect(spokenText('Rest 20–25 min')).toBe('Rest 20 to 25 minutes')
  })

  it('expands unit abbreviations that a voice would mangle', () => {
    expect(spokenText('Stir in 2 tbsp butter and 100 g flour, simmer 5 mins')).toBe(
      'Stir in 2 tablespoon butter and 100 grams flour, simmer 5 minutes',
    )
    expect(spokenText('Add 250ml stock and 1 hr later 2 oz cheese')).toBe('Add 250 millilitres stock and 1 hours later 2 ounces cheese')
  })

  it('leaves words that merely contain a unit alone', () => {
    expect(spokenText('Bring to a boil, then mingle the herbs')).toBe('Bring to a boil, then mingle the herbs')
    expect(spokenText('Add egg & milk')).toBe('Add egg and milk')
  })

  it('drops Markdown marks and tidies whitespace', () => {
    expect(spokenText('## **Sear** the  beef')).toBe('Sear the beef')
  })
})

function voice(lang: string, localService: boolean, name = lang): SpeechSynthesisVoice {
  return { lang, localService, name, default: false, voiceURI: name } as SpeechSynthesisVoice
}

describe('pickVoice', () => {
  it('never picks a network voice, even when it is the only match for the language', () => {
    const voices = [voice('en-US', false, 'Google US English'), voice('sv-SE', true, 'Alva')]
    expect(pickVoice(voices, 'en-US')?.name).toBe('Alva')
    expect(pickVoice([voice('en-US', false)], 'en-US')).toBeNull()
  })

  it('prefers an exact language match, then the same base language, then any on-device voice', () => {
    const voices = [voice('sv-SE', true, 'Alva'), voice('en-GB', true, 'Daniel'), voice('en-US', true, 'Samantha')]
    expect(pickVoice(voices, 'en-US')?.name).toBe('Samantha')
    expect(pickVoice(voices, 'en')?.name).toBe('Daniel')
    expect(pickVoice(voices, 'en_AU')?.name).toBe('Daniel')
    expect(pickVoice(voices, 'de-DE')?.name).toBe('Alva')
  })

  it('returns null with no voices at all', () => {
    expect(pickVoice([], 'en')).toBeNull()
  })
})
