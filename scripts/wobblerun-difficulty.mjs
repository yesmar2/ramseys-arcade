// Wobble Run's difficulty report: each round on its own, how hard it is, and above all whether its timing matters.
//
//   node scripts/wobblerun-difficulty.mjs [--round <letters>] [--tier <tiers>] [--gen <gens>] [--seeds <n>] [--phases <n>] [--json]
//
//   --round gbn   only these rounds (letters, as in a day's code; every built round, finales too, by default)
//   --tier 3      only these tiers (1, 2 and 3 by default; "23" or "2,3" for two)
//   --gen 2       only this generation, whether it differs from gen 1 or not (by default gen 1, then gen 2 for each
//                 round and tier whose gen-2 laying differs from its gen-1: a builder that reads slot.gen)
//   --seeds 12    how many layings of each round and tier (seeds 1..n)
//   --phases 6    how many start phases NAIVE runs each laying from (its start held 0 … the round's period)
//   --json        the rows (and every seed's numbers) as JSON instead of the table
//
// Each round at each tier is laid alone (engine/lab.ts soloCourse: the start pad and its slide, the round, a
// checkpoint pad, a plain finish; a finale gets a plain lead-in and its checkpoint pad first, and ends at its star),
// and every bot is timed from entering the round to standing on what comes after it (lab.ts roundTimer):
//   BLUE   the blue blip's careful hands (engine/bots.ts BLUE_HANDS): "blue s" is its time in the round
//   FAST   the fast hands, gold lines and all: "fast×" is its time ÷ the blue's (the medals' room; a day wants 0.48–0.6)
//   MAIN   the fast hands on the main route only: a perfectly timed run of the way NAIVE takes ("main s")
//   PHONE  one run a laying by the phone's late, noisy hands (PHONE_HANDS): the share that got through ("thru"), and the
//          median knocks (knocks and yeets) and falls (splats)
//   NAIVE  a player who just runs (NAIVE_HANDS: the main route at full stick, no waits, no windows, a jump for the
//          orange and for gaps, a dive under the violet, committed to every jump), from each start phase: the share of
//          runs that fell, the share knocked, and the median time lost to FAST and to MAIN (a run that never got
//          through has lost everything)
// "timing" is the share of NAIVE runs that fell or lost 2 s or more to MAIN: what it costs not to time anything. A
// round you can run straight through scores near 0. It's taken against MAIN, not FAST, so a gold line's saving isn't
// counted as timing. Gust Gaps T3 at gen 1 (the one round Ramsey found hard) is the reference every row is set
// against ("vs ref", points of "timing"), measured with the same seeds and phases as the rows. NAIVE never dodges a
// red thing, so rounds of red dodge-it hazards score high on "timing" from knocks a person dodges by eye: read their
// "naive fell" too (Ramsey's day 1 had Star Peak T2 at 100% timing and he didn't find it hard; only Gust Gaps T3 made
// NAIVE fall, and only it felt hard).
//
// It runs on most of the cores (JOBS=n for another number); a full run (12 rounds × 3 tiers × 12 seeds) takes a
// minute or two. Node 23.6+.
import os from 'node:os'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'

const ENGINE = new URL('../src/games/wobblerun/engine/', import.meta.url)
const lab = await import(new URL('lab.ts', ENGINE).href)
const bots = await import(new URL('bots.ts', ENGINE).href)
const sim = await import(new URL('sim.ts', ENGINE).href)
const { ROUNDS } = await import(new URL('rounds/index.ts', ENGINE).href)

/** The fast hands kept to the main route: the best a player who takes NAIVE's way can do, timing everything. */
const MAIN_HANDS = { ...bots.FAST_HANDS, name: 'main', gold: false }
/** A live run's longest, s. */
const LIMIT = 120
/** NAIVE losing this much to MAIN, s (or falling), is timing that matters. */
const LOST = 2
/** The reference: Gust Gaps T3 at gen 1. */
const REF = { letter: 'n', tier: 3, gen: 1 }

/** One laying of one round: every bot's time in the round, and what befell the live ones. */
function measure({ letter, tier, gen, seed, phases }) {
  const c = lab.soloCourse(letter, tier, { seed, gen })
  const i = lab.soloIndex(c)
  const r = c.rounds[i]
  const planned = (h) => {
    const steps = bots.planRoute(c, h)
    if (!steps) return { ok: false, touched: true, t: NaN }
    const tm = lab.roundTimer(c, i)
    const run = bots.runRoute(c, steps, h, { onStep: tm.tick })
    return { ok: run.finished, touched: run.touched, t: tm.exit - tm.enter }
  }
  const live = (go) => {
    const tm = lab.roundTimer(c, i)
    const run = go(tm.tick)
    const t = tm.exit - tm.enter
    return { thru: Number.isFinite(t), t: Number.isFinite(t) ? t : Infinity, falls: run.counts.splats, knocks: run.counts.knocks + run.counts.yeets, bonks: run.counts.bonks }
  }
  const blue = planned(bots.BLUE_HANDS)
  const fast = planned(bots.FAST_HANDS)
  const main = planned(MAIN_HANDS)
  const phone = live((tick) => bots.liveRun(c, bots.PHONE_HANDS, seed, LIMIT, tick))
  const naive = []
  for (let j = 0; j < phases; j++) {
    const pause = (j * r.period) / phases
    const pauses = c.rounds.map((_, k) => (k === i ? pause : 0))
    naive.push({ pause, ...live((tick) => bots.naiveRun(c, { pauses }, LIMIT, tick)) })
  }
  return { letter, tier, gen, seed, period: r.period, length: r.z1 - r.z0, blue, fast, main, phone, naive }
}

