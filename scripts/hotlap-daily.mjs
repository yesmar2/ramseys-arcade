// Hot Lap: the daily tracks, planned ahead and kept in src/games/hotlap/dailyPlan.ts.
//
//   node scripts/hotlap-daily.mjs plan [days=180]          add days to the end of the plan until it has this many
//   node scripts/hotlap-daily.mjs show YYYY-MM-DD           one day's track: its line, its checks, its pace lap
//   node scripts/hotlap-daily.mjs sheet [from=1] [count=36] [file=hotlap-tracks.svg]   the tracks' outlines, to look over
//   node scripts/hotlap-daily.mjs insert YYYY-MM-DD <landmark>   a landmark (landmarks.ts) on a day to come,
//                                                                the days after it moving on one
//   node scripts/hotlap-daily.mjs hills YYYY-MM-DD           hills (courses.ts hillyCourse) for the made tracks
//                                                                from that day to come on, those that have none
//   node scripts/hotlap-daily.mjs remake YYYY-MM-DD          every made day from that day to come on made again
//                                                                by today's track maker (landmarks stay put)
//
// Day 1 (2026-09-26) is the classic track. Each later day's track is the first that passes courses.ts's
// checks among seeds made from the day's number. Days already in the plan are never made again, even if
// the generator changes: a day that's been played has to stay the track it was. So plan only ever adds,
// and insert, hills and remake only ever change days that haven't come yet. A made day gets its hills from its
// line, so the same line always gets the same hills.
//
// Every command that writes the plan also writes the API's src/hotlapPace.ts, each day's blue car, which
// the API pays laps by (its ticketLadders.ts), and its src/courseNames.ts (course-names.mjs), each track's
// name for the record books: commit both in the API repo too (branch master).
import fs from 'node:fs'

const COURSES = new URL('../src/games/hotlap/courses.ts', import.meta.url)
const SIM = new URL('../src/games/hotlap/sim.ts', import.meta.url)
const PLAN = new URL('../src/games/hotlap/dailyPlan.ts', import.meta.url)
const SEEDS = new URL('../src/lib/seededRandom.ts', import.meta.url)
const LANDMARKS_FILE = new URL('../src/games/hotlap/landmarks.ts', import.meta.url)
/** The API's copy of each day's blue car, which it pays laps by (its ticketLadders.ts): written with the plan. */
const API_PACE = new URL('../../ramseys-arcade-api/src/hotlapPace.ts', import.meta.url)

const C = await import(COURSES.href)
const S = await import(SIM.href)
const { hashString } = await import(SEEDS.href)

const FIRST_DAY = '2026-09-26'
const round2 = (v) => Math.round(v * 100) / 100

async function readPlan() {
  if (!fs.existsSync(PLAN)) return []
  const { DAILY_TRACKS } = await import(PLAN.href)
  return DAILY_TRACKS.map((e) => ({ ...e }))
}

/** A planned track's shape beyond its pieces: how it lies on the map, and its hills. */
function shapeOf(e) {
  return { ...(e.heading ? { heading: e.heading } : {}), ...(e.hills ? { hills: C.decodeHills(e.hills) } : {}) }
}

/** A landmark's is a real circuit's layout, which may run longer than a made track (courses.ts checkCourse). */
const isLandmark = (e) => Boolean(e.heading)

/** Today on the boards' clock: a day that has come can't change. */
const todayInNewYork = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function writePlan(entries) {
  const lines = entries.map(
    (e) => `  { name: '${e.name}', course: '${e.course}', pace: ${e.pace}${e.heading ? `, heading: ${e.heading}` : ''}${e.hills ? `, hills: '${e.hills}'` : ''} },`,
  )
  const text = `// Written by scripts/hotlap-daily.mjs: Hot Lap's track for each day from the first (${FIRST_DAY}), each
// checked to close, keep clear of itself and give the pace car and a driver on the limit a clean lap.
// Days are only ever added at the end, never made again: a day that's been played stays the track it was.
// A landmark (landmarks.ts, a real circuit's layout) may be put on a day to come, and carries which way it
// faces on the map and its hills.
export type PlannedTrack = { name: string; course: string; pace: number; heading?: number; hills?: string }

export const DAILY_TRACKS: PlannedTrack[] = [
${lines.join('\n')}
]
`
  fs.writeFileSync(PLAN, text)
  writeApiPace(entries)
  // The tracks' names, for the API's record books.
  void import('./course-names.mjs').then((m) => m.writeCourseNames()).catch((err) => console.error('course names:', err))
}

/**
 * The API pays a lap by the day's own blue car, from its copy of the plan's pace laps, in milliseconds by
 * day (index = day number − 1): written whenever the plan is. A day's pace is the pace car's lap on it,
 * the same lap the game drives as the blue car (lap.ts hotlapCourse), to the hundredth. Commit it in the
 * API repo too (branch master), or the API pays by the old plan.
 */
