import { hashString, mulberry32 } from './seededRandom'

/*
 * Which bug gets loose on a day, and which month's set a find goes toward.
 * Kept apart from the rest of the hunt with nothing but the seeded shuffle,
 * because the API picks the same bug the same way (bugHunt.ts there) to tell
 * which finds count toward a set, and the two have to agree to the day.
 */

export type HuntBug = { id: string; name: string }

/**
 * The Blips in the hunt, by the ids HuntBlip.tsx draws them with. The order is part of the pick, and the API's
 * (bugHunt.ts) is the same. They took over from ten of Find the Bug's wanted bugs on 2026-11-09 (Ramsey: "i
 * wanted this to be the blips not the bugs"), when nobody on production had caught one yet. The hunt's code
 * still says "bug" for whatever is loose; players see Blips.
 */
export const HUNT_BUGS: readonly HuntBug[] = [
  { id: 'blip', name: 'Blip' },
  { id: 'ember', name: 'Ember' },
  { id: 'frost', name: 'Frost' },
  { id: 'berry', name: 'Berry' },
  { id: 'sunny', name: 'Sunny' },
  { id: 'moss', name: 'Moss' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'bolt', name: 'Bolt' },
  { id: 'pebble', name: 'Pebble' },
  { id: 'cloud', name: 'Cloud' },
]

export const SET_SIZE = HUNT_BUGS.length

const HUNT_IDS: ReadonlySet<string> = new Set(HUNT_BUGS.map((b) => b.id))

/** Whether a Blip is in the hunt now: a bug caught before the Blips took over isn't. */
export function isHuntBug(id: string): boolean {
  return HUNT_IDS.has(id)
}

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
 * 1 to 10 are one shuffle of the ten, 11 to 20 another, 21 to 30 a third,
 * and a 31st the start of a fourth, so every bug comes round three times a
 * month (twice for two of them in February) and one missed day never costs
 * the set. Before that, the running
 * shuffle the hunt launched with, ten days at a time since it went to ten.
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
