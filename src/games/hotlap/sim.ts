/*
 * Hot Lap without the pictures: the track, the car, the clock, and a driver who knows the way round.
 * The scene draws it (scene.ts); node can drive it (scripts/hotlap-check.mjs).
 */

export const STEP = 1 / 120
const SUBSTEPS = 2
const G = 9.81

/* ---------- the car ---------- */

/*
 * A rear-wheel-drive prototype racer, reckoned per kilogram, so forces are accelerations. Each axle's
 * tyres grip up to a limit and then slide; weight moves forward when you brake and back when you
 * accelerate; and its body and floor press it onto the road harder the faster it goes (downforce), so
 * it grips best at speed, as a Le Mans car does.
 */
export const CAR = {
  a: 1.2, // m from the centre of mass to the front axle
  b: 1.4, // m from it to the rear axle
  height: 0.45, // m the centre of mass sits above the road
  yawRadius: 1.28, // m: how hard the car is to turn about its middle
  mu: 1.22, // grip on the road: racing tyres
  muGrass: 0.6,
  rearGrip: 1.18, // wider tyres at the back: the front lets go first, so at the limit the car runs wide rather than spins
  slipPeak: 0.1, // rad a tyre is slid sideways at its grippiest, about 6°
  downforce: 0.0024, // × speed², m/s² of extra weight on the tyres: +61% at 112 mph
  aeroFront: 0.42, // share of it on the front; more at the back keeps it steady at speed
  power: 120, // W per kg at the rear wheels
  brake: 1.9, // g the pedal asks for; the tyres decide how much of it you get (ABS)
  brakeFront: 0.64, // share of the braking at the front
  drag: 0.00034, // air, × speed², m/s² (the downforce costs a little speed)
  rolling: 0.25, // m/s²
  engineBrake: 0.7, // m/s² at the rear wheels off the gas
  steerMax: 0.6, // rad of lock at a crawl
  steerRate: 3.2, // rad/s the front wheels turn
  assist: 0.9, // stability and traction control: 0 none, 1 firm
  grassSlow: 21, // m/s the grass lets you keep
  barrier: 38, // m from the middle of the road to the fence
}
export const WHEELBASE = CAR.a + CAR.b

/** m/s² the tyres are pressed down with at this speed: gravity and the downforce. */
export function load(u: number) {
  return G + CAR.downforce * u * u
}

/** A tyre's sideways grip against how far it's slid: building smoothly to its best at slipPeak, then easing to nine tenths of it. */
function tyre(alpha: number) {
  const x = Math.abs(alpha) / CAR.slipPeak
  const grip = x <= 1 ? 1.5 * x - 0.5 * x * x * x : 1 - 0.1 * Math.min(1, (x - 1) / 2)
  return Math.sign(alpha) * grip
}

/**
 * The lock the wheel gives at this speed: about what takes the car round at the limit of its grip (the
 * whole car leans into a corner, so the front wheels need only a little more than the corner's own
 * angle). Steering against a slide gives more, so it can be caught.
 */
export function steerLock(u: number, catching = 0) {
  const v = Math.max(u, 1)
  return Math.min(CAR.steerMax, (WHEELBASE * CAR.mu * load(v) * 1.05) / (v * v) + 0.035 + catching * 0.9)
}

/* ---------- the track ---------- */

type Piece = { straight: number | 'A' | 'B' } | { turn: number; r: number; name: string }

/*
 * Driven anticlockwise from the start line. A turn is degrees (left is positive) on a radius in metres;
 * the two lettered straights are sized so the loop closes on itself.
 */
const PLAN: Piece[] = [
  { straight: 'A' },
  { turn: 180, r: 18, name: 'Hairpin' },
  { straight: 120 },
  { turn: -90, r: 60, name: 'Kink' },
  { straight: 'B' },
  { turn: 90, r: 45, name: 'Top Turn' },
  { straight: 140 },
  { turn: -45, r: 30, name: 'Chicane' },
  { turn: 45, r: 30, name: 'Chicane' },
  { straight: 60 },
  { turn: 180, r: 110, name: 'The Sweep' },
]

export const HALF_WIDTH = 8
const START_AT = 70 // m along the first straight
/* A gate every 20 m, each passed within 15 m of it: driving round keeps them all, while a cut across the grass jumps one and the lap won't count. */
const GATE_EVERY = 20
const GATE_WINDOW = 15

