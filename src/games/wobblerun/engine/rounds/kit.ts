/**
 * The round builders' kit: what a round module (engine/rounds/*.ts) lays its round with. A builder makes a kit,
 * adds floors, walls, hazards, volumes, dressing and its route graph in the round's own frame (z from the start
 * edge, x from the centreline, y from the base: the pad before it ends at z 0, at y 0, 9 m wide), and hands back
 * `k.done(exit)`. The course moves it into place, numbers its solids and route nodes, and works out the rest.
 *
 *   const k = kit(slot, tier)
 *   const floor = k.floor(0, 40)                    // a 9 m runway, 40 m long
 *   k.walls(0, 40)                                  // 1 m side walls the whole way
 *   k.hazard({ shape: 'sphere', ... })              // things that hit
 *   k.node('in', 0, -1.5); k.node('out', 0, 41.5)   // the route: on the pads either side
 *   k.edge('in', 'out')
 *   return k.done({ x: 0, y: 0, z: 40 })
 *
 * Every motion is closed form in the clock (sim.ts wave, spin, orbit, doorMove, gloveMove, pendulumMove,
 * fanDuty, path specs), written as an offset from the thing's static pose. engine/README.md has the rules.
 *
 * New rules go in behind the course's generation (`k.gen`, `slot.gen`; byGen): gen 1 must lay exactly what it
 * always has, since played days are laid from it (README "Generations").
 */
import type {
  Bounce,
  CameraPreset,
  Deco,
  EdgeMove,
  Gen,
  GraphEdge,
  GraphNode,
  Hazard,
  Hit,
  Look,
  MoveFn,
  NodeWait,
  PathSpec,
  Point,
  Role,
  RoundOut,
  RoundSlot,
  Solid,
  TeleFn,
  Tier,
  TouchSpec,
  Vec3,
  Volume,
  XZ,
} from '../types.ts'

/** The colour code's meaning of each known look (types.ts Role), for things laid without a role of their own. */
export const ROLE_OF: Record<string, Role> = {
  floor: 'floor',
  pad: 'floor',
  terrace: 'floor',
  island: 'floor',
  summit: 'floor',
  basement: 'floor',
  slide: 'floor',
  plank: 'floor',
  tile: 'floor',
  'pad-lily': 'floor',
  drum: 'floor',
  disc: 'floor',
  turntable: 'pushes',
  belt: 'pushes',
  'start-pad': 'check',
  'check-pad': 'check',
  'tile-star': 'check',
  rail: 'deco',
  fence: 'deco',
  divider: 'deco',
  frame: 'deco',
  header: 'deco',
  cushion: 'bouncy',
  barrier: 'jelly',
  door: 'jelly',
  'wall-jelly': 'jelly',
  'tooth-tall': 'jelly',
  tooth: 'jump',
  'bar-low': 'jump',
  'glove-low': 'jump',
  banana: 'jump',
  'bar-high': 'dive',
  'glove-high': 'dive',
  pendulum: 'dodge',
  glove: 'dodge',
  'fruit-melon': 'dodge',
  'fruit-orange': 'dodge',
  boulder: 'dodge',
  gumball: 'dodge',
  hub: 'bouncy',
  bumper: 'bouncy',
  bounce: 'bouncy',
  'launch-pad': 'helps',
  hoop: 'helps',
  fan: 'pushes',
  wind: 'pushes',
  arrow: 'pushes',
  crown: 'gold',
  'gold-edge': 'gold',
  'gold-flag': 'gold',
  'pad-gold': 'gold',
  slime: 'dodge',
}

const roleOf = (look: Look, role?: Role): Role => role ?? ROLE_OF[look] ?? 'deco'

/** The tier's value from a list of three (T1, T2, T3). */
export function byTier<T>(tier: Tier, values: readonly [T, T, T]): T {
  return values[tier - 1]!
}

/**
 * The generation's value from a list (gen 1's first): `byGen(k.gen, [6, 8])`. A generation past the end of the list
 * takes its last, so a list written for gen 2 holds for later ones until they say otherwise.
 */
export function byGen<T>(gen: Gen, values: readonly [T, ...T[]]): T {
  return values[Math.min(gen, values.length) - 1]!
}