function writeApiPace(entries) {
  if (!fs.existsSync(new URL('.', API_PACE))) {
    console.log('no API repo beside this one: its src/hotlapPace.ts was not written')
    return
  }
  const rows = []
  for (let i = 0; i < entries.length; i += 10) rows.push(`  ${entries.slice(i, i + 10).map((e) => Math.round(e.pace * 1000)).join(', ')},`)
  const text = `// Written by the site's scripts/hotlap-daily.mjs from its src/games/hotlap/dailyPlan.ts: each planned day's
// blue car (its pace car's lap), in milliseconds, from the first day on. Hot Lap's ticket ladder goes by it
// (ticketLadders.ts), so a lap is paid by the day's own blue car, whatever the site sends. Past the last
// planned day the days come round again, as the site's dailyTrack has them. Don't edit it by hand: the
// script writes it again whenever the plan changes.
export const HOTLAP_FIRST_DAY = '${FIRST_DAY}'

export const HOTLAP_PACE_MS: readonly number[] = [
${rows.join('\n')}
]
`
  fs.writeFileSync(API_PACE, text)
}

function dayOf(n) {
  const [y, m, d] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n - 1)).toISOString().slice(0, 10)
}

function numberOf(day) {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y0, m0 - 1, d0)) / 86_400_000) + 1
}

/** Day n's track: the classic on day 1, else the first seed of its number whose track passes. */
function makeDay(n) {
  if (n === 1) {
    const check = C.checkCourse(S.CLASSIC)
    if (!check.ok) throw new Error(`the classic track fails its checks: ${check.why}`)
    return { name: 'The Classic', seed: 0, course: C.encodeCourse(S.CLASSIC), pace: round2(check.pace), tries: 1 }
  }
  for (let k = 0; k < 500; k++) {
    const seed = hashString(`hotlap:${n}:${k}`)
    const pieces = C.generateCourse(seed)
    if (!pieces) continue
    const check = C.checkCourse(pieces)
    if (!check.ok) continue
    const course = C.encodeCourse(pieces)
    // Its hills, if its line gives it any: a track that can't take them stays flat.
    const hilly = C.hillyCourse(course)
    if (hilly) return { seed, course, hills: hilly.hills, pace: round2(hilly.check.pace), tries: k + 1 }
    return { seed, course, pace: round2(check.pace), tries: k + 1 }
  }
  throw new Error(`no track for day ${n} in 500 seeds`)
}

const [command = 'plan', ...args] = process.argv.slice(2)

