// Ace Chase: check Today's Hole ahead of time, and keep the checked choices in src/games/acechase/dailyPlan.ts.
//
// Each day starts from its planned kind and place (daily.ts plannedPick). The generator's first try at
// it is played at every power and angle (acechase-windows.mjs); if it has no window a player can find by
// following the misses, or gives one away, the generator's next try is played, and so on; a kind that
// won't come right in TRIES tries gives way to the next kind, in the same place.
//
//   node scripts/acechase-daily.mjs plan [days=120]          plan from the first day, write dailyPlan.ts
//   node scripts/acechase-daily.mjs explore [each=3]          try every kind in every place, and say how they did
//   node scripts/acechase-daily.mjs show YYYY-MM-DD           one day's hole, as planned, and its windows
//
// --report=<file> also writes what each day's check found, as JSON. Runs on every core but one. Node 23.6+.
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import fs from 'node:fs'
import os from 'node:os'

const PHYSICS = new URL('../src/games/acechase/physics.ts', import.meta.url)
const DAILY = new URL('../src/games/acechase/daily.ts', import.meta.url)
const PLAN = new URL('../src/games/acechase/dailyPlan.ts', import.meta.url)

/**
 * What a day's hole has to be. A player finds a window by closing in on the power (the misses say short
 * or long) and on the angle (left or right), so what makes a hole hard is how narrow its window is in
 * power; how wide it is in angle matters less.
 */
const GOOD = {
  /** Its best window, in dial settings: at least this many, so following the misses finds it. */
  minWindow: 20,
  /** No more than this much power wide, or finding the power is no search at all. */
  maxPowerSpan: 4.5,
  /** All its bull settings together: no more than this, so it isn't given away. */
  maxCells: 900,
  /** The best window sits inside these powers: not at a dead stop, not flat out. */
  powers: [8, 99],
}
/** How many of the generator's tries a kind gets before the next kind is tried instead. */
const TRIES = 8
const SEARCH = { power: [5, 100], angles: [-22, 22], coarse: { power: 1, angle: 0.6 } }

function judge(found) {
  const best = found.windows[0]
  if (!best) return 'no way in'
  if (best.cells < GOOD.minWindow) return `best window only ${best.cells}`
  if (best.p1 - best.p0 > GOOD.maxPowerSpan) return `window ${best.p1 - best.p0} power wide`
  if (found.cells > GOOD.maxCells) return `${found.cells} bull settings, too many`
  if (best.p0 < GOOD.powers[0] || best.p1 > GOOD.powers[1]) return `window at ${best.p0}–${best.p1}`
  return null
}

const dayOf = (epoch, n) => {
  const [y, m, d] = epoch.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + (n - 1) * 86_400_000).toISOString().slice(0, 10)
}

const win = (w) => (w ? `${w.cells} @ ${w.p0}–${w.p1}, ${w.a0.toFixed(1)}..${w.a1.toFixed(1)}°` : '–')

