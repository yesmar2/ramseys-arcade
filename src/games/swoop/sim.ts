/**
 * Swoop without the pictures: the day's hills, a bird that slides down them and flies off their tops, and the
 * blue bird, which flies every day's hills first to set the time to beat.
 *
 * Metres and seconds, y up. The hills are a run of tops and bottoms joined by half cosine waves, so every
 * slope and every curve is smooth. Holding pulls the bird down hard. On a downhill that's speed; on an uphill
 * it's speed thrown away; over a top it keeps the bird on the hill, where letting go lets it fly off. In the
 * air, holding drops it sooner, to land on the far side of the next hill rather than into the face of it.
 * Landing along a downhill keeps the speed (and a clean one adds a little); landing into an uphill loses most
 * of it, never below LAND_FLOOR.
 *
 * Ramsey played the prototype (2026-10-06) and couldn't beat its blue bird, then learned to: the blue bird
 * here plays like a person who knows what to do and reacts a third of a second late (BLUE_HANDS), so a player
 * who has the hang of it beats it, and holding the whole way never does. Once he had, it was raced 10%
 * quicker along its own line (BLUE_PACE).
 *
 * No imports, so a script can run this with plain Node (scripts/swoop-daily.mjs plans the days with it). The
 * hills a day gets depend on everything here: once a day is planned, changing the hills or the physics
 * changes that day's hills, so don't, for days people have played.
 */

export const DT = 1 / 120
/** Gravity with hands off, and while holding, m/s². */
export const G_GLIDE = 20
export const G_DIVE = 62
/** The ground as a whole falls this much a metre along, under its two slow waves. */
const FALL = 0.005
/**
 * Air and snow both slow a bird the faster it goes, and past CAP it's like hitting a wall of wind, so the
 * very best runs top out rather than run away.
 */
const DRAG = 0.0011
const AIR_DRAG = 0.0005
const CAP = 55
const CAP_DRAG = 0.04
const drag = (v: number, k: number) => k * v * v + (v > CAP ? CAP_DRAG * (v - CAP) * (v - CAP) : 0)
/** A bird never quite stops: up the steepest hill it keeps crawling. */
export const MIN_SPEED = 9
const START_SPEED = 7
/** A landing within this angle of the slope, after this long in the air, is clean, and pays this much. */
export const CLEAN_ANGLE = 0.22
const CLEAN_AIR = 0.3
const CLEAN_BOOST = 1.05
/** Past this angle it's a thump. However badly it lands, it keeps this much of its speed. */
const BUMP_ANGLE = 0.62
const LAND_FLOOR = 0.6
/** The steepest a hill gets, as a slope. */
const MAX_SLOPE = 1.05
/** A ghost keeps where the bird was every this many steps: 20 times a second. */
export const GHOST_EVERY = 6
/** Ghost samples a second. */
export const GHOST_RATE = 1 / (DT * GHOST_EVERY)
/** A ghost sample's numbers: x, y, and whether it was holding (HOLD) or not (GLIDE). */
export const GHOST_STRIDE = 3
export const GLIDE = 0
export const HOLD = 1
/** The flags a run is split at, as shares of the way to the line. */
export const FLAG_AT = [0.25, 0.5, 0.75] as const

const r2 = (v: number) => Math.round(v * 100) / 100

/* ------------------------------------------------------------------ random --- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ----------------------------------------------------------------- the hills --- */

const FIRST = ['Clover', 'Bramble', 'Meadow', 'Honey', 'Willow', 'Thistle', 'Maple', 'Juniper', 'Bluebell', 'Pebble', 'Hazel', 'Primrose', 'Fern', 'Saffron', 'Marigold', 'Tumble', 'Buttercup', 'Heather']
const SECOND = ['Hills', 'Downs', 'Rise', 'Slopes', 'Ridge', 'Knolls', 'Dales', 'Rolls', 'Heights', 'Swells', 'Bumps', 'Fells']
/** The colour a day's hills are washed in: the arcade's own, a different one each day of the week. */
export const HILL_HUES = ['#3ecf8e', '#3ec8cf', '#f5b942', '#8a6ad4', '#4aa8e8', '#f2813a', '#e85d9a'] as const

