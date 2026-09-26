/**
 * Ace Chase: The Short Way Round, halfway between the round's holes and The Long Way Round (./longWay),
 * which was too long and too winding to learn: every putt played out too differently to know how to
 * adjust. The same pieces, once each, in about 54 m: a straight with the patch of posts in front of the
 * tee, one banked bend, a short straight into a rubber set across a corner, and the pocket it turns the
 * ball into, climbing to a level top with the target on it, and on up past it.
 *
 * The angle threads the posts; the power takes the ball round the bend, off the rubber and up the pocket,
 * and the harder, the further up it stops, short or past: past the target the pocket keeps climbing,
 * gently enough to stop on, so a putt too hard by a little stops a little past and too hard by a lot, a
 * lot past, and the miss says by how much. (A dip and a cushion behind the target stopped every putt too
 * hard in the same place, whatever the power: nothing to adjust by.)
 *
 * Imports only ./course and ./physics, so a script can run it with plain Node.
 */
import { course, laid, profile } from './course.ts'
import { smooth, type HoleDef } from './physics.ts'

const line = course({ x: 0, z: 18 }, [
  { line: 16, name: 'the posts' },
  { arc: 7, turn: -90, name: 'the bend' },
  { line: 9, name: 'the straight' },
  { corner: 90, name: 'the rubber' },
  { line: 18, name: 'the pocket' },
])

/** Where the parts start along the line, in metres from the tee end. */
const BEND = 16
const STRAIGHT = BEND + (Math.PI / 2) * 7
const CORNER = STRAIGHT + 9
const END = line.length
/** The tee, and the patch of posts in front of it. */
const TEE = 1.5
const PATCH = [4.5, 13.5] as const

export const SHORT_WAY_ROUND: HoleDef = laid(line, {
  name: 'The Short Way Round',
  note: 'Through the posts, round the bend, and off the rubber into the pocket.',
  tee: TEE,
  // 1.6 m either side, wider round the posts, and wider down the pocket, for the target's rings.
  half: (s) =>
    1.6 + 0.7 * smooth(PATCH[0] - 1.5, PATCH[0], s) * (1 - smooth(PATCH[1], BEND, s)) + 0.2 * smooth(CORNER + 2, CORNER + 4, s),
  // Level through the posts, so a ball that strikes one stops among them; then down the hill at about 6 in
  // a hundred, so the ball slows as it goes and a weak putt stops where its power ran out, rather than
  // crawling on to the corner; level round the corner; up the pocket to a level top with the target; then
  // on up at 8 in a hundred, a slope a ball can stop on.
  rise: profile([
    [0, 2.17],
    [PATCH[1] + 1, 2.17],
    [18, 2],
    [STRAIGHT, 1.48],
    [CORNER - 2, 1],
    [CORNER + 2, 1],
    [CORNER + 7, 1.24],
    [CORNER + 9.5, 1.24],
    [CORNER + 11, 1.32],
    [CORNER + 13, 1.48],
    [CORNER + 15, 1.64],
    [END - 0.5, 1.84],
    [END, 1.84],
  ]),
  paces: [5.2],
  // A little down the straights, hollowed round the bend; flat through the posts, so a ball's line through
  // them is straight, and round the corner; a shallow trough down the pocket.
  hollow: (s, k) => {
    const through = 0.08 + 0.42 * Math.abs(k) * 5.5
    const flat = 1 - smooth(PATCH[1], PATCH[1] + 2, s)
    const corner = smooth(CORNER - 3, CORNER - 1.7, s) * (1 - smooth(CORNER + 1.7, CORNER + 3, s))
    const pocket = smooth(CORNER + 1.7, CORNER + 3, s)
    return through * (1 - flat) * (1 - corner) * (1 - pocket) + 0.03 * pocket
  },
  ease: 1.5,
  spots: [{ s: CORNER + 8.2 }],
  cushion: END - 0.8,
  posts: [
    { s: TEE + 6, d: 0 },
    { s: TEE + 8.5, d: -0.95 },
    { s: TEE + 8.5, d: 0.95 },
    { s: TEE + 11, d: -1.9 },
    { s: TEE + 11, d: 0 },
    { s: TEE + 11, d: 1.9 },
  ],
  rubbers: [{ corner: 0, e: 0.95 }],
  ends: { tee: 1.2, far: 0.5 },
})
