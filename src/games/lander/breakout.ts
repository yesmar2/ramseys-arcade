import { soundOut } from '../../lib/sound'
import { GHOST_STRIDE, type Breach, type Cave } from './sim'

/*
 * Lander's easter egg: a cracked patch of wall in every cave, with open space behind it (sim.ts Breach has the
 * rules). This finds where: worked out from the cave alone (its walls, and the blue ship's flight down it, which
 * is the cave's own), so everyone flying the day's cave finds it in the same place. It's a side wall about a
 * third of the way down, a little off the line ships fly, where the rock is thin and nothing else of the cave is
 * on the far side: the space beyond it, and the moon floating in it, are a dead end. Its clue is the patch
 * itself: cracks in the wall with starlight showing through them (scene.ts).
 */

/** The rock's thickness, from the wall to the space, and the width of the way through it, in metres. */
const DEEP = 2.6
const WIDE = 4
/** The moon: its size, and where it floats from where the way comes out (a share of `far` out, and down a little). */
const MOON_R = 2.3
const MOON_OUT = 0.5
const MOON_DOWN = 2.8
/** The patch is kept this far off the blue ship's line, and from a gate, in metres. */
const OFF_LINE = 4.5
const OFF_GATE = 3.5
/** Rock kept between the space and the rest of the cave: everywhere, and away from the patch's own stretch. */
const CRUST = 1.2
const CLEAR = 3
/** How far a wall may lean from upright and still be a side wall: about 30°. */
const UPRIGHT = 0.5

/**
 * Where it's looked for, in turn till somewhere will do: how far out into the space a ship goes before it's
 * lost, the stretch of the tunnel (from and to, as shares of its length), and how flat the wall must be across
 * the patch (the walls of the nodes either side within this much of its line, in metres). A third of the way
 * down is best, with the most space; a cave with nowhere there has it a little further up or down, then with
 * less space past it, and last (six of the first 180 caves) on a wall that bends a little more.
 */
const TRIES = [
  ...[18, 15, 12.5].flatMap((far) =>
    [
      [0.22, 0.5],
      [0.14, 0.65],
      [0.06, 0.85],
    ].map(([from, to]) => ({ far, from: from!, to: to!, flat: 0.5 })),
  ),
  { far: 12.5, from: 0.06, to: 0.85, flat: 0.7 },
]

const placed = new WeakMap<Cave, Breach | null>()

/**
 * The breach of a cave, given the blue ship's flight down it (runs.ts paceOf's ghost, sim.ts paceRun): null only
 * in a cave with nowhere for it. Worked out once a cave.
 */
