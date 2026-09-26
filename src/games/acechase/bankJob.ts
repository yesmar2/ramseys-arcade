/**
 * Ace Chase: The Bank Job, a hole on trial. An open green with a wall across it, and the target hidden
 * behind the wall: there's no straight way in. The whole left side is a rubber, and the way in is off it,
 * like a bank shot at pool, back across past the end of the wall and on to the target. The angle picks
 * where on the rubber the ball banks, and so which way it comes off; the power, how far it goes. The green
 * leans a little to the right, so a slow putt bends: the softer, the more.
 *
 * It answers The Short Way Round (./shortWay) being too easy: there the bend and the gutters steered every
 * ball back to the middle, so once through the posts only the power mattered. Here nothing steers, and the
 * aim counts all the way to the target, which moves each round.
 *
 * Imports only ./physics, so a script can run it with plain Node.
 */
import { dish, rounded, type HoleDef } from './physics.ts'

const LEFT = -5
const RIGHT = 5
/** The far end, and the tee end. */
const TOP = -18
const BOTTOM = 16
/** The wall: across from the right side to a gap before the rubber. */
const WALL_Z = -5
const WALL_END = -1
/** The green falls to the right, 2 in a hundred. */
const LEAN = 0.02

export const BANK_JOB: HoleDef = {
  name: 'The Bank Job',
  note: 'The wall hides the target. Bank it off the rubber on the left, round the end of the wall. The green leans right, so a soft putt bends.',
  green: rounded(
    [
      [LEFT, BOTTOM],
      [RIGHT, BOTTOM],
      [RIGHT, TOP],
      [LEFT, TOP],
    ],
    1,
  ),
  tee: { x: 3, z: 14.5 },
  height: (x, z, t) => -LEAN * x - dish(x, z, t),
  // Checked with scripts/acechase-trial.mjs: each has one window, 57 to 110 settings, at a bank of 24° to 33°
  // left and a power in the high 50s or low 60s. Near the gap a straight putt gets there without the
  // rubber, near the far end the cushion hands back a putt too hard, and tight behind the wall (2, -8)
  // the window's barely wider than a degree: none of those is offered.
  spots: [
    { x: 0.5, z: -8 },
    { x: 0.5, z: -10.5 },
    { x: 0.5, z: -13 },
    { x: 2, z: -10.5 },
    { x: 2, z: -13 },
    { x: 3.5, z: -10.5 },
    { x: 3.5, z: -13 },
  ],
  // The far end is a cushion, so a putt too hard stays at the back rather than coming back at the target.
  soft: (_x, z) => z < TOP + 0.3,
  // The whole left side is a rubber rail, springy, black and gold, the bank.
  rubber: (x, z) => (x < LEFT + 0.3 && z < BOTTOM - 1 && z > TOP + 1 ? 0.92 : undefined),
  walls: [
    // The wall, named in the misses when a ball strikes it: then it's the angle that's out (off the rubber
    // too steep, or not off it at all), however short it stopped.
    { ax: RIGHT, az: WALL_Z, bx: WALL_END, bz: WALL_Z, name: 'the wall' },
  ],
}
