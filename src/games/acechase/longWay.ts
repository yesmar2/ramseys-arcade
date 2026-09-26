/**
 * Ace Chase: The Long Way Round, a hole of the length and the turns the three in a round don't have.
 * Down a hillside from the tee: a straight with a patch of posts in it, a banked bend, a straight, a
 * banked hairpin, a long straight, a second hairpin, and a last straight into a rubber corner that turns
 * the ball into the pocket where the target is. About 99 m, falling about 7.4 m.
 *
 * The posts come first, where a ball's line through them is the angle it was hit at and nothing else:
 * the angle threads them, the power takes it the rest of the way. After them it's a ride. The lane falls
 * at a little less than the slope a rolling ball keeps its pace on, so a ball runs the whole way at
 * about the pace it was hit, slowing a little; the bends are banked for a ball at a brisk pace and
 * hollowed like a bobsled run, so a faster ball rides higher round them and a slower one lower, instead
 * of into the rail; and the rails are ones a ball glides along. The pocket climbs, to stop a ball off
 * the rubber on the target.
 *
 * It's laid with ./course, like a road. Imports only ./course and ./physics, so a script can run it
 * with plain Node.
 */
import { course, profile, whereOn } from './course.ts'
import { ROLL, dish, smooth, type HoleDef, type Spot } from './physics.ts'

const line = course({ x: 0, z: 30 }, [
  { line: 18, name: 'the posts' },
  { arc: 6, turn: -90, name: 'the first bend' },
  { line: 8, name: 'the second straight' },
  { arc: 5.5, turn: 180, name: 'the hairpin' },
  { line: 12, name: 'the long straight' },
  { arc: 5.5, turn: -180, name: 'the last bend' },
  { line: 8, name: 'the last straight' },
  { corner: 90, name: 'the rubber' },
  { line: 12, name: 'the pocket' },
])

/** Where the parts start along the line, in metres from the tee end. */
const BEND = 18
const STRAIGHT = BEND + (Math.PI / 2) * 6
const HAIRPIN = STRAIGHT + 8
const LONG = HAIRPIN + Math.PI * 5.5
const LAST_BEND = LONG + 12
const LAST = LAST_BEND + Math.PI * 5.5
const CORNER = LAST + 8
const END = line.length
/** The tee, and the patch of posts in front of it. */
const TEE = 1.5
const PATCH = [4.5, 13.5] as const

/** The lane: 1.6 m either side, wider round the posts, and wider down the pocket, for the target's rings. */
const half = (s: number) =>
  1.6 +
  0.7 * smooth(PATCH[0] - 1.5, PATCH[0], s) * (1 - smooth(PATCH[1], BEND, s)) +
  0.2 * smooth(CORNER + 2, CORNER + 4, s)

/**
 * Down the hill at 9 in a hundred on the straights and 8.5 round the bends, just under the 9.8 a rolling
 * ball keeps its pace on, so it arrives at each bend at much the pace it was hit; level round the
 * corner; then up the pocket to a level top with the target on it and a dip behind: too soft stops on
 * the climb, too hard runs on past into the dip.
 */
const rise = profile([
  [0, 8.43],
  [3, 8.43],
  [BEND, 7.08],
  [STRAIGHT, 6.28],
  [HAIRPIN, 5.56],
  [LONG, 4.09],
  [LAST_BEND, 3.01],
  [LAST, 1.54],
  [CORNER - 2, 1],
  [CORNER + 2, 1],
  [CORNER + 7, 1.24],
  [END - 1.4, 1.24],
  [END, 1.12],
])

/** The pace each bend is banked for, in metres a second: a ball that makes the pocket comes round them at about these. */
const PACES = [5, 4.9, 4.6]
/** How far the lane leans across the bends at `s`: the slope that turns a ball at the bend's pace round it. */
const EASE = 1.5
const lean = (s: number) => line.curve(s, EASE, (i) => PACES[i]! ** 2) / (ROLL * 9.81)
/** How deep the lane is hollowed across: a little down the straights, a bobsled run round the bends. */
const hollow = (s: number, k: number) => {
  const through = 0.08 + 0.42 * Math.abs(k) * 5.5
  // Flat through the posts, so a ball's line through them is straight, and round the corner; a shallow
  // trough down the pocket.
  const flat = 1 - smooth(PATCH[1], PATCH[1] + 2, s)
  const corner = smooth(CORNER - 3, CORNER - 1.7, s) * (1 - smooth(CORNER + 1.7, CORNER + 3, s))
  const pocket = smooth(CORNER + 1.7, CORNER + 3, s)
  return through * (1 - flat) * (1 - corner) * (1 - pocket) + 0.05 * pocket
}

const spot = (s: number, d = 0): Spot => {
  const p = line.at(s)
  return { x: p.x + Math.cos(p.phi) * d, z: p.z + Math.sin(p.phi) * d }
}

// The rubber: a mirror right across the corner, turning every ball that comes down the last straight into the pocket.
const corner = line.cornerBank(0, half(CORNER), 2 * half(CORNER))

export const LONG_WAY_ROUND: HoleDef = {
  name: 'The Long Way Round',
  note: 'Through the posts, then down the hill the long way: round the bend and the hairpin, down the long straight, round the last bend, and off the rubber into the pocket.',
  green: line.outline(half, { tee: 1.2, far: 0.5 }),
  tee: spot(TEE),
  height: (x, z, t) => {
    const { s, d } = line.local(x, z)
    const k = line.curve(s, EASE)
    return rise(s) - lean(s) * d + hollow(s, k) * d * d - dish(x, z, t)
  },
  spots: [spot(CORNER + 8.2)],
  soft: (x, z) => line.local(x, z).s > END - 0.8,
  walls: [{ ax: corner.a[0], az: corner.a[1], bx: corner.b[0], bz: corner.b[1], e: 0.95, rubber: true }],
  // The posts, in rows of one, two and three: straight at the first is no good, and too wide meets the
  // second; between the two, 2.4° to 4.7° either way, there's a line either side of the middle.
  bumpers: (
    [
      [TEE + 6, 0],
      [TEE + 8.5, -0.95],
      [TEE + 8.5, 0.95],
      [TEE + 11, -1.9],
      [TEE + 11, 0],
      [TEE + 11, 1.9],
    ] as const
  ).map(([s, d]) => ({ ...spot(s, d), r: 0.15, e: 0.5 })),
  laid: true,
  path: line.path(rise, 1.5),
  where: whereOn(line),
}

/** Holes to try out before they go in a round: /games/acechase/play?hole=<key>. */
export const TEST_HOLES: Record<string, HoleDef> = { long: LONG_WAY_ROUND }
