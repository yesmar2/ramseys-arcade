// The API's src/courseNames.ts: every planned Hot Lap track's name and every planned Ace Chase hole's, from
// the site's plans, for the record books, where each track's and each hole's record is named after it.
//
//   node scripts/course-names.mjs
//
// Both plan scripts (hotlap-daily.mjs, acechase-daily.mjs) run this whenever they write a plan, so the API's
// names stay in step: commit src/courseNames.ts in the API repo too (branch master).
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const API_NAMES = new URL('../../ramseys-arcade-api/src/courseNames.ts', import.meta.url)
const HOTLAP_PLAN = new URL('../src/games/hotlap/dailyPlan.ts', import.meta.url)
const ACE_PLAN = new URL('../src/games/acechase/dailyPlan.ts', import.meta.url)
const ACE_DAILY = new URL('../src/games/acechase/daily.ts', import.meta.url)

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
  const text = `// Written by the site's scripts/course-names.mjs from its plans (src/games/hotlap/dailyPlan.ts and
// src/games/acechase/dailyPlan.ts): each planned Hot Lap track's name and each planned Ace Chase hole's, by
// day from each game's first, for the record books (records.ts), where each track's and each hole's record
// is named after it. The plan scripts write it again whenever they write a plan. Don't edit it by hand.

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
`
  fs.writeFileSync(API_NAMES, text)
  console.log(`wrote ${tracks.length} track names and ${holes.length} hole names to the API's src/courseNames.ts`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeCourseNames()