/** What every solid can be given; `top` is its top's height at its centre, `hy` half its thickness (0.6). */
export type SolidOpts = {
  x?: number
  z: number
  top?: number
  hy?: number
  yaw?: number
  pitch?: number
  roll?: number
  look?: Look
  role?: Role
  tint?: number
  gold?: boolean
  move?: MoveFn
  tele?: TeleFn
  ledge?: boolean
  noGround?: boolean
  door?: boolean
  duck?: boolean
  slick?: boolean
  slip?: boolean
  belt?: XZ
  bounce?: Bounce
  touch?: TouchSpec
}
export type BoxOpts = SolidOpts & { hx: number; hz: number }
export type CylOpts = SolidOpts & { r: number; sides?: number }

/** A hazard: its shape's sizes, its anchor (x, y, z), its hit, and how it moves (`move` or `path`). */
export type HazardOpts = {
  shape: Hazard['shape']
  x?: number
  y?: number
  z: number
  yaw?: number
  r?: number
  h?: number
  hx?: number
  hy?: number
  hz?: number
  len?: number
  hit: Hit
  move?: MoveFn
  path?: PathSpec
  tele?: TeleFn
  look: Look
  role?: Role
  tint?: number
}

export type DecoOpts = {
  look: Look
  x?: number
  y?: number
  z: number
  yaw?: number
  sx?: number
  sy?: number
  sz?: number
  role?: Role
  tint?: number
  ref?: Deco['ref']
  params?: Deco['params']
}

export type Kit = ReturnType<typeof kit>

