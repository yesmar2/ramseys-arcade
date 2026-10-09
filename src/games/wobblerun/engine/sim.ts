/**
 * Wobble Run without the pictures: a jelly bean running a course of rounds, the things it stands on (solids),
 * the things that hit it (hazards) and the places that push it (volumes), stepped at 1/120 s.
 *
 * The bean is the prototype's (wobble-run.html), retuned as design-final §1.1 says: it runs at 7.2 m/s, jumps
 * 5.4 m from a run, dives 10.5 m/s along the stick, belly slides, catches ledges it falls just short of, and
 * comes back 3 m above its last checkpoint 0.75 s after a splat (real time: the clock never stops and nothing
 * is added to it). Every push from the world across the ground (a moving platform, a belt, a tipping plank, the
 * wind, a hoop) is a carry added to where the bean is, never an acceleration: the run controller works at
 * 62 m/s² and would cancel anything gentler within a frame (design-final §3.0). Up and down, the pushes are
 * accelerations (gravity, updrafts, bounce pads).
 *
 * Clock things (doors, bars, gloves, fans, fruit, moving pads) are pure functions of the run clock `t`, 0 at GO,
 * so they're where they are whatever you did. Touch things (crumbling tiles, see-saw planks, the slime) answer
 * your bean only, step in a fixed order, and reset when you respawn into their round, so the same hands always
 * get the same run. Nothing here uses chance.
 *
 * A step goes (design-final §3.2): the clock; touch things (from the bean's last step); then the bean: what
 * carries it, what its stick asks, its jump and dive, gravity, moving, solids (ground, sides, ceilings, doors,
 * ledges), hazards, then what it passed through (checkpoints, flags, hoops, the crown, the slime, the goo). The
 * engine works out only what's near the bean (a broad phase by z); the scene asks for poses itself
 * (solidPose, hazardBodies), from the same closed forms.
 *
 * Node runs this as it is (erasable TypeScript, `.ts` imports), as the plan script does. Once a day is planned,
 * changing anything a course or a run depends on changes that day, so gate changes by day for days people have
 * played (design-final §3.3).
 */
import type {
  Bean,
  Body,
  Counts,
  Course,
  Grid,
  Hazard,
  Hit,
  Input,
  MoveFn,
  Offset,
  PathSpec,
  Pose,
  Run,
  Solid,
  Tele,
  TeleFn,
  TeleState,
  Vec3,
  Volume,
  World,
} from './types.ts'

/* --------------------------------------------------------------- the bean --- */

/** The fixed step, s; the countdown before GO. */
export const STEP = 1 / 120
export const COUNTDOWN = 3
/** The bean's radius and height; its height diving or belly sliding (hazards and duck-under solids only). */
export const R = 0.42
export const H = 1.46
export const H_PRONE = 0.84
/** Running speed, and how hard the stick turns velocity toward it on the ground and in the air, m/s². */
export const RUN = 7.2
export const ACC_GROUND = 62
export const ACC_AIR = 22
/** Without the stick (stunned), the ground slows the bean by this much a second (e^−9t). */
const STOP_DECAY = 9
export const G = 28
export const JUMP = 10.5
const FALL_MOST = 32
/** A ground dive's hop, an air dive's least upward speed, and a dive's speed along: max(DIVE, v + DIVE_ADD). */
export const DIVE_VY = 4
export const AIR_DIVE_VY = 3
export const DIVE = 10.5
export const DIVE_ADD = 1
/** A belly slide after a dive lands: SLIDE_T s, slowing e^−7t, held up to SLIDE_HOLD s more under something low. */
export const SLIDE_T = 0.38
const SLIDE_DECAY = 7
const SLIDE_HOLD = 0.4
/** Forgiveness: a jump just after walking off, and jump and dive presses kept this long. */
export const COYOTE = 0.12
export const JUMP_BUF = 0.15
export const DIVE_BUF = 0.15
/** A step up the bean takes in its stride, and how far past an edge its feet still hold. Walls meant to block are ≥ 0.6 m tall. */
export const STEP_UP = 0.5
export const FOOT = 0.22
/** Running down a slope or off a little step, the bean keeps to the floor within this much below it. */
const SNAP_DOWN = 0.3
/** Slope speed: RUN × (1 − SLOPE_K·s), s the sine of the slope along the stick, kept within SLOPE_DOWN to SLOPE_UP. */
const SLOPE_K = 0.6
const SLOPE_UP = 0.4
const SLOPE_DOWN = -0.25
/** Steeper than this nothing stands (tan 30°, squared). */
const STEEPEST2 = Math.tan((30 * Math.PI) / 180) ** 2
/**
 * Ledge catch (design-final §1.1): in the air, coming down or barely rising (vy ≤ LEDGE_VY), moving toward an
 * edge, its centre within LEDGE_OUT outside it and the top between LEDGE_ABOVE below its feet and LEDGE_UP above:
 * it pops up over LEDGE_T to LEDGE_IN inside, keeping LEDGE_KEEP of its speed.
 */
const LEDGE_VY = 2
const LEDGE_OUT = 0.45
const LEDGE_ABOVE = 0.05
const LEDGE_UP = 0.6
const LEDGE_T = 0.12
const LEDGE_IN = 0.3
const LEDGE_KEEP = 0.5
/** Hit cooldowns (a knock or yeet, a bonk), a knock's stun, and a yeet's stun after landing and at most. */
export const HIT_CD = 0.8
export const BONK_CD = 0.3
export const STUN = 0.55
const YEET_AFTER = 0.25
const YEET_MOST = 1.2
/**
 * A knocked bean (stunned, not yeeted) meets rails and fences (noGround walls) this much taller: a knock taken mid-jump
 * pops from up to 1.9 m, over a rail sized for a grounded knock's 0.64 m (design-final §1.4: no knock into the goo on
 * tiers 1–2). A gap has no wall to raise, so T3's stay open.
 */
const KNOCK_CATCH = 2.0
/** A hazard coming at the bean slower than this only shoves it. */
const SHOVE = 1
/** A door coming down on the bean pushes it out at least this fast. */
const DOOR_PUSH = 4.5
/** Below its round's base by this much the bean splats; it's back DEAD_T s later, DROP_H m above the spawn. */
export const DEATH_DROP = 6
export const DEAD_T = 0.75
const SPLASH_T = 0.6
export const DROP_H = 3
/** See-saw slide: past SLIP_FROM a carry toward the low side builds at G·sin θ − SLIP_LESS, to SLIP_MOST; it fades at SLIP_FADE. */
const SLIP_FROM = (8 * Math.PI) / 180
const SLIP_LESS = 2
const SLIP_MOST = 5
const SLIP_FADE = 10
/** Belly sliding on a slick slope: friction (× G cos θ), top speed, and how fast and hard the stick steers across. */
const SLICK_FRICTION = 0.08
const SLICK_MOST = 14
const SLICK_STEER = 4
const SLICK_STEER_ACC = 9
/** A jump while belly sliding. */
export const BELLY_HOP = 8
/** A hoop counts within this of its centre. */
const HOOP_R = 0.6
/** A JUMP this long after touching a bounce pad still makes it perfect (before it, the jump buffer). */
const PERFECT_AFTER = 0.1
/** A hazard passing this close, this fast, without touching, is a close call (one per CLOSE_CD s). */
const CLOSE_GAP = 0.35
const CLOSE_SPEED = 4
const CLOSE_CD = 1.5

/** The base periods a course's rounds take, s: none shared, so no single rhythm carries through (design-final §1.3). */
export const PERIODS = [2.9, 3.2, 3.4, 3.7, 4.1, 4.4] as const

/** A ghost keeps where the bean was every this many steps (20 a second), as x, y, z and a state. */
export const GHOST_EVERY = 6
export const GHOST_RATE = 1 / (STEP * GHOST_EVERY)
export const GHOST_STRIDE = 4
export const GROUNDED = 0
export const AIRBORNE = 1
export const RESPAWNING = 2
export const STUNNED = 3

const r2 = (v: number) => Math.round(v * 100) / 100
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const frac = (v: number) => v - Math.floor(v)

/* ----------------------------------------------------------- motions --- */
/*
 * Closed-form motions and telegraphs for the round builders. A motion writes an offset from the thing's static
 * pose (types.ts Offset); a telegraph says what phase it's in. All of them are pure functions of the clock.
 */

/** Back and forth along an axis: a·sin(2π(t + ph)/T). Bobbing pads (y), sliding pads (x). */
export function wave(axis: 'x' | 'y' | 'z', a: number, T: number, ph = 0): MoveFn {
  const w = (2 * Math.PI) / T
  if (axis === 'x') return (t, o) => void (o.x = a * Math.sin(w * (t + ph)))
  if (axis === 'y') return (t, o) => void (o.y = a * Math.sin(w * (t + ph)))
  return (t, o) => void (o.z = a * Math.sin(w * (t + ph)))
}

/** Turning at w rad/s (yaw sense), from yaw ph at GO: turntables, spinning pads, sweeper bars. */
export function spin(w: number, ph = 0): MoveFn {
  return (t, o) => void (o.yaw = w * t + ph)
}

/**
 * Riding round the anchor on a disc turning at w: rho out, at angle a0 at GO (yaw sense: the point starts at
 * local (rho·cos a0, −rho·sin a0)). Bumpers on a turntable: the same w as the disc's spin.
 */
export function orbit(rho: number, a0: number, w: number): MoveFn {
  return (t, o) => {
    const a = a0 + w * t
    o.x = rho * Math.cos(a)
    o.z = -rho * Math.sin(a)
    o.yaw = w * t
  }
}

/**
 * A Gate Crash door: u = frac((t + ph)/T) through OPEN `open` s, WARN `warn` (still open, juddering), SLAM `slam`
 * (bottom = lift·(1 − s²)), SHUT the rest, RISE `rise` (easing out). The door is laid shut; its motion lifts it.
 */
export type DoorSpec = { T: number; ph: number; open: number; warn?: number; slam?: number; rise?: number; lift?: number }

/** How high door `d` is lifted at t (0 shut, `lift` open), and which phase it's in. */
export function doorLift(d: DoorSpec, t: number): number {
  const { T, open } = d
  const warn = d.warn ?? 0.5
  const slam = d.slam ?? 0.45
  const rise = d.rise ?? 0.4
  const lift = d.lift ?? 2.8
  const s = frac((t + d.ph) / T) * T
  if (s < open) return lift
  // Juddering up only: an open door never dips under its header.
  if (s < open + warn) return lift + 0.03 * Math.abs(Math.sin(2 * Math.PI * 6 * s))
  if (s < open + warn + slam) {
    const k = (s - open - warn) / slam
    return lift * (1 - k * k)
  }
  if (s < T - rise) return 0
  const k = (s - (T - rise)) / rise
  return lift * (1 - (1 - k) * (1 - k))
}