export type Corner = { name: string; from: number; to: number; turn: number; r: number }

export type Track = {
  n: number
  gates: number
  sectorGates: [number, number]
  x: Float64Array
  y: Float64Array
  h: Float64Array
  k: Float64Array
  s: Float64Array
  length: number
  corners: Corner[]
  startIndex: number
  gap: number
  straights: { A: number; B: number }
}

function arcMove(h: number, turn: number, r: number): [number, number] {
  const phi = (turn * Math.PI) / 180
  const sgn = Math.sign(phi)
  return [sgn * r * (Math.sin(h + phi) - Math.sin(h)), sgn * r * (Math.cos(h) - Math.cos(h + phi))]
}

/** The loop as points a metre apart, with heading, curvature and distance. */
export function buildTrack(plan: Piece[] = PLAN): Track {
  // Headings at each piece, and where the fixed pieces take you.
  let h = 0
  let fx = 0
  let fy = 0
  const solveDir: Record<string, [number, number]> = {}
  for (const seg of plan) {
    if ('turn' in seg) {
      const [dx, dy] = arcMove(h, seg.turn, seg.r)
      fx += dx
      fy += dy
      h += (seg.turn * Math.PI) / 180
    } else if (typeof seg.straight === 'string') {
      solveDir[seg.straight] = [Math.cos(h), Math.sin(h)]
    } else {
      fx += seg.straight * Math.cos(h)
      fy += seg.straight * Math.sin(h)
    }
  }
  const [ax, ay] = solveDir.A!
  const [bx, by] = solveDir.B!
  const det = ax * by - ay * bx
  const lenA = (-fx * by + fy * bx) / det
  const lenB = (-ax * fy + ay * fx) / det
  if (!(lenA > 0 && lenB > 0)) throw new Error(`track does not close: A ${lenA} B ${lenB}`)

  const xs: number[] = []
  const ys: number[] = []
  const hs: number[] = []
  const ks: number[] = []
  const corners: Corner[] = []
  let x = 0
  let y = 0
  h = 0
  const push = (k: number) => {
    xs.push(x)
    ys.push(y)
    hs.push(h)
    ks.push(k)
  }
  for (const seg of plan) {
    if ('turn' in seg) {
      const phi = (seg.turn * Math.PI) / 180
      const len = Math.abs(phi) * seg.r
      const n = Math.max(1, Math.round(len))
      const k = Math.sign(phi) / seg.r
      const from = xs.length
      for (let i = 0; i < n; i++) {
        push(k)
        const step = phi / n
        const [dx, dy] = arcMove(h, (step * 180) / Math.PI, seg.r)
        x += dx
        y += dy
        h += step
      }
      corners.push({ name: seg.name, from, to: xs.length, turn: seg.turn, r: seg.r })
    } else {
      const len = typeof seg.straight === 'string' ? (seg.straight === 'A' ? lenA : lenB) : seg.straight
      const n = Math.max(1, Math.round(len))
      for (let i = 0; i < n; i++) {
        push(0)
        x += (len / n) * Math.cos(h)
        y += (len / n) * Math.sin(h)
      }
    }
  }
  const n = xs.length
  const s = new Float64Array(n)
  for (let i = 1; i < n; i++) s[i] = s[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!)
  const length = s[n - 1]! + Math.hypot(xs[0]! - xs[n - 1]!, ys[0]! - ys[n - 1]!)
  const gates = Math.floor(length / GATE_EVERY) - 1
  return {
    n,
    gates,
    sectorGates: [Math.round(gates / 3), Math.round((2 * gates) / 3)],
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    h: Float64Array.from(hs),
    k: Float64Array.from(ks),
    s,
    length,
    corners,
    startIndex: Math.round(START_AT),
    gap: Math.hypot(x - xs[0]!, y - ys[0]!),
    straights: { A: lenA, B: lenB },
  }
}

/** Distance along the lap from the start line, 0 up to the track's length. */
export function lapDistance(track: Track, index: number) {
  const d = track.s[index]! - track.s[track.startIndex]!
  return d < 0 ? d + track.length : d
}

