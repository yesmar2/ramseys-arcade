import type { Run } from './sim'

/*
 * The easter egg: three donuts, the car spun round three whole times in one go (HotLapGame reports it).
 *
 * A donut is the sim's own (sim.ts donutStep): slow or stopped, the wheel hard over, a tap of the brake
 * swings the back end out and the gas keeps it spinning, about a turn every 1.2 s. So the rule is simply
 * three whole turns the same way inside one donut, which takes about four seconds. It used to be three
 * slow circles of the wheel held over, before the car could really spin, which took twenty. It reads
 * the run and changes nothing in it.
 */

/** Three whole turns. */
const TURNS = 3 * 2 * Math.PI

export type Donuts = {
  /** How far the car has turned, its own way round, since this donut began. */
  turned: number
  /** Its heading at the last step of this donut, or null out of one. */
  lastH: number | null
  /** Spun this lap: it happens once a lap. */
  done: boolean
}

export function newDonuts(): Donuts {
  return { turned: 0, lastH: null, done: false }
}

/**
 * One step of a lap, after the sim's: true as the third turn of a donut closes, once a lap. The sim never
 * wraps the car's heading (sim.ts stepRun), so two headings a step apart say how far it turned.
 */
export function spinDonuts(d: Donuts, run: Run): boolean {
  if (d.done) return false
  if (run.donut === 0) {
    d.turned = 0
    d.lastH = null
    return false
  }
  if (d.lastH !== null) d.turned += (run.h - d.lastH) * run.donut
  d.lastH = run.h
  if (d.turned < TURNS) return false
  d.done = true
  return true
}