export function doorMove(d: DoorSpec): MoveFn {
  return (t, o) => void (o.y = doorLift(d, t))
}

export function doorTele(d: DoorSpec): TeleFn {
  const warn = d.warn ?? 0.5
  const slam = d.slam ?? 0.45
  const rise = d.rise ?? 0.4
  return (t) => {
    const s = frac((t + d.ph) / d.T) * d.T
    if (s < d.open) return { state: 'rest', u: s / d.open }
    if (s < d.open + warn) return { state: 'warn', u: (s - d.open) / warn }
    if (s < d.open + warn + slam) return { state: 'act', u: (s - d.open - warn) / slam }
    const shut = d.T - rise - (d.open + warn + slam)
    if (s < d.T - rise) return { state: 'hold', u: shut > 0 ? (s - d.open - warn - slam) / shut : 1 }
    return { state: 'back', u: (s - (d.T - rise)) / rise }
  }
}

/**
 * A Hit Parade glove punching in from the side `side` (+1: from the +x side, punching toward −x): WIND-UP
 * `windup` s (pulled back `pull` m), PUNCH `punch` s out `reach` m (ease-out cubic), HOLD `hold`, BACK `back`
 * (cosine), then REST for the rest of T. Its anchor is where it rests.
 */
export type GloveSpec = { T: number; ph: number; side: 1 | -1; reach: number; windup?: number; punch?: number; hold?: number; back?: number; pull?: number }

/** How far the glove's front is out from rest at t, m (negative while winding up). */
export function gloveOut(g: GloveSpec, t: number): number {
  const windup = g.windup ?? 0.6
  const punch = g.punch ?? 0.12
  const hold = g.hold ?? 0.5
  const back = g.back ?? 0.7
  const pull = g.pull ?? 0.6
  const s = frac((t + g.ph) / g.T) * g.T
  if (s < windup) {
    const k = s / windup
    return -pull * k * k * (3 - 2 * k)
  }
  if (s < windup + punch) {
    const k = (s - windup) / punch
    return -pull + (g.reach + pull) * (1 - (1 - k) ** 3)
  }
  if (s < windup + punch + hold) return g.reach
  if (s < windup + punch + hold + back) return g.reach * (0.5 + 0.5 * Math.cos((Math.PI * (s - windup - punch - hold)) / back))
  return 0
}

export function gloveMove(g: GloveSpec): MoveFn {
  return (t, o) => void (o.x = -g.side * gloveOut(g, t))
}

export function gloveTele(g: GloveSpec): TeleFn {
  const windup = g.windup ?? 0.6
  const punch = g.punch ?? 0.12
  const hold = g.hold ?? 0.5
  const back = g.back ?? 0.7
  return (t) => {
    const s = frac((t + g.ph) / g.T) * g.T
    if (s < windup) return { state: 'warn', u: s / windup }
    if (s < windup + punch) return { state: 'act', u: (s - windup) / punch }
    if (s < windup + punch + hold) return { state: 'hold', u: (s - windup - punch) / hold }
    if (s < windup + punch + hold + back) return { state: 'back', u: (s - windup - punch - hold) / back }
    const rest = g.T - windup - punch - hold - back
    return { state: 'rest', u: rest > 0 ? (s - windup - punch - hold - back) / rest : 1 }
  }
}

/** A pendulum swinging across the track (in x) from its pivot (the anchor): θ = A·sin(2π(t + ph)/T), arm L. */
export type PendulumSpec = { L: number; A: number; T: number; ph: number }

export function pendulumAngle(p: PendulumSpec, t: number): number {
  return p.A * Math.sin((2 * Math.PI * (t + p.ph)) / p.T)
}

export function pendulumMove(p: PendulumSpec): MoveFn {
  return (t, o) => {
    const th = pendulumAngle(p, t)
    o.x = p.L * Math.sin(th)
    o.y = -p.L * Math.cos(th)
    o.yaw = th
  }
}

/** The floor stripe under a pendulum: `warn` as the head comes down, `act` while it's low enough to hit. */
export function pendulumTele(p: PendulumSpec): TeleFn {
  return (t) => {
    const th = pendulumAngle(p, t)
    const u = 1 - Math.abs(th) / p.A
    const falling = Math.abs(pendulumAngle(p, t + 0.05)) < Math.abs(th)
    if (u > 0.75) return { state: 'act', u }
    if (u > 0.35 && falling) return { state: 'warn', u }
    return { state: 'rest', u }
  }
}

/**
 * A fan's cycle: OFF `off` s, SPIN-UP `spinUp` (no wind yet; a rising whine), BLOW `on`, SPIN-DOWN `spinDown`
 * (the wind falling to nothing), from phase ph.
 */
export type FanSpec = { off: number; on: number; ph: number; spinUp?: number; spinDown?: number }

export function fanPeriod(f: FanSpec): number {
  return f.off + (f.spinUp ?? 0.7) + f.on + (f.spinDown ?? 0.4)
}

export function fanDuty(f: FanSpec): (t: number) => number {
  const up = f.spinUp ?? 0.7
  const down = f.spinDown ?? 0.4
  const T = fanPeriod(f)
  return (t) => {
    const s = frac((t + f.ph) / T) * T
    if (s < f.off + up) return 0
    if (s < f.off + up + f.on) return 1
    return 1 - (s - f.off - up - f.on) / down
  }
}

export function fanTele(f: FanSpec): TeleFn {
  const up = f.spinUp ?? 0.7
  const down = f.spinDown ?? 0.4
  const T = fanPeriod(f)
  return (t) => {
    const s = frac((t + f.ph) / T) * T
    if (s < f.off) return { state: 'rest', u: s / f.off }
    if (s < f.off + up) return { state: 'warn', u: (s - f.off) / up }
    if (s < f.off + up + f.on) return { state: 'act', u: (s - f.off - up) / f.on }
    return { state: 'back', u: (s - f.off - up - f.on) / down }
  }
}

/**
 * A cannon's or chute's telegraph for releases at ph + k·P: `warn` for `warn` s before each (the swell and the
 * thoomp), `act` for 0.25 s after, `rest` between.
 */
export function releaseTele(P: number, ph: number, warn = 0.8): TeleFn {
  return (t) => {
    const since = frac((t - ph) / P) * P
    const until = P - since
    if (until < warn) return { state: 'warn', u: 1 - until / warn }
    if (since < 0.25) return { state: 'act', u: since / 0.25 }
    return { state: 'rest', u: since / P }
  }
}

/** Sinking `depth` m into the floor over `dur` s from `at`, then gone: the start barrier at GO. */
export function sinkAt(at: number, dur: number, depth: number): MoveFn {
  return (t, o) => {
    const k = clamp((t - at) / dur, 0, 1)
    o.y = -depth * k
    o.on = k < 1
  }
}

/** A path for things rolling straight from the anchor along (dx, dz) per metre, speed v0 + acc·τ to at most vmost. */
export function rollDistance(tau: number, v0: number, acc: number, vmost: number): number {
  if (acc <= 0) return v0 * tau
  const tc = (vmost - v0) / acc
  if (tau <= tc) return v0 * tau + 0.5 * acc * tau * tau
  return v0 * tc + 0.5 * acc * tc * tc + vmost * (tau - tc)
}

/** The hit classes (design-final §1.2), with the spec's usual numbers. */
export function bonk(kn = 6, pop = 2.5): Hit {
  return { cls: 'bonk', kn, kv: 0, pop, vcap: 11, always: true }
}
export function knock(kn = 6, kv = 0.6, pop = 5.5, vcap = 11): Hit {
  return { cls: 'knock', kn, kv, pop, vcap }
}
/** A yeet: flung `fling` plus `kv` × the hazard's own velocity (Block Party: (0, 10, 0) and 0.6). */
export function yeet(fling: Vec3, kv = 0): Hit {
  return { cls: 'yeet', kn: 0, kv, pop: fling.y, vcap: 11, fling }
}

const REST: Tele = { state: 'rest', u: 0 }

/** A thing's telegraph at t (rest, for a thing without one). */
export function teleOf(thing: { tele?: TeleFn }, t: number): Tele {
  return thing.tele ? thing.tele(t) : REST
}

/* ------------------------------------------------------------- poses --- */

const OFF: Offset = { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1 }

function clearOff(): Offset {
  OFF.x = 0
  OFF.y = 0
  OFF.z = 0
  OFF.yaw = 0
  OFF.on = true
  OFF.hy = -1
  return OFF
}

export function newPose(): Pose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, on: true, hy: 0, crack: 0 }
}

export function newBody(): Body {
  return { x: 0, y: 0, z: 0, yaw: 0, on: true, hy: -1, k: 0, tau: 0 }
}

/**
 * Solid i's pose at t: its motion, and with a world, its touch state (a tile's crack and drop, a plank's tip). The
 * scene passes the run's world (or null on the menu: touch things at rest).
 */
export function solidPose(course: Course, world: World | null, i: number, t: number, out: Pose): Pose {
  const s = course.solids[i]!
  out.x = s.x
  out.y = s.y
  out.z = s.z
  out.yaw = s.yaw
  out.pitch = s.pitch
  out.roll = s.roll
  out.on = true
  out.hy = s.hy
  out.crack = 0
  if (s.move) {
    const o = clearOff()
    s.move(t, o)
    out.x += o.x
    out.y += o.y
    out.z += o.z
    out.yaw += o.yaw
    out.on = o.on
    if (o.hy >= 0) out.hy = o.hy
  }
  if (s.touch && world) {
    if (s.touch.kind === 'tile') {
      const at = world.tileT[s.ti]!
      if (at === at && !s.touch.star) {
        const age = t - at
        out.crack = clamp(age / s.touch.crumble, 0, 1)
        if (age >= s.touch.crumble) {
          out.on = false
          const fall = age - s.touch.crumble
          out.y -= fall * fall * 14
        }
      }
    } else out.roll = -world.plank[s.pi]!
  }
  return out
}

/** Hazard h's body at t, for a hazard without a path. */
export function hazardPose(h: Hazard, t: number, out: Body): Body {
  out.x = h.x
  out.y = h.y
  out.z = h.z
  out.yaw = h.yaw
  out.on = true
  out.hy = -1
  out.k = 0
  out.tau = t
  if (h.move) {
    const o = clearOff()
    h.move(t, o)
    out.x += o.x
    out.y += o.y
    out.z += o.z
    out.yaw += o.yaw
    out.on = o.on
    out.hy = o.hy
  }
  return out
}

function pathBody(h: Hazard, p: PathSpec, tau: number, k: number, out: Body): Body {
  const o = clearOff()
  p.at(tau, k, o)
  out.x = h.x + o.x
  out.y = h.y + o.y
  out.z = h.z + o.z
  out.yaw = h.yaw + o.yaw
  out.on = o.on
  out.hy = o.hy
  out.k = k
  out.tau = tau
  return out
}

