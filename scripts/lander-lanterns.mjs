// Lander's lanterns: where each planned cave's three hang (the look on test, src/games/lander/lanterns.ts).
//
//   node scripts/lander-lanterns.mjs            write src/games/lander/lanternPlan.ts for every cave in the plan
//   node scripts/lander-lanterns.mjs show <n>   say where cave #n's hang, without writing anything
//
// A lantern hangs from a roof, over the blue ship's line and out of its reach, and is lit by flying into the
// ring round it. Where they hang is worked out here, once, and written down, so they're in the same three
// places on every device: the same sums can come out a hair different in different browsers.
//
// Run it again whenever scripts/lander-daily.mjs has planned more caves or laid any again: each cave's line
// starts with how many nodes the cave had, and the game ignores a line whose cave has changed (it works them
// out itself until this is run).
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DAILY_CAVES } from '../src/games/lander/dailyPlan.ts'
import { layLanterns, LIGHT_REACH } from '../src/games/lander/lanterns.ts'
import { plannedCave } from '../src/games/lander/sim.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src/games/lander/lanternPlan.ts')

/** How near the blue ship's own line comes to a lantern: it must stay out of the ring. */
function lineGap(cave, lantern) {
  const R = cave.route
  let best = Infinity
  for (let q = 0; q < R.n; q++) best = Math.min(best, Math.hypot(R.X[q] - lantern.x, R.Y[q] - lantern.y))
  return best
}

const caveOf = (n) => {
  const entry = DAILY_CAVES[n - 1]
  return plannedCave(n, entry.a, entry.t)
}

if (process.argv[2] === 'show') {
  const n = Number(process.argv[3])
  const cave = caveOf(n)
  console.log(`#${n} ${cave.name}: ${cave.nodes.length} nodes, ${Math.round(cave.length)} m`)
  for (const l of layLanterns(cave)) {
    const hung = l.ax === l.x ? `on ${(l.ay - l.y).toFixed(2)} m of chain from the roof` : `on a rope from the wall ${Math.abs(l.ax - l.x).toFixed(2)} m off`
    console.log(`  at ${l.x}, ${l.y}  ${hung}  blue line ${lineGap(cave, l).toFixed(2)} m off`)
  }
  process.exit(0)
}

const lines = []
const short = []
let nearest = Infinity
let fromWalls = 0
for (let n = 1; n <= DAILY_CAVES.length; n++) {
  const cave = caveOf(n)
  const lanterns = layLanterns(cave)
  if (lanterns.length < 3) short.push(`#${n} ${cave.name}: ${lanterns.length}`)
  for (const l of lanterns) {
    nearest = Math.min(nearest, lineGap(cave, l))
    if (l.ax !== l.x) fromWalls++
  }
  lines.push(`  [${[cave.nodes.length, ...lanterns.flatMap((l) => [l.x, l.y, l.ax, l.ay])].join(', ')}],`)
}

writeFileSync(
  OUT,
  `/*
 * Each planned cave's three lanterns, written by scripts/lander-lanterns.mjs: don't edit by hand.
 * A line is the cave's count of nodes when it was planned, then for each lantern where it hangs (x, y) and
 * where on the rock its chain is made fast (x, y).
 */
export const LANTERN_PLAN: readonly (readonly number[])[] = [
${lines.join('\n')}
]
`,
)
console.log(`${lines.length} caves written to ${OUT}; ${fromWalls} lanterns hang from a wall, the rest from a roof`)
console.log(short.length ? `Fewer than three lanterns:\n  ${short.join('\n  ')}` : 'Every cave has its three.')
console.log(`The blue ship's line comes no nearer a lantern than ${nearest.toFixed(2)} m (the ring is ${LIGHT_REACH} m).`)