if (!isMainThread) {
  parentPort.on('message', (job) => parentPort.postMessage({ key: job.key, ...measure(job) }))
} else {
  const args = process.argv.slice(2)
  const opt = (name) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const digits = (s) => [...(s ?? '')].filter((ch) => /[0-9]/.test(ch)).map(Number)
  const json = args.includes('--json')
  const seeds = Math.max(1, Number(opt('seeds') ?? 12))
  const phases = Math.max(1, Number(opt('phases') ?? 6))
  const letters = opt('round') ? [...opt('round')].filter((ch) => /[A-Za-z]/.test(ch)) : ROUNDS.filter((r) => !r.stub).map((r) => r.letter)
  for (const l of letters) if (!ROUNDS.some((r) => r.letter === l)) throw new Error(`no round '${l}'`)
  const tiers = opt('tier') ? digits(opt('tier')).filter((t) => t >= 1 && t <= 3) : [1, 2, 3]
  const gens = opt('gen') ? digits(opt('gen')).filter((g) => g >= 1) : null
  const jobsN = Math.max(1, Number(process.env.JOBS ?? Math.min(14, os.availableParallelism() - 2)))
  const seedList = Array.from({ length: seeds }, (_, s) => s + 1)

  /**
   * What a laying is, as numbers: every solid, hazard, volume, route node and edge, and every motion, telegraph-free,
   * sampled at a few moments. Two generations that lay a round the same give the same.
   */
  const fingerprint = (c) => {
    const at = [0.37, 1.91, 4.53, 9.17]
    const pose = sim.newPose()
    const bodies = []
    const out = []
    c.solids.forEach((s, i) => {
      out.push({ ...s, move: undefined, tele: undefined, bounce: s.bounce && { ...s.bounce, lit: s.bounce.lit && at.map(s.bounce.lit) }, z0: undefined, z1: undefined })
      if (s.move) for (const t of at) out.push({ ...sim.solidPose(c, null, i, t, pose) })
    })
    for (const h of c.hazards) {
      out.push({ ...h, move: undefined, path: undefined, tele: undefined, z0: undefined, z1: undefined })
      for (const t of at) {
        const n = sim.hazardBodies(h, t, bodies)
        for (let k = 0; k < n; k++) out.push({ ...bodies[k] })
      }
    }
    for (const v of c.volumes) out.push({ ...v, duty: v.kind === 'wind' ? at.map(v.duty) : undefined, bob: v.kind === 'crown' ? at.map(v.bob) : undefined, tele: undefined })
    out.push(c.graph.nodes, c.graph.edges.map((e) => ({ ...e, window: e.window && at.map(e.window) })), c.deaths, c.spawns, c.length)
    return JSON.stringify(out)
  }
  const differs = (letter, tier) => seedList.some((seed) => fingerprint(lab.soloCourse(letter, tier, { seed, gen: 1 })) !== fingerprint(lab.soloCourse(letter, tier, { seed, gen: 2 })))

  // The rows wanted: each round and tier at each generation asked for (gen 2 by default only where it differs).
  const rows = []
  const same2 = []
  for (const letter of letters) {
    for (const tier of tiers) {
      for (const gen of gens ?? [1, 2]) {
        if (!gens && gen === 2 && !differs(letter, tier)) {
          same2.push(`${letter}${tier}`)
          continue
        }
        rows.push({ letter, tier, gen })
      }
    }
  }
  const hasRef = rows.some((r) => r.letter === REF.letter && r.tier === REF.tier && r.gen === REF.gen)
  const wanted = hasRef ? rows : [...rows, { ...REF, ref: true }]
  const jobs = []
  for (const row of wanted) for (const seed of seedList) jobs.push({ key: `${row.letter}${row.tier}:${row.gen}:${seed}`, letter: row.letter, tier: row.tier, gen: row.gen, seed, phases })

  // The work, spread over the workers.
  const t0 = Date.now()
  const results = new Map()
  await new Promise((done, fail) => {
    const queue = [...jobs]
    let left = jobs.length
    let shown = 0
    const workers = Array.from({ length: Math.min(jobsN, jobs.length) }, () => new Worker(new URL(import.meta.url)))
    const feed = (w) => {
      const job = queue.shift()
      if (job) w.postMessage(job)
    }
    for (const w of workers) {
      w.on('error', fail)
      w.on('message', (res) => {
        results.set(res.key, res)
        left--
        const pct = Math.floor((100 * (jobs.length - left)) / jobs.length)
        if (pct >= shown + 10 || left === 0) {
          shown = pct - (pct % 10)
          process.stderr.write(`${pct}% (${jobs.length - left}/${jobs.length} layings, ${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
        }
        if (left === 0) {
          for (const x of workers) void x.terminate()
          done()
        } else feed(w)
      })
      feed(w)
    }
  })

  const sorted = (xs) => xs.filter((x) => x === x).sort((a, b) => a - b)
  const median = (xs) => {
    const s = sorted(xs)
    return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN
  }
  const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : NaN)
  const nameOf = (l) => ROUNDS.find((r) => r.letter === l)?.name ?? l

  /** A row's numbers from its layings. */
  const sum = (row) => {
    const per = seedList.map((seed) => results.get(`${row.letter}${row.tier}:${row.gen}:${seed}`))
    const naive = per.flatMap((p) => p.naive.map((n) => ({ ...n, fast: p.fast.ok ? p.fast.t : NaN, main: p.main.ok ? p.main.t : NaN })))
    const timed = naive.filter((n) => n.main === n.main)
    return {
      round: row.letter,
      name: nameOf(row.letter),
      tier: row.tier,
      gen: row.gen,
      seeds: per.length,
      period: median(per.map((p) => p.period)),
      length: median(per.map((p) => p.length)),
      blue: median(per.filter((p) => p.blue.ok).map((p) => p.blue.t)),
      blueBad: per.filter((p) => !p.blue.ok || p.blue.touched).length,
      fastX: median(per.filter((p) => p.blue.ok && p.fast.ok).map((p) => p.fast.t / p.blue.t)),
      main: median(per.filter((p) => p.main.ok).map((p) => p.main.t)),
      phoneThru: share(per, (p) => p.phone.thru),
      phoneKnocks: median(per.map((p) => p.phone.knocks)),
      phoneFalls: median(per.map((p) => p.phone.falls)),
      naiveRuns: naive.length,
      naiveFell: share(naive, (n) => n.falls > 0),
      naiveKnocked: share(naive, (n) => n.knocks > 0),
      naiveBonked: share(naive, (n) => n.bonks > 0),
      lostFast: median(naive.filter((n) => n.fast === n.fast).map((n) => n.t - n.fast)),
      lostMain: median(timed.map((n) => n.t - n.main)),
      timing: share(timed, (n) => n.falls > 0 || !(n.t - n.main < LOST)),
      layings: per,
    }
  }
  const out = rows.map(sum)
  const ref = sum(REF)

  if (json) {
    console.log(JSON.stringify({ seeds, phases, lost: LOST, reference: ref, sameAtGen2: same2, rows: out }, null, 1))
  } else {
    const pct = (v) => (v === v ? `${Math.round(100 * v)}%` : '–')
    const s1 = (v) => (v === v ? (Number.isFinite(v) ? v.toFixed(1) : '∞') : '–')
    const s2 = (v) => (v === v ? v.toFixed(2) : '–')
    const head = ['round', 'T', 'gen', 'blue s', 'fast×', 'main s', 'phone thru', 'knocks', 'falls', 'naive fell', 'knocked', 'lost·fast', 'lost·main', 'timing', 'vs ref']
    const line = (r) => [
      `${r.round} ${r.name}`,
      r.tier,
      r.gen,
      `${s1(r.blue)}${r.blueBad ? ` (${r.blueBad}✗)` : ''}`,
      s2(r.fastX),
      s1(r.main),
      pct(r.phoneThru),
      s1(r.phoneKnocks),
      s1(r.phoneFalls),
      pct(r.naiveFell),
      pct(r.naiveKnocked),
      s1(r.lostFast),
      s1(r.lostMain),
      pct(r.timing),
      r.timing === r.timing && ref.timing === ref.timing ? `${r.timing >= ref.timing ? '+' : ''}${Math.round(100 * (r.timing - ref.timing))}` : '–',
    ]
    console.log(`| ${head.join(' | ')} |`)
    console.log(`|${head.map(() => '---').join('|')}|`)
    for (const r of out) console.log(`| ${line(r).join(' | ')} |`)
    console.log('')
    console.log(`reference: ${ref.name} T${ref.tier} gen ${ref.gen}: timing ${pct(ref.timing)}, naive fell ${pct(ref.naiveFell)}, knocked ${pct(ref.naiveKnocked)}, lost·main ${s1(ref.lostMain)} s`)
    if (same2.length) console.log(`gen 2 lays the same as gen 1 (not run again): ${same2.join(' ')}`)
    console.log(`${seeds} seeds, NAIVE from ${phases} start phases each; ${jobs.length} layings in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${Math.min(jobsN, jobs.length)} workers`)
  }
}
