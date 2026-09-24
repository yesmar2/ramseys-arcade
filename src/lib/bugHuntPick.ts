import { hashString, mulberry32 } from './seededRandom'

/*
 * Which bug gets loose on a day, and which month's set a find goes toward.
 * Kept apart from the rest of the hunt with nothing but the seeded shuffle,
 * because the API picks the same bug the same way (bugHunt.ts there) to tell
 * which finds count toward a set, and the two have to agree to the day.
 */

export type HuntBug = { id: string; name: string }

/** The wanted bugs, by the ids findbug/wanted.ts draws them with. The order is part of the pick. */
export const HUNT_BUGS: readonly HuntBug[] = [
  { id: 'bug', name: 'the Bug' },
  { id: 'skip', name: 'Skip' },
  { id: 'dotty', name: 'Dotty' },
  { id: 'pickle', name: 'Pickle' },
  { id: 'tiger', name: 'Tiger' },
  { id: 'rosie', name: 'Rosie' },
  { id: 'ziggy', name: 'Ziggy' },
  { id: 'honey', name: 'Honey' },
  { id: 'buzz', name: 'Buzz' },
  { id: 'pip', name: 'Pip' },
  { id: 'hopper', name: 'Hopper' },
  { id: 'flutter', name: 'Flutter' },
]

export const SET_SIZE = HUNT_BUGS.length

/** From this day each month's bugs come round in shuffles of their own. */
const MONTHLY_FROM = '2026-10-01'
/** The hunt began on Sept 24, and its first set runs to the end of October. */
const FIRST_SET = '2026-10'

export function shuffled<T>(list: readonly T[], key: string): T[] {
  const rand = mulberry32(hashString(key))
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Days since the hunt's calendar starts, so each day has a number. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(2026, 0, 1)) / 86_400_000)
}

/**
 * The day's bug. From October, each month starts the rotation afresh: days
 * 1 to 12 are one shuffle of the twelve, 13 to 24 another, and the rest of
 * the month part of a third, so every bug comes round two or three times a
 * month and one missed day never costs the set. Before that, the running
 * shuffle the hunt launched with, so September stays as it was.
 */
export function bugForDay(day: string): HuntBug {
  if (day >= MONTHLY_FROM) {
    const d = Number(day.slice(8, 10))
    const block = Math.floor((d - 1) / SET_SIZE)
    return shuffled(HUNT_BUGS, `bugs:${day.slice(0, 7)}:${block}`)[(d - 1) % SET_SIZE]!
  }
  const n = dayNumber(day)
  const bugs = shuffled(HUNT_BUGS, `bugs:${Math.floor(n / SET_SIZE)}`)
  return bugs[((n % SET_SIZE) + SET_SIZE) % SET_SIZE]!
}

/** The set a day's find goes toward (YYYY-MM): its own month, with the hunt's first week in October's. */
export function setKeyFor(day: string): string {
  return day < MONTHLY_FROM ? FIRST_SET : day.slice(0, 7)
}

/** A set's month, for words: "October". */
export function setMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, 15)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** The first set started with the hunt, a week before its month did. */
export function setStartsEarly(key: string): boolean {
  return key === FIRST_SET
}

/** A set's last day, for words: "Oct 31". */
export function setEnds(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
