// Cook mode reads to you: the current step, and a finished timer, in the
// browser's own on-device voice. Speech synthesis runs locally everywhere
// except desktop Chrome, which also lists Google network voices that would
// send the text away; only voices the browser marks as local are ever used,
// so nothing about a recipe leaves the device. No local voice, no reading,
// and the control stays hidden.
//
// Lazy loaded on the first tap in cook mode: only a cook who wants it pays.

const FRACTIONS: Record<string, string> = {
  '½': 'a half',
  '¼': 'a quarter',
  '¾': 'three quarters',
  '⅓': 'a third',
  '⅔': 'two thirds',
  '⅛': 'an eighth',
  '⅜': 'three eighths',
  '⅝': 'five eighths',
  '⅞': 'seven eighths',
  '⅕': 'a fifth',
  '⅖': 'two fifths',
  '⅗': 'three fifths',
  '⅘': 'four fifths',
  '⅙': 'a sixth',
  '⅚': 'five sixths',
}
const FRACTION = /[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g
const MIXED = /(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])/g

// Abbreviations a voice would spell out or mangle. Kept to what shows up in
// steps; the ingredient list is not read.
const UNITS: Array<[RegExp, string]> = [
  [/\btsp\b\.?/gi, 'teaspoon'],
  [/\btbsp\b\.?/gi, 'tablespoon'],
  [/\bmins?\b\.?/gi, 'minutes'],
  [/\bhrs?\b\.?/gi, 'hours'],
  [/\bsecs?\b\.?/gi, 'seconds'],
  [/(\d)\s*g\b/g, '$1 grams'],
  [/(\d)\s*kg\b/g, '$1 kilos'],
  [/(\d)\s*ml\b/g, '$1 millilitres'],
  [/(\d)\s*dl\b/g, '$1 decilitres'],
  [/(\d)\s*oz\b/g, '$1 ounces'],
  [/(\d)\s*lbs?\b/g, '$1 pounds'],
]

/**
 * A step as it should be said: fractions and units as words, "25-30" as
 * "25 to 30", "400°F" as "400 degrees F", "&" as "and". Numbers and the rest
 * are left to the voice.
 */
export function spokenText(text: string): string {
  let s = text
    .replace(MIXED, (_, n: string, f: string) => `${n} and ${FRACTIONS[f]}`)
    .replace(FRACTION, (f) => FRACTIONS[f] ?? f)
    .replace(/(\d)\s*°\s*([CF])\b/g, '$1 degrees $2')
    .replace(/(\d)\s*°/g, '$1 degrees')
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*&\s*/g, ' and ')
  for (const [re, word] of UNITS) s = s.replace(re, word)
  return s.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim()
}

/**
 * The voice that keeps the promise: on-device only, in the page's language
 * when one is installed, else any on-device voice. Null when there is none.
 */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const local = voices.filter((v) => v.localService)
  const want = lang.toLowerCase().replace('_', '-')
  const base = want.split('-')[0]
  return (
    local.find((v) => v.lang.toLowerCase().replace('_', '-') === want) ??
    local.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base) ??
    local[0] ??
    null
  )
}

let current: SpeechSynthesisUtterance | null = null

/**
 * Say `text`, cutting whatever was being said. `onend` fires when this
 * utterance finishes on its own, not when it is cut. False when the browser
 * has no on-device voice.
 */
export function speak(text: string, lang: string, onend?: () => void): boolean {
  if (typeof speechSynthesis === 'undefined') return false
  const voice = pickVoice(speechSynthesis.getVoices(), lang)
  if (!voice) return false
  stop()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = 1
  const done = () => {
    if (current !== u) return // cut by a later speak() or stop(): not an ending
    current = null
    onend?.()
  }
  u.onend = done
  u.onerror = done
  current = u // also keeps the utterance alive: Chrome drops a collected one mid-sentence
  speechSynthesis.speak(u)
  return true
}

export function stop(): void {
  if (typeof speechSynthesis === 'undefined') return
  current = null
  speechSynthesis.cancel()
}
