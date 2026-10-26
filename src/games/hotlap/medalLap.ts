import { CAR, load, speedPlan, type Track } from './sim.ts'

/*
 * Each track's platinum, set track by track (dailyPlan.ts `platinum`, written by scripts/hotlap-daily.mjs; the
 * API's hotlapPace.ts HOTLAP_PLATINUM_MS is the same). One step under the blue car on every track couldn't fit:
 * the blue car keeps to the middle of the road, and how much a quick driver gains on it by taking a line
 * depends on the track. Ramsey's best laps on the seven tracks to 2026-10-26 landed anywhere from 18 to 27.5% under
 * it, while platinum sat at 15% on every one ("the medals are still a little off on some of the lap run tracks").
 *
 * He asked for platinum "about a half second slower than my best runs". On those seven it is just that
 * (PLATINUM_FROM_LAPS). On every other track it comes from a quick lap worked out here: the road's racing line
 * (the middle pulled tight between the edges), driven on the limit of grip and with the engine's own pull out of
 * each corner. His best laps were 95.8% of it on those seven, give or take 2% (the blue car's were 79%, give or
 * take 5%), so platinum is that share of it and half a second more. Bronze, silver and gold sit between the blue
 * car and platinum as the other races' do (lib/raceMedals.ts MEDAL_RUNGS).
 */

/** Platinum on the tracks Ramsey has driven at his best (his best lap there, from production, + 500 ms), by track. */
export const PLATINUM_FROM_LAPS: Readonly<Record<number, number>> = {
  25: 48_750, // Oct 20: his 48.250
  26: 49_600, // Oct 21: 49.100
  27: 54_867, // Oct 22: 54.367
  28: 49_242, // Oct 23: 48.742
  29: 51_017, // Oct 24: 50.517
  30: 49_192, // Oct 25: 48.692
  31: 51_392, // Oct 26: 50.892
}

/** His best laps on those tracks as a share of the quick lap worked out for each. */
export const QUICK_LAP_SHARE = 0.9584
/** Platinum is this much slower than the share of the quick lap: "about a half second slower than my best runs". */
export const PLATINUM_SLACK_MS = 500

/** How far either side of the middle the line may go: the road is 8 m each side, less the car. */
const LINE_ROOM = 6.5
/** How many times the line is pulled tight. */
const LINE_PULLS = 400

/** The racing line round a track: the middle pulled tight between the road's edges, as a track of its own. */
function racingLine(track: Track): Track {
  const { n } = track
  const nx = new Float64Array(n)
  const ny = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    nx[i] = -Math.sin(track.h[i]!)
    ny[i] = Math.cos(track.h[i]!)
  }
  // How far each point sits off the middle, to its left.
  const off = new Float64Array(n)
  const px = (i: number) => track.x[i]! + off[i]! * nx[i]!
  const py = (i: number) => track.y[i]! + off[i]! * ny[i]!
  for (let pull = 0; pull < LINE_PULLS; pull++) {
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n
      const b = (i + 1) % n
      const mx = (px(a) + px(b)) / 2
      const my = (py(a) + py(b)) / 2
      const want = (mx - track.x[i]!) * nx[i]! + (my - track.y[i]!) * ny[i]!
      off[i] = Math.max(-LINE_ROOM, Math.min(LINE_ROOM, want))
    }
  }
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const h = new Float64Array(n)
  const k = new Float64Array(n)
  const s = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = px(i)
    y[i] = py(i)
  }
  for (let i = 0; i < n; i++) {
    const b = (i + 1) % n
    h[i] = Math.atan2(y[b]! - y[i]!, x[b]! - x[i]!)
  }
  for (let i = 1; i < n; i++) s[i] = s[i - 1]! + Math.hypot(x[i]! - x[i - 1]!, y[i]! - y[i - 1]!)
  const length = s[n - 1]! + Math.hypot(x[0]! - x[n - 1]!, y[0]! - y[n - 1]!)
  // How sharply it bends at each point: the turn over a few metres either side.
  for (let i = 0; i < n; i++) {
    const a = (i - 2 + n) % n
    const b = (i + 2) % n
    const turn = h[(i + 1) % n]! - h[a]!
    const over = Math.hypot(x[b]! - x[a]!, y[b]! - y[a]!)
    k[i] = Math.atan2(Math.sin(turn), Math.cos(turn)) / Math.max(over * 0.75, 0.5)
  }
  return { ...track, x, y, h, k, s, length }
}

/**
 * A quick lap of a track, in seconds: its racing line on the limit of grip (sim.ts speedPlan at its full), braking
 * for each corner as late as the tyres allow and pulling out of it as hard as the engine can.
 */
export function quickLap(track: Track): number {
  const line = racingLine(track)
  const { n } = line
  const v = speedPlan(line, 1)
  const step = (i: number) => Math.max(0.2, (i + 1 < n ? line.s[i + 1]! : line.length) - line.s[i]!)
  // Out of each corner, no faster than the engine pulls (twice round, so the start line's corner counts too).
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < n; i++) {
      const u = Math.max(v[i]!, 2)
      const climb = line.grade ? 9.81 * line.grade[i]! : 0
      const pull = Math.min(CAR.power / u, 0.5 * CAR.mu * load(u)) - CAR.drag * u * u - CAR.rolling - climb
      const b = (i + 1) % n
      v[b] = Math.min(v[b]!, Math.sqrt(Math.max(1, u * u + 2 * pull * step(i))))
    }
  }
  let time = 0
  for (let i = 0; i < n; i++) time += step(i) / Math.max(v[i]!, 3)
  return time
}

/** Track n's platinum, in ms: from Ramsey's best lap there when he's set one at his best, else from its quick lap. */
export function platinumOf(n: number, track: Track, paceMs: number): number {
  const set = PLATINUM_FROM_LAPS[n]
  const ms = set ?? Math.round(quickLap(track) * QUICK_LAP_SHARE * 1000) + PLATINUM_SLACK_MS
  // Never at or over the blue car: platinum always takes a lap that beats it well.
  return Math.min(ms, Math.round(paceMs * 0.9))
}
