// The week plan: which picked recipe is for which day. Days are JS getDay()
// numbers (0 = Sunday). Display order always starts from today, which reads
// naturally in the kitchen and sidesteps arguing about where a week starts
// (Nepali weeks start Sunday, European ones Monday; "Today, Tomorrow, …"
// starts wherever the cook is standing).

export const PLAN_KEY = 'recipe-jar:shopplan'
export const WEEKDAYS_KEY = 'recipe-jar:weekdays'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayLabel(day: number, today: number): string {
  if (day === today) return 'Today'
  if (day === (today + 1) % 7) return 'Tomorrow'
  return DAY_NAMES[day] ?? ''
}

/** All seven days, today first. */
export function orderedDays(today: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (today + i) % 7)
}

/** Recipe ids planned for today: assigned to today's day AND still picked. */
export function tonightIds(
  pickedPairs: Array<[number, number]>,
  dayPairs: Array<[number, number]>,
  today: number,
): number[] {
  const picked = new Set(pickedPairs.map(([id]) => id))
  return dayPairs.filter(([id, d]) => d === today && picked.has(id)).map(([id]) => id)
}

/** Read a JSON array of [id, n] pairs from localStorage; junk reads as empty. */
export function readPairs(key: string): Array<[number, number]> {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? (v as Array<[number, number]>) : []
  } catch {
    return []
  }
}
