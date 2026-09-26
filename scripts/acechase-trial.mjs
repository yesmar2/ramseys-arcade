// Ace Chase: tune a hole on trial (src/games/acechase/trialHoles.ts) before it goes anywhere.
//
//   node scripts/acechase-trial.mjs short map [a0 a1 da p0 p1 dp]   where shots end, power down, angle across
//   node scripts/acechase-trial.mjs short line <angle> [p0 p1 dp]    one angle up a run of powers, in detail
//   node scripts/acechase-trial.mjs short check                      the bullseye windows, as the spot checker finds them
//   node scripts/acechase-trial.mjs short learn                      how many tries a player following the misses takes
//
// Any of the round's holes works too, as round:0, round:1 or round:2 (at each of its spots), to compare.
//
// The map marks each shot by how far along the hole it stopped, in tens of metres (0 to 9, + past 100),
// @ for a bullseye, o for the rings and x for lost. A hole a player can learn has broad blocks that climb
// as the power goes up; speckle means a shot is decided by some small touch on the way, which no amount
// of following the misses will find. `line` shows what touched the ball, where, and how hard.
//
// `learn` plays the hole as a thoughtful player would, from the game's opening dials (60, 0°) and a few
// others: after a miss it moves the power by the metres short or past and the angle by the metres left or
// right, each scaled by what its last change of that dial did to the ball, and after a post it tries the
// angle either side. A hole a player can learn by following the misses takes a handful of tries.
import { windowsFor } from './acechase-windows.mjs'

const physics = await import(new URL('../src/games/acechase/physics.ts', import.meta.url))
const { TEST_HOLES } = await import(new URL('../src/games/acechase/trialHoles.ts', import.meta.url))

const [key = 'short', mode = 'map', ...rest] = process.argv.slice(2)
const round = /^round:(\d)$/.exec(key)
const def = round ? physics.HOLE_DEFS[Number(round[1])] : TEST_HOLES[key]
if (!def) throw new Error(`no hole called ${key}: ${[...Object.keys(TEST_HOLES), 'round:0', 'round:1', 'round:2'].join(', ')}`)
const holes = def.spots.map((spot) => physics.makeHole(def, spot))
const hole = holes[0]
// The round's holes end in a lane running away from the tee: along is up it (−z), across is x.
const where = (x, z) => def.where?.(x, z) ?? { s: -z, d: x, part: undefined }
const num = (i, fallback) => (rest[i] === undefined ? fallback : Number(rest[i]))

/** How a miss lies from the target: metres past (+) or short (−) along the way, and right (+) or left (−). */
function missOf(h, r) {
  const at = where(r.x, r.z)
  const goal = where(h.target.x, h.target.z)
  // Off a post (the miss says so): the angle's what needs changing.
  const blocked = r.posts > 0
  return { along: at.s - goal.s, side: at.d - goal.d, blocked }
}

/** A player following the misses from (p, a): the tries to a bullseye, or Infinity after `cap`. */
function learn(h, p, a, cap = 30) {
  const step = (v, q) => Math.round(v / q) * q
  let last = null
  let aroundPosts = 0
  // Round the posts as a person would: a little either side, then further out.
  const turns = [1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 2, -2, 4, -4]
  for (let tries = 1; tries <= cap; tries++) {
    const r = physics.simulate(h, p, a)
    if (r.done === 'bull') return tries
    const m = missOf(h, r)
    if (m.blocked) {
      a = turns[aroundPosts++ % turns.length]
      last = null
      continue
    }
    // Each dial by the metres its miss says, at what its last change was worth: a metre a unit of power,
    // and half a metre the wrong way a degree, to begin with, until the ball says otherwise.
    let perPower = 1
    let perAngle = -0.5
    if (last && last.p !== p && Math.abs(m.along - last.along) > 0.05) perPower = (m.along - last.along) / (p - last.p)
    if (last && last.a !== a && Math.abs(m.side - last.side) > 0.02) perAngle = (m.side - last.side) / (a - last.a)
    if (!(perPower > 0.05 && perPower < 20)) perPower = 1
    if (!(Math.abs(perAngle) > 0.01 && Math.abs(perAngle) < 5)) perAngle = -0.5
    const next = {
      p: Math.max(5, Math.min(100, step(p - Math.max(-10, Math.min(10, m.along / perPower)), 0.5))),
      a: Math.max(-60, Math.min(60, step(a - Math.max(-3, Math.min(3, m.side / perAngle)), 0.1))),
    }
    last = { p, a, along: m.along, side: m.side }
    // A player nudges at least one notch when a miss says to.
    if (next.p === p && Math.abs(m.along) > 0.25) next.p += m.along < 0 ? 0.5 : -0.5
    p = next.p
    a = next.a
  }
  return Infinity
}

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
} else if (mode === 'learn') {
  const starts = [
    [60, 0],
    [40, 0],
    [80, 0],
    [60, 4],
    [60, -4],
    [50, 2],
    [70, -2],
    [45, 6],
  ]
  const all = []
  for (const h of holes) {
    const tries = starts.map(([p, a]) => learn(h, p, a))
    all.push(...tries)
    console.log(`target (${h.target.x.toFixed(1)}, ${h.target.z.toFixed(1)}): ${tries.map((t) => (t === Infinity ? '30+' : t)).join(' ')}`)
  }
  const sorted = [...all].sort((x, y) => x - y)
  const median = sorted[Math.floor(sorted.length / 2)]
  const stuck = all.filter((t) => t === Infinity).length
  console.log(`median ${median === Infinity ? '30+' : median} tries; ${stuck} of ${all.length} not there in 30`)
} else {
  throw new Error(`map, line, check or learn, not ${mode}`)
}
