// Ace Chase: check Today's Hole ahead of time, and keep the checked choices in src/games/acechase/dailyPlan.ts.
//
// Each day starts from its planned kind and place (daily.ts plannedPick). The generator's first green is
// played at every power and angle the dials can make (acechase-windows.mjs); if its target has no window a
// player can find by following the misses, or gives one away, or isn't about as hard as the rest, the
// generator's next green is played, and so on; after TRIES greens a place gives way to the garden, and
// after TRIES more the kind gives way to another, never the one planned for the day before or after.
//
//   node scripts/acechase-daily.mjs plan [days=180]          plan the days after those already planned, up to `days`
//   node scripts/acechase-daily.mjs plan --days=36,97         plan just those days afresh (before launch only)
//   node scripts/acechase-daily.mjs plan [days] --fresh       plan every day afresh (before launch only)
//   node scripts/acechase-daily.mjs explore [each=4] [place]  try every kind (in every place, or one), and say how they did
//   node scripts/acechase-daily.mjs show YYYY-MM-DD           one day's hole, as planned, and its windows
//
// Once Today's Hole is live, a day already planned may have been played, so only ever add days after the
// last; `plan` does that unless told otherwise.
//
// What each day's check found goes in src/games/acechase/dailyChecks.ts beside the plan, for the admin's
// Hole Book: how many bull settings in all, and its widest windows with a setting in each. Runs on every
// core but one. Node 23.6+.
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import fs from 'node:fs'
import os from 'node:os'

const PHYSICS = new URL('../src/games/acechase/physics.ts', import.meta.url)
const DAILY = new URL('../src/games/acechase/daily.ts', import.meta.url)
const PLAN = new URL('../src/games/acechase/dailyPlan.ts', import.meta.url)
const CHECKS = new URL('../src/games/acechase/dailyChecks.ts', import.meta.url)

/**
 * What a day's hole has to be. A player finds a window by closing in on the power (the misses say short
 * or long) and on the angle (left or right), so what makes a hole hard is how narrow its window is in
 * power; how wide it is in angle matters less. Bumps and Banks (./bumpsBanks), the green these are
 * modelled on, has best windows of 7 to 37 settings and 15 to 56 in all.
 */
const GOOD = {
  /** Its best window, in dial settings: at least this many, so following the misses finds it, and no
   * more than the most, so it takes finding. A narrow band, so every day is about as hard. */
  minWindow: 12,
  maxWindow: 40,
  /** No more than this much power wide, or finding the power is no search at all. */
  maxPowerSpan: 3,
  /** All its bull settings together: no more than this, so it isn't given away. */
  maxCells: 100,
  /** The best window sits inside these powers, not a slam at the top of the dial. */
  powers: [22, 88],
}
/** How many of the generator's greens a kind gets in a place before the garden, and then another kind, is tried. */
const TRIES = 8
/**
 * The whole dial: every angle it turns to (±60°, physics MAX_ANGLE), and every power from the least that
 * could reach the target (at 20 a ball rolls about 6 m on the rink, and no target is nearer the tee than 15 m).
 * Until 2026-09-27 the check stopped at ±45° and power 90, and missed ways in as wide as 500 settings.
 */
const SEARCH = { power: [20, 100], angles: [-60, 60], coarse: { power: 1, angle: 0.5 } }