export function breachOf(cave: Cave, flown: readonly number[]): Breach | null {
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

/** Whether a point is in any of the cave's air, anywhere along it: a far stretch of it may come back close. */
function inAnyAir(cave: Cave, x: number, y: number): boolean {
  for (const m of cave.rooms) if (x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1) return true
  const N = cave.nodes
  for (let i = 0; i < N.length; i++) {
    const a = N[i]!
    const dx = x - a.x
    const dy = y - a.y
    if (dx * dx + dy * dy <= a.r * a.r) return true
    const b = N[i + 1]
    if (!b) break
    const ex = b.x - a.x
    const ey = b.y - a.y
    const L2 = ex * ex + ey * ey
    const t = (dx * ex + dy * ey) / L2
    if (t >= 0 && t <= 1 && Math.abs(dx * ey - dy * ex) / Math.sqrt(L2) <= a.r + (b.r - a.r) * t) return true
  }
  return false
}

/**
 * The patch at a node's wall, on one side, if it fits there: a side wall, flat across the patch, with only rock
 * behind it, and room for the space and its moon past it with none of the rest of the cave near.
 */
function fit(cave: Cave, i: number, side: 1 | -1, far: number, flat: number): Breach | null {
  const N = cave.nodes
  const p = N[i]!
  const a = N[i - 1]!
  const b = N[i + 1]!
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  // Out through the wall, square to the way the cave runs there.
  const ux = (side * -(b.y - a.y)) / L
  const uy = (side * (b.x - a.x)) / L
  if (Math.abs(uy) > Math.sin(UPRIGHT)) return null
  const x = p.x + ux * p.r
  const y = p.y + uy * p.r
  // The wall flat across the patch: the walls of the nodes either side near its line.
  for (const j of [i - 2, i - 1, i + 1, i + 2]) {
    const q = N[j]
    if (!q) return null
    const wx = q.x + ux * q.r
    const wy = q.y + uy * q.r
    if (Math.abs((wx - x) * ux + (wy - y) * uy) > flat) return null
  }
  const frame = (px: number, py: number): [number, number] => [(px - x) * ux + (py - y) * uy, (py - y) * ux - (px - x) * uy]
  const at = (out: number, along: number): [number, number] => [x + ux * out - uy * along, y + uy * out + ux * along]
  // Only rock behind it, all the way through the wall.
  for (let out = 0.3; out <= DEEP + 0.3; out += 0.4) {
    for (let along = -WIDE / 2; along <= WIDE / 2 + 1e-9; along += 0.5) {
      const [px, py] = at(out, along)
      if (inAnyAir(cave, px, py)) return null
    }
  }
  // The space past it, out to `far` and a little more, clear of every node's air: kept well away from the cave
  // but for the patch's own stretch, where the wall is all there is between them.
  const reach = far + 3
  const toSpace = (px: number, py: number) => {
    const [out, along] = frame(px, py)
    if (out >= DEEP) return Math.max(0, Math.hypot(out - DEEP, along) - reach)
    return Math.hypot(DEEP - out, along - Math.max(-reach, Math.min(reach, along)))
  }
  for (let j = 0; j < N.length; j++) {
    const q = N[j]!
    const keep = Math.abs(j - i) <= 6 ? CRUST : CLEAR
    if (toSpace(q.x, q.y) < q.r + keep) return null
  }
  for (const m of cave.rooms) {
    for (let px = m.x0; px <= m.x1 + 1e-9; px += 1) {
      if (toSpace(px, m.y0) < CLEAR || toSpace(px, m.y1) < CLEAR) return null
    }
    for (let py = m.y0; py <= m.y1 + 1e-9; py += 1) {
      if (toSpace(m.x0, py) < CLEAR || toSpace(m.x1, py) < CLEAR) return null
    }
  }
  // The moon: out from where the way comes out, and a little down, all of it in the space with room round it.
  const [mx0, my0] = at(DEEP + far * MOON_OUT, 0)
  const moon = { x: mx0, y: my0 - MOON_DOWN, r: MOON_R }
  const [mout, malong] = frame(moon.x, moon.y)
  if (mout - DEEP < MOON_R + 1.5 || Math.hypot(mout - DEEP, malong) > far - MOON_R - 1.5) return null
  // Its top cut flat, a pad across it.
  const top = moon.y + MOON_R * 0.6
  const half = Math.sqrt(MOON_R * MOON_R - (MOON_R * 0.6) ** 2) - 0.1
  return { x, y, ux, uy, deep: DEEP, wide: WIDE, far, moon, pad: { x0: moon.x - half, x1: moon.x + half, y: top, end: false } }
}

/**
 * Where it is: of the walls it fits, the one nearest a third of the way down, kept off the blue ship's line and
 * the gates, where the cave is wide enough to ram it, on the most upright wall.
 */
function place(cave: Cave, flown: readonly number[]): Breach | null {
  const N = cave.nodes
  for (const { far, from, to, flat } of TRIES) {
    let best: Breach | null = null
    let bestScore = -Infinity
    for (let i = 3; i < N.length - 3; i++) {
      const along = N[i]!.s / cave.length
      if (along < from || along > to) continue
      for (const side of [1, -1] as const) {
        // Off the line and clear of the gates first: quicker to know than whether it fits.
        const p = N[i]!
        const a = N[i - 1]!
        const b = N[i + 1]!
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const wx = p.x + ((side * -(b.y - a.y)) / L) * p.r
        const wy = p.y + ((side * (b.x - a.x)) / L) * p.r
        let near = Infinity
        for (let j = 0; j + 1 < flown.length && near >= OFF_LINE * OFF_LINE; j += GHOST_STRIDE) {
          near = Math.min(near, (flown[j]! - wx) ** 2 + (flown[j + 1]! - wy) ** 2)
        }
        if (near < OFF_LINE * OFF_LINE) continue
        if (cave.gates.some((g) => toSegment(wx, wy, g.x0, g.y0, g.x1, g.y1) < OFF_GATE)) continue
        const breach = fit(cave, i, side, far, flat)
        if (!breach) continue
        const line = Math.sqrt(near)
        // A third of the way down matters most; then room to ram it, an upright wall, and not so far off the
        // line that nobody flies near enough to see the cracks.
        const score = -Math.abs(along - 1 / 3) * 40 + p.r * 0.6 - Math.abs(breach.uy) * 3 - Math.max(0, line - 9) * 0.4
        if (score > bestScore) {
          bestScore = score
          best = breach
        }
      }
    }
    if (best) return best
  }
  return null
}

/* ---------- its sounds, through the sound effects' bus (soundOut): the mute switch and the limiter hold ---------- */

/** A short burst of noise, shaped: what a crack and a crumble are made of. */
function noise(seconds: number, from: number, to: number, level: number, at = 0) {
  const out = soundOut()
  if (!out) return
  const { audio } = out
  const t0 = audio.currentTime + at
  const n = Math.max(1, Math.round(audio.sampleRate * seconds))
  const buffer = audio.createBuffer(1, n, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2
  const src = audio.createBufferSource()
  src.buffer = buffer
  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(from, t0)
  filter.frequency.exponentialRampToValueAtTime(to, t0 + seconds)
  const g = audio.createGain()
  g.gain.value = level
  src.connect(filter)
  filter.connect(g)
  g.connect(out.out)
  src.start(t0)
  src.stop(t0 + seconds + 0.02)
}

/** A knock on the patch: a sharp crack. */
export function crackSound() {
  noise(0.09, 5200, 1800, 0.5)
}

/** The patch giving way: a crack, then rock tumbling. */
export function breakSound() {
  noise(0.08, 6000, 2500, 0.55)
  noise(0.7, 2600, 240, 0.6, 0.05)
}

/** Down on the moon: three soft rising notes. */
export function smallStepSound() {
  const out = soundOut()
  if (!out) return
  const { audio } = out
  const t0 = audio.currentTime
  const bus = audio.createGain()
  bus.gain.value = 0.2
  bus.connect(out.out)
  ;[523.25, 659.25, 987.77].forEach((hz, k) => {
    const at = t0 + k * 0.14
    const tone = audio.createOscillator()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(hz, at)
    const g = audio.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(1, at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
    tone.connect(g)
    g.connect(bus)
    tone.start(at)
    tone.stop(at + 0.52)
  })
}
