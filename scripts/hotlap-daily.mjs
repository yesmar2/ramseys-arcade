// Hot Lap: the daily tracks, planned ahead and kept in src/games/hotlap/dailyPlan.ts.
//
//   node scripts/hotlap-daily.mjs plan [days=180]          add days to the end of the plan until it has this many
//   node scripts/hotlap-daily.mjs show YYYY-MM-DD           one day's track: its line, its checks, its pace lap
//   node scripts/hotlap-daily.mjs sheet [from=1] [count=36] [file=hotlap-tracks.svg]   the tracks' outlines, to look over
//
// Day 1 (2026-09-26) is the classic track. Each later day's track is the first that passes courses.ts's
// checks among seeds made from the day's number. Days already in the plan are never made again, even if
// the generator changes: a day that's been played has to stay the track it was. So plan only ever adds.
import fs from 'node:fs'

const COURSES = new URL('../src/games/hotlap/courses.ts', import.meta.url)
const SIM = new URL('../src/games/hotlap/sim.ts', import.meta.url)
const PLAN = new URL('../src/games/hotlap/dailyPlan.ts', import.meta.url)
const SEEDS = new URL('../src/lib/seededRandom.ts', import.meta.url)

const C = await import(COURSES.href)
const S = await import(SIM.href)
const { hashString } = await import(SEEDS.href)

const FIRST_DAY = '2026-09-26'
const round2 = (v) => Math.round(v * 100) / 100

function readPlan() {
  if (!fs.existsSync(PLAN)) return []
  const text = fs.readFileSync(PLAN, 'utf8')
  const out = []
  for (const m of text.matchAll(/\{ name: '([^']*)', course: '([^']*)', pace: ([\d.]+) \}/g)) out.push({ name: m[1], course: m[2], pace: Number(m[3]) })
  return out
}

function writePlan(entries) {
  const lines = entries.map((e) => `  { name: '${e.name}', course: '${e.course}', pace: ${e.pace} },`)
  const text = `// Written by scripts/hotlap-daily.mjs: Hot Lap's track for each day from the first (${FIRST_DAY}), each
// checked to close, keep clear of itself and give the pace car and a driver on the limit a clean lap.
// Days are only ever added at the end, never made again: a day that's been played stays the track it was.
export type PlannedTrack = { name: string; course: string; pace: number }

export const DAILY_TRACKS: PlannedTrack[] = [
${lines.join('\n')}
]
`
  fs.writeFileSync(PLAN, text)
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
    return { seed, course: C.encodeCourse(pieces), pace: round2(check.pace), tries: k + 1 }
  }
  throw new Error(`no track for day ${n} in 500 seeds`)
}

const [command = 'plan', ...args] = process.argv.slice(2)

if (command === 'plan') {
  const days = Number(args[0] ?? 180)
  const plan = readPlan()
  const had = plan.length
  const names = new Set(plan.map((e) => e.name))
  for (let n = plan.length + 1; n <= days; n++) {
    const made = makeDay(n)
    // Every day its own name: one the plan already has makes way for the next the seed gives.
    let name = made.name ?? C.courseName(made.seed)
    for (let j = 1; names.has(name) && j < 1000; j++) name = C.courseName(made.seed + j)
    names.add(name)
    plan.push({ name, course: made.course, pace: made.pace })
    if (n % 20 === 0 || n === days) console.log(`day ${n} (${dayOf(n)}): ${name}, pace ${made.pace}s, seed try ${made.tries}`)
  }
  writePlan(plan)
  console.log(`plan: ${had} days kept, ${plan.length - had} added, ${plan.length} in all (to ${dayOf(plan.length)})`)
} else if (command === 'show') {
  const day = args[0] ?? new Date().toISOString().slice(0, 10)
  const n = numberOf(day)
  const plan = readPlan()
  const entry = plan[(n - 1) % plan.length]
  if (!entry) throw new Error('the plan is empty: run plan first')
  const pieces = C.decodeCourse(entry.course)
  const check = C.checkCourse(pieces)
  console.log(`day ${n} (${day}): ${entry.name}`)
  console.log(`  ${entry.course}`)
  console.log(check.ok ? `  length ${check.track.length.toFixed(0)} m, pace ${check.pace.toFixed(2)}s, limit ${check.limit.toFixed(2)}s, start straight ${check.track.straights.A.toFixed(0)} m, clearance ${C.clearance(check.track).toFixed(0)} m` : `  fails: ${check.why}`)
} else if (command === 'sheet') {
  const from = Number(args[0] ?? 1)
  const count = Number(args[1] ?? 36)
  const file = args[2] ?? 'hotlap-tracks.svg'
  const plan = readPlan()
  const cell = 200
  const cols = 6
  const rows = Math.ceil(count / cols)
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}" style="background:#0c1218;font-family:sans-serif">`]
  for (let i = 0; i < count; i++) {
    const n = from + i
    const entry = plan[n - 1]
    if (!entry) break
    const track = S.buildTrack(C.decodeCourse(entry.course))
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
} else {
  console.log('usage: node scripts/hotlap-daily.mjs plan [days] | show YYYY-MM-DD | sheet [from] [count] [file]')
}