export type Hills = {
  /** The day's number the hills are laid from, and the try the plan kept. */
  n: number
  attempt: number
  name: string
  /** The day's colour (HILL_HUES). */
  hue: string
  /** Each top and bottom, in order along the way: x, then y. */
  xs: number[]
  ys: number[]
  /** Where the line is, and the flags before it. */
  finish: number
  flags: number[]
  /** How many tops there are to fly off. */
  tops: number
}

/**
 * Day n's hills, try `attempt`: about a kilometre of tops and bottoms, in stretches of quick bumps and long
 * rollers, drifting up and down as a whole so some runs are long and fast and some climbs are long and slow,
 * down onto a long flat at the end with the line just past its foot. Try 0 is the prototype's hills.
 */
export function layHills(n: number, attempt = 0): Hills {
  const rnd = mulberry32((Math.imul(n + 7, 2654435761) ^ 0x51ed ^ Math.imul(attempt, 0x9e3779b1)) >>> 0)
  const between = (a: number, b: number) => a + rnd() * (b - a)
  const pts: [number, number][] = [
    [-60, 60],
    [0, 60],
  ]
  const length = between(1050, 1250)
  // The ground as a whole drifts along two slow waves, a little downhill on balance.
  const wave1 = between(0, Math.PI * 2)
  const wave2 = between(0, Math.PI * 2)
  const len1 = between(260, 420)
  const len2 = between(110, 180)
  const lift = between(8, 16)
  const base = (x: number) => 60 - x * FALL + Math.sin(x / len1 + wave1) * lift + Math.sin(x / len2 + wave2) * lift * 0.35
  let x = 0
  let y = 60
  let down = true
  let stretch = 0
  let spacing = 20
  let amp = 10
  while (x < length) {
    if (stretch <= 0) {
      // A new stretch: quick bumps, long rollers, or something between.
      const kind = rnd()
      if (kind < 0.3) {
        spacing = between(11, 16)
        amp = between(4, 8)
      } else if (kind < 0.65) {
        spacing = between(18, 26)
        amp = between(8, 15)
      } else {
        spacing = between(28, 40)
        amp = between(14, 24)
      }
      stretch = 4 + Math.floor(rnd() * 6)
    }
    let dx = spacing * between(0.8, 1.25)
    const mid = base(x + dx)
    const ny = down ? mid - amp * between(0.4, 0.6) : mid + amp * between(0.4, 0.6)
    // Never steeper than a skier would ski: widen the step rather than steepen it.
    const need = (Math.abs(ny - y) * Math.PI) / 2 / MAX_SLOPE
    if (dx < need) dx = need
    x += dx
    pts.push([x, ny])
    y = ny
    down = !down
    stretch -= 0.5
  }
  // The finish: down the last hill onto a long flat, the line just past its foot.
  if (!down) {
    x += spacing
    y = Math.max(y + amp * 0.5, base(x) + amp * 0.5)
    pts.push([x, y])
  }
  const footX = x + 34
  const footY = y - 18
  pts.push([footX, footY])
  pts.push([footX + 400, footY])
  const finish = footX + 22
  const name = `${FIRST[Math.floor(rnd() * FIRST.length)]} ${SECOND[Math.floor(rnd() * SECOND.length)]}`
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  let tops = 0
  for (let i = 1; i < pts.length - 1; i++) if (ys[i]! > ys[i - 1]! && ys[i]! > ys[i + 1]!) tops++
  return {
    n,
    attempt,
    name,
    hue: HILL_HUES[(((n - 1) % HILL_HUES.length) + HILL_HUES.length) % HILL_HUES.length]!,
    xs,
    ys,
    finish,
    flags: FLAG_AT.map((f) => finish * f),
    tops,
  }
}

/** The segment of the hills a spot is on. */
function seg(h: Hills, x: number): number {
  const xs = h.xs
  if (x <= xs[0]!) return 0
  if (x >= xs[xs.length - 1]!) return xs.length - 2
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid]! <= x) lo = mid
    else hi = mid
  }
  return lo
}

