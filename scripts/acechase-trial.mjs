// Ace Chase: tune a hole on trial (src/games/acechase/longWay.ts, TEST_HOLES) before it goes anywhere.
//
//   node scripts/acechase-trial.mjs long map [a0 a1 da p0 p1 dp]   where shots end, power down, angle across
//   node scripts/acechase-trial.mjs long line <angle> [p0 p1 dp]    one angle up a run of powers, in detail
//   node scripts/acechase-trial.mjs long check                      the bullseye windows, as the spot checker finds them
//
// The map marks each shot by how far along the hole it stopped, in tens of metres (0 to 9, + past 100),
// @ for a bullseye, o for the rings and x for lost. A hole a player can learn has broad blocks that climb
// as the power goes up; speckle means a shot is decided by some small touch on the way, which no amount
// of following the misses will find. `line` shows what touched the ball, where, and how hard.
import { windowsFor } from './acechase-windows.mjs'

const physics = await import(new URL('../src/games/acechase/physics.ts', import.meta.url))
const { TEST_HOLES } = await import(new URL('../src/games/acechase/longWay.ts', import.meta.url))

const [key = 'long', mode = 'map', ...rest] = process.argv.slice(2)
const def = TEST_HOLES[key]
if (!def) throw new Error(`no hole on trial called ${key}: ${Object.keys(TEST_HOLES).join(', ')}`)
const hole = physics.makeHole(def, def.spots[0])
const where = (x, z) => def.where?.(x, z) ?? { s: 0, d: 0, part: '?' }
const num = (i, fallback) => (rest[i] === undefined ? fallback : Number(rest[i]))

if (mode === 'map') {
  const [a0, a1, da, p0, p1, dp] = [num(0, -12), num(1, 12), num(2, 1), num(3, 20), num(4, 100), num(5, 2)]
  let head = '      '
  for (let a = a0; a <= a1 + 1e-9; a += da) head += Math.abs(a % 5) < 1e-9 ? '|' : ' '
  console.log(head)
  let bulls = 0
  for (let p = p0; p <= p1 + 1e-9; p += dp) {
    let row = String(p).padStart(5) + ' '
    for (let a = a0; a <= a1 + 1e-9; a += da) {
      const r = physics.simulate(hole, p, a)
      if (r.done === 'bull') bulls++
      const tens = Math.floor(where(r.x, r.z).s / 10)
      row += r.done === 'bull' ? '@' : r.miss < physics.RINGS[2] ? 'o' : r.done === 'splash' || r.done === 'out' ? 'x' : tens > 9 ? '+' : String(Math.max(0, tens))
    }
    console.log(row)
  }
  console.log(`${bulls} bullseyes`)
} else if (mode === 'line') {
  const a = num(0, 0)
  const [p0, p1, dp] = [num(1, 30), num(2, 70), num(3, 1)]
  for (let p = p0; p <= p1 + 1e-9; p += dp) {
    const b = physics.launch(hole, p, a)
    const touches = []
    while (!b.done) {
      const before = { vx: b.vx, vz: b.vz }
      physics.step(hole, b)
      // A touch: the ball's pace or line changed more in a step than the ground alone changes it.
      const dv = Math.hypot(b.vx - before.vx, b.vz - before.vz)
      if (dv > 0.05) touches.push(`${(where(b.x, b.z).part ?? '?').replace(/^the /, '')}@${where(b.x, b.z).s.toFixed(0)} ${dv.toFixed(2)}`)
    }
    const end = where(b.x, b.z)
    const miss = Math.hypot(b.x - hole.target.x, b.z - hole.target.z)
    console.log(
      `p ${String(p).padStart(5)}  ${b.done.padEnd(5)} ${String(end.part).padEnd(20)} s ${end.s.toFixed(1).padStart(6)}  miss ${miss.toFixed(2).padStart(6)}  ${b.t.toFixed(1)}s  ${touches.join(', ')}`,
    )
  }
} else if (mode === 'check') {
  const t0 = Date.now()
  const r = windowsFor(physics.simulate, hole, { power: [num(0, 30), num(1, 80)], angles: [num(2, -12), num(3, 12)], coarse: { power: 1, angle: 0.3 } })
  console.log(JSON.stringify({ cells: r.cells, windows: r.windows, secs: Math.round((Date.now() - t0) / 1000) }, null, 1))
} else {
  throw new Error(`map, line or check, not ${mode}`)
}
