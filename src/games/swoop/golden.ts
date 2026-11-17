import { GOLDEN_HILLS } from './goldenPlan'
import { heightAt, type Hills } from './sim'

/*
 * Swoop's golden birds, in the look on test (newLook.ts): three a day, each sitting on a hill of its own, the same
 * hills for everyone. One clean landing on its hill catches it, and it flies with you to the line whatever happens
 * after, where the rest of the flock scatters at the first bad landing. A run ends with none, one, two or all
 * three, so there's something to fly for besides the time, at any level: the game's bot players, flying 36 days of
 * hills, caught at least one in 29% of runs flying like a newcomer, 56% getting the hang of it, 89% flying well,
 * and all three in 14% of good runs and 25% of very good ones. Ramsey, 2026-11-17, asked what else would make the
 * game more fun, and picked this from the list.
 *
 * Nothing about a run's time changes: a clean landing is a clean landing wherever it is. Which hills they sit on
 * is planned (scripts/swoop-golden.mjs writes goldenPlan.ts): downhills where good players do land clean, one in
 * each third of the way.
 */

/** How many golden birds a day has. */
export const GOLDEN = 3

/** A golden bird's hill: the index of its top in the hills' list, where its downhill runs from and to, and where the bird sits on it. */
export type GoldenHill = { top: number; from: number; to: number; x: number; y: number }

/** How far down its hill a golden bird sits, as a share of the downhill. */
const PERCH = 0.42

/** The downhill a spot is on, as the index of its top in the hills' list (sim.ts Hills.xs); -1 on a climb, or off either end. */
export function downhillAt(hills: Hills, x: number): number {
  const { xs, ys } = hills
  if (x < xs[0]! || x >= xs[xs.length - 1]!) return -1
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid]! <= x) lo = mid
    else hi = mid
  }
  return ys[lo]! > ys[lo + 1]! ? lo : -1
}

const isDownhill = (hills: Hills, top: number) => Number.isInteger(top) && top > 0 && top + 1 < hills.xs.length && hills.ys[top]! > hills.ys[top + 1]!

/**
 * Hills that aren't in the plan (an admin's test hills, or a day laid again since the plan was written) get their
 * golden hills by shape: in each third of the way, the biggest drop whose top doesn't stand over the one before it,
 * so a flight off the last hill can reach it.
 */
function byShape(hills: Hills): number[] {
  const picks: number[] = []
  for (let third = 0; third < GOLDEN; third++) {
    const from = 0.08 + third * 0.3
    let best = -1
    let most = 0
    for (let i = 2; i + 1 < hills.xs.length; i++) {
      const at = hills.xs[i]! / hills.finish
      if (at < from || at >= from + 0.3 || !isDownhill(hills, i)) continue
      const drop = hills.ys[i]! - hills.ys[i + 1]!
      if (hills.ys[i]! <= hills.ys[i - 2]! + 3 && drop > most) {
        most = drop
        best = i
      }
    }
    if (best >= 0) picks.push(best)
  }
  return picks
}

/**
 * The day's golden hills, in order along the way: `laid` is the planned day the hills were laid from (daily.ts
 * laidNumber), or null for hills that aren't a planned day's.
 */
export function goldenHills(hills: Hills, laid: number | null): GoldenHill[] {
  const planned = laid == null ? undefined : GOLDEN_HILLS[laid - 1]
  // The plan's word holds only for the hills it was written for: the same number of tops, each pick a downhill.
  const tops = planned && planned[3] === hills.tops && planned.slice(0, GOLDEN).every((top) => top < 0 || isDownhill(hills, top)) ? planned.slice(0, GOLDEN).filter((top) => top >= 0) : byShape(hills)
  return tops.map((top) => {
    const from = hills.xs[top]!
    const to = hills.xs[top + 1]!
    const x = from + (to - from) * PERCH
    return { top, from, to, x, y: heightAt(hills, x) }
  })
}

/* ---------- the most caught in one run today, kept on this device ---------- */

const KEY = 'skermix-swoop-golden'

/** The most golden birds this device has brought to the line in one run over a day's hills. */
export function goldenBest(day: string): number {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day?: string; best?: number } | null
    return kept && kept.day === day && typeof kept.best === 'number' ? Math.max(0, Math.min(GOLDEN, kept.best)) : 0
  } catch {
    return 0
  }
}

/** A run over a day's hills brought `count` home: kept if it's the most yet. Only one day is kept, the last flown. */
export function keepGoldenBest(day: string, count: number) {
  if (count <= goldenBest(day)) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ day, best: count }))
  } catch {
    /* a private window keeps nothing */
  }
}