/** The nearest point of the middle of the road, looked for near the last one; `side` is how far left of it. */
export function nearest(track: Track, px: number, py: number, hint = -1) {
  const { n, x, y } = track
  let best = 0
  let bestD = Infinity
  const look = (i: number) => {
    const d = (x[i]! - px) ** 2 + (y[i]! - py) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (hint >= 0) for (let j = -30; j <= 30; j++) look((hint + j + n) % n)
  if (hint < 0 || bestD > 60 * 60) for (let i = 0; i < n; i++) look(i)
  const h = track.h[best]!
  const side = (px - x[best]!) * -Math.sin(h) + (py - y[best]!) * Math.cos(h)
  return { index: best, side }
}

/* ---------- a run ---------- */

export type Run = {
  x: number
  y: number
  h: number
  /** m/s the way the car points. */
  u: number
  /** m/s sideways (left): the slide. */
  vy: number
  /** rad/s the car is turning. */
  r: number
  /** Speed. */
  v: number
  /** m/s² along the car, which moves the weight. */
  ax: number
  /** m/s² across it. */
  ay: number
  /** rad the front wheels are turned. */
  steer: number
  index: number
  side: number
  onGrass: boolean
  /** How far the tyres are past their grip, 0 while they hold. */
  over: number
  /** How hard the tyres are working: 1 is their grippiest; past it they slide. */
  work: number
  abs: boolean
  time: number
  /** Lap distance of the car, for the gates. */
  dist: number
  gate: number
  /** Seconds into the lap at the end of each sector: two, then the lap. */
  splits: number[]
  cut: boolean
  finished: boolean
  lapTime: number | null
  /** Seconds since the fence, counting down. */
  bumped: number
}

/** `steer` is −1 (right) to 1 (left); throttle and brake 0 to 1. */
export type Controls = { steer: number; throttle: number; brake: number }

export function newRun(track: Track): Run {
  const i = track.startIndex
  return {
    x: track.x[i]! - 4 * Math.cos(track.h[i]!),
    y: track.y[i]! - 4 * Math.sin(track.h[i]!),
    h: track.h[i]!,
    u: 0,
    vy: 0,
    r: 0,
    v: 0,
    ax: 0,
    ay: 0,
    steer: 0,
    index: i,
    side: 0,
    onGrass: false,
    over: 0,
    work: 0,
    abs: false,
    time: 0,
    dist: 0,
    gate: 0,
    splits: [],
    cut: false,
    finished: false,
    lapTime: null,
    bumped: 0,
  }
}

/** One axle's force: what the pedals ask along it and the tyres across it, within one circle of grip. */
function withinGrip(fx: number, fy: number, cap: number): [number, number, number] {
  const total = Math.hypot(fx, fy)
  if (total <= cap) return [fx, fy, 0]
  const k = cap / total
  return [fx * k, fy * k, 1 - k]
}

/**
 * One step. A bicycle model: the front and rear tyres each push sideways according to how far they're
 * slid, within the grip their share of the weight gives.
 */
export function stepRun(run: Run, input: Controls, track: Track): Run {
  const mu = run.onGrass ? CAR.muGrass : CAR.mu
  const dt = STEP / SUBSTEPS
  const k2 = CAR.yawRadius * CAR.yawRadius
  let over = 0
  let work = 0
  let abs = false
  for (let sub = 0; sub < SUBSTEPS; sub++) {
    let { u, vy, r } = run
    const beta = u > 2 ? Math.atan2(vy, u) : 0
    // Steering the other way from how the car is turning is catching a slide.
    const catching = input.steer !== 0 && Math.sign(input.steer) !== Math.sign(r) ? Math.abs(beta) : 0
    const target = input.steer * steerLock(u, catching)
    const turn = CAR.steerRate * dt
    run.steer += Math.max(-turn, Math.min(turn, target - run.steer))
    const d = run.steer

    // Braking puts weight on the front tyres; accelerating puts it on the rear; speed presses both down.
    const shift = (run.ax * CAR.height) / WHEELBASE
    const aero = CAR.downforce * u * u
    const capF = mu * Math.max(0.2 * G, (G * CAR.b) / WHEELBASE - shift + aero * CAR.aeroFront)
    const capR = mu * CAR.rearGrip * Math.max(0.2 * G, (G * CAR.a) / WHEELBASE + shift + aero * (1 - CAR.aeroFront))

    const along = Math.max(u, 4)
    const slipF = Math.atan2(vy + CAR.a * r, along) - d
    const slipR = Math.atan2(vy - CAR.b * r, along)
    const sideF = -capF * tyre(slipF)
    const sideR = -capR * tyre(slipR)

    let pushF = 0
    let pushR = 0
    if (input.brake > 0 && u > 0.2) {
      // Braking while steering asks a little less of the brakes, so the tyres keep some grip for turning.
      const want = input.brake * CAR.brake * G * (1 - 0.2 * Math.abs(input.steer))
      pushF = -want * CAR.brakeFront
      // Brake balance: as the weight comes off the rear tyres, they're asked for less, so they keep steering.
      pushR = -Math.min(want * (1 - CAR.brakeFront), capR * 0.4)
      abs = abs || want * CAR.brakeFront > capF * 0.95
    } else if (input.throttle > 0) {
      pushR = (input.throttle * CAR.power) / Math.max(u, 2)
      // Traction control: the power the rear tyres can take while they're also cornering.
      const room = Math.sqrt(Math.max(0, capR * capR - sideR * sideR))
      pushR = Math.min(pushR, CAR.assist * Math.max(room, capR * 0.25) + (1 - CAR.assist) * capR)
    } else if (u > 0.5) {
      pushR = -CAR.engineBrake
    }
    const [fxF, fyF, lostF] = withinGrip(pushF, sideF, capF)
    const [fxR, fyR, lostR] = withinGrip(pushR, sideR, capR)
    over = Math.max(over, lostF, lostR, Math.abs(slipF) / CAR.slipPeak - 1.2, Math.abs(slipR) / CAR.slipPeak - 1)
    work = Math.max(work, Math.abs(slipF) / CAR.slipPeak, Math.abs(slipR) / CAR.slipPeak)

    const cd = Math.cos(d)
    const sd = Math.sin(d)
    let ax = fxR + fxF * cd - fyF * sd - CAR.drag * u * u - (u > 0.1 ? CAR.rolling : 0)
    if (run.onGrass) ax -= 2 + Math.max(0, u - CAR.grassSlow) * 0.7
    const ay = fyR + fyF * cd + fxF * sd
    let spin = (CAR.a * (fyF * cd + fxF * sd) - CAR.b * fyR) / k2

    // Stability control: when the car turns faster than the wheel and the road allow, or slides
    // sideways, ease it back; the further it's sliding, the firmer.
    const asked = (u * Math.tan(d)) / WHEELBASE
    const most = (mu * load(u)) / Math.max(u, 3)
    const aim = Math.max(-most, Math.min(most, asked))
    if (u > 3 && (Math.abs(r) > Math.abs(aim) * 1.05 + 0.02 || Math.sign(r) !== Math.sign(aim))) {
      spin -= CAR.assist * (8 + 60 * Math.max(0, Math.abs(beta) - 0.05)) * (r - aim)
    }

    u += (ax + vy * r) * dt
    vy += (ay - u * r) * dt
    r += spin * dt
    if (u < 0) u = 0
    // At a crawl there's nothing to slide on: the car rolls where its wheels point.
    if (u < 3) {
      const settle = 1 - u / 3
      vy *= 1 - settle * 0.5
      r += (asked - r) * settle * 0.5
    }
    run.u = u
    run.vy = vy
    run.r = r
    run.ax = ax
    run.ay = ay
    run.h += r * dt
    const c = Math.cos(run.h)
    const s = Math.sin(run.h)
    run.x += (u * c - vy * s) * dt
    run.y += (u * s + vy * c) * dt
  }
  run.v = Math.hypot(run.u, run.vy)
  run.over = Math.max(0, over)
  run.work = run.v > 3 ? work : 0
  run.abs = abs

  // Where on the track.
  const near = nearest(track, run.x, run.y, run.index)
  run.index = near.index
  run.side = near.side
  run.onGrass = Math.abs(near.side) > HALF_WIDTH + 0.6
  run.bumped = Math.max(0, run.bumped - STEP)
  if (Math.abs(near.side) > CAR.barrier) {
    // The fence: back inside it, and most of the speed gone.
    const push = Math.abs(near.side) - CAR.barrier + 0.2
    const along = track.h[near.index]!
    const nx = -Math.sin(along) * Math.sign(near.side)
    const ny = Math.cos(along) * Math.sign(near.side)
    run.x -= nx * push
    run.y -= ny * push
    run.u *= 0.45
    run.vy *= 0.3
    run.r *= 0.3
    run.h += Math.atan2(Math.sin(along - run.h), Math.cos(along - run.h)) * 0.5
    run.v = Math.hypot(run.u, run.vy)
    run.bumped = 0.4
  }

  if (!run.finished) run.time += STEP

  // The gates, then the line.
  const was = run.dist
  run.dist = lapDistance(track, near.index)
  const gateAt = (run.gate + 1) * GATE_EVERY
  if (run.gate < track.gates && !run.cut) {
    if (run.dist >= gateAt && run.dist < gateAt + GATE_WINDOW) {
      run.gate += 1
      if (track.sectorGates.includes(run.gate)) run.splits.push(run.time)
    } else if (was < gateAt && run.dist >= gateAt + GATE_WINDOW && run.dist - was < track.length / 2) {
      run.cut = true
    }
  }
  if (!run.finished && run.gate === track.gates && was > track.length - 40 && run.dist < 40) {
    // Crossed the line within this step: take the part of the step before it.
    const past = run.dist
    const before = track.length - was
    const frac = before + past > 0 ? before / (before + past) : 1
    run.lapTime = run.time - STEP + STEP * frac
    run.splits.push(run.lapTime)
    run.finished = true
  }
  return run
}

/* ---------- a driver who knows the way ---------- */

/** The speed the middle of the road can be driven at each metre, braking as the tyres (and the downforce) allow. */
export function speedPlan(track: Track, margin = 0.86) {
  const { n } = track
  const v = new Float64Array(n)
  // Cornering: v² k = margin µ (g + downforce v²), so v² = margin µ g / (k − margin µ downforce).
  const reach = margin * CAR.mu * CAR.downforce
  for (let i = 0; i < n; i++) {
    let k = 0
    for (let j = -6; j <= 6; j++) k = Math.max(k, Math.abs(track.k[(i + j + n) % n]!))
    v[i] = k > reach + 1e-5 ? Math.min(80, Math.sqrt((margin * CAR.mu * G) / (k - reach))) : 80
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n]!
      v[i] = Math.min(v[i]!, Math.sqrt(next * next + 2 * 0.78 * CAR.mu * load(next)))
    }
  }
  return v
}

