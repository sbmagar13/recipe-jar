// Recipes sometimes carry sections inside their step list: the parser turns
// HowToSection names and markdown headings into "— Section name —" marker
// steps. These helpers split the flat list back into real sections so the
// card can show proper headings (numbering restarting per section, like the
// source page) and cook mode never lands on a heading as if it were a step.
// Original indices are preserved: step timers are keyed by them.

const DIVIDER = /^—\s+(.+?)\s+—$/

export interface StepRef {
  text: string
  index: number // index into recipe.steps, the timer key space
}

export interface StepGroup {
  title: string | null
  steps: StepRef[]
}

/** Split steps into titled groups. No dividers → one untitled group. */
export function stepGroups(steps: string[]): StepGroup[] {
  const groups: StepGroup[] = []
  let cur: StepGroup = { title: null, steps: [] }
  steps.forEach((text, index) => {
    const m = text.match(DIVIDER)
    if (m) {
      if (cur.title !== null || cur.steps.length > 0) groups.push(cur)
      cur = { title: m[1], steps: [] }
    } else {
      cur.steps.push({ text, index })
    }
  })
  if (cur.title !== null || cur.steps.length > 0) groups.push(cur)
  return groups
}

export interface CookStep extends StepRef {
  section: string | null // the section this step belongs to, if any
}

/** The real steps for cook mode: dividers become labels, never steps. */
export function cookSteps(steps: string[]): CookStep[] {
  const out: CookStep[] = []
  let section: string | null = null
  steps.forEach((text, index) => {
    const m = text.match(DIVIDER)
    if (m) section = m[1]
    else out.push({ text, index, section })
  })
  return out
}
