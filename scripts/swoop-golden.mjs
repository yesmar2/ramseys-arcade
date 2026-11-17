// Swoop's golden birds: which three hills of each planned day one sits on (the look on test, src/games/swoop/golden.ts).
//
//   node scripts/swoop-golden.mjs          write src/games/swoop/goldenPlan.ts for every day in the plan
//   node scripts/swoop-golden.mjs show <n>  say which hills day #n gets, and how often each kind of player catches them
//
// A golden bird is caught by one clean landing on its hill, so each sits on a downhill where good players do land
// clean: every day's hills are flown here by two kinds of good player, five times each, and in each third of the
// way the downhill with the most clean landings gets a bird. That's worked out here, once, and written down,
// because the same flight comes out a hair different in different browsers, and the birds have to be on the same
// hills for everyone.
//
// Run it again whenever scripts/swoop-daily.mjs has planned more days or laid any again: each day's line ends in
// how many tops its hills had, and the game ignores a line whose hills have changed (it picks by the hills' shape
// until this is run).
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DAILY_HILLS } from '../src/games/swoop/dailyPlan.ts'
import { makePerson, newBird, plannedHills, step } from '../src/games/swoop/sim.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src/games/swoop/goldenPlan.ts')

/** The players whose clean landings choose the hills: a good one and a very good one (the autopilot's hands). */
const CHOOSERS = [
  { lag: 0.18, look: 0.15, air: 0.9, jitter: 0.05 },
  { lag: 0.14, look: 0.16, air: 1, jitter: 0.03 },
]
const SEEDS = [5, 7, 13, 17, 23]
/** The thirds of the way a bird is chosen in, as shares of the way to the line. */
const THIRDS = [
  [0.08, 0.38],
  [0.38, 0.68],
  [0.68, 0.98],
]

/** The downhill a spot is on, as the index of its top; -1 on a climb. */
function downhillAt(h, x) {
  for (let i = 0; i + 1 < h.xs.length; i++) {
    if (x >= h.xs[i] && x < h.xs[i + 1]) return h.ys[i] > h.ys[i + 1] ? i : -1
  }
  return -1
}

/** The downhills a player lands clean on, flying these hills. */
function cleanHills(hills, style, seed) {
  const b = newBird(hills)
  const hands = makePerson(hills, { ...style, seed })
  const found = []
  while (!b.done && b.t < 300) {
    if (step(hills, b, hands(b)) === 'clean') found.push(downhillAt(hills, b.x))
  }
  return found
}

function choose(hills) {
  const tally = new Map()
  for (const style of CHOOSERS) {
    for (const seed of SEEDS) {
      for (const hill of cleanHills(hills, style, seed)) if (hill >= 0) tally.set(hill, (tally.get(hill) ?? 0) + 1)
    }
  }
  return THIRDS.map(([from, to]) => {
    let best = -1
    let most = 0
    for (const [hill, count] of [...tally].sort((a, b) => a[0] - b[0])) {
      const at = hills.xs[hill] / hills.finish
      if (at >= from && at < to && count > most) {
        most = count
        best = hill
      }
    }
    return best
  })
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'show') {
  const n = Number(arg)
  const entry = DAILY_HILLS[n - 1]
  if (!entry) throw new Error(`No day #${arg} in the plan`)
  const hills = plannedHills(n, entry.a)
  const picks = choose(hills)
  console.log(`#${n} ${entry.name}: golden birds on the downhills from tops ${picks.join(', ')} (at ${picks.map((p) => (p < 0 ? '-' : Math.round((hills.xs[p] / hills.finish) * 100) + '%')).join(', ')} of the way)`)
  for (const [name, style] of [
    ['new', { lag: 0.3, look: 0.12, air: 0.5, jitter: 0.1 }],
    ['getting it', { lag: 0.24, look: 0.14, air: 0.7, jitter: 0.08 }],
    ['good', CHOOSERS[0]],
    ['very good', CHOOSERS[1]],
  ]) {
    const caught = [3, 11, 29, 31, 37].map((seed) => {
      const clean = new Set(cleanHills(hills, style, seed))
      return picks.filter((p) => clean.has(p)).length
    })
    console.log(`  ${name}: ${caught.join(' ')} of 3 over five runs`)
  }
} else {
  const lines = []
  let none = 0
  DAILY_HILLS.forEach((entry, i) => {
    const hills = plannedHills(i + 1, entry.a)
    const picks = choose(hills)
    none += picks.filter((p) => p < 0).length
    lines.push(`  [${picks.join(', ')}, ${hills.tops}],`)
    if ((i + 1) % 30 === 0) console.log(`  #${i + 1}`)
  })
  writeFileSync(
    OUT,
    `// Written by scripts/swoop-golden.mjs: for each planned day (dailyPlan.ts, in its order), the three hills a golden
// bird sits on, one in each third of the way, and how many tops the day's hills had when they were chosen. A hill
// is the index of its top in the hills' own list (sim.ts Hills.xs), its downhill running on from there; -1 for a
// third with no hill to choose. Don't edit it by hand: run the script again when the plan changes.

export const GOLDEN_HILLS: readonly (readonly [number, number, number, number])[] = [
${lines.join('\n')}
]
`,
  )
  console.log(`Wrote ${DAILY_HILLS.length} days to ${OUT}${none ? ` (${none} thirds with no hill)` : ''}`)
}