/**
 * Hazard h's bodies at t into `out` (grown as needed): its one body, or its path's live releases. Returns how many
 * (bodies that aren't there have `on` false).
 */
export function hazardBodies(h: Hazard, t: number, out: Body[]): number {
  const p = h.path
  if (!p) {
    if (out.length < 1) out.push(newBody())
    hazardPose(h, t, out[0]!)
    return 1
  }
  const k0 = Math.ceil((t - p.life - p.ph) / p.P)
  const k1 = Math.floor((t - p.ph) / p.P)
  let n = 0
  for (let k = k0; k <= k1; k++) {
    const tau = t - (p.ph + k * p.P)
    if (tau < 0 || tau > p.life) continue
    if (out.length <= n) out.push(newBody())
    pathBody(h, p, tau, k, out[n]!)
    n++
  }
  return n
}

/** The crown's centre at t. */
export function crownAt(v: Volume & { kind: 'crown' }, t: number, out: Vec3): Vec3 {
  out.x = v.x
  out.y = v.y + v.bob(t)
  out.z = v.z
  return out
}

/** Where the slime is in this run, or NaN before it has started (or in a course without one). */
export function slimeY(run: Run): number {
  const w = run.world
  if (w.slimeT0 !== w.slimeT0) return NaN
  for (const v of run.course.volumes) {
    if (v.kind !== 'slime') continue
    return w.slimeY0 - v.depth + Math.max(0, run.t - w.slimeT0 - 3) * v.rate
  }
  return NaN
}

/** Where the bean splats at z on this course. */
export function deathY(course: Course, z: number): number {
  const d = course.deaths
  for (let i = 0; i < d.length; i++) if (z < d[i]!.z1) return d[i]!.y
  return d.length ? d[d.length - 1]!.y : -DEATH_DROP
}

/** The wind's lift on the bean now, m/s² (a tail wind's `up`, as step() works it out): the bots' landing sums. */
export function windLift(run: Run): number {
  const c = run.course
  const b = run.bean
  const vlist = c.grid.volumes[cellOf(c.grid, b.z)]!
  const mid = b.y + 0.7
  let up = 0
  for (let n = 0; n < vlist.length; n++) {
    const v = c.volumes[vlist[n]!]!
    if (v.kind !== 'wind' || !v.up) continue
    if (Math.abs(b.x - v.x) > v.hx || Math.abs(mid - v.y) > v.hy || Math.abs(b.z - v.z) > v.hz) continue
    up += v.up * Math.max(0, v.duty(run.t))
  }
  return up
}

/* -------------------------------------------------------- broad phase --- */

const GRID_CELL = 2
/** What's in a cell is what reaches within this of it: the bean's reach in a step, with room for close calls and ledges. */
const GRID_PAD = 2.2

function solidReach(s: Solid): number {
  return s.shape === 'box' ? Math.hypot(s.hx, s.hz) : s.r
}

function hazardReach(h: Hazard): number {
  if (h.shape === 'box') return Math.hypot(h.hx, h.hz)
  if (h.shape === 'bar') return h.len + h.r
  return h.r
}

/**
 * Works out the z every solid, hazard and volume can reach (sampling its motion over a minute of clock) and files
 * them by 2 m of z, for the step to look up what's near the bean. The course calls this once it's laid.
 */
export function buildGrid(course: Course): Grid {
  const pose = newPose()
  const body = newBody()
  let lo = Infinity
  let hi = -Infinity
  const span = (z0: number, z1: number) => {
    if (z0 < lo) lo = z0
    if (z1 > hi) hi = z1
  }
  course.solids.forEach((s, i) => {
    const r = solidReach(s)
    let z0 = s.z
    let z1 = s.z
    if (s.move) {
      for (let t = -COUNTDOWN; t <= 60; t += 0.05) {
        solidPose(course, null, i, t, pose)
        if (pose.z < z0) z0 = pose.z
        if (pose.z > z1) z1 = pose.z
      }
    }
    s.z0 = z0 - r - 0.3
    s.z1 = z1 + r + 0.3
    span(s.z0, s.z1)
  })
  for (const h of course.hazards) {
    const r = hazardReach(h)
    let z0 = h.z
    let z1 = h.z
    if (h.path) {
      const p = h.path
      for (let tau = 0; tau <= p.life; tau += 0.05) {
        for (const k of [0, 1, 2, 3]) {
          pathBody(h, p, tau, k, body)
          if (!body.on) continue
          if (body.z < z0) z0 = body.z
          if (body.z > z1) z1 = body.z
        }
      }
    } else if (h.move) {
      for (let t = -COUNTDOWN; t <= 60; t += 0.05) {
        hazardPose(h, t, body)
        if (body.z < z0) z0 = body.z
        if (body.z > z1) z1 = body.z
      }
    }
    h.z0 = z0 - r - 0.3
    h.z1 = z1 + r + 0.3
    span(h.z0, h.z1)
  }
  for (const v of course.volumes) {
    if (v.kind === 'wind') {
      v.z0 = v.z - v.hz
      v.z1 = v.z + v.hz
    } else if (v.kind === 'hoop' || v.kind === 'crown') {
      v.z0 = v.z - v.r - 0.5
      v.z1 = v.z + v.r + 0.5
    }
    span(v.z0, v.z1)
  }
  if (!(lo < hi)) {
    lo = 0
    hi = 1
  }
  const z0 = Math.floor(lo - GRID_PAD) - 2
  const n = Math.ceil((hi + GRID_PAD + 2 - z0) / GRID_CELL)
  const fill = (items: readonly { z0: number; z1: number }[]) => {
    const cells: number[][] = Array.from({ length: n }, () => [])
    items.forEach((it, i) => {
      const a = clamp(Math.floor((it.z0 - GRID_PAD - z0) / GRID_CELL), 0, n - 1)
      const b = clamp(Math.floor((it.z1 + GRID_PAD - z0) / GRID_CELL), 0, n - 1)
      for (let c = a; c <= b; c++) cells[c]!.push(i)
    })
    return cells.map((c) => Int32Array.from(c))
  }
  return { z0, cell: GRID_CELL, solids: fill(course.solids), hazards: fill(course.hazards), volumes: fill(course.volumes) }
}

function cellOf(g: Grid, z: number): number {
  return clamp(Math.floor((z - g.z0) / g.cell), 0, g.solids.length - 1)
}

/* --------------------------------------------------------------- runs --- */

function newBean(): Bean {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    ground: -1,
    gcx: 0,
    gcz: 0,
    acx: 0,
    acz: 0,
    slipX: 0,
    slipZ: 0,
    gvy: 0,
    coyote: 0,
    jumpBuf: 0,
    diveBuf: 0,
    diving: false,
    airDived: false,
    slide: 0,
    slideHeld: 0,
    stun: 0,
    yeet: false,
    hitCd: 0,
    knockH: -1,
    knockK: 0,
    dead: 0,
    splatted: false,
    ledge: 0,
    ledgeFrom: { x: 0, y: 0, z: 0 },
    ledgeTo: { x: 0, y: 0, z: 0 },
    ledgeOn: -1,
    ledgeKeep: { x: 0, z: 0 },
    hoopT: 0,
    hoopX: 0,
    hoopZ: 0,
    bounceOn: -1,
    bounceAge: 99,
    flingX: 0,
    flingZ: 0,
    air: 0,
    landV: 0,
    spawn: 0,
    closeCd: 0,
  }
}

function copyBean(a: Bean, b: Bean): void {
  const { ledgeFrom, ledgeTo, ledgeKeep } = b
  Object.assign(b, a)
  b.ledgeFrom = ledgeFrom
  b.ledgeTo = ledgeTo
  b.ledgeKeep = ledgeKeep
  ledgeFrom.x = a.ledgeFrom.x
  ledgeFrom.y = a.ledgeFrom.y
  ledgeFrom.z = a.ledgeFrom.z
  ledgeTo.x = a.ledgeTo.x
  ledgeTo.y = a.ledgeTo.y
  ledgeTo.z = a.ledgeTo.z
  ledgeKeep.x = a.ledgeKeep.x
  ledgeKeep.z = a.ledgeKeep.z
}

function newCounts(): Counts {
  return { splats: 0, knocks: 0, bonks: 0, yeets: 0, close: 0, ledges: 0, bounces: 0, perfects: 0, hoops: 0 }
}

/** Puts the bean at spawn s, standing still (on its floor, or `drop` m above it). */
function placeBean(run: Run, s: number, drop: number): void {
  const b = run.bean
  const sp = run.course.spawns[s]!
  b.x = sp.x
  b.y = sp.y + drop
  b.z = sp.z
  b.vx = b.vy = b.vz = 0
  b.yaw = 0
  b.ground = -1
  b.gcx = b.gcz = b.acx = b.acz = b.slipX = b.slipZ = b.gvy = 0
  b.coyote = b.jumpBuf = b.diveBuf = 0
  b.diving = b.airDived = false
  b.slide = b.slideHeld = 0
  b.stun = 0
  b.yeet = false
  b.hitCd = 0
  b.knockH = -1
  b.dead = 0
  b.splatted = false
  b.ledge = 0
  b.ledgeOn = -1
  b.hoopT = 0
  b.bounceOn = -1
  b.bounceAge = 99
  b.flingX = b.flingZ = 0
  b.air = 0
  b.spawn = s
}

/**
 * A run of the course from the start pad, `countdown` s before GO (the countdown's steps change nothing: the bean
 * can't move until GO, and the barrier holds it in). `ghost` records the ghost path; `quiet` skips events (the
 * bots); `cues` emits telegraph cues for sound.
 */
export function newRun(course: Course, opts: { countdown?: number; ghost?: boolean; quiet?: boolean; cues?: boolean } = {}): Run {
  const go = Math.round((opts.countdown ?? COUNTDOWN) / STEP)
  const nS = course.solids.length
  const run: Run = {
    course,
    t: -go * STEP,
    steps: 0,
    go,
    bean: newBean(),
    world: {
      tileT: new Float64Array(course.tiles.length).fill(NaN),
      plank: new Float64Array(course.planks.length),
      plankOn: new Uint8Array(course.planks.length),
      slimeT0: NaN,
      slimeY0: 0,
    },
    splits: [],
    done: false,
    time: 0,
    counts: newCounts(),
    touched: false,
    inflate: 0,
    near: false,
    ev: [],
    quiet: opts.quiet ?? false,
    cues: opts.cues ?? false,
    ghost: opts.ghost ? [] : null,
    frame: 0,
    cache: {
      stamp: new Int32Array(nS).fill(-1),
      pose: new Float64Array(nS * 8),
      cue: new Int8Array(nS + course.hazards.length + course.volumes.length).fill(-1),
    },
  }
  placeBean(run, 0, 0)
  run.bean.ground = groundUnder(run)
  return run
}

