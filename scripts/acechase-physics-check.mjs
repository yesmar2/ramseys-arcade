// Ace Chase: is the ball's physics right? Checks the game's own step() against the textbook for a solid
// ball rolling without slipping on a green with a steady rolling drag: by formula where there is one, and
// by integrating the same equations another way (RK4) where there isn't.
//
//   node scripts/acechase-physics-check.mjs
//
// What to expect: a roll on the flat and up a slope within half a percent of the formula; a tap stays on
// 9% and rolls back off 11% (the most it rests on is 1.4 × the drag, 9.8%); the break across a tilt
// within a couple of centimetres of RK4, turning (5/7)·g·slope·cosψ / speed² a metre, so more as it slows; off
// a rail at the angle the formula gives; and over a hill, energy only ever going down, all of it to drag.
const P = await import(new URL('../src/games/acechase/physics.ts', import.meta.url))
const { TEST_HOLES } = await import(new URL('../src/games/acechase/trialHoles.ts', import.meta.url))
const g = P.G
const mu = P.FRICTION
const big = [[-200, 200], [200, 200], [200, -200], [-200, -200]]
const holeOf = (height, extra = {}) => P.makeHole({ name: 't', note: '', green: big, tee: { x: 0, z: 0 }, height, spots: [{ x: 0, z: -1000 }], laid: true, ...extra }, { x: 0, z: -1000 })
const run = (h, power, angle, each) => {
  const b = P.launch(h, power, angle)
  while (!b.done) { P.step(h, b); each?.(b) }
  return b
}
const pct = (a, b) => `${(((a - b) / b) * 100).toFixed(2)}%`
const say = (s) => console.log(s)