function judge(found) {
  const best = found.windows[0]
  if (!best) return 'no way in'
  if (best.cells < GOOD.minWindow) return `best window only ${best.cells}`
  if (best.cells > GOOD.maxWindow) return `best window ${best.cells}, too wide`
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
  const daily = await import(DAILY)
  const workers = Math.max(1, os.cpus().length - 1)
  const t0 = Date.now()

  /** A pool: jobs in, results out, as fast as the cores go; a job `skip` says is no longer wanted isn't played. */
  function pool(onResult, skip = () => false) {
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
      let job = queue.shift()
      while (job && skip(job)) job = queue.shift()
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

  /**
   * The generator's next green of the kind in the place; after enough of those, in the garden; after
   * enough more, another kind: the next one round that isn't planned for the day before or after. Null
   * once every kind has had its turn.
   */
  function nextPick(n, pick) {
    let { kind, style, k } = pick
    k++
    if (k % TRIES === 0) {
      if (style !== 'garden') style = 'garden'
      else {
        const near = [n - 1, n + 1].filter((d) => d >= 1).map((d) => daily.plannedPick(d).kind)
        do kind = daily.KINDS[(daily.KINDS.indexOf(kind) + 1) % daily.KINDS.length]
        while (near.includes(kind))
      }
    }
    return k < TRIES * (daily.KINDS.length + 1) ? { kind, style, k } : null
  }

  function nothingGood(n) {
    console.error(`\n#${n} found nothing good`)
    process.exit(1)
  }

  /** The plan as it's written: each day's choice, and its line (comment and all) to keep as it is. */
  function writtenPlan() {
    const text = fs.existsSync(PLAN) ? fs.readFileSync(PLAN, 'utf8') : ''
    return [...text.matchAll(/^ {2}\{ kind: '(\w+)', style: '(\w+)', k: (\d+) \},.*$/gm)].map((m) => ({ line: m[0], pick: { kind: m[1], style: m[2], k: Number(m[3]) } }))
  }

  /** A day's line in dailyPlan.ts, with what its check found. */
  const lineFor = (r) => {
    const w = r.found.windows[0]
    return `  { kind: '${r.pick.kind}', style: '${r.pick.style}', k: ${r.pick.k} }, // #${r.n} ${r.day} ${r.name}: ${r.found.cells} in all, best ${w.cells} at ${w.p0}–${w.p1}, ${w.a0.toFixed(1)}..${w.a1.toFixed(1)}°`
  }

  /** A day's line in dailyChecks.ts: what its check found. */
  const checkLine = (c) =>
    `  { n: ${c.n}, cells: ${c.cells}, windows: [${c.windows.map((w) => `{ cells: ${w.cells}, p0: ${w.p0}, p1: ${w.p1}, a0: ${w.a0}, a1: ${w.a1}, sample: [${w.sample[0]}, ${w.sample[1]}] }`).join(', ')}] },`

  /**
   * dailyPlan.ts from the days' lines, and dailyChecks.ts beside it: the new days' checks, and what it
   * already held for the others.
   */
  async function writePlan(lines, rows, played) {
    const text = `// Written by scripts/acechase-daily.mjs: each day's hole for Today's Hole, from its first day, checked to
// have a way in a player can find and not to give it away. Rerun the script rather than editing by hand.
import type { DailyPick } from './daily.ts'

export const DAILY_PLAN: readonly DailyPick[] = [
${lines.join('\n')}
]
`
    fs.writeFileSync(PLAN, text)
    const checks = (fs.existsSync(CHECKS) ? (await import(CHECKS)).DAILY_CHECKS : []).map(checkLine)
    for (const r of rows) if (r) checks[r.n - 1] = checkLine({ n: r.n, cells: r.found.cells, windows: r.found.windows })
    fs.writeFileSync(
      CHECKS,
      `// Written by scripts/acechase-daily.mjs: what each planned day's check found, for the admin's Hole Book.
// Every power and angle the dials make was played; a window is the settings that stop the ball on the bull
// and touch one another (half a power or a tenth of a degree apart), the widest first, with one of them.

/** A window: how many settings, the powers and angles they span, and one of them. */
export type CheckWindow = { cells: number; p0: number; p1: number; a0: number; a1: number; sample: readonly [number, number] }
/** What a day's check found: how many bull settings in all, and its widest windows (three at most). */
export type DayCheck = { n: number; cells: number; windows: readonly CheckWindow[] }

export const DAILY_CHECKS: readonly DayCheck[] = [
${checks.slice(0, lines.length).join('\n')}
]
`,
    )
    console.log(`wrote ${lines.length} days to ${PLAN.pathname}, and their checks (${played} greens played)`)
  }

  if (mode === 'explore') {
    const each = Number(args[1] ?? 4)
    const only = args[2] && !args[2].startsWith('--') ? args[2] : null
    const rows = []
    const p = pool((res) => {
      rows.push(res)
      process.stderr.write(`\r${rows.length} greens, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    })
    let i = 0
    for (const style of daily.STYLES.filter((s) => !only || s === only))
      for (const kind of daily.kindsFor(style)) for (let k = 0; k < each; k++) p.add({ day: dayOf('2030-01-01', ++i), pick: { kind, style, k } })
    await p.done
    process.stderr.write('\n')
    rows.sort((a, b) => a.pick.kind.localeCompare(b.pick.kind) || a.pick.style.localeCompare(b.pick.style) || a.day.localeCompare(b.day))
    for (const r of rows) {
      const verdict = judge(r.found)
      console.log(`${r.pick.kind.padEnd(8)} ${r.pick.style.padEnd(6)} ${r.day} ${r.name.padEnd(22)} ${String(r.found.cells).padStart(4)} · ${win(r.found.windows[0])} · ${verdict ?? 'GOOD'}  (${r.secs}s)`)
    }
    for (const kind of daily.KINDS) {
      const mine = rows.filter((r) => r.pick.kind === kind)
      if (mine.length) console.log(`${kind}: ${mine.filter((r) => !judge(r.found)).length} of ${mine.length} good`)
    }
  } else if (mode === 'show') {
    const day = args[1]
    const n = daily.dailyNumber(day)
    const plan = (await import(PLAN)).DAILY_PLAN
    const choice = plan[n - 1] ?? { ...daily.plannedPick(n), k: 0 }
    const p = pool((res) => {
      console.log(`#${n} ${day} ${res.pick.kind} ${res.pick.style} k${res.pick.k} · ${res.name}`)
      console.log(`  ${res.found.cells} bull settings · best ${win(res.found.windows[0])} · next ${win(res.found.windows[1])}`)
      console.log(`  a way in: power ${res.found.windows[0]?.sample[0]}, angle ${res.found.windows[0]?.sample[1]}`)
      console.log(`  ${judge(res.found) ?? 'GOOD'}`)
    })
    p.add({ day, pick: choice })
    await p.done
  } else {
    const kept = args.includes('--fresh') ? [] : writtenPlan()
    const redo = new Set((args.find((a) => a.startsWith('--days='))?.slice(7).split(',') ?? []).map(Number))
    const days = Math.max(kept.length, Number(args[1] && !args[1].startsWith('--') ? args[1] : 180))
    const lines = kept.map((d) => d.line)
    const rows = []
    const todo = []
    for (let n = 1; n <= days; n++) if (n > kept.length || redo.has(n)) todo.push(n)
    // Each day's greens in their order, the first that passes being the day's. With cores to spare (few
    // days left), a day's next greens are played alongside, ahead of knowing whether they're needed.
    const chains = new Map(todo.map((n) => [n, { day: dayOf(daily.DAILY_EPOCH, n), picks: [{ ...daily.plannedPick(n), k: 0 }], results: [], done: false }]))
    let open = todo.length
    let tried = 0
    // With nothing to plan, only the files are written again (a pool with no jobs would never finish).
    if (todo.length) {
      const p = pool(
        (res, add) => {
          tried++
          const c = chains.get(res.n)
          if (c.done) return
          c.results[res.pick.k] = res
          for (let k = 0; k < c.picks.length && c.results[k]; k++)
            if (!judge(c.results[k].found)) {
              lines[res.n - 1] = lineFor(c.results[k])
              rows[res.n - 1] = c.results[k]
              c.done = true
              open--
              break
            }
          const ahead = Math.ceil(workers / Math.max(1, open))
          for (const [n, d] of chains) {
            if (d.done) continue
            if (!d.picks.at(-1) && d.picks.filter(Boolean).length === d.results.filter(Boolean).length) nothingGood(n)
            while (d.picks.at(-1) && d.picks.length - d.results.filter(Boolean).length < ahead) {
              const next = nextPick(n, d.picks.at(-1))
              d.picks.push(next)
              if (next) add({ n, day: d.day, pick: next })
            }
          }
          process.stderr.write(`\r${todo.length - open}/${todo.length} days, ${tried} greens played, ${((Date.now() - t0) / 1000).toFixed(0)}s   `)
        },
        (job) => chains.get(job.n)?.done ?? false,
      )
      const ahead = Math.ceil(workers / todo.length)
      for (const [n, c] of chains) {
        p.add({ n, day: c.day, pick: c.picks[0] })
        while (c.picks.length < ahead && c.picks.at(-1)) {
          const next = nextPick(n, c.picks.at(-1))
          c.picks.push(next)
          if (next) p.add({ n, day: c.day, pick: next })
        }
      }
      await p.done
      process.stderr.write('\n')
    }
    await writePlan(lines, rows, tried)
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