/** The solid right under the bean's feet, if it's standing on one (a new run's first floor). */
function groundUnder(run: Run): number {
  const b = run.bean
  const P = run.cache.pose
  const list = run.course.grid.solids[cellOf(run.course.grid, b.z)]!
  for (let n = 0; n < list.length; n++) {
    const i = list[n]!
    const s = run.course.solids[i]!
    if (s.noGround || s.door) continue
    const o = poseOf(run, i)
    if (!P[o + 6]) continue
    if (!footprint(s, P, o, b.x, b.z, FOOT)) continue
    if (Math.abs(topAt(s, P, o) - b.y) < 0.05) return i
  }
  return -1
}

/** Everything a run's future depends on, to try something and come back (the bots). */
export type Snapshot = {
  /** Steps since GO (so a snapshot of a run with a countdown restores into one without). */
  rel: number
  done: boolean
  time: number
  touched: boolean
  near: boolean
  splits: number[]
  counts: Counts
  bean: Bean
  tileT: Float64Array
  plank: Float64Array
  plankOn: Uint8Array
  slimeT0: number
  slimeY0: number
}

export function snapshot(run: Run, into?: Snapshot): Snapshot {
  const s: Snapshot = into ?? {
    rel: 0,
    done: false,
    time: 0,
    touched: false,
    near: false,
    splits: [],
    counts: newCounts(),
    bean: newBean(),
    tileT: new Float64Array(run.world.tileT.length),
    plank: new Float64Array(run.world.plank.length),
    plankOn: new Uint8Array(run.world.plankOn.length),
    slimeT0: NaN,
    slimeY0: 0,
  }
  s.rel = run.steps - run.go
  s.done = run.done
  s.time = run.time
  s.touched = run.touched
  s.near = run.near
  s.splits.length = 0
  for (const v of run.splits) s.splits.push(v)
  Object.assign(s.counts, run.counts)
  copyBean(run.bean, s.bean)
  s.tileT.set(run.world.tileT)
  s.plank.set(run.world.plank)
  s.plankOn.set(run.world.plankOn)
  s.slimeT0 = run.world.slimeT0
  s.slimeY0 = run.world.slimeY0
  return s
}

export function restore(run: Run, s: Snapshot): void {
  run.steps = s.rel + run.go
  run.t = s.rel * STEP
  run.done = s.done
  run.time = s.time
  run.touched = s.touched
  run.near = s.near
  run.splits.length = 0
  for (const v of s.splits) run.splits.push(v)
  Object.assign(run.counts, s.counts)
  copyBean(s.bean, run.bean)
  run.world.tileT.set(s.tileT)
  run.world.plank.set(s.plank)
  run.world.plankOn.set(s.plankOn)
  run.world.slimeT0 = s.slimeT0
  run.world.slimeY0 = s.slimeY0
  run.ev.length = 0
}

/** The ghost path's state for the bean now. */
export function ghostState(run: Run): number {
  const b = run.bean
  if (b.dead > 0) return RESPAWNING
  if (b.stun > 0) return STUNNED
  return b.ground >= 0 && !b.diving ? GROUNDED : AIRBORNE
}

/** Whether the bean is diving or belly sliding (0.84 m tall to hazards). */
export function prone(b: Bean): boolean {
  return b.diving || b.slide > 0
}

/* ------------------------------------------------------- step helpers --- */

/** A solid's pose this step, cached in the run: the offset of its 8 numbers (x, y, z, yaw, pitch, roll, on, crack). */
const TMP_POSE = newPose()
function poseOf(run: Run, i: number): number {
  const c = run.cache
  const o = i * 8
  if (c.stamp[i] !== run.frame) {
    c.stamp[i] = run.frame
    const p = solidPose(run.course, run.world, i, run.t, TMP_POSE)
    const P = c.pose
    P[o] = p.x
    P[o + 1] = p.y
    P[o + 2] = p.z
    P[o + 3] = p.yaw
    P[o + 4] = p.pitch
    P[o + 5] = p.roll
    P[o + 6] = p.on ? 1 : 0
    P[o + 7] = p.crack
  }
  return o
}

let LX = 0
let LZ = 0
/** World (x, z) into a pose's own frame: LX, LZ. */
function toLocal(x: number, z: number, px: number, pz: number, yaw: number): void {
  const dx = x - px
  const dz = z - pz
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  LX = dx * c - dz * s
  LZ = dx * s + dz * c
}
let WX = 0
let WZ = 0
/** A pose's own (lx, lz) into the world: WX, WZ. */
function toWorld(lx: number, lz: number, px: number, pz: number, yaw: number): void {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  WX = px + lx * c + lz * s
  WZ = pz - lx * s + lz * c
}

/** Whether world (x, z) is within `pad` of solid s's footprint (pose at P[o]); leaves LX, LZ and the clamped CX, CZ. */
let CX = 0
let CZ = 0
function footprint(s: Solid, P: Float64Array, o: number, x: number, z: number, pad: number): boolean {
  toLocal(x, z, P[o]!, P[o + 2]!, P[o + 3]!)
  if (s.shape === 'box') {
    CX = clamp(LX, -s.hx, s.hx)
    CZ = clamp(LZ, -s.hz, s.hz)
    return Math.abs(LX) <= s.hx + pad && Math.abs(LZ) <= s.hz + pad
  }
  const d = Math.hypot(LX, LZ)
  if (d > s.r) {
    CX = (LX * s.r) / d
    CZ = (LZ * s.r) / d
  } else {
    CX = LX
    CZ = LZ
  }
  return d <= s.r + pad
}

/** The top of the solid posed at P[o], at its own (CX, CZ). */
function topAt(_s: Solid, P: Float64Array, o: number): number {
  return P[o + 1]! + CZ * Math.tan(P[o + 4]!) + CX * Math.tan(P[o + 5]!)
}

let GX = 0
let GZ = 0
/** The world slope of solid s's top (rise per metre in x and z): GX, GZ. */
function gradient(P: Float64Array, o: number): void {
  const tp = Math.tan(P[o + 4]!)
  const tr = Math.tan(P[o + 5]!)
  const c = Math.cos(P[o + 3]!)
  const s = Math.sin(P[o + 3]!)
  GX = tr * c + tp * s
  GZ = -tr * s + tp * c
}

function isStatic(s: Solid): boolean {
  return !s.move && !s.touch
}

/** How much taller wall s is to bean b's sides: a rail or fence (never stood on) catches a knocked bean (KNOCK_CATCH). */
function catchOf(b: Bean, s: Solid): number {
  return s.noGround && !s.door && b.stun > 0 && !b.yeet ? KNOCK_CATCH : 0
}

function emit(run: Run, k: Run['ev'][number]['k'], i = -1, v = 0): void {
  if (run.quiet) return
  const b = run.bean
  run.ev.push({ k, x: b.x, y: b.y, z: b.z, i, v })
}

/* ---------------------------------------------------------------- step --- */

const NO_INPUT: Input = { x: 0, y: 0, jump: false, dive: false }

/** The stick as a world direction and size, this step (for the dive's direction and the ledge catch). */
let SX = 0
let SZ = 0
let SM = 0

/**
 * One step of the run, with the hands' input. Input is ignored before GO, while splatted, during a ledge pop and
 * once the run is done (the bean carries on falling and landing, for the celebration).
 */
export function step(run: Run, input: Input = NO_INPUT): void {
  const b = run.bean
  // The ghost keeps where the bean is at each 20th of a second from GO, before the step moves it.
  if (run.ghost && !run.done && run.steps >= run.go && (run.steps - run.go) % GHOST_EVERY === 0) {
    run.ghost.push(r2(b.x), r2(b.y), r2(b.z), ghostState(run))
  }
  run.ev.length = 0
  run.steps++
  run.frame++
  run.t = (run.steps - run.go) * STEP
  if (run.steps === run.go) emit(run, 'go')
  stepTouch(run)
  const live = run.t > 0 && !run.done
  if (b.dead > 0) stepDead(run)
  else if (b.ledge > 0) stepLedge(run)
  else stepBean(run, live ? input : NO_INPUT)
  for (let p = 0; p < run.course.planks.length; p++) run.world.plankOn[p] = b.ground === run.course.planks[p] && b.dead <= 0 ? 1 : 0
  if (run.cues && !run.quiet) cues(run)
}

/** Touch things, from where the bean was at the end of the last step: planks tip; tiles that drop now say so. */
function stepTouch(run: Run): void {
  const c = run.course
  const w = run.world
  const b = run.bean
  for (let p = 0; p < c.planks.length; p++) {
    const i = c.planks[p]!
    const s = c.solids[i]!
    const spec = s.touch!
    if (spec.kind !== 'plank') continue
    let target = 0
    let rate = ((spec.back ?? 12) * Math.PI) / 180
    if (w.plankOn[p]) {
      toLocal(b.x, b.z, s.x, s.z, s.yaw)
      const d = LX
      const past = Math.max(0, Math.abs(d) - (spec.dead ?? 0.35))
      const most = (spec.max * Math.PI) / 180
      target = clamp(((spec.k * Math.PI) / 180) * Math.sign(d) * past, -most, most)
      rate = ((spec.rate ?? 35) * Math.PI) / 180
    }
    const th = w.plank[p]!
    const dth = clamp(target - th, -rate * STEP, rate * STEP)
    w.plank[p] = th + dth
  }
  if (!run.quiet) {
    for (let k = 0; k < c.tiles.length; k++) {
      const at = w.tileT[k]!
      if (at !== at) continue
      const s = c.solids[c.tiles[k]!]!
      const spec = s.touch!
      if (spec.kind !== 'tile' || spec.star) continue
      const age = run.t - at
      if (age >= spec.crumble && age - STEP < spec.crumble) run.ev.push({ k: 'tileDrop', x: s.x, y: s.y, z: s.z, i: c.tiles[k]!, v: 0 })
    }
  }
}

/** Splatted: the bean keeps falling, visibly, then drops in again at its spawn. */
function stepDead(run: Run): void {
  const b = run.bean
  const c = run.course
  if (b.y > c.gooY) {
    b.vy = Math.max(b.vy - G * STEP, -FALL_MOST)
    b.x += b.vx * STEP
    b.y += b.vy * STEP
    b.z += b.vz * STEP
  }
  if (b.y <= c.gooY) {
    b.y = c.gooY
    b.vx = b.vy = b.vz = 0
  }
  if (!b.splatted && (b.y <= c.gooY || DEAD_T - b.dead >= SPLASH_T)) {
    b.splatted = true
    emit(run, 'splat')
  }
  b.dead -= STEP
  if (b.dead <= 0) respawn(run)
}

