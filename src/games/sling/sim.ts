/*
 * Sling: Blip up a day's tower, peg to peg. Drag back and let go to fling him; he grabs a peg near the top of
 * his flight (or falling past it), so a fling can go past a peg to a higher one. Miss, or touch a bramble, a bug
 * or a sweeper, and he floats back down to the peg he left. The clock runs from the go to the top peg.
 *
 * Each day's tower is a run of sections in its own order (layTower): sliding pegs, pegs that circle a hub, clay
 * pegs that crumble, bramble bars to fling through the gap of, bugs patrolling the shaft, an updraft up a tall
 * gap, a boost peg before a long leap, spinning sweepers. Everything that moves is a closed form of the run's
 * clock, so every run, and the blue blip's, sees the same tower at the same moment.
 *
 * No imports: Node lays and checks the plan with this file (scripts/sling-daily.mjs).
 */

export const DT = 1 / 120
/** A ghost sample every this many steps: 20 a second. */
export const GHOST_EVERY = 6
export const GHOST_RATE = 1 / (DT * GHOST_EVERY)
/** A ghost sample's numbers: x, y, and what Blip was doing (HANGING, FLYING or FLOATING back). */
export const GHOST_STRIDE = 3
export const HANGING = 0
export const FLYING = 1
export const FLOATING = 2
/** The flags a run is split at, as shares of the way up (by peg). */
export const FLAG_AT = [0.25, 0.5, 0.75] as const

/** The shaft's width inside its walls, in world units (y is up). */
export const TW = 360
/** The hardest fling, units a second, and gravity. */
export const VMAX = 1150
export const G = 1500
/** Blip's radius; how near a peg he grabs it; and he grabs only once he's rising slower than GRAB_VY. */
export const BR = 11
export const CATCH = 34
export const GRAB_VY = 420
/** How far under his peg Blip hangs. */
export const HANG = 17
/** A clay peg crumbles this long after it's grabbed, and is back this long after. */
export const CLAY_FOR = 2.2
export const CLAY_BACK = 3
/** A boost peg's fling is this much harder. */
export const BOOST = 1.32
/** An updraft's push, and the speed it carries Blip up at most. */
export const FAN_PUSH = 2700
export const FAN_TOP = 640
/** Floating back to the peg left takes this long. */
export const RETURN_FOR = 0.9

const r2 = (v: number) => Math.round(v * 100) / 100

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

/* ----------------------------------------------------------------- the tower --- */

export type PegKind = 'peg' | 'slide' | 'orbit' | 'clay' | 'boost' | 'top'
export type Peg = {
  kind: PegKind
  /** Where it is when it doesn't move; a slider's middle; an orbiting peg's hub. */
  x: number
  y: number
  slide?: { amp: number; w: number; ph: number }
  orbit?: { r: number; w: number; ph: number }
  /** A blinker: solid for `on` seconds of every `on + off`, from `ph` in; it holds still while Blip hangs on it. */
  blink?: { on: number; off: number; ph: number }
}
/** A bramble bar across the shaft at `y`, with a gap from gx0 to gx1; a shifting one's gap slides `amp` each way. */
export type Bramble = { y: number; gx0: number; gx1: number; shift?: { amp: number; w: number; ph: number } }
/** A gust: a band of wind from y0 up to y1 that pushes Blip sideways in the air (`push` units/s², + to the right). */
export type Gust = { y0: number; y1: number; push: number }
/** A bumper: a round springy post that bounces Blip off. */
export type Bumper = { x: number; y: number; r: number }
/** A bug patrolling side to side between x0 and x1 at `y`. */
export type Bug = { y: number; x0: number; x1: number; w: number; ph: number }
/** An updraft: a column of air from y0 up to y1 between x0 and x1 that carries Blip up. */
export type Fan = { x0: number; x1: number; y0: number; y1: number }
/** A sweeper: two arms from a hub, `len` each way, turning at `w`. */
export type Sweeper = { x: number; y: number; len: number; w: number; ph: number }

