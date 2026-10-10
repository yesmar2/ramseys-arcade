// Wobble Run's plan: which rounds each day's gauntlet gets, checked before it goes out.
//
//   node scripts/wobblerun-daily.mjs plan [days]        add days after the last one planned (180 in all by default)
//   node scripts/wobblerun-daily.mjs replan <n> [days]  lay every day from #n on again (only days nobody has played)
//   node scripts/wobblerun-daily.mjs repace             run every day's blue bean again, each day's gauntlet as it is
//   node scripts/wobblerun-daily.mjs show <n>           lay gauntlet #n from the plan and say how the bots do
//   node scripts/wobblerun-daily.mjs trial <n> [days] [gen]
//                                                       test gauntlets: pick and check `days` days (14) from #n as a
//                                                       replan would, laid by generation `gen` (the newest, 2), and
//                                                       say how they did; writes nothing
//
// Generations (engine/course.ts): each day is picked and laid by its own, gen 1 before GEN2_FROM and gen 2 from it
// (genOfDay): its tiers come from plan.ts HEAT or HEAT2 and its rounds are laid by that generation's rules. So once
// GEN2_FROM is set to a day nobody has played, `replan <GEN2_FROM>` lays the days from it at gen 2 and keeps the
// ones before it as they are. `trial` shows what gen-2 days would come to before then.
//
// A day's rounds are picked by the slot, heat and variety rules (src/games/wobblerun/engine/plan.ts pickRounds),
// and a try of them is kept only once it passes the checks (plan.ts validate): the blue bean runs it untouched in a
// fair time (PACE_FROM to PACE_TO), the fast hands leave the medals room without going under the API's floor, and
// the phone's noisy hands all get to the crown in fair time without being knocked about. If no try of the day's
// rounds passes, the day gets other rounds. The plan keeps the rounds, the try, the gauntlet's name and the blue
// bean's time (dailyPlan.ts, in the main bundle); the blue bean's route goes in blueRoutes.ts (the game's chunk only),
// so the game replays the blue's run rather than look for it. The API gets its own copy of the times
// (ramseys-arcade-api src/wobblerunPace.ts, or API_DIR's), since a run's tickets and its fastest believable time go by
// them, and the gauntlets' names (course-names.mjs writes its src/courseNames.ts).
//
// `plan` only ever adds days: a day that's been played keeps its gauntlet. Changing the engine (engine/*.ts, a
// round's builder, a physics constant) changes the gauntlets of days already planned, so don't, once people have
// played them; before launch, replan and repace freely. A day takes several seconds of bot runs, so this runs on
// most of the cores (JOBS=n for another number). Node 23.6+.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'

