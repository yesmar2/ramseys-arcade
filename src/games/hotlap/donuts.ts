import type { Run } from './sim'

/*
 * The easter egg: three donuts, the car spun round three whole times in one spot (HotLapGame reports it).
 *
 * The car can't power-slide round its nose: traction and stability control hold it, and at a crawl it
 * rolls where its wheels point. What it can do, measured in the sim as the page drives it, is a tight
 * circle with the wheel held over and the gas down. Rolling first (the wheel going over at 4 to 11 mph, a
 * fifth to half a second of gas from a standstill), it settles at about 9 mph on a circle some 8 m across,
 * once round in 6 s, and three take 20 to 24 s; blipping the gas to hold it near 13 mph takes 14 s. Wheel
 * and gas together from a standstill only crawl round at 2 mph, 25 s a circle, which counts too, in the
 * end. Faster than about 12 mph, the wheel held over and the gas down run it wide into the fence instead.
 *
 * So the rule: the car's heading turned three whole times the same way, all of it within REACH of where
 * the car is as the third closes. Nothing faster than about 28 mph stays that tight on any tyre, and no lap
 * turns more than a hairpin's half circle in that space, so driving round never comes near it. It reads the
 * run and changes nothing in it: the lap's time, its ghost and its board are as they'd be without it.
 */

/** Where the car is and how far it has turned, noted every this many steps of the sim: ten times a second. */
const EVERY = 12
/** The donuts all within this many metres of where the car is as the third closes. */
const REACH = 25
/** Three whole turns, either way round. */
const TURNS = 3 * 2 * Math.PI
/** Two minutes of notes at most: more than three donuts at a crawl take. */
const KEEP = 1200

export type Donuts = {
  /** Every EVERY steps: the car's x, y and heading, one after another, back to where it was last out of reach. */
  notes: number[]
  steps: number
  /** Spun this lap: it happens once a lap. */
  done: boolean
}

export function newDonuts(): Donuts {
  return { notes: [], steps: 0, done: false }
}

/**
 * One step of a lap, after the sim's: true as the third donut closes, once a lap. The sim never wraps the
 * car's heading (sim.ts stepRun), so two headings apart in time say how far it turned between them.
 */
export function spinDonuts(d: Donuts, run: Run): boolean {
  if (d.done || d.steps++ % EVERY !== 0) return false
  const notes = d.notes
  notes.push(run.x, run.y, run.h)
  if (notes.length > KEEP * 3) notes.splice(0, notes.length - KEEP * 3)
  for (let k = notes.length - 6; k >= 0; k -= 3) {
    if (Math.hypot(notes[k]! - run.x, notes[k + 1]! - run.y) > REACH) {
      // Out of reach of here: nothing from then on can be part of these donuts.
      notes.splice(0, k + 3)
      return false
    }
    if (Math.abs(run.h - notes[k + 2]!) >= TURNS) {
      d.done = true
      return true
    }
  }
  return false
}