if (command === 'plan') {
  const days = Number(args[0] ?? 180)
  const plan = await readPlan()
  const had = plan.length
  const names = new Set(plan.map((e) => e.name))
  for (let n = plan.length + 1; n <= days; n++) {
    const made = makeDay(n)
    // Every day its own name: one the plan already has makes way for the next the seed gives.
    let name = made.name ?? C.courseName(made.seed)
    for (let j = 1; names.has(name) && j < 1000; j++) name = C.courseName(made.seed + j)
    names.add(name)
    plan.push({ name, course: made.course, pace: made.pace, ...(made.hills ? { hills: made.hills } : {}) })
    if (n % 20 === 0 || n === days) console.log(`day ${n} (${dayOf(n)}): ${name}, pace ${made.pace}s, seed try ${made.tries}`)
  }
  writePlan(plan)
  console.log(`plan: ${had} days kept, ${plan.length - had} added, ${plan.length} in all (to ${dayOf(plan.length)})`)
} else if (command === 'show') {
  const day = args[0] ?? new Date().toISOString().slice(0, 10)
  const n = numberOf(day)
  const plan = await readPlan()
  const entry = plan[(n - 1) % plan.length]
  if (!entry) throw new Error('the plan is empty: run plan first')
  const pieces = C.decodeCourse(entry.course)
  const check = C.checkCourse(pieces, shapeOf(entry), isLandmark(entry))
  console.log(`day ${n} (${day}): ${entry.name}`)
  console.log(`  ${entry.course}`)
  console.log(check.ok ? `  length ${check.track.length.toFixed(0)} m, pace ${check.pace.toFixed(2)}s, limit ${check.limit.toFixed(2)}s, start straight ${check.track.straights.A.toFixed(0)} m, clearance ${C.clearance(check.track).toFixed(0)} m` : `  fails: ${check.why}`)
} else if (command === 'sheet') {
  const from = Number(args[0] ?? 1)
  const count = Number(args[1] ?? 36)
  const file = args[2] ?? 'hotlap-tracks.svg'
  const plan = await readPlan()
  const cell = 200
  const cols = 6
  const rows = Math.ceil(count / cols)
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}" style="background:#0c1218;font-family:sans-serif">`]
  for (let i = 0; i < count; i++) {
    const n = from + i
    const entry = plan[n - 1]
    if (!entry) break
    const track = S.buildTrack(C.decodeCourse(entry.course), shapeOf(entry))
    const box = C.bounds(track)
    const scale = (cell - 40) / Math.max(box.width, box.height)
    const ox = (i % cols) * cell + cell / 2
    const oy = Math.floor(i / cols) * cell + cell / 2 + 6
    const pts = []
    for (let k = 0; k < track.n; k += 3) pts.push(`${(ox + (track.x[k] - box.cx) * scale).toFixed(1)},${(oy - (track.y[k] - box.cy) * scale).toFixed(1)}`)
    const sx = ox + (track.x[track.startIndex] - box.cx) * scale
    const sy = oy - (track.y[track.startIndex] - box.cy) * scale
    parts.push(`<polygon points="${pts.join(' ')}" fill="none" stroke="#e7eef3" stroke-width="3" stroke-linejoin="round"/>`)
    parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" fill="#f2813a"/>`)
    parts.push(`<text x="${(i % cols) * cell + 8}" y="${Math.floor(i / cols) * cell + 16}" fill="#9bb0be" font-size="12">#${n} ${entry.name} · ${entry.pace}s</text>`)
  }
  parts.push('</svg>')
  fs.writeFileSync(file, parts.join('\n'))
  console.log(`wrote ${file}`)
} else if (command === 'insert') {
  const [day, key] = args
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !key) throw new Error('usage: insert YYYY-MM-DD <landmark>')
  const { LANDMARKS } = await import(LANDMARKS_FILE.href)
  const landmark = LANDMARKS[key]
  if (!landmark) throw new Error(`no landmark "${key}": ${Object.keys(LANDMARKS).join(', ')}`)
  // Only a day to come: today's track is being driven, and a played day stays the track it was.
  const today = todayInNewYork()
  if (day <= today) throw new Error(`${day} has come already (it's ${today} in New York): pick a day after it`)
  const plan = await readPlan()
  if (plan.some((e) => e.name === landmark.name)) throw new Error(`${landmark.name} is in the plan already`)
  const n = numberOf(day)
  if (n < 2 || n > plan.length + 1) throw new Error(`day ${n} is outside the plan (1 to ${plan.length})`)
  const entry = { name: landmark.name, course: landmark.course, heading: landmark.heading, hills: landmark.hills }
  const check = C.checkCourse(C.decodeCourse(entry.course), shapeOf(entry), true)
  if (!check.ok) throw new Error(`${landmark.name} fails its checks: ${check.why}`)
  plan.splice(n - 1, 0, { ...entry, pace: round2(check.pace) })
  writePlan(plan)
  console.log(`day ${n} (${day}): ${landmark.name}, ${check.track.length.toFixed(0)} m, pace ${check.pace.toFixed(2)}s, limit ${check.limit.toFixed(2)}s; the days after it each move on one, to ${dayOf(plan.length)}`)
} else if (command === 'remake') {
  const [day] = args
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('usage: remake YYYY-MM-DD')
  const today = todayInNewYork()
  if (day <= today) throw new Error(`${day} has come already (it's ${today} in New York): pick a day after it`)
  const plan = await readPlan()
  const from = numberOf(day)
  // The days before it, and landmarks, keep their names; each day made again gets one of its own.
  const names = new Set(plan.filter((e, i) => i + 1 < from || isLandmark(e)).map((e) => e.name))
  let made = 0
  for (let n = Math.max(2, from); n <= plan.length; n++) {
    if (isLandmark(plan[n - 1])) continue
    const track = makeDay(n)
    let name = C.courseName(track.seed)
    for (let j = 1; names.has(name) && j < 1000; j++) name = C.courseName(track.seed + j)
    names.add(name)
    plan[n - 1] = { name, course: track.course, pace: track.pace, ...(track.hills ? { hills: track.hills } : {}) }
    made++
    if (n % 20 === 0) console.log(`day ${n} (${dayOf(n)}): ${name}, pace ${track.pace}s, seed try ${track.tries}`)
  }
  writePlan(plan)
  console.log(`from day ${from} (${day}): ${made} days made again; landmarks and the days before kept`)
} else if (command === 'hills') {
  const [day] = args
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('usage: hills YYYY-MM-DD')
  const today = todayInNewYork()
  if (day <= today) throw new Error(`${day} has come already (it's ${today} in New York): pick a day after it`)
  const plan = await readPlan()
  const from = numberOf(day)
  const kinds = { flat: 0, rolling: 0, hilly: 0, big: 0, kept: 0 }
  for (let n = Math.max(2, from); n <= plan.length; n++) {
    const entry = plan[n - 1]
    // A landmark keeps its own heights, and a track that has hills keeps them.
    if (isLandmark(entry) || entry.hills) {
      kinds.kept++
      continue
    }
    const hilly = C.hillyCourse(entry.course)
    if (!hilly) {
      kinds.flat++
      continue
    }
    kinds[hilly.kind]++
    entry.hills = hilly.hills
    entry.pace = round2(hilly.check.pace)
    if (n % 20 === 0) console.log(`day ${n} (${dayOf(n)}): ${entry.name}, ${hilly.kind}, pace ${entry.pace}s`)
  }
  writePlan(plan)
  console.log(`from day ${from} (${day}): ${kinds.rolling} rolling, ${kinds.hilly} hilly, ${kinds.big} big, ${kinds.flat} flat; ${kinds.kept} kept as they were`)
} else {
  console.log('usage: node scripts/hotlap-daily.mjs plan [days] | show YYYY-MM-DD | sheet [from] [count] [file] | insert YYYY-MM-DD <landmark> | hills YYYY-MM-DD | remake YYYY-MM-DD')
}
