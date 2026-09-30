// Marble Run's plan: which course each day gets, checked before it goes out.
//
//   node scripts/marblerun-daily.mjs plan [days]    add days after the last one planned (180 in all by default)
//   node scripts/marblerun-daily.mjs replan <n> [days]  lay every day from #n on again (only days nobody has played)
//   node scripts/marblerun-daily.mjs show <n>        lay course #n from the plan and say how the pace ball does
//
// A day's course is laid from its number (src/games/marblerun/sim.ts tryCourse), and a try is kept only once
// the pace ball has been all the way down it without falling off. The plan keeps which try that was, the
// course's name, and the pace ball's time; the API gets its own copy of the times (ramseys-arcade-api
// src/marblerunPace.ts, or API_DIR's), since a run's tickets and its fastest believable time go by them.
//
// `plan` only ever adds days: a day that's been played keeps its course. Changing sim.ts's generator or
// physics changes the courses of days already planned, so don't, once people have played them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firstGoodCourse, paceRun, plannedCourse } from '../src/games/marblerun/sim.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = join(root, 'src/games/marblerun/dailyPlan.ts')
const API = join(process.env.API_DIR ?? join(root, '../ramseys-arcade-api'), 'src/marblerunPace.ts')
const FIRST_DAY = '2026-09-29'

function readPlan() {
  if (!existsSync(PLAN)) return []
  const text = readFileSync(PLAN, 'utf8')
  return [...text.matchAll(/\{ a: (\d+), name: '([^']+)', pace: (\d+) \}/g)].map((m) => ({ a: Number(m[1]), name: m[2], pace: Number(m[3]) }))
}

function writePlan(days) {
  const lines = days.map((d) => `  { a: ${d.a}, name: '${d.name}', pace: ${d.pace} },`)
  writeFileSync(
    PLAN,
    `// Written by scripts/marblerun-daily.mjs: each day's course, from the first day (daily.ts FIRST_DAY) on. \`a\`
// is the try at the day's number that was kept (sim.ts plannedCourse), \`pace\` the pace ball's time in
// milliseconds when it was planned. Don't edit it by hand, and don't change sim.ts in a way that changes
// the courses of days people have played.

export type PlannedCourse = { a: number; name: string; pace: number }

export const DAILY_COURSES: readonly PlannedCourse[] = [
${lines.join('\n')}
]
`,
  )
  const paces = []
  for (let i = 0; i < days.length; i += 10) paces.push(`  ${days.slice(i, i + 10).map((d) => d.pace).join(', ')},`)
  writeFileSync(
    API,
    `// Written by the site's scripts/marblerun-daily.mjs from its src/games/marblerun/dailyPlan.ts: each planned
// day's blue ball (the pace ball's run), in milliseconds, from the first day on. Marble Run's ticket ladder
// goes by it (ticketLadders.ts), and so does the fastest run a day's board believes (routes.ts), whatever the
// site sends. Past the last planned day the days come round again, as the site's dailyCourse has them.
// Don't edit it by hand: the script writes it again whenever the plan changes.
export const MARBLERUN_FIRST_DAY = '${FIRST_DAY}'

export const MARBLERUN_PACE_MS: readonly number[] = [
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
    const { course, attempt, pace } = firstGoodCourse(n)
    days.push({ a: attempt, name: course.name, pace: Math.round(pace.time * 1000) })
    if (n % 20 === 0) console.log(`#${n} ${course.name} (try ${attempt}) ${pace.time.toFixed(2)}s · ${((Date.now() - t0) / 1000).toFixed(0)} s so far`)
  }
  writePlan(days)
  const times = days.map((d) => d.pace / 1000).sort((a, b) => a - b)
  console.log(`${days.length} days planned; pace ${times[0].toFixed(1)}–${times[times.length - 1].toFixed(1)} s, median ${times[Math.floor(times.length / 2)].toFixed(1)} s`)
  console.log(`wrote ${PLAN}\nwrote ${API}`)
} else if (cmd === 'show') {
  const n = Number(arg)
  const day = readPlan()[n - 1]
  if (!day) throw new Error(`#${n} isn't planned`)
  const course = plannedCourse(n, day.a)
  const pace = paceRun(course)
  console.log(`#${n} ${course.name}: ${course.length.toFixed(0)} m, ${(course.maxY - course.minY).toFixed(0)} m down, ${course.lines.length - 1} checkpoints`)
  console.log(`  ${course.order.join(' → ')}`)
  console.log(`  pace ${pace.time.toFixed(2)} s (planned ${(day.pace / 1000).toFixed(2)} s), splits ${pace.splits.map((s) => s.toFixed(1)).join(' ')}`)
} else {
  console.log('node scripts/marblerun-daily.mjs plan [days] | show <n>')
}