/** Back at the spawn, 3 m up, the touch things of its round and later reset. */
function respawn(run: Run): void {
  const s = run.bean.spawn
  const sp = run.course.spawns[s]!
  resetTouch(run, sp.round)
  if (sp.finale) {
    run.world.slimeT0 = run.t
    run.world.slimeY0 = sp.y
  }
  placeBean(run, s, DROP_H)
  emit(run, 'respawn', s)
}

/** Resets the touch things of round `from` and every later one. */
export function resetTouch(run: Run, from: number): void {
  const c = run.course
  const w = run.world
  for (let k = 0; k < c.tiles.length; k++) if (c.solids[c.tiles[k]!]!.round >= from) w.tileT[k] = NaN
  for (let p = 0; p < c.planks.length; p++) {
    if (c.solids[c.planks[p]!]!.round >= from) {
      w.plank[p] = 0
      w.plankOn[p] = 0
    }
  }
}

function die(run: Run): void {
  const b = run.bean
  b.dead = DEAD_T
  b.splatted = false
  b.ground = -1
  b.diving = false
  b.slide = 0
  b.stun = 0
  b.ledge = 0
  b.flingX = b.flingZ = 0
  run.counts.splats++
  run.touched = true
  emit(run, 'fall')
}

/** A ledge catch's pop-up: over LEDGE_T up and onto the edge (riding the solid if it moves). */
function stepLedge(run: Run): void {
  const b = run.bean
  const s = run.course.solids[b.ledgeOn]!
  const P = run.cache.pose
  const o = poseOf(run, b.ledgeOn)
  const x0 = b.x
  const z0 = b.z
  b.ledge -= STEP
  const u = clamp(1 - b.ledge / LEDGE_T, 0, 1)
  const e = u * u * (3 - 2 * u)
  toWorld(b.ledgeTo.x, b.ledgeTo.z, P[o]!, P[o + 2]!, P[o + 3]!)
  CX = b.ledgeTo.x
  CZ = b.ledgeTo.z
  if (s.shape === 'box') {
    CX = clamp(CX, -s.hx, s.hx)
    CZ = clamp(CZ, -s.hz, s.hz)
  }
  const top = topAt(s, P, o)
  b.x = b.ledgeFrom.x + (WX - b.ledgeFrom.x) * e
  b.z = b.ledgeFrom.z + (WZ - b.ledgeFrom.z) * e
  b.y = b.ledgeFrom.y + (top - b.ledgeFrom.y) * e + Math.sin(Math.PI * u) * 0.15
  if (b.ledge <= 0 || !P[o + 6]) {
    b.ledge = 0
    if (P[o + 6]) {
      b.y = top
      b.ground = b.ledgeOn
    }
    b.vx = b.ledgeKeep.x
    b.vz = b.ledgeKeep.z
    b.vy = 0
    b.air = 0
  }
  hazards(run, H)
  if (b.dead <= 0) triggers(run, x0, z0, b.z)
}

let WIND_UP = 0

/** The bean's step: carries, stick, jump and dive, gravity, moving, solids, hazards, what it passed through. */
function stepBean(run: Run, input: Input): void {
  const c = run.course
  const b = run.bean
  const P = run.cache.pose
  const t = run.t
  const x0 = b.x
  const z0 = b.z

  // 1. Carries: what it stands on (moving, turning, a belt, tipping it), then the air (wind, a hoop).
  let g = b.ground
  b.gcx = b.gcz = 0
  b.gvy = 0
  if (g >= 0) {
    const s = c.solids[g]!
    const o = poseOf(run, g)
    if (!P[o + 6]) {
      // The floor has gone from under it (a tile dropped): as walking off, with coyote time, so a JUMP pressed as
      // the tile goes still launches it.
      g = b.ground = -1
      b.slipX = b.slipZ = 0
      b.coyote = COYOTE
      b.air = 0
    } else {
      if (s.move) {
        const prev = solidPose(c, run.world, g, t - STEP, TMP_POSE)
        toLocal(b.x, b.z, prev.x, prev.z, prev.yaw)
        toWorld(LX, LZ, P[o]!, P[o + 2]!, P[o + 3]!)
        const dx = WX - b.x
        const dz = WZ - b.z
        const dy = P[o + 1]! - prev.y
        b.x = WX
        b.z = WZ
        b.y += dy
        b.yaw += P[o + 3]! - prev.yaw
        b.gcx = dx / STEP
        b.gcz = dz / STEP
        b.gvy = dy / STEP
      }
      if (s.belt) {
        const cs = Math.cos(P[o + 3]!)
        const sn = Math.sin(P[o + 3]!)
        const bx = s.belt.x * cs + s.belt.z * sn
        const bz = -s.belt.x * sn + s.belt.z * cs
        b.x += bx * STEP
        b.z += bz * STEP
        b.gcx += bx
        b.gcz += bz
      }
      // A tipped plank slides you toward its low side; level, the slide fades.
      gradient(P, o)
      const tg = Math.hypot(GX, GZ)
      let slip = Math.hypot(b.slipX, b.slipZ)
      if (s.slip && Math.atan(tg) > SLIP_FROM) {
        const th = Math.atan(tg)
        slip = Math.min(SLIP_MOST, slip + (G * Math.sin(th) - SLIP_LESS) * STEP)
        b.slipX = (-GX / tg) * slip
        b.slipZ = (-GZ / tg) * slip
      } else if (slip > 0) {
        const k = Math.max(0, slip - SLIP_FADE * STEP) / slip
        b.slipX *= k
        b.slipZ *= k
      }
      b.x += b.slipX * STEP
      b.z += b.slipZ * STEP
      b.gcx += b.slipX
      b.gcz += b.slipZ
    }
  }
  // The air's carry: wind volumes (on the ground and in the air), a hoop's boost.
  b.acx = b.acz = 0
  WIND_UP = 0
  const vlist = c.grid.volumes[cellOf(c.grid, b.z)]!
  const mid = b.y + 0.7
  for (let n = 0; n < vlist.length; n++) {
    const v = c.volumes[vlist[n]!]!
    if (v.kind !== 'wind') continue
    if (Math.abs(b.x - v.x) > v.hx || Math.abs(mid - v.y) > v.hy || Math.abs(b.z - v.z) > v.hz) continue
    const duty = v.duty(t)
    if (duty <= 0) continue
    b.acx += v.carry.x * duty
    b.acz += v.carry.z * duty
    WIND_UP += v.up * duty
  }
  if (g < 0 && (b.flingX !== 0 || b.flingZ !== 0)) {
    b.acx += b.flingX
    b.acz += b.flingZ
  }
  if (b.hoopT > 0) {
    b.acx += b.hoopX
    b.acz += b.hoopZ
    b.hoopT -= STEP
  }
  b.x += b.acx * STEP
  b.z += b.acz * STEP

  // 2. The stick, as the run controller's target (the camera looks +z, so screen right is −x).
  let ix = input.x
  let iy = input.y
  const im = Math.hypot(ix, iy)
  if (im > 1) {
    ix /= im
    iy /= im
  }
  SM = Math.min(1, im)
  SX = SM > 1e-6 ? -ix / Math.max(im, 1e-6) : 0
  SZ = SM > 1e-6 ? iy / Math.max(im, 1e-6) : 0
  const slickSlide = b.slide > 0 && g >= 0 && !!c.solids[g]!.slick
  // A pad's throw is ballistic: no steering until it lands (it lands where the pad aimed it, whatever the stick).
  const flung = g < 0 && (b.flingX !== 0 || b.flingZ !== 0)
  const control = b.stun <= 0 && b.slide <= 0 && !b.diving && !flung
  if (control) {
    let speed = RUN
    if (g >= 0 && SM > 0) {
      gradient(P, poseOf(run, g))
      const rise = GX * SX + GZ * SZ
      const s = clamp(rise / Math.sqrt(1 + rise * rise), SLOPE_DOWN, SLOPE_UP)
      speed = RUN * (1 - SLOPE_K * s)
    }
    const tx = -ix * speed
    const tz = iy * speed
    const acc = (g >= 0 ? ACC_GROUND : ACC_AIR) * STEP
    let dx = tx - b.vx
    let dz = tz - b.vz
    const d = Math.hypot(dx, dz)
    if (d > acc) {
      dx *= acc / d
      dz *= acc / d
    }
    b.vx += dx
    b.vz += dz
  } else if (slickSlide) {
    // Belly sliding down a slick slope: gravity along the fall line, a little friction, steered across by the stick.
    b.slide = SLIDE_T
    b.slideHeld = 0
    gradient(P, poseOf(run, g))
    const tg = Math.hypot(GX, GZ)
    const cos = 1 / Math.sqrt(1 + tg * tg)
    const sin = tg * cos
    let fx = 0
    let fz = 1
    if (tg > 1e-6) {
      fx = -GX / tg
      fz = -GZ / tg
      b.vx += fx * G * sin * STEP
      b.vz += fz * G * sin * STEP
    } else {
      const sp = Math.hypot(b.vx, b.vz)
      if (sp > 1e-6) {
        fx = b.vx / sp
        fz = b.vz / sp
      }
    }
    let sp = Math.hypot(b.vx, b.vz)
    if (sp > 1e-6) {
      const k = Math.max(0, sp - SLICK_FRICTION * G * cos * STEP) / sp
      b.vx *= k
      b.vz *= k
      sp *= k
    }
    if (sp > SLICK_MOST) {
      b.vx *= SLICK_MOST / sp
      b.vz *= SLICK_MOST / sp
    }
    const lx = fz
    const lz = -fx
    const lat = b.vx * lx + b.vz * lz
    const want = (SX * lx + SZ * lz) * SM * SLICK_STEER
    const dl = clamp(want - lat, -SLICK_STEER_ACC * STEP, SLICK_STEER_ACC * STEP)
    b.vx += lx * dl
    b.vz += lz * dl
  } else if (g >= 0) {
    const k = Math.exp(-STEP * (b.slide > 0 ? SLIDE_DECAY : STOP_DECAY))
    b.vx *= k
    b.vz *= k
  }

  // 3. Jump and dive, with their buffers and coyote time.
  if (input.jump) b.jumpBuf = JUMP_BUF
  if (input.dive) b.diveBuf = DIVE_BUF
  b.jumpBuf -= STEP
  b.diveBuf -= STEP
  b.coyote -= STEP
  b.bounceAge += STEP
  if (b.jumpBuf > 0 && b.bounceOn >= 0 && b.bounceAge <= PERFECT_AFTER && b.vy > 0) {
    // A JUMP just after touching a bounce pad: the perfect bounce after all.
    perfectBounce(run, c.solids[b.bounceOn]!, b.bounceAge)
  } else if (b.jumpBuf > 0 && b.stun <= 0 && (g >= 0 || b.coyote > 0)) {
    if (b.slide > 0 && g >= 0) {
      // A belly hop keeps the slide's speed and lands back on the belly.
      b.vx += b.gcx
      b.vz += b.gcz
      b.vy = BELLY_HOP
      b.diving = true
      b.airDived = true
      b.slide = 0
      g = b.ground = -1
      b.jumpBuf = 0
      b.coyote = 0
      b.air = 0
      emit(run, 'bellyHop')
    } else if (control) {
      if (g >= 0) {
        b.vx += b.gcx
        b.vz += b.gcz
        b.vy = JUMP + Math.max(0, b.gvy)
      } else b.vy = JUMP
      g = b.ground = -1
      b.jumpBuf = 0
      b.coyote = 0
      b.air = 0
      emit(run, 'jump')
    }
  }
  if (b.diveBuf > 0 && !b.diving && b.stun <= 0 && b.slide <= 0 && (g >= 0 || !b.airDived)) {
    let dx = SX
    let dz = SZ
    if (SM <= 0.3) {
      dx = Math.sin(b.yaw)
      dz = Math.cos(b.yaw)
    }
    if (g >= 0) {
      b.vx += b.gcx
      b.vz += b.gcz
      b.vy = DIVE_VY + Math.max(0, b.gvy)
    } else {
      b.vy = Math.max(b.vy, AIR_DIVE_VY)
      b.airDived = true
      b.vx += b.flingX
      b.vz += b.flingZ
      b.flingX = b.flingZ = 0
    }
    const sp = Math.max(DIVE, Math.hypot(b.vx, b.vz) + DIVE_ADD)
    b.vx = dx * sp
    b.vz = dz * sp
    b.yaw = Math.atan2(dx, dz)
    b.diving = true
    g = b.ground = -1
    b.diveBuf = 0
    b.coyote = 0
    emit(run, 'dive')
  }
  const was = g

  // 4–5. Gravity (and the wind's lift), then move.
  b.vy = Math.max(b.vy - (G - WIND_UP) * STEP, -FALL_MOST)
  b.x += b.vx * STEP
  b.y += b.vy * STEP
  b.z += b.vz * STEP

  // 6. Solids.
  const isProne = prone(b)
  const hc = isProne ? H_PRONE : H
  const vyIn = b.vy
  const ng = solids(run, was, hc)
  if (b.ledge > 0) return
  if (ng < 0 && was >= 0) {
    // Walking off: what carried it becomes its own speed.
    b.vx += b.gcx
    b.vz += b.gcz
    b.slipX = b.slipZ = 0
    b.coyote = COYOTE
    b.air = 0
  }
  b.ground = ng
  if (ng >= 0 && was < 0) land(run, ng, vyIn)
  if (ng < 0) b.air += STEP
  if (b.ground >= 0) {
    const s = c.solids[b.ground]!
    if (s.touch && s.touch.kind === 'tile' && !s.touch.star && run.world.tileT[s.ti] !== run.world.tileT[s.ti]) {
      run.world.tileT[s.ti] = t
      emit(run, 'tileCrack', b.ground)
    }
    if (s.bounce && (!s.bounce.lit || s.bounce.lit(t))) launch(run, b.ground)
  }

  // 7. Hazards.
  hazards(run, hc)
  if (b.dead > 0) return

  // Facing follows its own way of going, while it has the stick.
  const sp = Math.hypot(b.vx, b.vz)
  if (control && sp > 0.6) {
    let d = Math.atan2(b.vx, b.vz) - b.yaw
    d = Math.atan2(Math.sin(d), Math.cos(d))
    b.yaw += d * (1 - Math.exp(-STEP * 14))
  }
  b.stun -= STEP
  b.hitCd -= STEP
  b.closeCd -= STEP
  if (b.slide > 0 && !(b.ground >= 0 && c.solids[b.ground]!.slick)) {
    if (b.slide - STEP <= 0 && b.slideHeld < SLIDE_HOLD && overhead(run)) b.slideHeld += STEP
    else b.slide -= STEP
  }
  if (b.stun <= 0) b.yeet = false

  // 8. What it passed through.
  triggers(run, x0, z0, b.z)
}