const ENGINE = new URL('../src/games/wobblerun/engine/', import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = join(root, 'src/games/wobblerun/dailyPlan.ts')
const ROUTES = join(root, 'src/games/wobblerun/blueRoutes.ts')
const API_DIR = process.env.API_DIR ?? join(root, '../ramseys-arcade-api')
const API = join(API_DIR, 'src/wobblerunPace.ts')
const FIRST_DAY = '2026-10-09'
/** The API refuses a run under this share of the day's pace (routes.ts and trackLaps.ts): the plan says if it's still safe. */
const API_FLOOR = 0.4
/**
 * Which rounds the days get (plan.ts PickOptions): the phase 2 rounds are out for now. Roll On's engine passes, but
 * the scene doesn't draw its drums yet; Slime Climb days came in 67–72 s against the blue's 80–95 s, every try of
 * four sets of rounds on #7. WOBBLE_ROLL=1 or WOBBLE_SLIME=1 to try them in.
 */
const PICK = { roll: process.env.WOBBLE_ROLL === '1', slime: process.env.WOBBLE_SLIME === '1' }

const plan = await import(new URL('plan.ts', ENGINE).href)
const course = await import(new URL('course.ts', ENGINE).href)
const bots = await import(new URL('bots.ts', ENGINE).href)

if (!isMainThread) {
  // A worker: a day to find a good try for, or a planned day's blue bean to run again, each laid by the job's
  // generation (the day's own, but in a trial).
  parentPort.on('message', (job) => {
    const t0 = Date.now()
    if (job.kind === 'day') {
      const good = plan.firstGoodCourse(job.n, job.k, { gen: job.gen })
      if (!good.course) {
        parentPort.postMessage({ ...job, ok: false, why: good.why, unpaced: good.unpaced, secs: (Date.now() - t0) / 1000 })
        return
      }
      parentPort.postMessage({
        ...job,
        ok: true,
        a: good.attempt,
        pace: good.pace,
        route: bots.encodeRoute(good.blue.steps),
        fast: good.fast.time,
        phone: good.phone,
        secs: (Date.now() - t0) / 1000,
      })
    } else {
      const c = course.plannedCourse(job.n, job.a, job.k, job.name, job.gen)
      const blue = bots.blueRun(c)
      parentPort.postMessage({ ...job, ok: blue.finished && !blue.touched, pace: Math.round(blue.time * bots.BLUE_PACE * 1000), route: bots.encodeRoute(blue.steps) })
    }
  })
} else {
  const jobs = Math.max(1, Number(process.env.JOBS ?? Math.min(8, os.availableParallelism() - 2)))

  const keyOf = (job) => `${job.kind}:${job.n}:${job.k}:${job.gen}`

  /**
   * The workers: jobs in, each job's result by its key (get) once it's done. A job `wanted` says no to by the time
   * a worker is free for it (a day whose rounds have changed since) is dropped; a job asked for twice runs once.
   */
  function pool() {
    const queue = []
    const asked = new Set()
    const results = new Map()
    const waiting = new Map()
    const workers = Array.from({ length: jobs }, () => new Worker(new URL(import.meta.url)))
    const idle = [...workers]
    let wanted = () => true
    const feed = (w) => {
      let job = queue.shift()
      while (job && !wanted(job)) {
        asked.delete(keyOf(job))
        job = queue.shift()
      }
      if (!job) {
        idle.push(w)
        return
      }
      w.once('message', (res) => {
        const key = keyOf(res)
        results.set(key, res)
        asked.delete(key)
        waiting.get(key)?.(res)
        feed(w)
      })
      w.postMessage(job)
    }
    for (const w of workers)
      w.on('error', (err) => {
        console.error(err)
        process.exit(1)
      })
    return {
      add(job) {
        const key = keyOf(job)
        if (results.has(key) || asked.has(key)) return
        asked.add(key)
        queue.push(job)
        const w = idle.pop()
        if (w) feed(w)
      },
      get: (key) => (results.has(key) ? Promise.resolve(results.get(key)) : new Promise((done) => waiting.set(key, done))),
      want(f) {
        wanted = f
      },
      close() {
        for (const w of workers) void w.terminate()
      },
    }
  }

  /** Runs every job; their results in the jobs' order. */
  async function runAll(list) {
    if (!list.length) return []
    const p = pool()
    for (const job of list) p.add(job)
    const out = await Promise.all(list.map((job) => p.get(keyOf(job))))
    p.close()
    return out
  }

  function readPlan() {
    if (!existsSync(PLAN)) return []
    const text = readFileSync(PLAN, 'utf8')
    // The site's stand-in plan (made before this script ran) is no plan at all.
    if (text.includes('PLACEHOLDER')) return []
    return [...text.matchAll(/\{ a: (\d+), name: '([^']+)', pace: (\d+), k: '([A-Za-z0-9]+)' \}/g)].map((m) => ({ a: Number(m[1]), name: m[2], pace: Number(m[3]), k: m[4] }))
  }

  function readRoutes() {
    if (!existsSync(ROUTES)) return []
    return [...readFileSync(ROUTES, 'utf8').matchAll(/^ {2}'([0-9a-z,:]*)',$/gm)].map((m) => m[1])
  }

  function writePlan(days) {
    const lines = days.map((d) => `  { a: ${d.a}, name: '${d.name}', pace: ${d.pace}, k: '${d.k}' },`)
    writeFileSync(
      PLAN,
      `// Written by scripts/wobblerun-daily.mjs: each day's gauntlet, from the first day (daily.ts FIRST_DAY) on. \`a\` is
// the try at the day's number that was kept (engine/course.ts plannedCourse), \`name\` its name, \`pace\` the blue
// blip's time in milliseconds as it's raced, and \`k\` its rounds in course order, finale last: a letter and a tier
// each (g Slam Doors, b Wall Rush, s Sweeper Spin, h Bonk Alley, f Melon Hill, w Tippy Planks, x Crumble Tiles,
// l Pad Hop, r Barrel Roll, n Gust Gaps; finales C Star Peak, S Tide Tower). A day is laid by the generation its
// number gives it (engine/course.ts genOfDay: gen 1 before GEN2_FROM, gen 2 from it), so new rules come in behind
// a later generation. Don't edit it by hand, and don't change the engine in a way that changes the gauntlets of
// days people have played.

export type PlannedGauntlet = { a: number; name: string; pace: number; k: string }

export const DAILY_GAUNTLETS: readonly PlannedGauntlet[] = [
${lines.join('\n')}
]
`,
    )
    writeFileSync(
      ROUTES,
      `// Written by scripts/wobblerun-daily.mjs: each planned day's blue blip, from the first day on, as the route its
// careful hands found over the day's gauntlet (engine/bots.ts encodeRoute): one step for each safe spot it set off
// from, the way it took there (its index among the ways on from that spot, engine/bots.ts segmentsFrom, base 36),
// and \`:wait\` if it stood there first (base 36, in 30ths of a second). "0,1,0:c,2" is way 0, way 1, a wait of 12/30 s
// and then way 0, then way 2. The game replays it (runs.ts paceOf, engine/bots.ts replayBlue), so no search runs in
// the browser; it means something only on the gauntlet it was found on (dailyPlan.ts's row for the day, laid by the
// day's generation, engine/course.ts genOfDay). Only the game's chunk imports it.

export const BLUE_ROUTES: readonly string[] = [
${days.map((d) => `  '${d.route}',`).join('\n')}
]
`,
    )
    if (!existsSync(join(API_DIR, 'src'))) {
      console.log(`no API repo at ${API_DIR}: its src/wobblerunPace.ts was not written (set API_DIR)`)
      return
    }
    const paces = []
    for (let i = 0; i < days.length; i += 10) paces.push(`  ${days.slice(i, i + 10).map((d) => d.pace).join(', ')},`)
    writeFileSync(
      API,
      `// Written by the site's scripts/wobblerun-daily.mjs from its src/games/wobblerun/dailyPlan.ts: each planned day's
// blue blip (its run over the day's gauntlet, as it's raced), in milliseconds, from the first day on. Wobble Run's
// ticket ladder goes by it (ticketLadders.ts), and so does the fastest run a day's board believes (routes.ts,
// trackLaps.ts), whatever the site sends. Past the last planned day the days come round again, as the site's
// dailyGauntlet has them. Don't edit it by hand: the script writes it again whenever the plan changes.
export const WOBBLERUN_FIRST_DAY = '${FIRST_DAY}'

export const WOBBLERUN_PACE_MS: readonly number[] = [
${paces.join('\n')}
]
`,
    )
  }

  const q = (xs, f) => xs[Math.min(xs.length - 1, Math.floor(f * xs.length))]
  const sorted = (xs) => xs.slice().sort((a, b) => a - b)

  /** What the days planned this time came to: the blue's times, the fast hands' and the phone's against it, the rounds. */
  function summary(fresh) {
    if (!fresh.length) return
    const paces = sorted(fresh.map((d) => d.pace / 1000))
    console.log(`blue bean raced: ${paces[0].toFixed(1)}–${paces[paces.length - 1].toFixed(1)} s, median ${q(paces, 0.5).toFixed(1)} (quartiles ${q(paces, 0.25).toFixed(1)} / ${q(paces, 0.75).toFixed(1)})`)
    const fast = fresh.map((d) => ({ n: d.n, r: d.fast / (d.pace / 1000) })).sort((a, b) => a.r - b.r)
    const fr = fast.map((f) => f.r)
    const low = fast[0]
    console.log(`fast hands ÷ blue: ${low.r.toFixed(3)} (#${low.n})–${fr[fr.length - 1].toFixed(3)}, median ${q(fr, 0.5).toFixed(3)}`)
    const safe = 0.85 * low.r
    console.log(`  the API's floor ${API_FLOOR} × pace ${API_FLOOR <= safe ? 'holds' : 'is TOO HIGH'}: it should stay under 0.85 × the lowest, ${safe.toFixed(3)}`)
    const worst = sorted(fresh.map((d) => d.phone.worst / (d.pace / 1000)))
    const mid = sorted(fresh.map((d) => d.phone.median / (d.pace / 1000)))
    const hits = sorted(fresh.map((d) => d.phone.hits))
    console.log(`phone runs ÷ blue: median ${q(mid, 0.5).toFixed(2)} (days ${mid[0].toFixed(2)}–${mid[mid.length - 1].toFixed(2)}), slowest ${worst[worst.length - 1].toFixed(2)}; knocks at the median ${hits[0]}–${hits[hits.length - 1]}`)
    const count = new Map()
    for (const d of fresh) for (const m of d.k.matchAll(/([A-Za-z])([123])/g)) count.set(m[1], (count.get(m[1]) ?? 0) + 1)
    console.log(`rounds: ${[...count].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l} ${c}`).join(', ')}`)
  }

  /**
   * Lays days after the ones in `days` (which it adds to) until there are `want`, each picked and laid by generation
   * genFor(n). A day's rounds are picked over the days before it, so the days are settled in order, the next few
   * checked ahead at once on the rounds picked so far. A day none of whose tries passes gets other rounds, and the
   * days ahead of it are picked (and checked) again. Rounds that never had the blue in a fair time are given to no
   * later day either (at the same tiers, in any order). Returns what each new day's checks found.
   */
  async function layDays(days, want, genFor, t0) {
    const avoid = new Map()
    const unpaced = []
    const ahead = []
    const fresh = []
    const p = pool()
    p.want((job) => job.n - days.length - 1 < ahead.length && ahead[job.n - days.length - 1] === job.k)
    while (days.length < want) {
      const n = days.length + 1
      while (ahead.length < Math.min(jobs * 2, want - days.length)) {
        const m = n + ahead.length
        const k = plan.pickRounds(m, [...days.map((d) => d.k), ...ahead], { ...PICK, avoid: [...(avoid.get(m) ?? []), ...unpaced], gen: genFor(m) })
        ahead.push(k)
        p.add({ kind: 'day', n: m, k, gen: genFor(m) })
      }
      const r = await p.get(keyOf({ kind: 'day', n, k: ahead[0], gen: genFor(n) }))
      if (!r.ok) {
        console.log(`#${n}: no try of ${r.k} passed (${r.why}); other rounds`)
        avoid.set(n, [...(avoid.get(n) ?? []), r.k])
        if (r.unpaced) unpaced.push(r.k)
        ahead.length = 0
        continue
      }
      ahead.shift()
      fresh.push(r)
      const name = plan.dayName(n, r.a, days.map((d) => d.name))
      days.push({ a: r.a, name, pace: r.pace, k: r.k, route: r.route })
      if (fresh.length % 20 === 0) console.log(`#${n} ${name} (${r.k}, try ${r.a}) ${(r.pace / 1000).toFixed(2)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s so far`)
    }
    p.close()
    return fresh
  }

  const [cmd = 'plan', arg, arg2, arg3] = process.argv.slice(2)
  if (cmd === 'plan' || cmd === 'replan') {
    const want = Number((cmd === 'replan' ? arg2 : arg) ?? 180)
    // replan keeps the days before #n as they were played and lays the rest again.
    const read = readPlan()
    const kept = cmd === 'replan' ? read.slice(0, Math.max(0, Number(arg) - 1)) : read
    const t0 = Date.now()
    // The kept days' routes (any missing are found again).
    const routes = readRoutes()
    const lost = kept.map((d, i) => ({ kind: 'pace', n: i + 1, a: d.a, k: d.k, name: d.name, gen: course.genOfDay(i + 1) })).filter((j) => !routes[j.n - 1])
    for (const r of await runAll(lost)) {
      if (r.pace !== kept[r.n - 1].pace) console.log(`#${r.n}: its blue bean runs ${r.pace} ms now, not the planned ${kept[r.n - 1].pace} (repace?)`)
      routes[r.n - 1] = r.route
    }
    const days = kept.map((d, i) => ({ ...d, route: routes[i] }))
    // Each new day by its own generation, as the game will lay it.
    const fresh = await layDays(days, want, course.genOfDay, t0)
    writePlan(days)
    const tries = fresh.filter((d) => d.a > 0).length
    console.log(`${days.length} days planned (${fresh.length} new, ${tries} of them on a second try or later) in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
    summary(fresh)
    console.log(`wrote ${PLAN}\nwrote ${ROUTES}\nwrote ${API}`)
    await (await import('./course-names.mjs')).writeCourseNames()
  } else if (cmd === 'repace') {
    // Every planned day keeps its rounds, its try and its name; only its blue bean is run again (as after a change
    // to the blue's hands, engine/bots.ts BLUE_HANDS or BLUE_PACE), and its route and time kept.
    const days = readPlan()
    const again = await runAll(days.map((d, i) => ({ kind: 'pace', n: i + 1, a: d.a, k: d.k, name: d.name, gen: course.genOfDay(i + 1) })))
    const out = days.map((d, i) => ({ ...d, pace: again[i].pace, route: again[i].route }))
    for (const r of again) if (!r.ok) console.log(`#${r.n}: the blue bean no longer runs it untouched (replan from here?)`)
    writePlan(out)
    const times = sorted(out.map((d) => d.pace / 1000))
    const off = out.filter((d) => d.pace < plan.PACE_FROM * 1000 || d.pace > plan.PACE_TO * 1000).length
    console.log(`${out.length} days paced again; pace ${times[0].toFixed(1)}–${times[times.length - 1].toFixed(1)} s, median ${q(times, 0.5).toFixed(1)} s${off ? ` (${off} outside ${plan.PACE_FROM}–${plan.PACE_TO} s)` : ''}`)
    console.log(`wrote ${PLAN}\nwrote ${ROUTES}\nwrote ${API}`)
  } else if (cmd === 'show') {
    const n = Number(arg)
    const day = readPlan()[n - 1]
    if (!day) throw new Error(`#${n} isn't planned`)
    // `show <n> <gen>` lays the day's rounds by another generation's rules, to look at (its kept route is the day's own).
    const own = course.genOfDay(n)
    const gen = arg2 ? Number(arg2) : own
    const c = course.plannedCourse(n, day.a, day.k, day.name, gen)
    const route = gen === own ? readRoutes()[n - 1] : undefined
    const replay = route ? bots.replayBlue(c, route) : null
    const v = plan.validate(c, { from: 0, to: Infinity })
    const raced = v.pace / 1000
    console.log(`#${n} ${course.dayOfN(n)} ${day.name} (${c.theme.name}): ${day.k}, try ${day.a}, ${c.length.toFixed(0)} m, gen ${c.gen}${gen === own ? '' : ` (a trial: the plan lays it at gen ${own})`}`)
    console.log(`  rounds: ${c.rounds.map((r) => `${r.name} T${r.tier}`).join(' · ')}`)
    console.log(`  blue bean ${v.blue.finished ? `${raced.toFixed(3)} s` : 'FOUND NO WAY'}${v.blue.touched ? ', TOUCHED' : ''} (planned ${(day.pace / 1000).toFixed(3)} s), splits ${v.blue.splits.map((s) => s.toFixed(1)).join(' ')}`)
    console.log(`  its route (${route ? route.length : 0} chars) replays ${replay ? `in ${replay.time.toFixed(3)} s${replay.finished ? '' : ', NOT TO THE STAR'}` : '— no route kept'}`)
    if (v.fast) console.log(`  fast hands ${v.fast.finished ? `${v.fast.time.toFixed(3)} s, ${(v.fast.time / raced).toFixed(3)} × the blue` : 'FOUND NO WAY'}`)
    if (v.phone) console.log(`  phone runs: median ${v.phone.median.toFixed(1)} s, slowest ${v.phone.worst.toFixed(1)} s (${(v.phone.worst / raced).toFixed(2)} × the blue); knocks ${v.phone.hits}, splats ${v.phone.splats}, bonks ${v.phone.bonks} at the median`)
    const fair = raced >= plan.PACE_FROM && raced <= plan.PACE_TO
    console.log(`  ${!fair ? `the blue's raced time is outside ${plan.PACE_FROM}–${plan.PACE_TO} s` : v.ok ? 'passes every check' : v.why}`)
  } else if (cmd === 'trial') {
    // Test gauntlets: the days from #n picked and checked as a replan from #n would, but by generation `gen` whatever
    // their own is, and nothing written. The days before #n (as planned) are the variety rules' history.
    const read = readPlan()
    const from = Math.min(Math.max(1, Number(arg) || 1), read.length + 1)
    const count = Math.max(1, Number(arg2 ?? 14))
    const gen = Number(arg3 ?? course.LATEST_GEN)
    const t0 = Date.now()
    const days = read.slice(0, from - 1).map((d) => ({ ...d, route: '' }))
    const fresh = await layDays(days, from - 1 + count, () => gen, t0)
    for (const r of fresh) {
      const raced = r.pace / 1000
      console.log(
        `#${r.n} ${course.dayOfN(r.n)} ${r.k} try ${r.a}: blue ${raced.toFixed(2)} s, fast ${(r.fast / raced).toFixed(3)} × it, phone median ${(r.phone.median / raced).toFixed(2)} × (slowest ${(r.phone.worst / raced).toFixed(2)}), knocks ${r.phone.hits}, splats ${r.phone.splats}`,
      )
    }
    console.log(`${fresh.length} test gauntlets from #${from} at gen ${gen} in ${((Date.now() - t0) / 1000).toFixed(0)} s (${fresh.filter((d) => d.a > 0).length} on a second try or later)`)
    summary(fresh)
    console.log('a trial: nothing was written')
  } else {
    console.log('node scripts/wobblerun-daily.mjs plan [days] | replan <n> [days] | repace | show <n> [gen] | trial <n> [days] [gen]')
  }
}