export function botDriver(track: Track, margin = 0.86) {
  const plan = speedPlan(track, margin)
  return (run: Run): Controls => {
    const { n } = track
    const ahead = Math.round(7 + run.v * 0.45)
    const ti = (run.index + ahead) % n
    const dx = track.x[ti]! - run.x
    const dy = track.y[ti]! - run.y
    const heading = run.h + (run.u > 2 ? Math.atan2(run.vy, run.u) : 0)
    const off = Math.atan2(Math.sin(Math.atan2(dy, dx) - heading), Math.cos(Math.atan2(dy, dx) - heading))
    const dist = Math.max(4, Math.hypot(dx, dy))
    const bend = (2 * Math.sin(off)) / dist
    const lateral = Math.min(1, (Math.abs(bend) * run.u * run.u) / (CAR.mu * load(run.u)))
    const wheel = Math.atan(bend * WHEELBASE) * 1.05 + Math.sign(bend) * 0.035 * lateral
    const steer = Math.max(-1, Math.min(1, wheel / steerLock(run.u)))
    const want = plan[(run.index + Math.round(run.v * 0.35) + 2) % n]!
    if (run.v > want + 0.6) return { steer, throttle: 0, brake: 1 }
    if (run.v < want - 0.3) return { steer, throttle: 1, brake: 0 }
    return { steer, throttle: 0, brake: 0 }
  }
}

/** Where a car was, 30 times a second: x, y and heading, one after another. */
export type GhostPath = number[]
/** How many steps apart a ghost's samples are: every fourth, so 30 a second. */
export const GHOST_EVERY = 4
export const GHOST_RATE = 1 / (STEP * GHOST_EVERY)

/** A whole lap by the driver above: its time, and where it was 30 times a second. */
export function botLap(track: Track, maxSeconds = 120) {
  const drive = botDriver(track)
  const run = newRun(track)
  const ghost: GhostPath = []
  let steps = 0
  let grass = 0
  while (!run.finished && run.time < maxSeconds) {
    if (steps % GHOST_EVERY === 0) ghost.push(run.x, run.y, run.h)
    stepRun(run, drive(run), track)
    if (run.onGrass) grass += STEP
    steps += 1
  }
  return { time: run.lapTime, splits: run.splits, ghost, grass, run }
}