export function heightAt(h: Hills, x: number): number {
  const i = seg(h, x)
  const x0 = h.xs[i]!
  const x1 = h.xs[i + 1]!
  const y0 = h.ys[i]!
  const y1 = h.ys[i + 1]!
  const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
  return y0 + ((y1 - y0) * (1 - Math.cos(Math.PI * u))) / 2
}

export function slopeAt(h: Hills, x: number): number {
  const i = seg(h, x)
  const x0 = h.xs[i]!
  const dx = h.xs[i + 1]! - x0
  const u = Math.min(1, Math.max(0, (x - x0) / dx))
  return ((h.ys[i + 1]! - h.ys[i]!) * Math.PI * Math.sin(Math.PI * u)) / (2 * dx)
}

export function curveAt(h: Hills, x: number): number {
  const i = seg(h, x)
  const x0 = h.xs[i]!
  const dx = h.xs[i + 1]! - x0
  const u = Math.min(1, Math.max(0, (x - x0) / dx))
  return ((h.ys[i + 1]! - h.ys[i]!) * Math.PI * Math.PI * Math.cos(Math.PI * u)) / (2 * dx * dx)
}

/** The lowest and highest the hills go between the start and the line, for a picture of them. */
export function hillsSpan(h: Hills): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let x = 0; x <= h.finish; x += 2) {
    const y = heightAt(h, x)
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  return [lo, hi]
}

/* ------------------------------------------------------------------ the bird --- */

export type Bird = {
  x: number
  y: number
  vx: number
  vy: number
  /** Speed along the hill, while on it. */
  s: number
  ground: boolean
  /** Seconds since it last left the ground. */
  air: number
  /** Seconds since the go. */
  t: number
  /** Clean landings this run, the streak of them now, and the longest. */
  clean: number
  streak: number
  bestStreak: number
  /** The last flag passed, −1 before the first; each one's moment, then the line's. */
  flag: number
  splits: number[]
  done: boolean
  /** The run's time, to the moment it crossed the line inside its last step. */
  time: number
  /** The fastest it went, m/s. */
  top: number
}

export function newBird(h: Hills): Bird {
  return {
    x: 0,
    y: heightAt(h, 0),
    vx: START_SPEED,
    vy: 0,
    s: START_SPEED,
    ground: true,
    air: 0,
    t: 0,
    clean: 0,
    streak: 0,
    bestStreak: 0,
    flag: -1,
    splits: [],
    done: false,
    time: 0,
    top: START_SPEED,
  }
}

/** What a step did worth telling: off a top, down again (clean, a thump, or just down), past a flag, over the line. */
export type StepEvent = 'launch' | 'clean' | 'thump' | 'land' | 'finish' | { flag: number } | null