/** Down on a solid: a dive becomes a belly slide, a yeet ends 0.25 s after, one air dive again. */
function land(run: Run, i: number, vy: number): void {
  const b = run.bean
  b.landV = -vy
  b.air = 0
  b.airDived = false
  b.vx += b.flingX
  b.vz += b.flingZ
  b.flingX = b.flingZ = 0
  if (b.diving) {
    b.diving = false
    b.slide = SLIDE_T
    b.slideHeld = 0
    emit(run, 'slide', i)
  }
  if (b.yeet) b.stun = Math.min(b.stun, YEET_AFTER)
  emit(run, 'land', i, -vy)
}

/** Thrown by a bounce pad: perfect if JUMP was pressed just before. */
function launch(run: Run, i: number): void {
  const b = run.bean
  const s = run.course.solids[i]!
  const bo = s.bounce!
  b.ground = -1
  b.diving = false
  b.slide = 0
  b.airDived = false
  b.coyote = 0
  b.bounceOn = i
  b.bounceAge = 0
  b.vx += b.gcx
  b.vz += b.gcz
  if (b.jumpBuf > 0 && bo.perfectVy !== undefined) {
    perfectBounce(run, s, 0)
    return
  }
  b.vy = bo.vy
  throwAlong(b, bo.vy, bo.fwd, bo.aim)
  run.counts.bounces++
  emit(run, 'bounce', i)
}

function perfectBounce(run: Run, s: Solid, since: number): void {
  const b = run.bean
  const bo = s.bounce!
  const vy = (bo.perfectVy ?? bo.vy) - G * since
  b.vy = vy
  throwAlong(b, vy, bo.perfectFwd ?? bo.fwd, bo.perfectAim ?? bo.aim)
  b.jumpBuf = 0
  b.bounceAge = 99
  run.counts.perfects++
  emit(run, 'perfectBounce', b.bounceOn)
}

/** A bounce's horizontal speed: set (`fwd`), aimed at a point (whatever lands it there), or its own. */
function throwAlong(b: Bean, vy: number, fwd?: { x: number; z: number }, aim?: Vec3): void {
  if (aim) {
    const dy = aim.y - b.y
    const disc = vy * vy - 2 * G * dy
    const tf = disc > 0 ? (vy + Math.sqrt(disc)) / G : vy / G
    b.flingX = (aim.x - b.x) / Math.max(0.1, tf)
    b.flingZ = (aim.z - b.z) / Math.max(0.1, tf)
  } else if (fwd) {
    b.flingX = fwd.x
    b.flingZ = fwd.z
  } else return
  b.vx = 0
  b.vz = 0
}

/** Whether something low is over the bean (a belly slide is held under it). */
function overhead(run: Run): boolean {
  const c = run.course
  const b = run.bean
  const P = run.cache.pose
  const cell = cellOf(c.grid, b.z)
  const sl = c.grid.solids[cell]!
  for (let n = 0; n < sl.length; n++) {
    const i = sl[n]!
    const s = c.solids[i]!
    if (!s.duck) continue
    const o = poseOf(run, i)
    if (!P[o + 6] || !footprint(s, P, o, b.x, b.z, R)) continue
    const bottom = topAt(s, P, o) - 2 * (s.hy)
    if (bottom < b.y + H && bottom > b.y) return true
  }
  const hl = c.grid.hazards[cell]!
  for (let n = 0; n < hl.length; n++) {
    const h = c.hazards[hl[n]!]!
    if (h.shape !== 'box' && h.shape !== 'bar') continue
    const m = hazardBodies(h, run.t, BODIES)
    for (let k = 0; k < m; k++) {
      const bd = BODIES[k]!
      if (!bd.on) continue
      const bottom = h.shape === 'box' ? bd.y - (bd.hy >= 0 ? bd.hy : h.hy) : bd.y - h.r
      if (bottom > b.y + H || bottom < b.y + 0.2) continue
      if (contact(h, bd, b.x, b.z, b.y + R, b.y + H - R) < 0.3) return true
    }
  }
  return false
}

/**
 * The bean against the solids near it: first the ground (the highest top under its feet, if it's coming down or
 * keeping to the floor), then sides, ceilings, doors and ledges. Returns the solid it stands on, or −1.
 */