/** A kit for laying a round in `slot` at `tier`. Floors take the slot's tint unless told otherwise. */
export function kit(slot: RoundSlot, tier: Tier) {
  const out: RoundOut = {
    solids: [],
    hazards: [],
    volumes: [],
    decos: [],
    flags: [],
    graph: { nodes: [], edges: [] },
    gold: [],
    camera: 'default',
    exit: { x: 0, y: 0, z: 0 },
    deaths: [],
  }
  const tint = slot.i

  const solid = (shape: 'box' | 'cyl', o: SolidOpts & { hx?: number; hz?: number; r?: number; sides?: number }): number => {
    const look = o.look ?? 'floor'
    const s: Solid = {
      shape,
      x: o.x ?? 0,
      y: o.top ?? 0,
      z: o.z,
      yaw: o.yaw ?? 0,
      pitch: o.pitch ?? 0,
      roll: o.roll ?? 0,
      hx: o.hx ?? o.r ?? 1,
      hz: o.hz ?? o.r ?? 1,
      r: o.r ?? Math.max(o.hx ?? 1, o.hz ?? 1),
      hy: o.hy ?? 0.6,
      look,
      role: roleOf(look, o.role),
      tint: o.tint ?? (roleOf(look, o.role) === 'floor' ? tint : -1),
      ledge: o.ledge ?? !(o.noGround || o.door),
      round: -1,
      ti: -1,
      pi: -1,
      z0: 0,
      z1: 0,
    }
    if (o.sides !== undefined) s.sides = o.sides
    if (o.gold) s.gold = true
    if (o.move) s.move = o.move
    if (o.tele) s.tele = o.tele
    if (o.noGround) s.noGround = true
    if (o.door) s.door = true
    if (o.duck) s.duck = true
    if (o.slick) s.slick = true
    if (o.slip) s.slip = true
    if (o.belt) s.belt = o.belt
    if (o.bounce) s.bounce = o.bounce
    if (o.touch) s.touch = o.touch
    out.solids.push(s)
    return out.solids.length - 1
  }

  return {
    out,
    slot,
    tier,
    /**
     * The course's generation (types.ts Gen; 1 for a slot made by hand without one): gate every new rule on it
     * (`if (k.gen >= 2) …`, byGen) and leave what gen 1 lays exactly as it is.
     */
    gen: (slot.gen ?? 1) as Gen,
    /** A box solid; returns its index (for nodes' `on`, decos' refs). */
    box: (o: BoxOpts) => solid('box', o),
    /** A disc solid (a hex tile with `sides: 6`). */
    cyl: (o: CylOpts) => solid('cyl', o),
    /** A flat floor from z0 to z1, `hx` half wide (4.5: the 9 m track), top at `top`. */
    floor(z0: number, z1: number, o: Partial<BoxOpts> = {}): number {
      return solid('box', { ...o, hx: o.hx ?? 4.5, hz: (z1 - z0) / 2, z: (z0 + z1) / 2, top: o.top ?? 0 })
    },
    /** A ramp from z0 at height y0 to z1 at y0 + rise (a TILT box, `hx` half wide). */
    ramp(z0: number, z1: number, y0: number, rise: number, o: Partial<BoxOpts> = {}): number {
      return solid('box', { ...o, hx: o.hx ?? 4.5, hz: (z1 - z0) / 2, z: (z0 + z1) / 2, top: y0 + rise / 2, pitch: Math.atan2(rise, z1 - z0) })
    },
    /**
     * Side walls (rails) from z0 to z1, just outside a track `hx` half wide, `h` tall (1.0) above a floor at `y`
     * (sloping by `rise` over the length, for a ramp), with gaps [z0, z1] left open. Walls are never stood on.
     */
    walls(z0: number, z1: number, o: { hx?: number; x?: number; y?: number; h?: number; rise?: number; gaps?: readonly (readonly [number, number])[]; look?: Look; sides?: readonly (1 | -1)[]; thick?: number } = {}): number[] {
      const hx = o.hx ?? 4.5
      const x = o.x ?? 0
      const y = o.y ?? 0
      const h = o.h ?? 1.0
      const rise = o.rise ?? 0
      const thick = o.thick ?? 0.5
      const len = z1 - z0
      const slope = len > 0 ? rise / len : 0
      const pieces: [number, number][] = []
      let at = z0
      const gaps = [...(o.gaps ?? [])].sort((a, b) => a[0] - b[0])
      for (const [g0, g1] of gaps) {
        if (g0 > at) pieces.push([at, Math.min(g0, z1)])
        at = Math.max(at, g1)
      }
      if (at < z1) pieces.push([at, z1])
      const made: number[] = []
      for (const side of o.sides ?? [-1, 1]) {
        for (const [a, b] of pieces) {
          if (b - a < 0.05) continue
          const mid = (a + b) / 2
          made.push(
            solid('box', {
              x: x + side * (hx + thick / 2),
              z: mid,
              hx: thick / 2,
              hz: (b - a) / 2,
              top: y + (mid - z0) * slope + h,
              hy: (h + 0.6) / 2,
              pitch: Math.atan(slope),
              look: o.look ?? 'rail',
              noGround: true,
            }),
          )
        }
      }
      return made
    },
    /** A hazard; returns its index. */
    hazard(o: HazardOpts): number {
      const h: Hazard = {
        shape: o.shape,
        x: o.x ?? 0,
        y: o.y ?? 0,
        z: o.z,
        yaw: o.yaw ?? 0,
        r: o.r ?? 0.5,
        h: o.h ?? 1,
        hx: o.hx ?? 0.5,
        hy: o.hy ?? 0.5,
        hz: o.hz ?? 0.5,
        len: o.len ?? 1,
        hit: o.hit,
        look: o.look,
        role: roleOf(o.look, o.role),
        tint: o.tint ?? -1,
        round: -1,
        z0: 0,
        z1: 0,
      }
      if (o.move) h.move = o.move
      if (o.path) h.path = o.path
      if (o.tele) h.tele = o.tele
      out.hazards.push(h)
      return out.hazards.length - 1
    },
    /** A wind volume (half sizes), blowing `carry` m/s and lifting `up` m/s², times duty(t). */
    wind(o: { x?: number; y?: number; z: number; hx: number; hy: number; hz: number; carry: XZ; up?: number; duty: (t: number) => number; tele?: TeleFn; look?: Look }): number {
      const v: Volume = { kind: 'wind', x: o.x ?? 0, y: o.y ?? 0, z: o.z, hx: o.hx, hy: o.hy, hz: o.hz, carry: o.carry, up: o.up ?? 0, duty: o.duty, look: o.look ?? 'wind', role: 'pushes', round: -1, z0: 0, z1: 0 }
      if (o.tele) v.tele = o.tele
      out.volumes.push(v)
      return out.volumes.length - 1
    },
    /** A boost hoop (ring radius r, drawn), centred at x, y, z: through it going `dir` gives `boost` m/s more for `dur` s. */
    hoop(o: { x?: number; y: number; z: number; r?: number; dir?: XZ; boost?: number; dur?: number }): number {
      out.volumes.push({ kind: 'hoop', x: o.x ?? 0, y: o.y, z: o.z, r: o.r ?? 1.2, dir: o.dir ?? { x: 0, z: 1 }, boost: o.boost ?? 3, dur: o.dur ?? 1.2, look: 'hoop', role: 'helps', round: -1, z0: 0, z1: 0 })
      return out.volumes.length - 1
    },
    /** The crown (a finale's): touching it ends the run. Its centre is y + bob(t). */
    crown(o: { x?: number; y: number; z: number; r?: number; bob: (t: number) => number }): number {
      out.volumes.push({ kind: 'crown', x: o.x ?? 0, y: o.y, z: o.z, r: o.r ?? 0.8, bob: o.bob, look: 'crown', role: 'gold', round: -1, z0: 0, z1: 0 })
      return out.volumes.length - 1
    },
    /** Slime Climb's slime, from z0 to z1 (drawn hx half wide): `depth` under the flag you set off from, rising `rate` m/s. */
    slime(o: { z0: number; z1: number; hx?: number; depth: number; rate: number }): number {
      out.volumes.push({ kind: 'slime', x: 0, y: 0, z: (o.z0 + o.z1) / 2, hx: o.hx ?? 5, depth: o.depth, rate: o.rate, look: 'slime', role: 'dodge', round: -1, z0: o.z0, z1: o.z1 })
      return out.volumes.length - 1
    },
    /** Dressing: no collision. */
    deco(o: DecoOpts): number {
      const d: Deco = {
        look: o.look,
        x: o.x ?? 0,
        y: o.y ?? 0,
        z: o.z,
        yaw: o.yaw ?? 0,
        sx: o.sx ?? 1,
        sy: o.sy ?? 1,
        sz: o.sz ?? 1,
        role: roleOf(o.look, o.role),
        tint: o.tint ?? -1,
        round: -1,
      }
      if (o.ref) d.ref = o.ref
      if (o.params) d.params = o.params
      out.decos.push(d)
      return out.decos.length - 1
    },
    /** A spot (riding solid `on`, if given). */
    at(x: number, y: number, z: number, on?: number): Point {
      return on === undefined ? { x, y, z } : { x, y, z, on }
    },
    /** A route node: `safe` (a bot may wait there) or `no`. Returns its id. */
    node(id: string, x: number, z: number, o: { y?: number; wait?: NodeWait; on?: number; r?: number } = {}): string {
      const n: GraphNode = { id, x, y: o.y ?? 0, z, wait: o.wait ?? 'safe' }
      if (o.on !== undefined) n.on = o.on
      if (o.r !== undefined) n.r = o.r
      out.graph.nodes.push(n)
      return id
    },
    /** A route edge (main unless told `tier: 'gold'`). */
    edge(from: string, to: string, move: EdgeMove = 'run', o: Partial<Omit<GraphEdge, 'from' | 'to' | 'move'>> = {}): GraphEdge {
      const e: GraphEdge = { from, to, move, tier: o.tier ?? 'main' }
      if (o.window) e.window = o.window
      if (o.takeoff) e.takeoff = o.takeoff
      if (o.inset !== undefined) e.inset = o.inset
      if (o.via) e.via = o.via
      if (o.diveAt !== undefined) e.diveAt = o.diveAt
      if (o.stick !== undefined) e.stick = o.stick
      if (o.maxT !== undefined) e.maxT = o.maxT
      if (o.dur !== undefined) e.dur = o.dur
      out.graph.edges.push(e)
      return e
    },
    /** A mid flag (a respawn point, not a split) at its route node. */
    flag(x: number, z: number, node: string, y = 0): void {
      out.flags.push({ x, y, z, node })
    },
    /** A gold line, as the start card names it. */
    gold(name: string, z0: number, z1: number, x = 0): void {
      out.gold.push({ name, z0, z1, x })
    },
    /** Splat below `y` from z0 to z1 (instead of 6 m below the base). */
    death(z0: number, z1: number, y: number): void {
      out.deaths.push({ z0, z1, y })
    },
    camera(preset: CameraPreset): void {
      out.camera = preset
    },
    /** The round as laid, with the pad after it starting at `exit`. */
    done(exit: Vec3): RoundOut {
      out.exit = exit
      const ids = new Set(out.graph.nodes.map((n) => n.id))
      if (!ids.has('in') || !ids.has('out')) {
        if (!slot.finale || !ids.has('in')) throw new Error(`round ${slot.letter}: the route needs nodes 'in' and 'out'`)
      }
      for (const e of out.graph.edges) {
        if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`round ${slot.letter}: edge ${e.from} → ${e.to} names a node that isn't there`)
      }
      return out
    },
  }
}
