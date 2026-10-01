import { soundOut } from '../../lib/sound'
import { GHOST_STRIDE, inAir, toWorld, type Cave } from './sim'

/*
 * Lander's easter egg: a little green alien standing in a nook of every cave, about a third of the way down,
 * who waves when your ship comes close (scene.ts draws it, LanderGame.tsx says when it's found). It's only
 * drawn: not rock, nothing the ship can hit, and nothing in sim.ts knows it's there, so the cave, the runs and
 * the boards are as they were. Where it stands is worked out from the cave alone (its walls, and the blue
 * ship's flight down it, which is the cave's own), so everyone flying the day's cave finds it in the same
 * place. Far off, all there is of it is two eyes blinking in the dark: its clue.
 */

/**
 * Where the alien stands: its feet on the cave's wall, how far it leans from straight up (right positive, as
 * the ship's angle is: upright on a floor, square to a steep wall where a cave has no floor), and the way it
 * faces, out of its nook (+1 to its right, −1 to its left).
 */
export type Alien = { x: number; y: number; a: number; facing: 1 | -1 }

/** How tall it stands, antennae and all, in metres: a little less than the ship is long. */
export const ALIEN_H = 1.75
/** Its middle, where a ship is measured from, this far up from its feet. */
export const ALIEN_MID = 0.85
/** A ship within this many metres of its middle gets a wave. */
export const WAVE_NEAR = 4

/** Its middle, in the world. */
export const alienMiddle = (al: Alien) => toWorld(al, 0, ALIEN_MID)

/** The room it needs: this far either side of its feet (an arm out, waving) and this far up. */
const ROOM_SIDE = 0.95
const ROOM_UP = 2.1
/** Kept this far from a gate's line, so the dashes never cross it. */
const OFF_GATE = 3
/** A side wall this near, at its middle's height, tucks it into a nook. */
const TUCKED = 2.4
/** The steepest wall it stands on upright, as a floor (about 22°), and the steepest it clings to, square to it. */
const FLOOR = 0.38
const WALL = 1.75

/**
 * Where it's looked for, in turn till somewhere will do: how far down the tunnel (a share of its length), how
 * far it's kept off the blue ship's flight, in metres, and the steepest wall it may stand on. A ship flying
 * that line goes by without a wave, so it's a little way off it. Where a third of the way down has no floor,
 * the line may come a little nearer, still out of reach, then a little further up and down is looked at.
 * Some caves are all shafts and slants, with no floor near a third of the way down or none at all: there it
 * clings to a wall.
 */
const SEARCH = [
  [0.22, 0.48, 5, FLOOR],
  [0.22, 0.48, 4.5, FLOOR],
  [0.15, 0.6, 4.5, FLOOR],
  [0.22, 0.48, 5, WALL],
  [0.1, 0.8, 4.5, FLOOR],
  [0.1, 0.8, 4.5, WALL],
  [0.05, 0.92, WAVE_NEAR + 0.2, WALL],
] as const

const placed = new WeakMap<Cave, Alien | null>()

/**
 * The alien of a cave, given the blue ship's flight down it (runs.ts paceOf's ghost, sim.ts paceRun): null
 * only in a cave with nowhere at all to stand it (none of the plan's). Worked out once a cave.
 */
export function alienOf(cave: Cave, flown: readonly number[]): Alien | null {
  if (!placed.has(cave)) placed.set(cave, place(cave, flown))
  return placed.get(cave)!
}

/** How far a point is from a segment. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const ex = bx - ax
  const ey = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1)))
  return Math.hypot(px - ax - ex * t, py - ay - ey * t)
}

/**
 * Where it stands: on the cave's wall as the scene draws it, with rock under both feet, room to wave, off the
 * blue ship's flight and clear of the gates. Of those, the best is about a third of the way down the tunnel,
 * where the cave is wide, tucked against a side wall, on the flattest footing there is.
 */
