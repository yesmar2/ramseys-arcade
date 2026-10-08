// The API's src/courseNames.ts: every planned Hot Lap track's name, every planned Ace Chase hole's and every
// planned Wobble Run gauntlet's, from the site's plans, for the record books, where each track's and each
// hole's record is named after it, and for anything the API says about a day's gauntlet by name.
//
//   node scripts/course-names.mjs
//
// The plan scripts (hotlap-daily.mjs, acechase-daily.mjs, wobblerun-daily.mjs) run this whenever they write a
// plan, so the API's names stay in step: commit src/courseNames.ts in the API repo too (branch master). From a
// worktree, set API_DIR to the API's checkout, as the plan scripts take it.
import fs from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const API_NAMES = pathToFileURL(join(process.env.API_DIR ?? join(root, '../ramseys-arcade-api'), 'src/courseNames.ts'))
const HOTLAP_PLAN = new URL('../src/games/hotlap/dailyPlan.ts', import.meta.url)
const ACE_PLAN = new URL('../src/games/acechase/dailyPlan.ts', import.meta.url)
const ACE_DAILY = new URL('../src/games/acechase/daily.ts', import.meta.url)
const WOBBLE_PLAN = new URL('../src/games/wobblerun/dailyPlan.ts', import.meta.url)
const WOBBLE_DAILY = new URL('../src/games/wobblerun/daily.ts', import.meta.url)

/** A list of names as TypeScript, six a line. */
function listOf(names) {
  const rows = []
  for (let i = 0; i < names.length; i += 6) rows.push(`  ${names.slice(i, i + 6).map((name) => `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')},`)
  return rows.join('\n')
}

export async function writeCourseNames() {
  if (!fs.existsSync(new URL('.', API_NAMES))) {
    console.log('no API repo beside this one: its src/courseNames.ts was not written')
    return
  }
  // Fresh copies: a plan script has just written the plan it imported before.
  const fresh = `?names=${Date.now()}`
  const { DAILY_TRACKS } = await import(HOTLAP_PLAN.href + fresh)
  const { DAILY_PLAN } = await import(ACE_PLAN.href + fresh)
  const ace = await import(ACE_DAILY.href)
  const [y, m, d] = ace.DAILY_EPOCH.split('-').map(Number)
  const holeDay = (n) => new Date(Date.UTC(y, m - 1, d + n - 1)).toISOString().slice(0, 10)
  const holes = DAILY_PLAN.map((pick, i) => ace.dailyHoleDef(pick, holeDay(i + 1)).name)
  const tracks = DAILY_TRACKS.map((entry) => entry.name)
  const { DAILY_GAUNTLETS } = await import(WOBBLE_PLAN.href + fresh)
  const { FIRST_DAY: WOBBLE_FIRST_DAY } = await import(WOBBLE_DAILY.href)
  const gauntlets = DAILY_GAUNTLETS.map((entry) => entry.name)
  const text = `// Written by the site's scripts/course-names.mjs from its plans (src/games/hotlap/dailyPlan.ts,
// src/games/acechase/dailyPlan.ts and src/games/wobblerun/dailyPlan.ts): each planned Hot Lap track's name, each
// planned Ace Chase hole's and each planned Wobble Run gauntlet's, by day from each game's first, for the record
// books (records.ts), where each track's and each hole's record is named after it. The plan scripts write it
// again whenever they write a plan. Don't edit it by hand.

/** Hot Lap's tracks, the first day's (hotlapPace.ts HOTLAP_FIRST_DAY) first. */
export const HOTLAP_TRACK_NAMES: readonly string[] = [
${listOf(tracks)}
]

/** Today's Hole #1 was this day's. */
export const ACECHASE_FIRST_DAY = '${ace.DAILY_EPOCH}'

/** Ace Chase's holes, the first day's first. */
export const ACECHASE_HOLE_NAMES: readonly string[] = [
${listOf(holes)}
]

/** Today's Gauntlet #1 was this day's (wobblerunPace.ts WOBBLERUN_FIRST_DAY). */
export const WOBBLERUN_FIRST_DAY = '${WOBBLE_FIRST_DAY}'

/** Wobble Run's gauntlets, the first day's first. */
export const WOBBLERUN_GAUNTLET_NAMES: readonly string[] = [
${listOf(gauntlets)}
]
`
  fs.writeFileSync(API_NAMES, text)
  console.log(`wrote ${tracks.length} track names, ${holes.length} hole names and ${gauntlets.length} gauntlet names to the API's src/courseNames.ts`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeCourseNames()
