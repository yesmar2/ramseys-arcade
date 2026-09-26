/**
 * Ace Chase: King of the Hill, a hole on trial. From a tee up on a rise, down into three rollers, humps
 * across the lane like Rolling Thunder's; a rubber set across the corner at the bottom, the bank shot that
 * turns the ball on to the last stretch; and a climb to a small flat summit with the target on it, where
 * the summit ends in a drop into a pond. About 44 m.
 *
 * Built to be tuned, not found: there's no dish round the target to draw a ball in and nothing on the
 * way that steers one back to the middle, so the ball stops exactly where the putt sends it. The humps
 * and the climb run straight across the lane, so they take and give pace but never turn the ball; the
 * aim carries all the way, off the rubber, to where on the summit it stops. Too soft stops on the climb,
 * too hard runs over the top into the pond, and the target moves across the summit every time.
 *
 * Imports only ./course and ./physics, so a script can run it with plain Node.
 */
import { course, laid, profile } from './course.ts'
import { band, type HoleDef } from './physics.ts'

const line = course({ x: 0, z: 24 }, [
  { line: 26, name: 'the rollers' },
  { corner: 90, name: 'the rubber' },
  { line: 10, name: 'on the climb' },
  { line: 5, name: 'on the top' },
  { line: 3, name: 'the pond' },
])

/** Where the parts are along the line, in metres from the tee end. */
const TEE = 1.5
const CORNER = 26
const TOP = CORNER + 10
const EDGE = TOP + 5
const END = line.length

const rise = profile([
  // The tee up on a rise, and the run down off it into the rollers.
  [0, 1],
  [3, 1],
  [7.5, 0],
  // Level round the corner.
  [CORNER - 2.5, 0],
  [CORNER + 2.5, 0],
  // The climb, never quite steeper than a ball can stop on, to the level top.
  [TOP, 0.45],
  [EDGE, 0.45],
  // Over the back, down into the pond.
  [EDGE + 0.5, -0.9],
  [END, -0.9],
])

/** The rollers: three humps straight across the lane. */
const rollers = (s: number) => 0.26 * band(s, 11, 1.1) + 0.34 * band(s, 16.5, 1.2) + 0.22 * band(s, 21, 1)

export const KING_OF_THE_HILL: HoleDef = laid(line, {
  name: 'King of the Hill',
  note: 'Down over the rollers, off the rubber, and up the climb. The target sits on the summit, and behind it is the pond.',
  tee: TEE,
  half: () => 1.9,
  rise: (s) => rise(s) + rollers(s),
  paces: [],
  hollow: () => 0,
  ease: 1.5,
  dish: false,
  water: -0.55,
  // Checked with scripts/acechase-trial.mjs: 61 to 133 bullseye settings a spot, in two or three windows
  // (straight off the rubber, and off a side rail too), none more than two power points wide; the test
  // players take a median of 4 tries, and 6 as a rougher player.
  spots: [TOP + 1.5, TOP + 2.5].flatMap((s) => [-0.9, 0, 0.9].map((d) => ({ s, d }))),
  cushion: END - 0.5,
  rubbers: [{ corner: 0, e: 0.92 }],
  ends: { tee: 1.2, far: 0.5 },
  // Only a putt aimed out meets a rail, and then it bounces back to near the rail whatever the aim was, so
  // the misses say it did ("off the rail: …"): it's the angle to change.
  rail: 'the rail',
})
