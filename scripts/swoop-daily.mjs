// Swoop's plan: which hills each day gets, checked before they go out.
//
//   node scripts/swoop-daily.mjs plan [days]        add days after the last one planned (180 in all by default)
//   node scripts/swoop-daily.mjs replan <n> [days]  lay every day from #n on again (only days nobody has played)
//   node scripts/swoop-daily.mjs repace             time every day's blue bird again, each day's hills as they are
//   node scripts/swoop-daily.mjs show <n>           lay hills #n from the plan and say how the blue bird does
//
// A day's hills are laid from its number (src/games/swoop/sim.ts layHills), and a try is kept only once the
// blue bird has flown them in a fair time (sim.ts PACE_FROM to PACE_TO). The plan keeps which try that was,
// the hills' name, and the blue bird's time; the API gets its own copy of the times (ramseys-arcade-api
// src/swoopPace.ts, or API_DIR's), since a run's tickets and its fastest believable time go by them.
//
// `plan` only ever adds days: a day that's been played keeps its hills. Changing sim.ts's hills or physics
// changes the hills of days already planned, so don't, once people have played them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLUE_PACE, firstGoodHills, hillsSpan, paceRun, plannedHills } from '../src/games/swoop/sim.ts'

/** A day's pace, in ms: its blue bird's hands' time, raced quicker (sim.ts BLUE_PACE). */
const paceMs = (flight) => Math.round(flight.time * BLUE_PACE * 1000)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = join(root, 'src/games/swoop/dailyPlan.ts')
const API = join(process.env.API_DIR ?? join(root, '../ramseys-arcade-api'), 'src/swoopPace.ts')
const FIRST_DAY = '2026-10-06'

function readPlan() {
  if (!existsSync(PLAN)) return []
  const text = readFileSync(PLAN, 'utf8')
  return [...text.matchAll(/\{ a: (\d+), name: '([^']+)', pace: (\d+) \}/g)].map((m) => ({ a: Number(m[1]), name: m[2], pace: Number(m[3]) }))
}

function writePlan(days) {
  const lines = days.map((d) => `  { a: ${d.a}, name: '${d.name}', pace: ${d.pace} },`)
  writeFileSync(
    PLAN,
    `// Written by scripts/swoop-daily.mjs: each day's hills, from the first day (daily.ts FIRST_DAY) on. \`a\` is
// the try at the day's number that was kept (sim.ts plannedHills), \`pace\` the blue bird's time in
// milliseconds as it's raced: its hands' time when it was planned, quicker by sim.ts BLUE_PACE. Don't edit it
// by hand, and don't change sim.ts in a way that changes the hills of days people have played.

export type PlannedHills = { a: number; name: string; pace: number }

export const DAILY_HILLS: readonly PlannedHills[] = [
${lines.join('\n')}
]
`,
  )
  const paces = []
  for (let i = 0; i < days.length; i += 10) paces.push(`  ${days.slice(i, i + 10).map((d) => d.pace).join(', ')},`)
  writeFileSync(
    API,
    `// Written by the site's scripts/swoop-daily.mjs from its src/games/swoop/dailyPlan.ts: each planned day's
// blue bird (its run over the day's hills, as it's raced), in milliseconds, from the first day on. Swoop's
// ticket ladder goes by it (ticketLadders.ts), and so does the fastest run a day's board believes (routes.ts),
// whatever the site sends. Past the last planned day the days come round again, as the site's dailyHills has
// them. Don't edit it by hand: the script writes it again whenever the plan changes.
export const SWOOP_FIRST_DAY = '${FIRST_DAY}'

export const SWOOP_PACE_MS: readonly number[] = [
${paces.join('\n')}
]
`,
  )
}

const [cmd = 'plan', arg, arg2] = process.argv.slice(2)
if (cmd === 'plan' || cmd === 'replan') {
  const want = Number((cmd === 'replan' ? arg2 : arg) ?? 180)
  // replan keeps the days before #n as they were played and lays the rest again.
  const days = cmd === 'replan' ? readPlan().slice(0, Math.max(0, Number(arg) - 1)) : readPlan()
  const t0 = Date.now()
  for (let n = days.length + 1; n <= want; n++) {
    const { hills, attempt, pace } = firstGoodHills(n)
    days.push({ a: attempt, name: hills.name, pace: paceMs(pace) })
    if (n % 20 === 0) console.log(`#${n} ${hills.name} (try ${attempt}) ${pace.time.toFixed(2)}s · ${((Date.now() - t0) / 1000).toFixed(0)} s so far`)
  }
  writePlan(days)
  const times = days.map((d) => d.pace / 1000).sort((a, b) => a - b)
  const tries = days.filter((d) => d.a > 0).length
  console.log(`${days.length} days planned (${tries} on a second try or later); pace ${times[0].toFixed(1)}–${times[times.length - 1].toFixed(1)} s, median ${times[Math.floor(times.length / 2)].toFixed(1)} s`)
  console.log(`wrote ${PLAN}\nwrote ${API}`)
} else if (cmd === 'show') {
  const n = Number(arg)
  const day = readPlan()[n - 1]
  if (!day) throw new Error(`#${n} isn't planned`)
  const hills = plannedHills(n, day.a)
  const pace = paceRun(hills)
  const [lo, hi] = hillsSpan(hills)
  console.log(`#${n} ${hills.name}: ${hills.finish.toFixed(0)} m to the line, ${hills.tops} tops, ${(hi - lo).toFixed(0)} m from the lowest to the highest`)
  console.log(`  hands ${pace.time.toFixed(2)} s, raced in ${(paceMs(pace) / 1000).toFixed(2)} s (planned ${(day.pace / 1000).toFixed(2)} s), splits ${pace.splits.map((s) => s.toFixed(1)).join(' ')}`)
} else if (cmd === 'repace') {
  // Every planned day keeps its hills (the try it kept) and its name; only its blue bird's time is worked out
  // again, as when the blue bird went quicker (sim.ts BLUE_PACE).
  const days = readPlan().map((d, i) => ({ ...d, pace: paceMs(paceRun(plannedHills(i + 1, d.a))) }))
  writePlan(days)
  const times = days.map((d) => d.pace / 1000).sort((a, b) => a - b)
  console.log(`${days.length} days paced again; pace ${times[0].toFixed(1)}–${times[times.length - 1].toFixed(1)} s, median ${times[Math.floor(times.length / 2)].toFixed(1)} s`)
  console.log(`wrote ${PLAN}\nwrote ${API}`)
} else {
  console.log('node scripts/swoop-daily.mjs plan [days] | replan <n> [days] | repace | show <n>')
}
