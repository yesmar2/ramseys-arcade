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
 * Ramsey found it too long and too winding (2026-09-26): every shot plays out too differently to know
 * how to adjust. The Short Way Round (./shortWay) meets it halfway.
 *
 * It's laid with ./course, like a road. Imports only ./course and ./physics, so a script can run it
 * with plain Node.
 */
import { course, laid, profile } from './course.ts'
import { smooth, type HoleDef } from './physics.ts'

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

export const LONG_WAY_ROUND: HoleDef = laid(line, {
  name: 'The Long Way Round',
  note: 'Through the posts, then down the hill the long way: round the bend and the hairpin, down the long straight, round the last bend, and off the rubber into the pocket.',
  tee: TEE,
  // 1.6 m either side, wider round the posts, and wider down the pocket, for the target's rings.
  half: (s) =>
    1.6 + 0.7 * smooth(PATCH[0] - 1.5, PATCH[0], s) * (1 - smooth(PATCH[1], BEND, s)) + 0.2 * smooth(CORNER + 2, CORNER + 4, s),
  // Down the hill at 9 in a hundred on the straights and 8.5 round the bends, just under the 9.8 a
  // rolling ball keeps its pace on; level round the corner; then up the pocket to a level top with the
  // target on it and a dip behind: too soft stops on the climb, too hard runs on past into the dip.
  rise: profile([
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
  ]),
  // The pace a ball that makes the pocket comes round each bend at.
  paces: [5, 4.9, 4.6],
  // A little down the straights, a bobsled run round the bends; flat through the posts, so a ball's line
  // through them is straight, and round the corner; a shallow trough down the pocket.
  hollow: (s, k) => {
    const through = 0.08 + 0.42 * Math.abs(k) * 5.5
    const flat = 1 - smooth(PATCH[1], PATCH[1] + 2, s)
    const corner = smooth(CORNER - 3, CORNER - 1.7, s) * (1 - smooth(CORNER + 1.7, CORNER + 3, s))
    const pocket = smooth(CORNER + 1.7, CORNER + 3, s)
    return through * (1 - flat) * (1 - corner) * (1 - pocket) + 0.05 * pocket
  },
  ease: 1.5,
  spots: [{ s: CORNER + 8.2 }],
  cushion: END - 0.8,
  // Rows of one, two and three: straight at the first is no good, and too wide meets the second; between
  // the two, 2.4° to 4.7° either way, there's a line either side of the middle.
  posts: [
    { s: TEE + 6, d: 0 },
    { s: TEE + 8.5, d: -0.95 },
    { s: TEE + 8.5, d: 0.95 },
    { s: TEE + 11, d: -1.9 },
    { s: TEE + 11, d: 0 },
    { s: TEE + 11, d: 1.9 },
  ],
  // A mirror right across the corner, turning every ball that comes down the last straight into the pocket.
  rubbers: [{ corner: 0, e: 0.95 }],
  ends: { tee: 1.2, far: 0.5 },
})
