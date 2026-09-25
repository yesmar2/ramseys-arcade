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
const FINE = { power: 0.5, angle: 0.1 }

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
  const { HOLE_DEFS, makeHole, simulate } = physics
  parentPort.on('message', ({ hole, spot, angles }) => {
    const h = makeHole(HOLE_DEFS[hole], spot)
    const bull = new Map()
    const key = (p, a) => `${p}|${a}`
    const tryShot = (p, a) => {
      const k = key(p, a)
      if (!bull.has(k)) bull.set(k, simulate(h, p, a).done === 'bull')
      return bull.get(k)
    }
    // Tenths of a degree as integers, so the grid never drifts.
    const A0 = Math.round(angles[0] * 10)
    const A1 = Math.round(angles[1] * 10)
    const hits = []
    for (let p = POWER[0]; p <= POWER[1]; p += COARSE.power)
      for (let a = A0; a <= A1; a += Math.round(COARSE.angle * 10)) if (tryShot(p, a / 10)) hits.push([p, a])
    // Every dial setting round each coarse hit, and on out from any fine hit until the window closes.
    const queue = []
    for (const [p, a] of hits)
      for (let dp = -2; dp <= 2; dp++) for (let da = -5; da <= 5; da++) queue.push([p + dp * FINE.power, a + da])
    const seen = new Set()
    while (queue.length) {
      const [p, a] = queue.pop()
      if (p < POWER[0] || p > POWER[1] || a < A0 || a > A1) continue
      const k = key(p, a / 10)
      if (seen.has(k)) continue
      seen.add(k)
      if (tryShot(p, a / 10)) {
        queue.push([p + FINE.power, a], [p - FINE.power, a], [p, a + 1], [p, a - 1])
      }
    }
    // Windows: bull settings that touch, a half of power or a tenth of a degree apart.
    const cells = [...seen].filter((k) => bull.get(k)).map((k) => k.split('|').map(Number))
    const at = new Map(cells.map(([p, a]) => [key(p, Math.round(a * 10)), [p, Math.round(a * 10)]]))
    const done = new Set()
    const windows = []
    for (const [k, start] of at) {
      if (done.has(k)) continue
      const stack = [start]
      done.add(k)
      const w = { cells: 0, p0: Infinity, p1: -Infinity, a0: Infinity, a1: -Infinity }
      while (stack.length) {
        const [p, a] = stack.pop()
        w.cells++
        w.p0 = Math.min(w.p0, p)
        w.p1 = Math.max(w.p1, p)
        w.a0 = Math.min(w.a0, a / 10)
        w.a1 = Math.max(w.a1, a / 10)
        for (const [q, b] of [
          [p + FINE.power, a],
          [p - FINE.power, a],
          [p, a + 1],
          [p, a - 1],
        ]) {
          const kk = key(q, b)
          if (at.has(kk) && !done.has(kk)) {
            done.add(kk)
            stack.push([q, b])
          }
        }
      }
      windows.push(w)
    }
    windows.sort((x, y) => y.cells - x.cells)
    parentPort.postMessage({ hole, spot, cells: cells.length, windows: windows.slice(0, 3) })
  })
}
