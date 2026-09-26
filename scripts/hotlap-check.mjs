// Hot Lap: measure the car and the track after any change to src/games/hotlap/sim.ts, before the medal
// times in lap.ts (gold 50, silver 53.5, bronze 58) are trusted again.
//
//   node scripts/hotlap-check.mjs
//
// What to expect (2026-09-26): the pace car, the ghost a new player chases, round in 53.36s with no time
// on the grass; a driver cornering at the very limit down the middle of the road in about 51.3s, which gold
// beats only by using the whole road; braking from 112 mph at 1.27 g, in 93 m; and a driver who never
// brakes some 14 seconds slower than the pace car (67.5s), the grass and the fence costing more than braking.
const sim = await import(new URL('../src/games/hotlap/sim.ts', import.meta.url))

const track = sim.buildTrack()
const fmt = (t) => (t == null ? 'no lap' : `${t.toFixed(2)}s`)

/** A lap by the driver who knows the way, cornering at `margin` of the tyres' grip. */
function lap(margin, brakes = true) {
  const drive = sim.botDriver(track, margin)
  const run = sim.newRun(track)
  let grass = 0
  while (!run.finished && run.time < 150) {
    const input = drive(run)
    sim.stepRun(run, brakes ? input : { ...input, brake: 0, throttle: 1 }, track)
    if (run.onGrass) grass += sim.STEP
  }
  return { time: run.lapTime, splits: run.splits, grass, cut: run.cut }
}

console.log(`track: ${track.length.toFixed(0)} m, ${track.gates} gates, straights A ${track.straights.A.toFixed(1)} m and B ${track.straights.B.toFixed(1)} m`)
const pace = sim.botLap(track)
console.log(`pace car (the first ghost): ${fmt(pace.time)}, sectors ${pace.splits.map((s) => s.toFixed(2)).join(' / ')}, ${pace.grass.toFixed(2)}s on the grass`)
for (const margin of [0.92, 0.97, 1.0]) {
  const l = lap(margin)
  console.log(`driver at ${margin} of the grip: ${fmt(l.time)}, ${l.grass.toFixed(2)}s on the grass${l.cut ? ', cut' : ''}`)
}
const flat = lap(0.86, false)
console.log(`never braking: ${fmt(flat.time)}${flat.cut ? ' (cut)' : ''}`)

// Braking in a straight line from 112 mph, on the first straight.
const run = sim.newRun(track)
run.u = 50
run.v = 50
let metres = 0
let steps = 0
while (run.u > 0.3 && steps < 10_000) {
  const x = run.x
  const y = run.y
  sim.stepRun(run, { steer: 0, throttle: 0, brake: 1 }, track)
  metres += Math.hypot(run.x - x, run.y - y)
  steps += 1
}
const seconds = steps * sim.STEP
console.log(`braking from 112 mph: ${metres.toFixed(0)} m in ${seconds.toFixed(2)}s, ${(50 / seconds / 9.81).toFixed(2)} g on average`)