// 1. Flat: stops at v²/(2μg), after v/(μg) seconds.
{
  const h = holeOf(() => 0)
  for (const power of [30, 60, 90]) {
    const b = run(h, power, 0)
    const v = (P.MAX_SPEED * power) / 100
    const d = -b.z
    say(`flat, power ${power}: rolled ${d.toFixed(2)} m in ${b.t.toFixed(2)} s; formula ${(v * v / (2 * mu * g)).toFixed(2)} m in ${(v / (mu * g)).toFixed(2)} s (${pct(d, v * v / (2 * mu * g))})`)
  }
}
// 2. Straight up a 5% slope: slows at (5/7)g·sinθ + μg·cosθ.
{
  const k = 0.05
  const h = holeOf((_x, z) => -k * z)
  const th = Math.atan(k)
  const a = (5 / 7) * g * Math.sin(th) + mu * g * Math.cos(th)
  const b = run(h, 60, 0)
  const v = P.MAX_SPEED * 0.6
  const along = -b.z / Math.cos(th)
  say(`up a 5% slope, power 60: rolled ${along.toFixed(2)} m up it; formula ${(v * v / (2 * a)).toFixed(2)} m (${pct(along, v * v / (2 * a))})`)
}
// 3. Where a ball can rest: on 9% it stays, on 11% it rolls back down.
for (const k of [0.09, 0.11]) {
  const h = holeOf((_x, z) => -k * z)
  const b = run(h, 2, 0)
  say(`a tap up a ${Math.round(k * 100)}% slope: ended ${(-b.z).toFixed(2)} m up it (${b.z > 0 ? 'rolled back down past the tee' : 'stayed'})`)
}
// 4. The break across a 3.5% tilt, against the same equations integrated independently (RK4).
{
  const k = 0.035
  const h = holeOf((x) => k * x)
  const path = []
  const b = run(h, 55, 0, (s) => path.push([s.x, s.z, Math.hypot(s.vx, s.vz), Math.abs(s.vz) / Math.hypot(s.vx, s.vz)]))
  // dv/dt = (5/7) g (−∇h)·(tangent) − μ g cosθ v̂, on the plane h = kx.
  const n = [-k, 1, 0].map((c) => c / Math.hypot(k, 1))
  const acc = (vx, vy, vz) => {
    const sp = Math.hypot(vx, vy, vz) || 1e-12
    const gx = (5 / 7) * g * n[1] * n[0], gy = (5 / 7) * (-g + g * n[1] * n[1]), gz = 0
    const hold = mu * g * n[1]
    return [gx - (hold * vx) / sp, gy - (hold * vy) / sp, gz - (hold * vz) / sp]
  }
  let s = [0, 0, 0, 0, 0, -P.MAX_SPEED * 0.55] // x y z vx vy vz
  // Start along the plane: the launch is level, so take its speed along the slope's direction of travel.
  const dt = 1 / 2000
  for (let i = 0; i < 400000; i++) {
    const f = (q) => { const [ax, ay, az] = acc(q[3], q[4], q[5]); return [q[3], q[4], q[5], ax, ay, az] }
    const k1 = f(s), k2 = f(s.map((q, j) => q + (dt / 2) * k1[j])), k3 = f(s.map((q, j) => q + (dt / 2) * k2[j])), k4 = f(s.map((q, j) => q + dt * k3[j]))
    const next = s.map((q, j) => q + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]))
    // keep it on the plane
    const vn = next[3] * n[0] + next[4] * n[1] + next[5] * n[2]
    next[3] -= vn * n[0]; next[4] -= vn * n[1]; next[5] -= vn * n[2]
    if (Math.hypot(next[3], next[4], next[5]) < 0.012) { s = next; break }
    s = next
  }
  say(`across a 3.5% tilt, power 55: game ends at (${b.x.toFixed(2)}, ${b.z.toFixed(2)}), RK4 of the same equations at (${s[0].toFixed(2)}, ${s[2].toFixed(2)}); off by ${Math.hypot(b.x - s[0], b.z - s[2]).toFixed(3)} m`)
  // How the curve tightens as it slows: its turn per metre at each third of the roll.
  const turn = (i) => { const [x0, z0] = path[i - 12], [x1, z1] = path[i], [x2, z2] = path[i + 12]; const a1 = Math.atan2(x1 - x0, z0 - z1), a2 = Math.atan2(x2 - x1, z1 - z2); return ((a2 - a1) * 180) / Math.PI / Math.hypot(x2 - x1, z2 - z1) }
  const at = [0.25, 0.5, 0.75].map((q) => Math.floor(path.length * q))
  say(`  its turn per metre: ${at.map((i) => `${Math.abs(turn(i)).toFixed(2)}° at ${path[i][2].toFixed(1)} m/s`).join(', ')}; theory (5/7)gk·cosψ/v² → ${at.map((i) => `${(((5 / 7) * g * k * path[i][3]) / path[i][2] ** 2 * 180 / Math.PI).toFixed(2)}°`).join(', ')} (ψ, how far it has turned downhill)`)
}
// 5. Off a wall: the part of the speed into the wall comes back times e, the part along it stays.
{
  const walls = [{ ax: -50, az: -5, bx: 50, bz: -5 }]
  for (const [e, rubber] of [[undefined, false], [0.9, true]]) {
    const h = holeOf(() => 0, { walls: [{ ...walls[0], ...(e ? { e, rubber } : {}) }] })
    let before = null, after = null
    const b = P.launch(h, 40, 30)
    while (!b.done) {
      const vx = b.vx, vz = b.vz
      P.step(h, b)
      if (Math.sign(b.vz) !== Math.sign(vz) && !after) { before = [vx, vz]; after = [b.vx, b.vz] }
    }
    const inAng = (Math.atan2(Math.abs(before[0]), Math.abs(before[1])) * 180) / Math.PI
    const outAng = (Math.atan2(Math.abs(after[0]), Math.abs(after[1])) * 180) / Math.PI
    const ee = e ?? P.WALL_E
    const want = (Math.atan(Math.tan((inAng * Math.PI) / 180) / ee) * 180) / Math.PI
    say(`off a ${rubber ? 'rubber (e 0.9)' : 'timber rail (e 0.62)'} at ${inAng.toFixed(1)}° from square: came off at ${outAng.toFixed(1)}°; formula ${want.toFixed(1)}°; speed into it ${Math.abs(before[1]).toFixed(2)} → back out ${Math.abs(after[1]).toFixed(2)} m/s (×${(Math.abs(after[1]) / Math.abs(before[1])).toFixed(3)})`)
  }
}
// 6. Over Bumps and Banks' hill: the model's energy (½v² + (5/7)g·h, per unit mass) only ever goes down,
// and exactly as fast as the drag takes it.
{
  const def = TEST_HOLES.green
  const h = P.makeHole(def, def.spots[0])
  const b = P.launch(h, 62, 0)
  let E0 = null, worstRise = 0, drag = 0, prev = null, steps = 0
  while (!b.done && !b.air) {
    const E = 0.5 * (b.vx ** 2 + b.vy ** 2 + b.vz ** 2) + (5 / 7) * g * h.height(b.x, b.z)
    if (E0 === null) E0 = E
    if (prev !== null) { worstRise = Math.max(worstRise, E - prev.E); drag += h.mu * g * prev.sp * P.DT * prev.ny }
    const ny = (() => { const [gx, gz] = P.slope(h, b.x, b.z); return 1 / Math.hypot(gx, 1, gz) })()
    prev = { E, sp: Math.hypot(b.vx, b.vy, b.vz), ny }
    const copy = { ...b }
    P.step(h, copy) // dry run: does this step meet anything?
    if (copy.hits !== b.hits || copy.air) { drag -= h.mu * g * prev.sp * P.DT * prev.ny; break }
    P.step(h, b)
    steps++
  }
  const E1 = prev.E
  say(`over the hill, power 62 (${(steps / 240).toFixed(1)} s): energy ${E0.toFixed(3)} → ${E1.toFixed(3)}, the drag accounts for ${drag.toFixed(3)} of the ${(E0 - E1).toFixed(3)} lost; the most it ever rose in a step: ${worstRise.toExponential(1)}`)
}
// 7. The same putt twice is the same putt.
{
  const def = TEST_HOLES.green
  const h = P.makeHole(def, def.spots[3])
  const a = P.simulate(h, 61.5, 9.3)
  const b = P.simulate(h, 61.5, 9.3)
  say(`the same putt twice: ${a.x === b.x && a.z === b.z && a.t === b.t ? 'identical, to the last digit' : 'DIFFERENT'}`)
}