export type SectionKind =
  | 'steps'
  | 'sliders'
  | 'carousel'
  | 'clay'
  | 'brambles'
  | 'bugs'
  | 'updraft'
  | 'boost'
  | 'sweepers'
  | 'blinkers'
  | 'gusts'
  | 'bumpers'
  | 'shifters'
/** What players call each section. */
export const SECTION_NAMES: Record<SectionKind, string> = {
  steps: 'Steps',
  sliders: 'Sliders',
  carousel: 'Carousel',
  clay: 'Clay',
  brambles: 'Brambles',
  bugs: 'Bugs',
  updraft: 'Updraft',
  boost: 'Boost',
  sweepers: 'Sweepers',
  blinkers: 'Blinkers',
  gusts: 'Gusts',
  bumpers: 'Bumpers',
  shifters: 'Shifting brambles',
}

export type Tower = {
  /** The day's number the tower is laid from (0 for a test tower), and the try the plan kept. */
  n: number
  attempt: number
  name: string
  /** The day's colour (TOWER_HUES). */
  hue: string
  pegs: Peg[]
  brambles: Bramble[]
  bugs: Bug[]
  fans: Fan[]
  sweepers: Sweeper[]
  gusts: Gust[]
  bumpers: Bumper[]
  /** The sections from the bottom up: where each starts (its first peg) and what it is. */
  sections: { kind: SectionKind; from: number }[]
  /** The pegs a run is split at (FLAG_AT of the way up). */
  flags: number[]
  /** The top peg's height. */
  height: number
}

const FIRST = ['Pepper', 'Juniper', 'Thistle', 'Clover', 'Saffron', 'Bramble', 'Marigold', 'Willow', 'Hazel', 'Sorrel', 'Cobble', 'Puffin', 'Tinker', 'Lantern', 'Pebble', 'Maple', 'Sprocket', 'Honey', 'Copper', 'Bluebell']
const SECOND = ['Spire', 'Tower', 'Steeple', 'Turret', 'Lookout', 'Chimney', 'Beanstalk', 'Mast', 'Pinnacle', 'Belfry', 'Climb', 'Column']
/** The colour a day's tower is washed in: the arcade's own, a different one each day of the week (as Swoop's hills). */
export const TOWER_HUES = ['#3ecf8e', '#3ec8cf', '#f5b942', '#8a6ad4', '#4aa8e8', '#f2813a', '#e85d9a'] as const

/** Where peg `pg` is at moment `t` of a run. */
export function pegAt(pg: Peg, t: number): { x: number; y: number } {
  if (pg.slide) return { x: pg.x + pg.slide.amp * Math.sin(pg.slide.w * t + pg.slide.ph), y: pg.y }
  if (pg.orbit) {
    const a = pg.orbit.w * t + pg.orbit.ph
    return { x: pg.x + pg.orbit.r * Math.cos(a), y: pg.y + pg.orbit.r * Math.sin(a) }
  }
  return { x: pg.x, y: pg.y }
}
/** Where a bug is at moment `t`. */
export function bugAt(b: Bug, t: number): number {
  return (b.x0 + b.x1) / 2 + ((b.x1 - b.x0) / 2) * Math.sin(b.w * t + b.ph)
}
/** A sweeper's angle at moment `t`. */
export const sweeperAt = (s: Sweeper, t: number) => s.w * t + s.ph
/** A bramble bar's gap at moment `t`: a shifting one's slides side to side. */
export function gapAt(br: Bramble, t: number): { gx0: number; gx1: number } {
  if (!br.shift) return br
  const d = br.shift.amp * Math.sin(br.shift.w * t + br.shift.ph)
  return { gx0: br.gx0 + d, gx1: br.gx1 + d }
}
/** Whether a blinker is solid at moment `t` (any other peg always is). */
export function solidAt(pg: Peg, t: number): boolean {
  if (!pg.blink) return true
  const P = pg.blink.on + pg.blink.off
  return (((t + pg.blink.ph) % P) + P) % P < pg.blink.on
}
/** A blinker's part of its cycle at moment `t`, 0 to 1: under on/(on+off) it's solid. */
export function blinkPhase(pg: Peg, t: number): number {
  if (!pg.blink) return 0
  const P = pg.blink.on + pg.blink.off
  return ((((t + pg.blink.ph) % P) + P) % P) / P
}