function solids(run: Run, was: number, hc: number): number {
  const c = run.course
  const b = run.bean
  const P = run.cache.pose
  const list = c.grid.solids[cellOf(c.grid, b.z)]!
  let best = -1
  let bestTop = -Infinity
  // Rising (a jump, a bounce), it lands on nothing.
  for (let n = 0; n < list.length && b.vy <= 0.01; n++) {
    const i = list[n]!
    const s = c.solids[i]!
    if (s.noGround || s.door) continue
    const o = poseOf(run, i)
    if (!P[o + 6]) continue
    if (!footprint(s, P, o, b.x, b.z, FOOT)) continue
    const tp = Math.tan(P[o + 4]!)
    const tr = Math.tan(P[o + 5]!)
    if (tp * tp + tr * tr > STEEPEST2) continue
    const top = topAt(s, P, o)
    if (b.y < top - STEP_UP) continue
    if (b.y > top + 0.02 && (was < 0 || b.y > top + SNAP_DOWN)) continue
    if (top > bestTop) {
      bestTop = top
      best = i
    }
  }
  if (best >= 0) {
    b.y = bestTop
    if (b.vy < 0) b.vy = 0
  }
  for (let n = 0; n < list.length; n++) {
    const i = list[n]!
    if (i === best) continue
    const s = c.solids[i]!
    const o = poseOf(run, i)
    if (!P[o + 6]) continue
    toLocal(b.x, b.z, P[o]!, P[o + 2]!, P[o + 3]!)
    let dx: number
    let dz: number
    let d: number
    if (s.shape === 'box') {
      CX = clamp(LX, -s.hx, s.hx)
      CZ = clamp(LZ, -s.hz, s.hz)
      dx = LX - CX
      dz = LZ - CZ
      d = Math.hypot(dx, dz)
    } else {
      const dc = Math.hypot(LX, LZ)
      if (dc > 1e-9) {
        CX = (LX * Math.min(dc, s.r)) / dc
        CZ = (LZ * Math.min(dc, s.r)) / dc
      } else {
        CX = 0
        CZ = 0
      }
      dx = LX - CX
      dz = LZ - CZ
      d = Math.max(0, dc - s.r)
    }
    if (d >= R + LEDGE_OUT + run.inflate) continue
    const top = topAt(s, P, o)
    const bottom = top - 2 * s.hy
    if (s.door) {
      doorRule(run, i, s, P, o, top, bottom, hc)
      continue
    }
    const hs = s.duck ? hc : H
    if (b.y >= top + catchOf(b, s) - 0.05) continue
    if (b.y + hs <= bottom) continue
    if (d <= 0 && b.y < bottom && b.vy > 0) {
      // Its head into the underside: stopped there.
      b.y = bottom - hs
      b.vy = 0
      continue
    }
    if (best >= 0 && d < R && !s.noGround && top - b.y <= STEP_UP && b.vy <= 0.01) {
      // A step up in its stride: onto it.
      b.y = top
      if (b.vy < 0) b.vy = 0
      best = i
      continue
    }
    if (s.ledge && best < 0 && b.stun <= 0 && b.vy <= LEDGE_VY && d > 0 && d <= LEDGE_OUT && top - b.y <= LEDGE_UP && top - b.y >= -LEDGE_ABOVE) {
      // Toward the edge (moving, or the stick): catch it.
      const cs = Math.cos(P[o + 3]!)
      const sn = Math.sin(P[o + 3]!)
      const nx = dx / d
      const nz = dz / d
      const wnx = nx * cs + nz * sn
      const wnz = -nx * sn + nz * cs
      const toward = -(b.vx * wnx + b.vz * wnz)
      const stick = -(SX * wnx + SZ * wnz) * SM
      if (toward >= 0.5 || stick >= 0.3) {
        b.ledge = LEDGE_T
        b.ledgeOn = i
        b.ledgeFrom.x = b.x
        b.ledgeFrom.y = b.y
        b.ledgeFrom.z = b.z
        b.ledgeTo.x = CX - nx * LEDGE_IN
        b.ledgeTo.z = CZ - nz * LEDGE_IN
        b.ledgeTo.y = top
        b.ledgeKeep.x = (b.vx + b.flingX) * LEDGE_KEEP
        b.ledgeKeep.z = (b.vz + b.flingZ) * LEDGE_KEEP
        b.flingX = b.flingZ = 0
        b.diving = false
        b.slide = 0
        b.vy = 0
        run.counts.ledges++
        emit(run, 'ledge', i)
        return -1
      }
    }
    if (d >= R) continue
    let nx: number
    let nz: number
    let pen: number
    if (d > 1e-6) {
      nx = dx / d
      nz = dz / d
      pen = R - d
    } else if (s.shape === 'box') {
      const fx = s.hx - Math.abs(LX)
      const fz = s.hz - Math.abs(LZ)
      if (fx < fz) {
        nx = Math.sign(LX) || 1
        nz = 0
        pen = fx + R
      } else {
        nz = Math.sign(LZ) || 1
        nx = 0
        pen = fz + R
      }
    } else {
      const dc = Math.hypot(LX, LZ)
      nx = dc > 1e-6 ? LX / dc : 1
      nz = dc > 1e-6 ? LZ / dc : 0
      pen = s.r + R - dc
    }
    toWorld(LX + nx * pen, LZ + nz * pen, P[o]!, P[o + 2]!, P[o + 3]!)
    b.x = WX
    b.z = WZ
    const cs = Math.cos(P[o + 3]!)
    const sn = Math.sin(P[o + 3]!)
    const wnx = nx * cs + nz * sn
    const wnz = -nx * sn + nz * cs
    const vn = b.vx * wnx + b.vz * wnz
    if (vn < 0) {
      b.vx -= vn * wnx
      b.vz -= vn * wnz
    }
  }
  return best
}

/**
 * The descending-door rule (design-final M7): a door whose bottom is below the bean's top while it's in the door's
 * way pushes it out along the door's z, to the side its centre is on, at least DOOR_PUSH m/s, and bonks it.
 */
function doorRule(run: Run, i: number, s: Solid, P: Float64Array, o: number, top: number, bottom: number, hc: number): void {
  const b = run.bean
  const inf = run.inflate
  if (inf > 0 && Math.abs(LX) < s.hx + R + inf && Math.abs(LZ) < s.hz + R + inf && bottom < b.y + hc + inf && top > b.y) run.near = true
  if (!(Math.abs(LX) < s.hx + R && Math.abs(LZ) < s.hz + R && bottom < b.y + hc && top > b.y)) return
  const yaw = P[o + 3]!
  const cs = Math.cos(yaw)
  const sn = Math.sin(yaw)
  let vzl = b.vx * sn + b.vz * cs
  const vxl = b.vx * cs - b.vz * sn
  const side = LZ > 0 ? 1 : LZ < 0 ? -1 : vzl > 0 ? -1 : 1
  toWorld(LX, side * (s.hz + R), P[o]!, P[o + 2]!, yaw)
  b.x = WX
  b.z = WZ
  if (vzl * side < DOOR_PUSH) vzl = DOOR_PUSH * side
  b.vx = vxl * cs + vzl * sn
  b.vz = -vxl * sn + vzl * cs
  b.diving = false
  if (b.hitCd <= 0) {
    b.hitCd = BONK_CD
    b.knockH = -1
    run.counts.bonks++
    run.touched = true
    emit(run, 'bonk', i)
  }
}

/* ------------------------------------------------------------ hazards --- */

const BODIES: Body[] = [newBody(), newBody(), newBody(), newBody()]
const PREV = newBody()
let CT_NX = 0
let CT_NZ = 0
let CT_X = 0
let CT_Z = 0

/**
 * How far the bean (a capsule from lo to hi, radius R, at px, pz) is from touching hazard body bd: negative when
 * they overlap. Leaves the push's direction (CT_NX, CT_NZ, flat) and the touching point on the hazard (CT_X, CT_Z).
 */
function contact(h: Hazard, bd: Body, px: number, pz: number, lo: number, hi: number): number {
  if (h.shape === 'sphere') {
    const yc = clamp(bd.y, lo, hi)
    const dx = px - bd.x
    const dy = yc - bd.y
    const dz = pz - bd.z
    const d = Math.hypot(dx, dy, dz)
    const dh = Math.hypot(dx, dz)
    if (dh > 1e-6) {
      CT_NX = dx / dh
      CT_NZ = dz / dh
    } else {
      CT_NX = 0
      CT_NZ = -1
    }
    const k = d > 1e-6 ? h.r / d : 0
    CT_X = bd.x + dx * k
    CT_Z = bd.z + dz * k
    return d - h.r - R
  }
  if (h.shape === 'post') {
    const dx = px - bd.x
    const dz = pz - bd.z
    const dh = Math.hypot(dx, dz)
    if (dh > 1e-6) {
      CT_NX = dx / dh
      CT_NZ = dz / dh
    } else {
      CT_NX = 0
      CT_NZ = -1
    }
    CT_X = bd.x + CT_NX * h.r
    CT_Z = bd.z + CT_NZ * h.r
    const flat = dh - h.r - R
    const vg = Math.max(bd.y - (hi + R), lo - R - (bd.y + h.h), 0)
    return vg > 0 ? Math.max(flat, vg) : flat
  }
  if (h.shape === 'box') {
    const hy = bd.hy >= 0 ? bd.hy : h.hy
    toLocal(px, pz, bd.x, bd.z, bd.yaw)
    const qy = clamp(clamp(bd.y, lo, hi), bd.y - hy, bd.y + hy)
    const pyc = clamp(qy, lo, hi)
    const qx = clamp(LX, -h.hx, h.hx)
    const qz = clamp(LZ, -h.hz, h.hz)
    const dx = LX - qx
    const dy = pyc - qy
    const dz = LZ - qz
    const d = Math.hypot(dx, dy, dz)
    const dh = Math.hypot(dx, dz)
    let nx: number
    let nz: number
    let gap = d - R
    if (dh > 1e-6) {
      nx = dx / dh
      nz = dz / dh
    } else {
      const fx = h.hx - Math.abs(LX)
      const fz = h.hz - Math.abs(LZ)
      if (fx < fz) {
        nx = Math.sign(LX) || 1
        nz = 0
        if (Math.abs(dy) < 1e-6) gap = -(fx + R)
      } else {
        nz = Math.sign(LZ) || 1
        nx = 0
        if (Math.abs(dy) < 1e-6) gap = -(fz + R)
      }
    }
    toWorld(qx, qz, bd.x, bd.z, bd.yaw)
    CT_X = WX
    CT_Z = WZ
    const cs = Math.cos(bd.yaw)
    const sn = Math.sin(bd.yaw)
    CT_NX = nx * cs + nz * sn
    CT_NZ = -nx * sn + nz * cs
    return gap
  }
  // A bar: a capsule along its yaw's local x.
  const ax = Math.cos(bd.yaw)
  const az = -Math.sin(bd.yaw)
  const ox = px - bd.x
  const oz = pz - bd.z
  const s = clamp(ox * ax + oz * az, -h.len, h.len)
  const qx = bd.x + s * ax
  const qz = bd.z + s * az
  const dy = clamp(bd.y, lo, hi) - bd.y
  const dx = px - qx
  const dz = pz - qz
  const d = Math.hypot(dx, dy, dz)
  const dh = Math.hypot(dx, dz)
  if (dh > 1e-6) {
    CT_NX = dx / dh
    CT_NZ = dz / dh
  } else {
    CT_NX = -az
    CT_NZ = ax
  }
  CT_X = qx
  CT_Z = qz
  return d - h.r - R
}

let HV_X = 0
let HV_Z = 0
/** The velocity of the hazard's touching point (CT_X, CT_Z on body bd): where the same point was a step ago. */
function hazardVel(h: Hazard, bd: Body, t: number): void {
  if (h.path) pathBody(h, h.path, bd.tau - STEP, bd.k, PREV)
  else hazardPose(h, t - STEP, PREV)
  toLocal(CT_X, CT_Z, bd.x, bd.z, bd.yaw)
  toWorld(LX, LZ, PREV.x, PREV.z, PREV.yaw)
  HV_X = (CT_X - WX) / STEP
  HV_Z = (CT_Z - WZ) / STEP
}

/** The bean against the hazards near it: hits, shoves, close calls, and the bots' margin. */
function hazards(run: Run, hc: number): void {
  const c = run.course
  const b = run.bean
  const t = run.t
  const list = c.grid.hazards[cellOf(c.grid, b.z)]!
  const lo = b.y + R
  const hi = Math.max(lo, b.y + hc - R)
  for (let n = 0; n < list.length; n++) {
    const hz = list[n]!
    const h = c.hazards[hz]!
    // A yeeted bean sails over the walls that yeeted it.
    if (h.hit.cls === 'yeet' && b.yeet && b.stun > 0) continue
    const m = hazardBodies(h, t, BODIES)
    for (let k = 0; k < m; k++) {
      const bd = BODIES[k]!
      if (!bd.on) continue
      // The body that knocked it lets it be until the knock's cooldown is over.
      if (b.hitCd > 0 && hz === b.knockH && bd.k === b.knockK) continue
      const gap = contact(h, bd, b.x, b.z, lo, hi)
      if (gap < run.inflate) run.near = true
      if (gap < 0) {
        hazardVel(h, bd, t)
        hit(run, h, hz, -gap, bd.k)
      } else if (gap < CLOSE_GAP && b.closeCd <= 0) {
        hazardVel(h, bd, t)
        const rel = Math.hypot(HV_X - b.vx, HV_Z - b.vz)
        if (rel > CLOSE_SPEED) {
          b.closeCd = CLOSE_CD
          run.counts.close++
          emit(run, 'closeCall', hz, rel)
        }
      }
    }
  }
}