function place(cave: Cave, flown: readonly number[]): Alien | null {
  const N = cave.nodes
  for (const [from, to, offLine, steep] of SEARCH) {
    let best: Alien | null = null
    let bestScore = -Infinity
    for (let i = 1; i < N.length - 1; i++) {
      const p = N[i]!
      const along = p.s / cave.length
      if (along < from || along > to) continue
      // The walls either side, `r` out from the middle, square to the way the cave runs there.
      const a = N[i - 1]!
      const b = N[i + 1]!
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / L
      const ny = (b.x - a.x) / L
      for (const side of [1, -1]) {
        // Out of the wall into the air, and how far that leans from straight up.
        const lean = Math.atan2(-side * nx, -side * ny)
        if (Math.abs(lean) > steep) continue
        const al: Alien = { x: p.x + side * nx * p.r, y: p.y + side * ny * p.r, a: Math.abs(lean) <= FLOOR ? 0 : lean, facing: 1 }
        /** Whether a point on it, to its right and up from its feet, is in the air. */
        const free = (px: number, py: number) => {
          const [x, y] = toWorld(al, px, py)
          return inAir(cave, x, y, i)
        }
        // Rock under both feet and air over them: a wall the cave really has, not one another stretch's air covers.
        if (free(-0.35, -0.3) || free(0.35, -0.3) || !free(0, 0.3)) continue
        // Off the line and clear of the gates (quicker to know than the room it has, so first).
        const [mx, my] = alienMiddle(al)
        let near = Infinity
        let nearest = 0
        for (let j = 0; j + 1 < flown.length && near >= offLine * offLine; j += GHOST_STRIDE) {
          const d = (flown[j]! - mx) ** 2 + (flown[j + 1]! - my) ** 2
          if (d < near) {
            near = d
            nearest = j
          }
        }
        if (near < offLine * offLine) continue
        if (cave.gates.some((g) => toSegment(mx, my, g.x0, g.y0, g.x1, g.y1) < OFF_GATE)) continue
        // Room to stand and wave, up to over its antennae.
        let room = true
        for (let u = 0.45; u <= ROOM_UP && room; u += 0.3) {
          for (const v of [-ROOM_SIDE, -ROOM_SIDE / 2, 0, ROOM_SIDE / 2, ROOM_SIDE]) {
            if (!free(v, u)) {
              room = false
              break
            }
          }
        }
        if (!room) continue
        const line = Math.sqrt(near)
        // A wall at its side, either way, at its middle's height.
        const away = (dir: number) => {
          for (let d = 0.25; d <= 6; d += 0.25) if (!free(dir * d, ALIEN_MID)) return d
          return Infinity
        }
        const left = away(-1)
        const right = away(1)
        const tucked = Math.min(left, right)
        // A third of the way down matters most; then the cave's width there, a wall at its back, not so far off
        // the line that nobody flies near, and the flattest footing.
        const score =
          -Math.abs(along - 1 / 3) * 40 + p.r * 0.8 + (tucked <= TUCKED ? 2.5 - tucked * 0.4 : 0) - Math.max(0, line - 8) * 0.5 - Math.abs(al.a) * 3
        if (score > bestScore) {
          bestScore = score
          // It faces out of its nook, or, standing in the open, toward the line ships fly.
          const [rx, ry] = toWorld({ x: 0, y: 0, a: al.a }, 1, 0)
          al.facing = tucked <= TUCKED ? (left < right ? 1 : -1) : (flown[nearest]! - mx) * rx + (flown[nearest + 1]! - my) * ry >= 0 ? 1 : -1
          best = al
        }
      }
    }
    if (best) return best
  }
  return null
}

/**
 * Its hello: two little rising chirps, through the sound effects' bus (soundOut), so the mute switch and the
 * limiter hold, and a game playing itself makes none.
 */
export function sayHi() {
  const out = soundOut()
  if (!out) return
  const { audio } = out
  const t0 = audio.currentTime
  const bus = audio.createGain()
  bus.gain.value = 0.22
  bus.connect(out.out)
  for (const [at, from, to] of [
    [0, 620, 980],
    [0.13, 760, 1320],
  ] as const) {
    const chirp = audio.createOscillator()
    chirp.type = 'triangle'
    chirp.frequency.setValueAtTime(from, t0 + at)
    chirp.frequency.exponentialRampToValueAtTime(to, t0 + at + 0.09)
    const g = audio.createGain()
    g.gain.setValueAtTime(0.0001, t0 + at)
    g.gain.exponentialRampToValueAtTime(1, t0 + at + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.11)
    chirp.connect(g)
    g.connect(bus)
    chirp.start(t0 + at)
    chirp.stop(t0 + at + 0.12)
  }
}
