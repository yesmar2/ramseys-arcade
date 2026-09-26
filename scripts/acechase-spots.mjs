// Ace Chase: which target spots have a way in, and how wide it is.
//
// For every candidate spot on a hole, every power and angle the dials can set is tried (a coarse pass to
// find where the bullseyes are, then every setting round them), and the settings that stop on the bull
// are grouped into windows. A spot is only worth offering if its best window is one a player can find by
// following the misses, not a lone fluke, and no wider than a hole should give away.
//
//   node scripts/acechase-spots.mjs            every hole's candidates
//   node scripts/acechase-spots.mjs 2          one hole (0-based)
//   node scripts/acechase-spots.mjs 1 --used   only the spots the game offers now
//
// Runs on every core but one. Node 23.6 or later, which runs the TypeScript physics as it is.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import os from 'node:os'

const PHYSICS = new URL('../src/games/acechase/physics.ts', import.meta.url)

/** Where each hole's target may go, before checking: a grid over the ground it could sit on. */
const CANDIDATES = [
  // Rolling Thunder: the straight at the end of the S.
  { xs: [-1.3, -0.85, -0.4, 0.05, 0.5], zs: [-11.6, -12.2, -12.8, -13.4], angles: [-6, 14] },
  // Canyon Leap: the plateau at the top of the climb.
  { xs: [-1.4, 0, 1.4], zs: [-13, -14.5, -16], lifts: [-0.35, 0, 0.35], angles: [-8, 8] },
  // Switchback: the last lane.
  { xs: [2.5, 2.9, 3.3], zs: [-12.2, -12.8, -13.4, -14, -14.6], angles: [-9, 3] },
]
const POWER = [30, 100]
const COARSE = { power: 1, angle: 0.3 }

if (isMainThread) {
  const args = process.argv.slice(2)
  const only = args.find((a) => /^\d+$/.test(a))
  const used = args.includes('--used')
  const physics = await import(PHYSICS)
  const jobs = []
  physics.HOLE_DEFS.forEach((def, hole) => {
    if (only !== undefined && Number(only) !== hole) return
    const c = CANDIDATES[hole]
    const spots = used
      ? def.spots
      : c.xs.flatMap((x) => c.zs.flatMap((z) => (c.lifts ?? [undefined]).map((lift) => (lift === undefined ? { x, z } : { x, z, lift }))))
    for (const spot of spots) jobs.push({ hole, spot, angles: c.angles })
  })
  const results = []
  const workers = Math.max(1, Math.min(jobs.length, os.cpus().length - 1))
  const t0 = Date.now()
  let next = 0
  await Promise.all(
    Array.from({ length: workers }, () =>
      new Promise((resolve, reject) => {
        const w = new Worker(new URL(import.meta.url), { workerData: { physics: PHYSICS.href } })
        const feed = () => {
          if (next >= jobs.length) {
            void w.terminate()
            resolve()
            return
          }
          w.postMessage(jobs[next++])
        }
        w.on('message', (r) => {
          results.push(r)
          process.stderr.write(`\r${results.length}/${jobs.length} spots, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
          feed()
        })
        w.on('error', reject)
        feed()
      }),
    ),
  )
  process.stderr.write('\n')
  results.sort((a, b) => a.hole - b.hole || (a.spot.lift ?? 0) - (b.spot.lift ?? 0) || b.spot.z - a.spot.z || a.spot.x - b.spot.x)
  let hole = -1
  for (const r of results) {
    if (r.hole !== hole) {
      hole = r.hole
      console.log(`\n${physics.HOLE_DEFS[hole].name}   spot: bull settings in all · best window (size, power, angle) · next`)
    }
    const [a, b] = r.windows
    const win = (w) => (w ? `${String(w.cells).padStart(4)} @ ${w.p0}–${w.p1}, ${w.a0.toFixed(1)}..${w.a1.toFixed(1)}°` : '   –')
    const lift = r.spot.lift === undefined ? '' : `, ${r.spot.lift >= 0 ? '+' : ''}${r.spot.lift.toFixed(2)}`
    console.log(`  (${r.spot.x.toFixed(2).padStart(5)}, ${r.spot.z.toFixed(1)}${lift})  ${String(r.cells).padStart(4)} · ${win(a)} · ${win(b)}`)
  }
} else {
  const physics = await import(workerData.physics)
  const { windowsFor } = await import('./acechase-windows.mjs')
  parentPort.on('message', ({ hole, spot, angles }) => {
    const h = physics.makeHole(physics.HOLE_DEFS[hole], spot)
    const found = windowsFor(physics.simulate, h, { power: POWER, angles, coarse: COARSE })
    parentPort.postMessage({ hole, spot, cells: found.cells, windows: found.windows })
  })
}