/** One step of `dt` (always DT in a run), holding or not. */
export function step(h: Hills, b: Bird, hold: boolean): StepEvent {
  if (b.done) return null
  // Held up the far side of a bottom it pulls as hard as down it: a hold kept too long costs speed.
  const g = hold ? G_DIVE : G_GLIDE
  let ev: StepEvent = null
  const x0 = b.x
  if (b.ground) {
    const d = slopeAt(h, b.x)
    const n = Math.sqrt(1 + d * d)
    b.s += ((-g * d) / n - drag(b.s, DRAG)) * DT
    if (b.s < MIN_SPEED) b.s = MIN_SPEED
    const k = curveAt(h, b.x) / (n * n * n)
    if (k < 0 && b.s * b.s * -k > g / n) {
      // Over a top faster than gravity can hold it to the hill: away it goes, along the slope.
      b.ground = false
      b.air = 0
      b.vx = b.s / n
      b.vy = (b.s * d) / n
      b.x += b.vx * DT
      b.y += b.vy * DT
      ev = 'launch'
    } else {
      b.x += (b.s / n) * DT
      b.y = heightAt(h, b.x)
      const d2 = slopeAt(h, b.x)
      const n2 = Math.sqrt(1 + d2 * d2)
      b.vx = b.s / n2
      b.vy = (b.s * d2) / n2
    }
  } else {
    b.vy -= g * DT
    const v = Math.hypot(b.vx, b.vy)
    if (v > 0) {
      const slow = (drag(v, AIR_DRAG) * DT) / v
      b.vx -= b.vx * slow
      b.vy -= b.vy * slow
    }
    b.x += b.vx * DT
    b.y += b.vy * DT
    b.air += DT
    const floor = heightAt(h, b.x)
    if (b.y <= floor) {
      const d = slopeAt(h, b.x)
      const n = Math.sqrt(1 + d * d)
      const along = (b.vx + b.vy * d) / n
      const into = (b.vy - b.vx * d) / n
      const angle = Math.atan2(Math.abs(into), Math.max(0.001, along))
      const speed = Math.hypot(b.vx, b.vy)
      // What runs along the hill is kept; landing into it costs the rest, down to a floor.
      let s = speed * Math.max(LAND_FLOOR, along / Math.max(0.001, speed))
      if (along > 0 && angle < CLEAN_ANGLE && b.air > CLEAN_AIR) {
        s *= CLEAN_BOOST
        b.clean += 1
        b.streak += 1
        b.bestStreak = Math.max(b.bestStreak, b.streak)
        ev = 'clean'
      } else if (angle > BUMP_ANGLE || along <= 0) {
        b.streak = 0
        ev = 'thump'
      } else {
        ev = 'land'
      }
      b.s = Math.max(MIN_SPEED, s)
      b.ground = true
      b.y = floor
      b.vx = b.s / n
      b.vy = (b.s * d) / n
    }
  }
  b.t += DT
  const speed = Math.hypot(b.vx, b.vy)
  if (speed > b.top) b.top = speed
  const nextFlag = b.flag + 1
  if (nextFlag < h.flags.length && b.x >= h.flags[nextFlag]!) {
    b.flag = nextFlag
    b.splits.push(b.t)
    ev = ev ?? { flag: nextFlag }
  }
  if (b.x >= h.finish) {
    // The moment it crossed, between this step's start and end.
    const f = (h.finish - x0) / Math.max(1e-6, b.x - x0)
    b.time = b.t - DT + DT * Math.min(1, Math.max(0, f))
    b.splits.push(b.time)
    b.done = true
    ev = 'finish'
  }
  return ev
}

/* ----------------------------------------------------------------- the hands --- */

/** Where a bird in the air would come down with this much gravity: how steep the hill is there. */
function landingSlope(h: Hills, b: { x: number; y: number; vx: number; vy: number }, g: number): number {
  let x = b.x
  let y = b.y
  let vx = b.vx
  let vy = b.vy
  const dt = 1 / 30
  for (let i = 0; i < 150; i++) {
    vy -= g * dt
    x += vx * dt
    y += vy * dt
    if (y <= heightAt(h, x)) break
  }
  return slopeAt(h, x)
}

/**
 * How a pair of hands plays: it sees the bird `lag` seconds late and judges the hill `look` seconds ahead of
 * what it saw. On the ground it holds down the slopes; in the air, on `air` of its flights, it dives for the
 * far side of the next hill. `jitter` makes each change of mind a little early or late. The same seed plays
 * the same run.
 */
export type HandsStyle = { lag?: number; look?: number; air?: number; jitter?: number; seed?: number }

export function makePerson(h: Hills, { lag = 0.3, look = 0.12, air = 0.5, jitter = 0, seed = 1 }: HandsStyle = {}): (b: Bird) => boolean {
  const rnd = mulberry32(seed)
  const seen: { x: number; y: number; vx: number; vy: number; ground: boolean }[] = []
  const back = Math.max(0, Math.round(lag / DT))
  let hold = false
  let want = false
  let changeAt = Infinity
  let diving = false
  let wasGround = true
  return (b) => {
    seen.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, ground: b.ground })
    if (seen.length > back + 1) seen.shift()
    const s = seen[0]!
    if (wasGround && !s.ground) diving = rnd() < air
    wasGround = s.ground
    const w = s.ground ? slopeAt(h, s.x + s.vx * look) < -0.03 : diving && landingSlope(h, s, G_DIVE) < landingSlope(h, s, G_GLIDE) - 0.05
    if (w !== want) {
      want = w
      changeAt = b.t + (jitter ? jitter * (rnd() - 0.3) : 0)
    }
    if (b.t >= changeAt) {
      hold = want
      changeAt = Infinity
    }
    return hold
  }
}