/**
 * How far the bean can be pushed along (nx, nz), up to `most`, before its middle meets a wall (anything beside it
 * it can't step onto): a hazard may pin a bean against a rail, never push it through one.
 */
function pushRoom(run: Run, nx: number, nz: number, most: number): number {
  const c = run.course
  const b = run.bean
  const P = run.cache.pose
  const hc = prone(b) ? H_PRONE : H
  const list = c.grid.solids[cellOf(c.grid, b.z)]!
  let room = most
  for (let n = 0; n < list.length; n++) {
    const i = list[n]!
    const s = c.solids[i]!
    if (s.door) continue
    const o = poseOf(run, i)
    if (!P[o + 6]) continue
    const top = topAt(s, P, o)
    if (b.y >= top + catchOf(b, s) - 0.05 || b.y + (s.duck ? hc : H) <= top - 2 * s.hy) continue
    toLocal(b.x, b.z, P[o]!, P[o + 2]!, P[o + 3]!)
    const cs = Math.cos(P[o + 3]!)
    const sn = Math.sin(P[o + 3]!)
    const ux = nx * cs - nz * sn
    const uz = nx * sn + nz * cs
    let enter = Infinity
    if (s.shape === 'box') {
      // Where the push meets the footprint grown by the bean's radius, an axis at a time (already inside: the
      // solids put it out).
      const ex = s.hx + R
      const ez = s.hz + R
      if (Math.abs(LX) < ex && Math.abs(LZ) < ez) continue
      let t0 = 0
      let t1 = Infinity
      if (Math.abs(ux) < 1e-9) {
        if (Math.abs(LX) >= ex) continue
      } else {
        const a = (-ex - LX) / ux
        const d = (ex - LX) / ux
        t0 = Math.max(t0, Math.min(a, d))
        t1 = Math.min(t1, Math.max(a, d))
      }
      if (Math.abs(uz) < 1e-9) {
        if (Math.abs(LZ) >= ez) continue
      } else {
        const a = (-ez - LZ) / uz
        const d = (ez - LZ) / uz
        t0 = Math.max(t0, Math.min(a, d))
        t1 = Math.min(t1, Math.max(a, d))
      }
      if (t0 <= t1) enter = t0
    } else {
      const rr = s.r + R
      const pd = LX * ux + LZ * uz
      const q = LX * LX + LZ * LZ - rr * rr
      if (q < 0) continue
      const disc = pd * pd - q
      if (disc >= 0 && pd < 0) enter = -pd - Math.sqrt(disc)
    }
    if (enter < room) room = Math.max(0, enter)
  }
  return room
}

/** Hit by hazard h (overlapping by `pen`), whose touching point moves at HV: pushed out, then bonked, knocked or yeeted. */
function hit(run: Run, h: Hazard, i: number, pen: number, k: number): void {
  const b = run.bean
  const nx = CT_NX
  const nz = CT_NZ
  const push = pushRoom(run, nx, nz, pen)
  b.x += nx * push
  b.z += nz * push
  const vn = b.vx * nx + b.vz * nz
  if (vn < 0) {
    b.vx -= vn * nx
    b.vz -= vn * nz
  }
  if (b.hitCd > 0) return
  const hc = h.hit
  if (!hc.always && HV_X * nx + HV_Z * nz < SHOVE) return
  let hvx = HV_X
  let hvz = HV_Z
  const m = Math.hypot(hvx, hvz)
  if (m > hc.vcap) {
    hvx *= hc.vcap / m
    hvz *= hc.vcap / m
  }
  if (hc.cls === 'yeet') {
    const f = hc.fling ?? { x: 0, y: 10, z: 0 }
    b.vx = f.x + hvx * hc.kv
    b.vy = f.y
    b.vz = f.z + hvz * hc.kv
    b.stun = YEET_MOST
    b.yeet = true
    b.hitCd = HIT_CD
    b.knockH = -1
    run.counts.yeets++
    emit(run, 'yeet', i)
  } else if (hc.cls === 'knock') {
    b.vx = nx * hc.kn + hvx * hc.kv
    b.vz = nz * hc.kn + hvz * hc.kv
    b.vy = hc.pop
    b.stun = STUN
    b.hitCd = HIT_CD
    b.knockH = i
    b.knockK = k
    run.counts.knocks++
    emit(run, 'knock', i)
  } else {
    b.vx = nx * hc.kn + hvx * hc.kv
    b.vz = nz * hc.kn + hvz * hc.kv
    b.vy = Math.max(b.vy, hc.pop)
    b.hitCd = BONK_CD
    b.knockH = -1
    run.counts.bonks++
    emit(run, 'bonk', i)
  }
  b.ground = -1
  b.diving = false
  b.slide = 0
  b.slideHeld = 0
  b.coyote = 0
  b.airDived = false
  b.ledge = 0
  b.gcx = b.gcz = b.slipX = b.slipZ = 0
  b.flingX = b.flingZ = 0
  run.touched = true
}

/* ----------------------------------------------------------- triggers --- */

const CROWN = { x: 0, y: 0, z: 0 }

/** What the bean passed through this step, from (x0, z0): checkpoints, flags, hoops, the crown, the slime, the goo. */
function triggers(run: Run, x0: number, z0: number, z1: number): void {
  const c = run.course
  const b = run.bean
  const t = run.t
  if (run.done) return
  // Checkpoints: a split at the line, to the moment it crossed. Flags: standing on solid ground past theirs.
  for (let s = b.spawn + 1; s < c.spawns.length; s++) {
    const sp = c.spawns[s]!
    if (sp.line > z1) break
    // Under the pad (fallen short, its lip passed overhead): no checkpoint. A ledge catch is within LEDGE_UP of its top.
    if (sp.split && b.y < sp.y - 1.0) continue
    if (sp.split) {
      if (z0 < sp.line) {
        const f = (sp.line - z0) / Math.max(1e-9, z1 - z0)
        reachSpawn(run, s, t - STEP + STEP * clamp(f, 0, 1))
      } else reachSpawn(run, s, t)
    } else if (b.ground >= 0 && isStatic(c.solids[b.ground]!)) reachSpawn(run, s, t)
  }
  const vlist = c.grid.volumes[cellOf(c.grid, b.z)]!
  for (let n = 0; n < vlist.length; n++) {
    const vi = vlist[n]!
    const v = c.volumes[vi]!
    if (v.kind === 'hoop') {
      const cy = b.y + 0.7
      const s0 = (x0 - v.x) * v.dir.x + (z0 - v.z) * v.dir.z
      const s1 = (b.x - v.x) * v.dir.x + (b.z - v.z) * v.dir.z
      if (s0 < 0 && s1 >= 0) {
        const f = -s0 / Math.max(1e-9, s1 - s0)
        const px = x0 + (b.x - x0) * f
        const pz = z0 + (b.z - z0) * f
        if (Math.hypot(px - v.x, cy - v.y, pz - v.z) <= HOOP_R) {
          b.hoopT = v.dur
          b.hoopX = v.dir.x * v.boost
          b.hoopZ = v.dir.z * v.boost
          run.counts.hoops++
          emit(run, 'hoop', vi)
        }
      }
    } else if (v.kind === 'crown') {
      crownAt(v, t, CROWN)
      const lo = b.y + R
      const hi = b.y + H - R
      const d1 = Math.hypot(b.x - CROWN.x, clamp(CROWN.y, lo, hi) - CROWN.y, b.z - CROWN.z)
      if (d1 <= v.r + R) {
        const cy0 = v.y + v.bob(t - STEP)
        const d0 = Math.hypot(x0 - CROWN.x, clamp(cy0, lo, hi) - cy0, z0 - CROWN.z)
        const f = d0 > d1 ? (d0 - v.r - R) / (d0 - d1) : 1
        run.time = t - STEP + STEP * clamp(f, 0, 1)
        while (run.splits.length < c.splitCount - 1) run.splits.push(run.time)
        run.splits.push(run.time)
        run.done = true
        if (run.ghost) run.ghost.push(r2(b.x), r2(b.y), r2(b.z), ghostState(run))
        emit(run, 'crown', vi, run.time)
        return
      }
    }
  }
  const sy = slimeY(run)
  if (b.y < deathY(c, b.z) || b.y < sy) die(run)
}

/** Reached spawn s at time `at`: a split if it's a checkpoint (any skipped before it get the same time). */
function reachSpawn(run: Run, s: number, at: number): void {
  const c = run.course
  const sp = c.spawns[s]!
  run.bean.spawn = s
  if (sp.split) {
    let k = 0
    for (let j = 1; j <= s; j++) if (c.spawns[j]!.split) k++
    while (run.splits.length < k) run.splits.push(at)
    if (sp.finale) {
      run.world.slimeT0 = at
      run.world.slimeY0 = sp.y
    }
    emit(run, 'checkpoint', s, at)
  } else emit(run, 'flag', s)
}

/* --------------------------------------------------------------- cues --- */

const TELE_STATES: readonly TeleState[] = ['rest', 'warn', 'act', 'hold', 'back']

/** Telegraphs that change phase near the bean (20 m behind to 45 m ahead) become `cue` events for sound. */
function cues(run: Run): void {
  const c = run.course
  const b = run.bean
  const t = run.t
  const cue = run.cache.cue
  const nS = c.solids.length
  const nH = c.hazards.length
  const near = (z0: number, z1: number) => z1 > b.z - 20 && z0 < b.z + 45
  const check = (idx: number, tele: TeleFn, what: 'solid' | 'hazard' | 'volume', i: number, x: number, y: number, z: number, look: string) => {
    const st = TELE_STATES.indexOf(tele(t).state)
    if (cue[idx] !== -1 && cue[idx] !== st) run.ev.push({ k: 'cue', x, y, z, i, v: 0, what, look, state: TELE_STATES[st] })
    cue[idx] = st
  }
  for (let i = 0; i < nS; i++) {
    const s = c.solids[i]!
    if (s.tele && near(s.z0, s.z1)) check(i, s.tele, 'solid', i, s.x, s.y, s.z, s.look)
  }
  for (let i = 0; i < nH; i++) {
    const h = c.hazards[i]!
    if (h.tele && near(h.z0, h.z1)) check(nS + i, h.tele, 'hazard', i, h.x, h.y, h.z, h.look)
  }
  for (let i = 0; i < c.volumes.length; i++) {
    const v = c.volumes[i]!
    if (v.kind === 'wind' && v.tele && near(v.z0, v.z1)) check(nS + nH + i, v.tele, 'volume', i, v.x, v.y, v.z, v.look)
  }
}
