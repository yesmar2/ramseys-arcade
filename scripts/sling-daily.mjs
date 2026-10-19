// Sling's plan: which tower each day gets, checked before it goes out.
//
//   node scripts/sling-daily.mjs plan [days]        add days after the last one planned (180 in all by default)
//   node scripts/sling-daily.mjs replan <n> [days]  lay every day from #n on again (only days nobody has played)
//   node scripts/sling-daily.mjs show <n>           lay tower #n from the plan and say how the blue blip does
//
// A day's tower is laid from its number (src/games/sling/sim.ts layTower), and a try is kept only once the blue
// blip has climbed it clean in a fair time (sim.ts PACE_FROM to PACE_TO). The plan keeps which try that was, the
// tower's name and the blue blip's time (dailyPlan.ts), and the blue blip's flings (blueRoutes.ts), so the game
// flies its climb again in a moment instead of working it out on a phone. The API gets its own copy of the
// times (ramseys-arcade-api src/slingPace.ts, or API_DIR's), since a run's tickets and its fastest believable
// time go by them.
//
// `plan` only ever adds days: a day that's been played keeps its tower. Changing sim.ts's towers or physics
// changes the towers of days already planned, so don't, once people have played them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { climbWith, firstGoodTower, paceRun, plannedTower, replayHands, SECTION_NAMES } from '../src/games/sling/sim.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = join(root, 'src/games/sling/dailyPlan.ts')
const ROUTES = join(root, 'src/games/sling/blueRoutes.ts')
const API = join(process.env.API_DIR ?? join(root, '../ramseys-arcade-api'), 'src/slingPace.ts')
const FIRST_DAY = '2026-10-19'

function readPlan() {
  if (!existsSync(PLAN)) return []
  const text = readFileSync(PLAN, 'utf8')
  const days = [...text.matchAll(/\{ a: (\d+), name: '([^']+)', pace: (\d+) \}/g)].map((m) => ({ a: Number(m[1]), name: m[2], pace: Number(m[3]) }))
  const routes = existsSync(ROUTES) ? [...readFileSync(ROUTES, 'utf8').matchAll(/^ {2}'([^']*)',$/gm)].map((m) => m[1]) : []
  return days.map((d, i) => ({ ...d, route: routes[i] ?? '' }))
}

function writePlan(days) {
  writeFileSync(
    PLAN,
    `// Written by scripts/sling-daily.mjs: each day's tower, from the first day (daily.ts FIRST_DAY) on. \`a\` is
// the try at the day's number that was kept (sim.ts plannedTower), \`pace\` the blue blip's time in
// milliseconds. Don't edit it by hand, and don't change sim.ts in a way that changes the towers of days people
// have played.

export type PlannedTower = { a: number; name: string; pace: number }

export const DAILY_TOWERS: readonly PlannedTower[] = [
${days.map((d) => `  { a: ${d.a}, name: '${d.name}', pace: ${d.pace} },`).join('\n')}
]
`,
  )
  writeFileSync(
    ROUTES,
    `// Written by scripts/sling-daily.mjs: each planned day's blue blip, as its flings (sim.ts routeStep: the step,
// the angle in degrees and the power in hundredths, base 36), so the game flies its climb again in a moment
// (runs.ts paceOf) instead of working it out. Don't edit it by hand.

export const BLUE_ROUTES: readonly string[] = [
${days.map((d) => `  '${d.route}',`).join('\n')}
]
`,
  )
  const paces = []
  for (let i = 0; i < days.length; i += 10) paces.push(`  ${days.slice(i, i + 10).map((d) => d.pace).join(', ')},`)
  writeFileSync(
    API,
    `// Written by the site's scripts/sling-daily.mjs from its src/games/sling/dailyPlan.ts: each planned day's
// blue blip (its climb up the day's tower), in milliseconds, from the first day on. Sling's ticket ladder goes
// by it (ticketLadders.ts), and so does the fastest run a day's board believes (trackLaps.ts), whatever the
// site sends. Past the last planned day the days come round again, as the site's dailyTower has them. Don't
// edit it by hand: the script writes it again whenever the plan changes.
export const SLING_FIRST_DAY = '${FIRST_DAY}'

export const SLING_PACE_MS: readonly number[] = [
${paces.join('\n')}
]
`,
  )
}

const summary = (days) => {
  const times = days.map((d) => d.pace / 1000).sort((a, b) => a - b)
  const tries = days.filter((d) => d.a > 0).length
  return `${days.length} days planned (${tries} on a second try or later); pace ${times[0].toFixed(1)}–${times[times.length - 1].toFixed(1)} s, median ${times[Math.floor(times.length / 2)].toFixed(1)} s`
}

const [cmd = 'plan', arg, arg2] = process.argv.slice(2)
if (cmd === 'plan' || cmd === 'replan') {
  const want = Number((cmd === 'replan' ? arg2 : arg) ?? 180)
  const days = cmd === 'replan' ? readPlan().slice(0, Math.max(0, Number(arg) - 1)) : readPlan()
  const t0 = Date.now()
  for (let n = days.length + 1; n <= want; n++) {
    const { tower, attempt, pace } = firstGoodTower(n)
    // The route must fly the same climb again, step for step.
    const again = climbWith(tower, replayHands(pace.route))
    if (!again.finished || Math.abs(again.time - pace.time) > 1e-6) throw new Error(`#${n}: the blue blip's route doesn't climb the same again`)
    days.push({ a: attempt, name: tower.name, pace: Math.round(pace.time * 1000), route: pace.route })
    if (n % 10 === 0) console.log(`#${n} ${tower.name} (try ${attempt}) ${pace.time.toFixed(2)}s · ${((Date.now() - t0) / 1000).toFixed(0)} s so far`)
  }
  writePlan(days)
  console.log(summary(days))
  console.log(`wrote ${PLAN}\nwrote ${ROUTES}\nwrote ${API}`)
} else if (cmd === 'show') {
  const n = Number(arg)
  const day = readPlan()[n - 1]
  if (!day) throw new Error(`#${n} isn't planned`)
  const tower = plannedTower(n, day.a)
  const pace = paceRun(tower)
  console.log(`#${n} ${tower.name}: ${tower.pegs.length} pegs, ${tower.height.toFixed(0)} up; ${tower.sections.map((s) => SECTION_NAMES[s.kind]).join(', ')}`)
  console.log(`  blue ${pace.time.toFixed(2)} s (planned ${(day.pace / 1000).toFixed(2)} s), splits ${pace.splits.map((s) => s.toFixed(1)).join(' ')}`)
} else {
  console.log('node scripts/sling-daily.mjs plan [days] | replan <n> [days] | show <n>')
}