const SECTION_POOL: SectionKind[] = ['sliders', 'carousel', 'clay', 'brambles', 'bugs', 'updraft', 'boost', 'sweepers']
/**
 * From tower #MORE_FROM, four more sections join the pool (blinkers, gusts, bumpers, shifting brambles) and a tower
 * has eight of the twelve, not seven of the eight (Ramsey, 2026-10-19: "maybe it needs to be a tad harder, and more
 * obsticle type things"). Tower #1 was played as it was laid, and keeps it.
 */
const MORE_POOL: SectionKind[] = [...SECTION_POOL, 'blinkers', 'gusts', 'bumpers', 'shifters']
export const MORE_FROM = 2

/**
 * A tower: three steps to start, then seven of the eight sections in an order of the day's, each a little
 * harder than the one before, two more steps, and the top. `only`, a test tower of these sections in this order.
 */
export function layTower(seed: number, attempt: number, only?: SectionKind[], more = false): Tower {
  const r = mulberry32(seed * 7919 + attempt * 104729 + 17)
  const pegs: Peg[] = [{ kind: 'peg', x: TW / 2, y: 0 }]
  const brambles: Bramble[] = []
  const bugs: Bug[] = []
  const fans: Fan[] = []
  const sweepers: Sweeper[] = []
  const gusts: Gust[] = []
  const bumpers: Bumper[] = []
  const sections: { kind: SectionKind; from: number }[] = []
  let y = 0
  let x = TW / 2
  const across = (min = 70) => {
    let nx = 45 + r() * (TW - 90)
    for (let k = 0; k < 8 && Math.abs(nx - x) < min; k++) nx = 45 + r() * (TW - 90)
    return nx
  }
  const add = (pg: Peg) => {
    pegs.push(pg)
    x = pg.x
    y = pg.y
  }
  const lay = (kind: SectionKind, level: number) => {
    sections.push({ kind, from: pegs.length })
    const hard = level / 6
    if (kind === 'steps') {
      const count = 3
      for (let i = 0; i < count; i++) add({ kind: 'peg', x: across(), y: y + 130 + r() * 60 })
    } else if (kind === 'sliders') {
      const count = 4
      for (let i = 0; i < count; i++) {
        const amp = 45 + r() * 20 + hard * 15
        add({ kind: 'slide', x: 110 + r() * 140, y: y + 140 + r() * 50, slide: { amp, w: (0.7 + r() * 0.4 + hard * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2 } })
      }
    } else if (kind === 'carousel') {
      const count = 3
      for (let i = 0; i < count; i++) {
        const rad = 45 + r() * 15
        const hub = 100 + r() * 160
        add({ kind: 'orbit', x: hub, y: y + 170 + r() * 40, orbit: { r: rad, w: (0.8 + r() * 0.4 + hard * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2 } })
      }
    } else if (kind === 'clay') {
      const count = 4
      for (let i = 0; i < count; i++) add({ kind: 'clay', x: across(80), y: y + 125 + r() * 45 })
    } else if (kind === 'brambles') {
      const count = 4
      for (let i = 0; i < count; i++) {
        const nx = across(60)
        const ny = y + 175 + r() * 40
        // The bar halfway up, its gap somewhere between the two pegs: the way through.
        const gap = 155 - hard * 25
        const mid = Math.max(gap / 2 + 14, Math.min(TW - gap / 2 - 14, (x + nx) / 2 + (r() - 0.5) * 90))
        brambles.push({ y: (y + ny) / 2 + (r() - 0.5) * 20, gx0: mid - gap / 2, gx1: mid + gap / 2 })
        add({ kind: 'peg', x: nx, y: ny })
      }
    } else if (kind === 'bugs') {
      const count = 4
      for (let i = 0; i < count; i++) {
        const nx = across(60)
        const ny = y + 165 + r() * 40
        bugs.push({ y: (y + ny) / 2, x0: 30, x1: TW - 30, w: (0.9 + r() * 0.5 + hard * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2 })
        add({ kind: 'peg', x: nx, y: ny })
      }
    } else if (kind === 'updraft') {
      // A peg by the column of air, the next far above it: too far to fling, so ride the updraft.
      const left = r() < 0.5
      const colX = left ? 30 + r() * 30 : TW - 140 - r() * 30
      const mid = colX + 55
      add({ kind: 'peg', x: left ? mid + 95 : mid - 95, y: y + 140 + r() * 30 })
      const top = y + 520 + r() * 60 + hard * 40
      fans.push({ x0: colX, x1: colX + 110, y0: y - 40, y1: top - 70 })
      // The peg at the top hangs over the air, a little to the far side: ride up and reach for it.
      add({ kind: 'peg', x: mid + (left ? -22 : 22), y: top })
      add({ kind: 'peg', x: across(), y: y + 150 + r() * 40 })
    } else if (kind === 'boost') {
      add({ kind: 'boost', x: 120 + r() * 120, y: y + 150 + r() * 40 })
      add({ kind: 'peg', x: Math.max(60, Math.min(TW - 60, x + (r() - 0.5) * 160)), y: y + 440 + r() * 40 + hard * 25 })
      add({ kind: 'peg', x: across(), y: y + 150 + r() * 40 })
    } else if (kind === 'sweepers') {
      const count = 3
      for (let i = 0; i < count; i++) {
        const nx = across(60)
        const ny = y + 200 + r() * 40
        sweepers.push({ x: 90 + r() * 180, y: (y + ny) / 2, len: 58 + r() * 12 + hard * 8, w: (1.1 + r() * 0.5 + hard * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2 })
        add({ kind: 'peg', x: nx, y: ny })
      }
    } else if (kind === 'blinkers') {
      // Pegs that fade in and out: grab one while it's solid. Each keeps its own beat.
      const count = 4
      for (let i = 0; i < count; i++) {
        const on = 1.5 - hard * 0.3 + r() * 0.4
        add({ kind: 'peg', x: across(70), y: y + 150 + r() * 45, blink: { on, off: 0.9 + hard * 0.3 + r() * 0.3, ph: r() * 3 } })
      }
    } else if (kind === 'gusts') {
      // A band of wind across each gap, the other way to the last: aim into it.
      const count = 4
      let dir = r() < 0.5 ? -1 : 1
      for (let i = 0; i < count; i++) {
        const nx = across(60)
        const ny = y + 165 + r() * 40
        gusts.push({ y0: y + 25, y1: ny - 25, push: dir * (380 + r() * 140 + hard * 120) })
        dir = -dir
        add({ kind: 'peg', x: nx, y: ny })
      }
    } else if (kind === 'bumpers') {
      // Round bumpers near the straight way up: fling round them, or off them.
      const count = 4
      for (let i = 0; i < count; i++) {
        const nx = across(70)
        const ny = y + 180 + r() * 40
        const t = 0.4 + r() * 0.2
        const bx = Math.max(40, Math.min(TW - 40, x + (nx - x) * t + (r() - 0.5) * 70))
        bumpers.push({ x: bx, y: y + (ny - y) * t + 10, r: 14 + r() * 5 + hard * 3 })
        add({ kind: 'peg', x: nx, y: ny })
      }
    } else if (kind === 'shifters') {
      // Bramble bars whose gap slides side to side: fling as it comes under you.
      const count = 4
      for (let i = 0; i < count; i++) {
        const nx = across(60)
        const ny = y + 180 + r() * 40
        const gap = 150 - hard * 20
        const amp = 55 + r() * 25
        const mid = Math.max(gap / 2 + amp + 10, Math.min(TW - gap / 2 - amp - 10, (x + nx) / 2))
        brambles.push({ y: (y + ny) / 2, gx0: mid - gap / 2, gx1: mid + gap / 2, shift: { amp, w: (0.8 + r() * 0.4 + hard * 0.2) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2 } })
        add({ kind: 'peg', x: nx, y: ny })
      }
    }
  }
  lay('steps', 0)
  const order = only ?? (() => {
    const pool = (more ? MORE_POOL : SECTION_POOL).slice()
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
    }
    return pool.slice(0, more ? 8 : 7)
  })()
  order.forEach((kind, level) => lay(kind, level))
  sections.push({ kind: 'steps', from: pegs.length })
  add({ kind: 'peg', x: across(), y: y + 150 + r() * 40 })
  add({ kind: 'top', x: TW / 2, y: y + 170 })
  const topIndex = pegs.length - 1
  const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${SECOND[Math.floor(r() * SECOND.length)]}`
  return {
    n: seed,
    attempt,
    name,
    hue: TOWER_HUES[(((seed - 1) % TOWER_HUES.length) + TOWER_HUES.length) % TOWER_HUES.length]!,
    pegs,
    brambles,
    bugs,
    fans,
    sweepers,
    gusts,
    bumpers,
    sections,
    flags: FLAG_AT.map((f) => Math.round(topIndex * f)),
    height: pegs[topIndex]!.y,
  }
}

/** Every section once, bottom to top, on a tower of its own each load: the admin's test tower. */
export function labTower(seed: number): Tower {
  return { ...layTower(seed, 0, MORE_POOL, true), n: 0 }
}

/* ----------------------------------------------------------------- Blip --- */

export type Blip = {
  /** Seconds since the go. */
  t: number
  /** The peg he's on, or left last; and whether he's on it. */
  p: number
  on: boolean
  x: number
  y: number
  vx: number
  vy: number
  /** Seconds since he left a peg, in the air. */
  air: number
  /** Floating back to peg `p`: from where, and how far along. */
  back: { t: number; x0: number; y0: number } | null
  /** Seconds on his peg. */
  held: number
  /** A clay peg that crumbled, and when it's back. */
  gone: { i: number; until: number } | null
  /** The highest peg he's had. */
  best: number
  /** The flags passed, by when (seconds). */
  splits: number[]
  flings: number
  misses: number
  skips: number
  /** Over the top: the run's time. */
  done: boolean
  time: number
  /** Last fling's power, for looks. */
  boosted: boolean
}

export function newBlip(tw: Tower): Blip {
  const p0 = tw.pegs[0]!
  return { t: 0, p: 0, on: true, x: p0.x, y: p0.y - HANG, vx: 0, vy: 0, air: 0, back: null, held: 0, gone: null, best: 0, splits: [], flings: 0, misses: 0, skips: 0, done: false, time: 0, boosted: false }
}

export type Fling = { ang: number; pw: number }
/**
 * What a step did: flung, grabbed (a peg, or one past the next: a skip), floated back after a miss, a prick,
 * a bump or a sweep, a clay peg crumbling, a flag passed, or over the top.
 */
export type StepEvent = 'fling' | 'grab' | 'skip' | 'miss' | 'prick' | 'bump' | 'swept' | 'crumble' | 'bounce' | 'finish' | { flag: number } | null

const isGone = (b: Blip, i: number) => b.gone !== null && b.gone.i === i && b.t < b.gone.until

/** How hard a fling from peg `p` goes at power `pw`: a boost peg flings harder. */
export const flingSpeed = (tw: Tower, p: number, pw: number) => VMAX * pw * (tw.pegs[p]!.kind === 'boost' ? BOOST : 1)

function floatBack(b: Blip, why: StepEvent): StepEvent {
  b.misses++
  b.back = { t: 0, x0: b.x, y0: b.y }
  b.air = 0
  return why
}

/** One step of DT. `fling`: let go this step, if he's on a peg. */
export function step(tw: Tower, b: Blip, fling: Fling | null): StepEvent {
  if (b.done) return null
  b.t += DT
  const t = b.t
  if (b.back) {
    b.back.t += DT
    const at = pegAt(tw.pegs[b.p]!, t)
    const k = Math.min(1, b.back.t / RETURN_FOR)
    const e = k * k * (3 - 2 * k)
    b.x = b.back.x0 + (at.x - b.back.x0) * e
    b.y = b.back.y0 + (at.y - HANG - b.back.y0) * e
    if (k >= 1) {
      b.back = null
      b.on = true
      b.held = 0
      b.gone = null
      b.vx = 0
      b.vy = 0
    }
    return null
  }
  if (b.on) {
    if (fling && b.p < tw.pegs.length - 1) {
      const v = flingSpeed(tw, b.p, Math.max(0, Math.min(1, fling.pw)))
      b.on = false
      b.air = 0
      b.vx = Math.cos(fling.ang) * v
      b.vy = Math.sin(fling.ang) * v
      b.flings++
      b.boosted = tw.pegs[b.p]!.kind === 'boost'
      return 'fling'
    }
    b.held += DT
    const at = pegAt(tw.pegs[b.p]!, t)
    b.x = at.x
    b.y = at.y - HANG
    if (tw.pegs[b.p]!.kind === 'clay' && b.held >= CLAY_FOR) {
      b.gone = { i: b.p, until: t + CLAY_BACK }
      b.on = false
      b.air = 0
      b.vx = 0
      b.vy = 0
      return 'crumble'
    }
    return null
  }
  // In the air.
  b.air += DT
  b.vy -= G * DT
  for (const f of tw.fans) {
    if (b.x > f.x0 && b.x < f.x1 && b.y > f.y0 && b.y < f.y1 && b.vy < FAN_TOP) b.vy = Math.min(FAN_TOP, b.vy + FAN_PUSH * DT)
  }
  for (const g of tw.gusts) if (b.y > g.y0 && b.y < g.y1) b.vx += g.push * DT
  b.x += b.vx * DT
  b.y += b.vy * DT
  if (b.x < BR) {
    b.x = BR
    b.vx = Math.abs(b.vx) * 0.7
  }
  if (b.x > TW - BR) {
    b.x = TW - BR
    b.vx = -Math.abs(b.vx) * 0.7
  }
  for (const br of tw.brambles) {
    if (Math.abs(b.y - br.y) >= 5 + BR * 0.8) continue
    const gap = gapAt(br, t)
    if (b.x < gap.gx0 + BR * 0.6 || b.x > gap.gx1 - BR * 0.6) return floatBack(b, 'prick')
  }
  for (const bp of tw.bumpers) {
    const dx = b.x - bp.x
    const dy = b.y - bp.y
    const d = Math.hypot(dx, dy)
    if (d >= bp.r + BR || d === 0) continue
    // Bounced off along the way out of it, a little livelier than it came in.
    const nx = dx / d
    const ny = dy / d
    const along = b.vx * nx + b.vy * ny
    if (along < 0) {
      b.vx -= 2 * along * nx
      b.vy -= 2 * along * ny
      const speed = Math.hypot(b.vx, b.vy)
      const want = Math.max(speed * 1.05, 380)
      b.vx *= want / speed
      b.vy *= want / speed
    }
    b.x = bp.x + nx * (bp.r + BR)
    b.y = bp.y + ny * (bp.r + BR)
    return 'bounce'
  }
  for (const bug of tw.bugs) {
    if (Math.abs(b.y - bug.y) < 30 && Math.hypot(bugAt(bug, t) - b.x, bug.y - b.y) < 13 + BR) return floatBack(b, 'bump')
  }
  for (const s of tw.sweepers) {
    const dx = b.x - s.x
    const dy = b.y - s.y
    if (dx * dx + dy * dy > (s.len + BR + 6) ** 2) continue
    const a = sweeperAt(s, t)
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const along = Math.max(-s.len, Math.min(s.len, dx * ux + dy * uy))
    if (Math.hypot(dx - ux * along, dy - uy * along) < 5 + BR) return floatBack(b, 'swept')
  }
  if (b.vy < GRAB_VY) {
    const lo = Math.max(0, b.p - 8)
    const hi = Math.min(tw.pegs.length - 1, b.p + 6)
    for (let i = hi; i >= lo; i--) {
      if (i === b.p && b.air < 0.25) continue
      if (isGone(b, i)) continue
      if (!solidAt(tw.pegs[i]!, t)) continue
      const at = pegAt(tw.pegs[i]!, t)
      if (Math.hypot(at.x - b.x, at.y - HANG * 0.5 - b.y) <= CATCH) {
        const before = b.best
        b.on = true
        b.p = i
        b.held = 0
        b.x = at.x
        b.y = at.y - HANG
        b.vx = 0
        b.vy = 0
        let ev: StepEvent = 'grab'
        if (i > before + 1) {
          b.skips += i - before - 1
          ev = 'skip'
        }
        if (i > before) {
          b.best = i
          for (let k = b.splits.length; k < tw.flags.length && tw.flags[k]! <= i; k++) {
            b.splits.push(t)
            if (ev === 'grab') ev = { flag: k }
          }
        }
        if (i === tw.pegs.length - 1) {
          b.done = true
          b.time = t
          b.splits.push(t)
          return 'finish'
        }
        return ev
      }
    }
  }
  const from = pegAt(tw.pegs[b.p]!, t)
  if ((b.y < from.y - 240 && b.vy < 0) || b.air > 3.2) return floatBack(b, 'miss')
  return null
}

/** A copy of Blip to try things on. */
export const cloneBlip = (b: Blip): Blip => ({ ...b, back: b.back && { ...b.back }, gone: b.gone && { ...b.gone }, splits: b.splits.slice() })

/** Where a fling would end up: the peg grabbed (or −1), and how long it took. */
export function tryFling(tw: Tower, b: Blip, f: Fling, want = -1): { to: number; dur: number } {
  const c = cloneBlip(b)
  const t0 = c.t
  step(tw, c, f)
  const floor = want >= 0 ? tw.pegs[want]!.y - 80 : -Infinity
  for (let k = 0; k < 400; k++) {
    const ev = step(tw, c, null)
    if (c.on && !c.back) return { to: c.p, dur: c.t - t0 }
    if (ev === 'miss' || ev === 'prick' || ev === 'bump' || ev === 'swept') return { to: -1, dur: 0 }
    // Falling below the peg it wants: a miss, whatever it grabs further down.
    if (c.vy < 0 && c.y < floor) return { to: -1, dur: 0 }
  }
  return { to: -1, dur: 0 }
}

/* ----------------------------------------------------------------- hands --- */

/**
 * A climber's hands: they line up for `aim` seconds after each grab, then fling for the next peg, picking the
 * shot in the middle of the ones that work (never on the edge of one), or one past it with `skip` when that's
 * as safe. With no safe shot yet (a bug or a sweeper in the way), they wait a beat and look again.
 */
export type HandsStyle = { aim: number; skip: boolean; wait: number }
export const BLUE_HANDS: HandsStyle = { aim: 2.4, skip: false, wait: 0.12 }
/** A good player's hands: quicker, and taking a skip when one's on: the dev autopilot's. */
export const GOOD_HANDS: HandsStyle = { aim: 0.6, skip: true, wait: 0.08 }

const ANGS: number[] = []
const PWS: number[] = []
for (let a = 12; a <= 168; a += 4) ANGS.push((a * Math.PI) / 180)
for (let p = 0.3; p <= 1.0001; p += 0.05) PWS.push(p)

/** The safest shot for peg `want`: how many of its neighbours work too (0–4), and the shot. */
export function bestShot(tw: Tower, b: Blip, want: number): { safe: number; f: Fling; dur: number } | null {
  const grid = ANGS.map((ang) => PWS.map((pw) => tryFling(tw, b, { ang, pw }, want)))
  let best: { safe: number; f: Fling; dur: number; score: number } | null = null
  for (let i = 0; i < ANGS.length; i++) {
    for (let j = 0; j < PWS.length; j++) {
      const s = grid[i]![j]!
      if (s.to !== want) continue
      let safe = 0
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (grid[i + di]?.[j + dj]?.to === want) safe++
      const score = safe * 10 - s.dur
      if (!best || score > best.score) best = { safe, f: { ang: ANGS[i]!, pw: PWS[j]! }, dur: s.dur, score }
    }
  }
  return best
}

export function makeHands(tw: Tower, style: HandsStyle): (b: Blip) => Fling | null {
  let lookAt = 0
  let since = -1
  return (b) => {
    if (!b.on || b.back || b.p >= tw.pegs.length - 1) {
      since = -1
      return null
    }
    if (since < 0) {
      since = b.t
      // On clay, line up quicker than it crumbles.
      lookAt = b.t + (tw.pegs[b.p]!.kind === 'clay' ? Math.min(style.aim, CLAY_FOR - 0.5) : style.aim)
    }
    if (b.t < lookAt) return null
    const clay = tw.pegs[b.p]!.kind === 'clay'
    const late = b.t - since > 3.4 || (clay && b.held > CLAY_FOR - 0.12)
    if (style.skip && b.p + 2 < tw.pegs.length) {
      const two = bestShot(tw, b, b.p + 2)
      if (two && two.safe >= 3) return two.f
    }
    const one = bestShot(tw, b, b.p + 1)
    if (one && (one.safe >= 3 || late)) return one.f
    if (late) {
      const any = bestShot(tw, b, b.p + 2)
      if (any) return any.f
      return { ang: Math.PI / 2, pw: 0.6 }
    }
    lookAt = b.t + style.wait
    return null
  }
}

/* ----------------------------------------------------------------- climbs --- */

/**
 * A run as its ghost flies it: its time, when it passed each flag and the top, and where Blip was. `route`, its
 * flings, to fly it again cheaply (routeOf, replayHands).
 */
export type Climb = { finished: boolean; time: number; splits: number[]; ghost: number[]; misses: number; skips: number; route: string }

/** Blip up the tower by `hands`, until the top or `limit` seconds. */
export function climbWith(tw: Tower, hands: (b: Blip) => Fling | null, limit = 300): Climb {
  const b = newBlip(tw)
  const ghost: number[] = []
  const flings: string[] = []
  let steps = 0
  while (!b.done && b.t < limit) {
    if (steps % GHOST_EVERY === 0) ghost.push(r2(b.x), r2(b.y), b.back ? FLOATING : b.on ? HANGING : FLYING)
    const f = hands(b)
    if (step(tw, b, f) === 'fling' && f) flings.push(routeStep(steps, f))
    steps++
  }
  const route = flings.join(' ')
  if (!b.done) return { finished: false, time: Infinity, splits: b.splits, ghost, misses: b.misses, skips: b.skips, route }
  ghost.push(r2(b.x), r2(b.y), HANGING)
  return { finished: true, time: b.time, splits: b.splits.slice(), ghost, misses: b.misses, skips: b.skips, route }
}

/** A fling as the plan keeps it: its step, its angle in whole degrees, its power in hundredths (all base 36). */
function routeStep(steps: number, f: Fling): string {
  const deg = Math.round((f.ang * 180) / Math.PI)
  return `${steps.toString(36)}.${deg.toString(36)}.${Math.round(f.pw * 100).toString(36)}`
}

/** Hands that fling a route's flings at its steps: the blue blip's climb flown again, without working it out. */
export function replayHands(route: string): (b: Blip) => Fling | null {
  const at = new Map<number, Fling>()
  for (const part of route.split(' ')) {
    if (!part) continue
    const [s, d, p] = part.split('.').map((v) => parseInt(v, 36))
    at.set(s!, { ang: (d! * Math.PI) / 180, pw: p! / 100 })
  }
  let steps = 0
  return () => at.get(steps++) ?? null
}

/** The blue blip up the tower, worked out (a few seconds: the plan does this once a day, and keeps the route). */
export function paceRun(tw: Tower): Climb {
  return climbWith(tw, makeHands(tw, BLUE_HANDS))
}

/** A blue blip at the top in this many seconds makes the tower fair: not a sprint, not a slog. */
export const PACE_FROM = 60
export const PACE_TO = 110

/** Tower `n`'s try `attempt`, as the plan chose it (dailyPlan.ts): laid the same on every device. */
export function plannedTower(n: number, attempt: number): Tower {
  return layTower(n, attempt, undefined, n >= MORE_FROM)
}

/** Tower `n` from scratch: the first try the blue blip climbs clean in a fair time. */
export function firstGoodTower(n: number): { tower: Tower; attempt: number; pace: Climb } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const tower = plannedTower(n, attempt)
    const pace = paceRun(tower)
    if (pace.finished && pace.misses === 0 && pace.time >= PACE_FROM && pace.time <= PACE_TO) return { tower, attempt, pace }
  }
  throw new Error(`Sling: no tower for #${n}`)
}