if (isMainThread) {
  const args = process.argv.slice(2)
  const mode = args[0] ?? 'plan'
  const report = args.find((a) => a.startsWith('--report='))?.slice(9)
  const daily = await import(DAILY)
  const workers = Math.max(1, os.cpus().length - 1)
  const t0 = Date.now()

  /** A pool: jobs in, results out, as fast as the cores go. */
  function pool(onResult) {
    const queue = []
    const idle = []
    let busy = 0
    let finish
    const done = new Promise((r) => (finish = r))
    const all = Array.from({ length: workers }, () => {
      const w = new Worker(new URL(import.meta.url))
      w.on('message', (res) => {
        busy--
        onResult(res, add)
        feed(w)
      })
      w.on('error', (e) => {
        console.error(e)
        process.exit(1)
      })
      idle.push(w)
      return w
    })
    function feed(w) {
      const job = queue.shift()
      if (job) {
        busy++
        w.postMessage(job)
      } else {
        idle.push(w)
        if (busy === 0 && queue.length === 0) {
          for (const x of all) void x.terminate()
          finish()
        }
      }
    }
    function add(job) {
      queue.push(job)
      const w = idle.pop()
      if (w) feed(w)
    }
    return { add, done }
  }

  if (mode === 'explore') {
    const each = Number(args[1] ?? 3)
    const rows = []
    const p = pool((res) => {
      rows.push(res)
      process.stderr.write(`\r${rows.length} holes, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    })
    let i = 0
    for (const family of daily.FAMILIES)
      for (const style of daily.STYLES)
        for (let k = 0; k < each; k++) p.add({ day: dayOf('2030-01-01', ++i), pick: { family, style, k } })
    await p.done
    process.stderr.write('\n')
    rows.sort((a, b) => a.pick.family.localeCompare(b.pick.family) || a.pick.style.localeCompare(b.pick.style))
    for (const r of rows) {
      const verdict = judge(r.found)
      console.log(`${r.pick.family.padEnd(10)} ${r.pick.style.padEnd(6)} ${r.name.padEnd(22)} ${String(r.found.cells).padStart(4)} · ${win(r.found.windows[0])} · ${verdict ?? 'GOOD'}  (${r.secs}s)`)
    }
  } else if (mode === 'show') {
    const day = args[1]
    const n = daily.dailyNumber(day)
    const plan = (await import(PLAN)).DAILY_PLAN
    const choice = plan[n - 1] ?? { ...daily.plannedPick(n), k: 0 }
    const p = pool((res) => {
      console.log(`#${n} ${day} ${res.pick.family} ${res.pick.style} k${res.pick.k} · ${res.name}`)
      console.log(`  ${res.found.cells} bull settings · best ${win(res.found.windows[0])} · next ${win(res.found.windows[1])}`)
      console.log(`  a way in: power ${res.found.windows[0]?.sample[0]}, angle ${res.found.windows[0]?.sample[1]}`)
      console.log(`  ${judge(res.found) ?? 'GOOD'}`)
    })
    p.add({ day, pick: choice })
    await p.done
  } else {
    const days = Number(args[1] ?? 120)
    const plan = []
    const found = []
    let settled = 0
    const p = pool((res, add) => {
      const n = res.n
      const verdict = judge(res.found)
      if (!verdict) {
        plan[n - 1] = res.pick
        found[n - 1] = res
        settled++
      } else {
        // The next try at this kind, or after enough of those, the next kind in the same place.
        let { family, style, k } = res.pick
        k++
        if (k % TRIES === 0) {
          const kinds = daily.kindsFor(style)
          family = kinds[(kinds.indexOf(family) + 1) % kinds.length]
        }
        if (k >= TRIES * daily.kindsFor(style).length) {
          console.error(`\n#${n} found nothing good`)
          process.exit(1)
        }
        add({ n, day: res.day, pick: { family, style, k } })
      }
      process.stderr.write(`\r${settled}/${days} days, ${((Date.now() - t0) / 1000).toFixed(0)}s   `)
    })
    for (let n = 1; n <= days; n++) p.add({ n, day: dayOf(daily.DAILY_EPOCH, n), pick: { ...daily.plannedPick(n), k: 0 } })
    await p.done
    process.stderr.write('\n')
    const lines = plan.map((c, i) => {
      const r = found[i]
      const w = r.found.windows[0]
      return `  { family: '${c.family}', style: '${c.style}', k: ${c.k} }, // #${i + 1} ${r.day} ${r.name}: ${r.found.cells} in all, best ${w.cells} at ${w.p0}–${w.p1}, ${w.a0.toFixed(1)}..${w.a1.toFixed(1)}°`
    })
    const text = `// Written by scripts/acechase-daily.mjs: each day's hole for Today's Hole, from its first day, checked to
// have a way in a player can find and not to give it away. Rerun the script rather than editing by hand.
import type { DailyPick } from './daily.ts'

export const DAILY_PLAN: readonly DailyPick[] = [
${lines.join('\n')}
]
`
    fs.writeFileSync(PLAN, text)
    console.log(`wrote ${plan.length} days to ${PLAN.pathname}`)
    if (report) fs.writeFileSync(report, JSON.stringify(found.map((r) => ({ n: r.n, day: r.day, pick: r.pick, name: r.name, note: r.note, found: r.found })), null, 1))
  }
} else {
  const physics = await import(PHYSICS)
  const daily = await import(DAILY)
  const { windowsFor } = await import('./acechase-windows.mjs')
  parentPort.on('message', (job) => {
    const t = Date.now()
    const def = daily.dailyHoleDef(job.pick, job.day)
    const hole = physics.makeHole(def, def.spots[0])
    const found = windowsFor(physics.simulate, hole, SEARCH)
    parentPort.postMessage({ ...job, name: def.name, note: def.note, found, secs: Math.round((Date.now() - t) / 1000) })
  })
}
