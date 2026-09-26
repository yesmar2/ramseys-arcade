/**
 * Ace Chase: Bumps and Banks, a hole on trial. One big open green with walls all round, and everything
 * on it bends the ball: a hill in the middle that a putt curves off to whichever side it passes, a hump
 * up on the left and a lower, wider one on the right, and the top of the green tilting left, so a putt
 * breaks as it dies, the slower the more. Two rocks stand either side of the way up from the tee, a log
 * lies across the top in the way of the straight line to anything behind it, and the right wall steps in
 * at an angle as a rubber bank to play off. The target moves each time.
 *
 * Imports only ./physics, so a script can run it with plain Node.
 */
import { gauss, rounded, smooth, type HoleDef } from './physics.ts'

/** The green's edges: wide at the tee end, the right side stepping in along the bank. */
const LEFT = -7
const RIGHT = 7
const RIGHT_TOP = 5
const TEE_END = 15
const FAR_END = -15
/** The right bank: from the right wall at z 0 in to x 5 at z -6. */
const BANK_FROM = 0
const BANK_TO = -6
/** The log across the top. */
const LOG_Z = -5.5
const LOG_HALF = 2.2
/** The top of the green falls to the left, 3.5 in a hundred, from about z -2 on up. */
const TILT = 0.035

export const BUMPS_AND_BANKS: HoleDef = {
  name: 'Bumps and Banks',
  note: 'Curve it off the humps, bank it off the rubber, get round the rocks and the log, and let it break down the tilt to the target.',
  green: rounded(
    [
      [LEFT, TEE_END],
      [RIGHT, TEE_END],
      [RIGHT, BANK_FROM],
      [RIGHT_TOP, BANK_TO],
      [RIGHT_TOP, FAR_END],
      [LEFT, FAR_END],
    ],
    1,
  ),
  tee: { x: 0, z: 13.5 },
  height: (x, z) =>
    // The hill in the middle, a hump up on the left and a lower, wider one down on the right.
    0.6 * gauss(x, z, 0, 3, 2.3) +
    0.3 * gauss(x, z, -4, -1.5, 1.3) +
    0.25 * gauss(x, z, 4.2, 6, 1.5) +
    // The top tilting left.
    TILT * x * smooth(-2, -6, z),
  // Checked on a grid of every setting from 40 to 80 power and 40° either side: each has 23 to 65 bullseye
  // settings over a few ways in, the biggest 11 to 45 of them (between the rocks and off the hill, off the
  // rubber, or off the left wall). Just right of the middle behind the log (x 2, and 0 far up) has under a
  // dozen and they're flukes; just behind the log in the middle (0, -9) the rubber gives away 77.
  spots: [
    { x: -4, z: -9 },
    { x: -2, z: -9 },
    { x: 3.5, z: -9 },
    { x: -4, z: -11 },
    { x: -2, z: -11 },
    { x: 0, z: -11 },
    { x: 3.5, z: -11 },
    { x: -4, z: -13 },
    { x: -2, z: -13 },
    { x: 3.5, z: -13 },
  ],
  // The far end is a cushion, so a putt too hard stays up there rather than coming back at the target.
  soft: (_x, z) => z < FAR_END + 0.3,
  // The angled stretch of the right wall is the rubber bank.
  rubber: (x, z) => (x > RIGHT_TOP + 0.2 && x < RIGHT - 0.2 && z < BANK_FROM - 0.3 && z > BANK_TO + 0.3 ? 0.9 : undefined),
  walls: [{ ax: -LOG_HALF, az: LOG_Z, bx: LOG_HALF, bz: LOG_Z, name: 'the log' }],
  bumpers: [
    { x: -3, z: 7, r: 0.45, rock: true },
    { x: 3, z: 7, r: 0.45, rock: true },
  ],
  laid: true,
  // The humps and the tilt drawn plainly, lighter up and darker down: they're what the putt is read by.
  relief: 4,
}