/** The blue bird's hands: a person with a fair reaction, a third of a second, who dives in the air half the time. */
export const BLUE_HANDS: HandsStyle = { lag: 0.3, look: 0.12, air: 0.5, jitter: 0, seed: 7 }

/**
 * The blue bird as it's raced and timed: its hands' flight, along the same line, 10% quicker (Ramsey,
 * 2026-10-06: "blue needs to be a little bit harder"; his run on #1 was 36.6% under it, where his best runs
 * land 18 to 24% under the other racing dailies' blues). Quicker hands won't do: a third of a second's
 * difference makes one day's flight a third faster and another's slower. A try is still kept by its hands'
 * own time (PACE_FROM to PACE_TO), so no day's hills changed with it; the plan's pace is the quicker time
 * (scripts/swoop-daily.mjs), and the game flies the line to it (runs.ts paceOf).
 */
export const BLUE_PACE = 0.9

/** A good player's hands, quick and always diving in the air: the dev autopilot's. */
export const GOOD_HANDS: HandsStyle = { lag: 0.14, look: 0.16, air: 1, jitter: 0, seed: 3 }

/* ----------------------------------------------------------------- flights --- */

/** A run as its ghost flies it: its time, when it passed each flag and the line, and where it was. */
export type Flight = {
  finished: boolean
  time: number
  /** Each flag's moment, then the line's: the last is the run's time. */
  splits: number[]
  /** GHOST_STRIDE numbers a sample (GHOST_RATE a second from the go), and the line's moment last. */
  ghost: number[]
  clean: number
  bestStreak: number
}

/** A bird flown down the hills by `hands` until it crosses the line or `limit` seconds go by. */
export function flyWith(h: Hills, hands: (b: Bird) => boolean, limit = 300): Flight {
  const b = newBird(h)
  const ghost: number[] = []
  let steps = 0
  while (!b.done && b.t < limit) {
    const hold = hands(b)
    if (steps % GHOST_EVERY === 0) ghost.push(r2(b.x), r2(b.y), hold ? HOLD : GLIDE)
    step(h, b, hold)
    steps++
  }
  if (!b.done) return { finished: false, time: Infinity, splits: b.splits, ghost, clean: b.clean, bestStreak: b.bestStreak }
  ghost.push(r2(b.x), r2(b.y), GLIDE)
  return { finished: true, time: b.time, splits: b.splits.slice(), ghost, clean: b.clean, bestStreak: b.bestStreak }
}

/** The blue bird down the hills. */
export function paceRun(h: Hills): Flight {
  return flyWith(h, makePerson(h, BLUE_HANDS))
}

/** A blue bird crossing the line in this many seconds makes the hills fair: not a sprint, not a slog. */
export const PACE_FROM = 42
export const PACE_TO = 72

/** Hills `n`'s try `attempt`, as the plan chose it (dailyPlan.ts): laid the same on every device. */
export function plannedHills(n: number, attempt: number): Hills {
  return layHills(n, attempt)
}

/**
 * Hills `n` from scratch: the first try the blue bird flies in a fair time. The plan script keeps which try
 * that was, and the blue bird's time.
 */
export function firstGoodHills(n: number): { hills: Hills; attempt: number; pace: Flight } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const hills = layHills(n, attempt)
    const pace = paceRun(hills)
    if (pace.finished && pace.time >= PACE_FROM && pace.time <= PACE_TO) return { hills, attempt, pace }
  }
  throw new Error(`Swoop: no hills for #${n}`)
}
