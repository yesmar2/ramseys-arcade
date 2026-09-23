/**
 * Scene builder: a picture-book spread with the Bug somewhere in it.
 *
 * Every scene is a place — a picnic, a garden, a pond, an arcade, a night
 * market — laid out as a few big set pieces, groups of critters doing things
 * among them, and a crowd filling the rest. Then one critter becomes the Bug
 * and a handful of others become the reason he is hard to find: they share his
 * stripes, or his hat, or all of it bar one thing.
 *
 * World units: every scene covers the same area whatever its shape, so a phone
 * held upright and a desktop both search the same amount of ground, with the
 * same number of critters at the same size.
 */

import { mulberry32 } from '../../lib/seededRandom'
import {
  CREAM,
  critterBounds,
  faceCentre,
  INK,
  NAVY,
  RED,
  WHITE,
  type Critter,
  type Glasses,
  type Hat,
  type Held,
  type Look,
  type Mood,
  type Pattern,
  type Pose,
  type Species,
} from './critters'
import { isLowProp, propBounds, propOccluders, type Prop, type PropKind } from './props'
import { CLASSIC, wearsAllOf, type WantedBug } from './wanted'

export type SceneKind = 'picnic' | 'garden' | 'pond' | 'arcade' | 'night'

/**
 * Fixed order, so every run faces the same climb; only the contents are
 * seeded. Bright and open to begin with, dark and crowded at the end.
 */
export const SCENE_ORDER: readonly SceneKind[] = ['picnic', 'garden', 'pond', 'arcade', 'night']

export const SCENE_NAMES: Record<SceneKind, string> = {
  picnic: 'The Picnic',
  garden: 'The Garden',
  pond: 'The Pond',
  arcade: 'The Bug Arcade',
  night: 'The Night Market',
}

/** Square world units every scene covers, whatever its shape. */
export const WORLD_AREA = 720_000

export type Rect = { x0: number; y0: number; x1: number; y1: number }

export type DecalKind = 'blade' | 'clover' | 'bloom' | 'speck' | 'crumb' | 'confetti' | 'shell' | 'ripple' | 'star'

/** Flat marks on the ground: texture, never in the way of anything. */
export type Decal = { kind: DecalKind; x: number; y: number; s: number; rot: number; colour: string }

/** A pool of light at night. */
export type Light = { x: number; y: number; r: number; colour: string }

export type Ground =
  | { kind: 'picnic'; blanket: { x: number; y: number; w: number; h: number; rot: number }; plates: { x: number; y: number; r: number }[] }
  | { kind: 'garden'; beds: Rect[]; stones: { x: number; y: number; r: number }[] }
  | { kind: 'pond'; shore: number[]; pads: { x: number; y: number; r: number; rot: number }[] }
  | { kind: 'arcade'; wall: number }
  | { kind: 'night'; horizon: number; path: number[] }

export type Item = { z: number; critter?: Critter; prop?: Prop }

/** String lights and anything else hung over the whole scene. */
export type Garland = { points: [number, number][]; colours: string[] }

export type Scene = {
  kind: SceneKind
  index: number
  w: number
  h: number
  /** A critter's height here, the yardstick everything else is laid out in. */
  unit: number
  ground: Ground
  decals: Decal[]
  items: Item[]
  critters: Critter[]
  target: Critter
  /** Who the target is: the bug on the wanted card, whose look it wears. */
  wanted: WantedBug
  garlands: Garland[]
  lights: Light[]
  /** How dark the night is, 0 in daylight. */
  dusk: number
}

type Rng = () => number

// ------------------------------------------------------------------ tuning

/**
 * The difficulty climb, per scene. The crowd grows and shrinks a little, more
 * of it borrows the Bug's look, and from the third scene he may stand behind
 * something with only his top half showing.
 */
export type SceneSpec = {
  crowd: number
  size: number
  /** Critters that share all of the wanted bug's look bar one thing. */
  twins: number
  /** Other critters in its shell. */
  stripes: number
  /** Other critters in its hat. */
  hats: number
  /** Share of the crowd in glasses like its. */
  glasses: number
  /** Whether he may stand half behind something. */
  tuck: boolean
}

export function sceneSpec(index: number): SceneSpec {
  const specs: SceneSpec[] = [
    { crowd: 120, size: 50, twins: 1, stripes: 6, hats: 5, glasses: 0.14, tuck: false },
    { crowd: 150, size: 48, twins: 2, stripes: 8, hats: 7, glasses: 0.18, tuck: false },
    { crowd: 175, size: 46, twins: 4, stripes: 10, hats: 9, glasses: 0.22, tuck: true },
    { crowd: 200, size: 44, twins: 6, stripes: 12, hats: 11, glasses: 0.26, tuck: true },
    { crowd: 225, size: 43, twins: 8, stripes: 14, hats: 13, glasses: 0.3, tuck: true },
  ]
  return specs[Math.max(0, Math.min(specs.length - 1, index))]
}

// ----------------------------------------------------------------- palette

const HAT_COLOURS = ['#3d99d8', '#40a276', '#e6ac39', '#7d57d5', '#e67732', '#e969a1', '#2a3136', '#34aeb4', WHITE] as const
const BRIGHT = ['#3d99d8', '#40a276', '#e6ac39', '#7d57d5', '#e67732', '#e969a1', '#34aeb4', '#e24139'] as const
const HEADS = [CREAM, '#f1b996', '#d8976f', '#3e384c', '#66d0a1', '#ecbf66', '#f299c0', '#98bdd6', '#a187de', '#eea374'] as const
const LIMBS = [NAVY, '#3c344d', '#52392a', '#325143', '#593260'] as const

type Cast = {
  species: [Species, number][]
  held: Held[]
  heldChance: number
  poses: [Pose, number][]
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

function weighted<T>(rng: Rng, list: readonly [T, number][]): T {
  let total = 0
  for (const [, w] of list) total += w
  let roll = rng() * total
  for (const [v, w] of list) {
    roll -= w
    if (roll <= 0) return v
  }
  return list[list.length - 1][0]
}

function range(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

const HATS: [Hat, number][] = [
  ['none', 40],
  ['cap', 12],
  ['beanie', 8],
  ['bobble', 6],
  ['straw', 5],
  ['party', 4],
  ['bow', 6],
  ['flower', 5],
  ['tophat', 3],
  ['crown', 2],
  ['headphones', 4],
]

/**
 * A random crowd member. Colours are drawn per species so a bee is still
 * yellow and an ant still ant-coloured; hats and glasses are anybody's.
 */
function randomLook(rng: Rng, cast: Cast, species?: Species): Look {
  const sp = species ?? weighted(rng, cast.species)
  let body: string = pick(rng, BRIGHT)
  let trim: string = pick(rng, BRIGHT)
  let pattern: Pattern = 'plain'
  let head: string = pick(rng, HEADS)
  let limb: string = pick(rng, LIMBS)

  switch (sp) {
    case 'beetle': {
      const roll = rng()
      if (roll < 0.28) {
        // Ladybird.
        body = pick(rng, ['#e24139', '#e67732', '#e6ac39', '#e969a1'])
        trim = '#1a2b3c'
        pattern = 'spots'
        head = pick(rng, ['#3e384c', '#2a3136', CREAM])
      } else {
        body = pick(rng, BRIGHT)
        trim = pick(rng, [WHITE, '#1a2b3c', ...BRIGHT])
        pattern = weighted(rng, [['plain', 3], ['spots', 2], ['dots', 2], ['stripes', 2]] as [Pattern, number][])
        if (trim === body) trim = WHITE
      }
      break
    }
    case 'ant':
      body = pick(rng, ['#9f5e35', '#302a3e', '#7f4c2c', '#c1672e', '#6f327a'])
      head = body === '#302a3e' ? '#3e384c' : mixHead(rng, body)
      limb = body === '#302a3e' ? '#302a3e' : '#53331f'
      trim = body
      break
    case 'bee':
      body = pick(rng, ['#e9b650', '#e8b247', '#e7af3f'])
      trim = '#302a3e'
      head = pick(rng, ['#ecbf66', '#3e384c', CREAM])
      limb = '#302a3e'
      break
    case 'grasshopper':
      body = pick(rng, ['#57ce99', '#48d897', '#54bf8f', '#57d59d'])
      head = pick(rng, ['#66d7a4', '#6bdfab', '#57ce99'])
      limb = '#3a8f69'
      trim = body
      break
    case 'spider':
      body = pick(rng, ['#7c57cf', '#3e384c', '#61412d', '#3d99d8', '#e24139'])
      trim = pick(rng, ['#e6ac39', '#e969a1', WHITE, '#34aeb4'])
      limb = pick(rng, ['#523593', '#302a3e', '#442b1c'])
      head = body
      break
    case 'butterfly':
      body = pick(rng, ['#eb77aa', '#e67732', '#3d99d8', '#e6ac39', '#7d57d5', '#34aeb4', WHITE])
      trim = pick(rng, BRIGHT.filter((c) => c !== body))
      head = pick(rng, [CREAM, '#3e384c', '#f299c0'])
      limb = '#3c344d'
      break
    case 'caterpillar':
      body = pick(rng, ['#57ce99', '#e6ac39', '#e67732', '#3d99d8', '#7d57d5', '#34aeb4'])
      trim = pick(rng, ['#e6ac39', '#57ce99', WHITE, '#e969a1', '#302a3e'])
      if (trim === body) trim = WHITE
      head = pick(rng, ['#66d7a4', '#f1b996', '#ecbf66', CREAM])
      break
    case 'snail':
      body = pick(rng, ['#dfb154', '#c99e49', '#e969a1', '#87c0e6', '#a187de', '#e6ac39'])
      trim = pick(rng, ['#975932', '#843658', '#40469c', WHITE])
      head = pick(rng, ['#8ed1b3', '#d6c29a', '#e3d1af', '#92d3b6'])
      break
    case 'worm':
      body = pick(rng, ['#f299c0', '#ef8883', '#e6b697'])
      head = body
      break
  }

  const canWear = sp !== 'snail' || rng() < 0.25
  const hat: Hat = canWear ? weighted(rng, HATS) : 'none'
  const hatColour = hat === 'crown' ? '#e6ac39' : hat === 'straw' ? '#e7c073' : pick(rng, HAT_COLOURS)
  let hatTrim: string = pick(rng, [WHITE, ...HAT_COLOURS])
  if (hatTrim === hatColour) hatTrim = WHITE

  const facesUs = sp !== 'snail' && sp !== 'spider'
  const glasses: Glasses = facesUs ? (rng() < 0.12 ? 'round' : rng() < 0.08 ? 'shades' : 'none') : 'none'
  const bipedal = sp === 'beetle' || sp === 'ant' || sp === 'bee' || sp === 'grasshopper' || sp === 'butterfly'
  const held: Held = bipedal && rng() < cast.heldChance ? pick(rng, cast.held) : 'none'

  return {
    species: sp,
    body,
    trim,
    pattern,
    head,
    limb,
    hat,
    hatColour,
    hatTrim,
    glasses,
    scarf: bipedal && rng() < 0.1 ? pick(rng, HAT_COLOURS) : null,
    held,
    heldColour: held === 'crumb' ? '#e7c073' : held === 'leaf' ? '#54bf8f' : pick(rng, BRIGHT),
  }
}

function mixHead(rng: Rng, body: string): string {
  return rng() < 0.5 ? body : pick(rng, ['#b9403a', '#8b522e', '#d0763d'])
}

// ------------------------------------------------------------------ layout

class Layout {
  props: Prop[] = []
  critters: Critter[] = []
  decals: Decal[] = []
  /** Ground a critter's feet may not land on. */
  private solids: { x: number; y: number; rx: number; ry: number }[] = []
  private cells = new Map<number, Critter[]>()
  private cell: number
  nextId = 0
  readonly w: number
  readonly h: number
  readonly rng: Rng
  readonly size: number
  readonly cast: Cast
  /** Extra rule for where feet may go: water, walls. */
  readonly walkable: (x: number, y: number) => boolean

  constructor(w: number, h: number, rng: Rng, size: number, cast: Cast, walkable: (x: number, y: number) => boolean) {
    this.w = w
    this.h = h
    this.rng = rng
    this.size = size
    this.cast = cast
    this.walkable = walkable
    this.cell = size
  }

  addProp(
    kind: PropKind,
    x: number,
    y: number,
    s: number,
    opts: Partial<Pick<Prop, 'colour' | 'colour2' | 'variant' | 'flip'>> & { solid?: boolean } = {},
  ): Prop {
    const prop: Prop = {
      kind,
      x,
      y,
      s,
      colour: opts.colour ?? '#e24139',
      colour2: opts.colour2 ?? WHITE,
      variant: opts.variant ?? Math.floor(this.rng() * 8),
      flip: opts.flip ?? this.rng() < 0.5,
      z: y,
    }
    this.props.push(prop)
    if (opts.solid !== false) {
      const b = propBounds(prop)
      this.solids.push({ x, y: y - s * 0.12, rx: (b.x1 - b.x0) * 0.46, ry: Math.max(s * 0.16, this.size * 0.3) })
    }
    return prop
  }

  private key(cx: number, cy: number) {
    return cx * 4096 + cy
  }

  private near(x: number, y: number, radius: number): Critter[] {
    const out: Critter[] = []
    const r = Math.ceil(radius / this.cell)
    const cx = Math.floor(x / this.cell)
    const cy = Math.floor(y / this.cell)
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const list = this.cells.get(this.key(cx + dx, cy + dy))
        if (list) out.push(...list)
      }
    }
    return out
  }

  inSolid(x: number, y: number): boolean {
    for (const s of this.solids) {
      const dx = (x - s.x) / s.rx
      const dy = (y - s.y) / s.ry
      if (dx * dx + dy * dy < 1) return true
    }
    return false
  }

  /** Is there room for feet here, at least `gap` from anybody else's? */
  free(x: number, y: number, gap: number, margin = 0.02): boolean {
    const mx = this.w * margin
    if (x < mx || x > this.w - mx || y < this.size * 1.05 || y > this.h - this.size * 0.06) return false
    if (!this.walkable(x, y) || this.inSolid(x, y)) return false
    for (const c of this.near(x, y, gap)) {
      if (c.lift > 0) continue
      const dx = c.x - x
      const dy = (c.y - y) * 1.15
      if (dx * dx + dy * dy < gap * gap) return false
    }
    return true
  }

  addCritter(x: number, y: number, look: Look, opts: Partial<Critter> = {}): Critter {
    const rng = this.rng
    const size = (opts.size ?? this.size) * (opts.size ? 1 : range(rng, 0.92, 1.08))
    const bipedal = look.species !== 'snail' && look.species !== 'caterpillar' && look.species !== 'spider' && look.species !== 'worm'
    let pose: Pose = opts.pose ?? (bipedal ? weighted(rng, this.cast.poses) : 'stand')
    if (look.held === 'crumb' || look.held === 'leaf' || look.held === 'plush') pose = 'carry'
    else if (pose === 'carry') pose = 'stand'
    const critter: Critter = {
      id: this.nextId++,
      x,
      y,
      size,
      look,
      pose,
      facing: opts.facing ?? (rng() < 0.42 ? 1 : 0),
      flip: opts.flip ?? rng() < 0.5,
      gazeX: opts.gazeX ?? range(rng, -1, 1),
      gazeY: opts.gazeY ?? range(rng, -0.4, 0.8),
      mood: opts.mood ?? weighted(rng, [['smile', 60], ['open', 24], ['o', 8], ['sleepy', 6]] as [Mood, number][]),
      lift: opts.lift ?? 0,
      z: opts.z ?? y,
    }
    this.critters.push(critter)
    if (critter.lift === 0) {
      const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))
      const list = this.cells.get(k)
      if (list) list.push(critter)
      else this.cells.set(k, [critter])
    }
    return critter
  }

  /** Dart-throw a crowd into whatever room is left. */
  fillCrowd(count: number, gap: number, region?: Rect, look?: () => Look) {
    const rng = this.rng
    const r = region ?? { x0: 0, y0: 0, x1: this.w, y1: this.h }
    let placed = 0
    let tries = 0
    while (placed < count && tries < count * 60) {
      tries++
      const x = range(rng, r.x0, r.x1)
      const y = range(rng, r.y0, r.y1)
      if (!this.free(x, y, gap)) continue
      this.addCritter(x, y, look ? look() : randomLook(rng, this.cast))
      placed++
    }
    return placed
  }

  /** A line of critters walking a path — ants to the hill, a queue. */
  march(points: [number, number][], spacing: number, look: () => Look, opts: Partial<Critter> = {}) {
    const lengths: number[] = [0]
    for (let k = 1; k < points.length; k++) {
      const [ax, ay] = points[k - 1]
      const [bx, by] = points[k]
      lengths.push(lengths[k - 1] + Math.hypot(bx - ax, by - ay))
    }
    const total = lengths[lengths.length - 1]
    for (let d = spacing * 0.5; d < total; d += spacing * range(this.rng, 0.9, 1.15)) {
      let k = 1
      while (k < lengths.length - 1 && lengths[k] < d) k++
      const t = (d - lengths[k - 1]) / Math.max(1e-6, lengths[k] - lengths[k - 1])
      const [ax, ay] = points[k - 1]
      const [bx, by] = points[k]
      const x = ax + (bx - ax) * t + range(this.rng, -0.06, 0.06) * this.size
      const y = ay + (by - ay) * t + range(this.rng, -0.06, 0.06) * this.size
      if (!this.free(x, y, this.size * 0.5)) continue
      // Face the way the line is going. Snails and caterpillars are drawn
      // heading left, everybody else turned to their right.
      const l = look()
      const headsLeft = l.species === 'snail' || l.species === 'caterpillar'
      this.addCritter(x, y, l, { facing: 1, flip: headsLeft ? bx > ax : bx < ax, ...opts })
    }
  }

  /** A ring of critters round a spot: dancing, gathered at a fire. */
  ring(cx: number, cy: number, rx: number, ry: number, n: number, look: () => Look, opts: Partial<Critter> = {}) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + range(this.rng, -0.15, 0.15)
      const x = cx + Math.cos(a) * rx
      const y = cy + Math.sin(a) * ry
      if (!this.free(x, y, this.size * 0.45)) continue
      this.addCritter(x, y, look(), { flip: Math.cos(a) > 0, ...opts })
    }
  }

  /**
   * Critters standing on top of a prop. They take its draw order plus a
   * little, so they are painted over it rather than behind it.
   */
  perch(prop: Prop, topY: number, halfWidth: number, n: number, look: () => Look, opts: Partial<Critter> = {}) {
    for (let k = 0; k < n; k++) {
      const x = prop.x + (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * halfWidth) + range(this.rng, -0.05, 0.05) * this.size
      this.addCritter(x, topY, look(), { z: prop.z + 0.5 + k * 0.01, ...opts })
    }
  }

  /** Something in the air: a bee, a butterfly. */
  flyer(x: number, y: number, look: Look, lift: number) {
    return this.addCritter(x, y, look, { lift, pose: this.rng() < 0.5 ? 'wave' : 'cheer' })
  }

  decal(kind: DecalKind, x: number, y: number, s: number, colour: string, rot = 0) {
    this.decals.push({ kind, x, y, s, rot, colour })
  }
}

// ----------------------------------------------------------------- scenes

type Built = { ground: Ground; garlands?: Garland[]; lights?: Light[]; dusk?: number }

function speciesLook(L: Layout, species: Species, patch: Partial<Look> = {}): () => Look {
  return () => ({ ...randomLook(L.rng, L.cast, species), ...patch })
}

// Picnic ------------------------------------------------------------------

const PICNIC_CAST: Cast = {
  species: [
    ['beetle', 30],
    ['ant', 22],
    ['bee', 8],
    ['grasshopper', 8],
    ['butterfly', 6],
    ['caterpillar', 7],
    ['snail', 5],
    ['spider', 5],
    ['worm', 3],
  ],
  held: ['icecream', 'drink', 'balloon', 'flag', 'lollipop', 'crumb'],
  heldChance: 0.26,
  poses: [['stand', 30], ['wave', 16], ['walk', 20], ['cheer', 10], ['sit', 12], ['hold', 6]],
}

function buildPicnic(L: Layout): Built {
  const { w, h, rng, size } = L
  const bw = w * range(rng, 0.52, 0.6)
  const bh = h * range(rng, 0.42, 0.5)
  const blanket = { x: w * range(rng, 0.44, 0.56), y: h * range(rng, 0.46, 0.54), w: bw, h: bh, rot: range(rng, -0.1, 0.1) }

  const inBlanket = (x: number, y: number, pad = 0) => {
    const dx = x - blanket.x
    const dy = y - blanket.y
    const c = Math.cos(-blanket.rot)
    const s = Math.sin(-blanket.rot)
    const lx = dx * c - dy * s
    const ly = dx * s + dy * c
    return Math.abs(lx) < bw / 2 - pad && Math.abs(ly) < bh / 2 - pad
  }
  const onBlanket = (u: number, v: number): [number, number] => {
    const lx = (u - 0.5) * bw
    const ly = (v - 0.5) * bh
    const c = Math.cos(blanket.rot)
    const s = Math.sin(blanket.rot)
    return [blanket.x + lx * c - ly * s, blanket.y + lx * s + ly * c]
  }

  // The spread, laid out on the cloth.
  const melonAt = onBlanket(range(rng, 0.2, 0.3), range(rng, 0.3, 0.4))
  const melon = L.addProp('watermelon', melonAt[0], melonAt[1], size * 3.2)
  // Standing along the flat top of the slice.
  L.perch(melon, melon.y - melon.s * 0.45, melon.s * 0.32, 2 + Math.floor(rng() * 2), () => randomLook(rng, L.cast))

  const sandAt = onBlanket(range(rng, 0.7, 0.8), range(rng, 0.62, 0.72))
  const sand = L.addProp('sandwich', sandAt[0], sandAt[1], size * 2.6, { colour: pick(rng, BRIGHT) })
  L.perch(sand, sand.y - sand.s * 0.5, sand.s * 0.25, 2, () => randomLook(rng, L.cast))

  const cakeAt = onBlanket(range(rng, 0.62, 0.72), range(rng, 0.22, 0.3))
  L.addProp('cupcake', cakeAt[0], cakeAt[1], size * 1.7, { colour: pick(rng, ['#f5b9d3', '#faedd3', '#bee0f7']), colour2: pick(rng, ['#89cdd1', '#e6ac39', '#a187de']) })

  const cheeseAt = onBlanket(range(rng, 0.3, 0.4), range(rng, 0.75, 0.85))
  const cheese = L.addProp('cheese', cheeseAt[0], cheeseAt[1], size * 2)
  L.perch(cheese, cheese.y - cheese.s * 0.36, cheese.s * 0.2, 1, () => randomLook(rng, L.cast))

  const cupAt = onBlanket(range(rng, 0.45, 0.55), range(rng, 0.12, 0.2))
  L.addProp('teacup', cupAt[0], cupAt[1], size * 1.3, { colour: pick(rng, ['#3d99d8', '#34aeb4', '#e969a1']) })

  const berries = 2 + Math.floor(rng() * 2)
  for (let k = 0; k < berries; k++) {
    const at = onBlanket(range(rng, 0.1, 0.9), range(rng, 0.1, 0.9))
    if (L.inSolid(at[0], at[1])) continue
    L.addProp('strawberry', at[0], at[1], size * range(rng, 0.9, 1.1))
  }
  const grapesAt = onBlanket(range(rng, 0.84, 0.92), range(rng, 0.2, 0.4))
  L.addProp('grapes', grapesAt[0], grapesAt[1], size * 1.4, { colour: pick(rng, ['#7d57d5', '#49bf8a']) })
  const juiceAt = onBlanket(range(rng, 0.08, 0.16), range(rng, 0.6, 0.8))
  L.addProp('juicebox', juiceAt[0], juiceAt[1], size * 1.2, { colour: pick(rng, ['#e67732', '#54bf8f', '#e969a1']), colour2: pick(rng, ['#e24139', '#e6ac39']) })

  // Plates are flat, painted with the cloth; somebody always sits round one.
  const plates: { x: number; y: number; r: number }[] = []
  const plateAt = onBlanket(range(rng, 0.44, 0.56), range(rng, 0.5, 0.6))
  plates.push({ x: plateAt[0], y: plateAt[1], r: size * 1.1 })
  L.ring(plateAt[0], plateAt[1], size * 1.25, size * 0.75, 6, () => randomLook(rng, L.cast), { pose: 'sit' })

  // Off the cloth: the basket, the anthill, flowers in the grass.
  const basketX = blanket.x + (rng() < 0.5 ? -1 : 1) * (bw / 2 + size * 1.2)
  L.addProp('basket', Math.max(size * 2, Math.min(w - size * 2, basketX)), blanket.y - bh * 0.3, size * 2.6)

  const hillX = rng() < 0.5 ? w * range(rng, 0.08, 0.2) : w * range(rng, 0.8, 0.92)
  const hillY = rng() < 0.5 ? h * range(rng, 0.1, 0.18) : h * range(rng, 0.84, 0.94)
  L.addProp('anthill', hillX, hillY, size * 2.2)
  // The ant trail: from the cupcake to the hill, each one carrying a crumb.
  const trail: [number, number][] = [
    [cakeAt[0], cakeAt[1] + size * 0.4],
    [(cakeAt[0] + hillX) / 2 + range(rng, -1, 1) * size * 2, (cakeAt[1] + hillY) / 2 + range(rng, -1, 1) * size * 2],
    [hillX, hillY + size * 0.3],
  ]
  L.march(trail, size * 0.62, speciesLook(L, 'ant', { held: 'crumb', heldColour: '#e7c073', hat: 'none' }))

  for (let k = 0; k < 9; k++) {
    const x = range(rng, 0.04, 0.96) * w
    const y = range(rng, 0.06, 0.98) * h
    if (inBlanket(x, y, -size * 0.6) || L.inSolid(x, y)) continue
    const kind = pick(rng, ['daisy', 'daisy', 'dandelion', 'tulip'] as const)
    L.addProp(kind, x, y, size * range(rng, 1.4, 1.9), {
      colour: kind === 'daisy' ? WHITE : pick(rng, ['#e24139', '#e969a1', '#e6ac39', '#7d57d5']),
      colour2: '#e6ac39',
      solid: false,
    })
  }
  for (let k = 0; k < 7; k++) {
    const x = range(rng, 0.03, 0.97) * w
    const y = range(rng, 0.05, 0.99) * h
    if (inBlanket(x, y, -size * 0.3)) continue
    L.addProp('pebble', x, y, size * range(rng, 0.7, 1.1), { colour: pick(rng, ['#b3bdc4', '#a3afb7', '#d5c098']) })
  }
  for (let k = 0; k < 14; k++) {
    const x = range(rng, 0.02, 0.98) * w
    const y = range(rng, 0.04, 1) * h
    if (inBlanket(x, y, -size * 0.2)) continue
    L.addProp('tuft', x, y, size * range(rng, 0.5, 0.75), { colour: '#45af7f', colour2: '#4ec28e', solid: false })
  }

  // Grass texture and the odd crumb.
  for (let k = 0; k < 520; k++) {
    const x = rng() * w
    const y = rng() * h
    if (inBlanket(x, y)) {
      if (rng() < 0.08) L.decal('crumb', x, y, size * range(rng, 0.05, 0.09), '#e7c073', rng() * 6)
      continue
    }
    const roll = rng()
    if (roll < 0.8) L.decal('blade', x, y, size * range(rng, 0.14, 0.24), rng() < 0.5 ? '#44a97c' : '#66cfa0', range(rng, -0.4, 0.4))
    else if (roll < 0.93) L.decal('clover', x, y, size * range(rng, 0.14, 0.2), '#3da074', rng() * 6)
    else L.decal('bloom', x, y, size * range(rng, 0.07, 0.1), pick(rng, [WHITE, '#e6ac39', '#f299c0']), 0)
  }

  // Butterflies and bees over the grass.
  for (let k = 0; k < 6; k++) {
    const x = range(rng, 0.06, 0.94) * w
    const y = range(rng, 0.12, 0.96) * h
    L.flyer(x, y, randomLook(rng, L.cast, rng() < 0.5 ? 'butterfly' : 'bee'), range(rng, 0.5, 1.1))
  }

  return { ground: { kind: 'picnic', blanket, plates } }
}

// Garden ------------------------------------------------------------------

const GARDEN_CAST: Cast = {
  species: [
    ['beetle', 28],
    ['ant', 12],
    ['bee', 12],
    ['grasshopper', 10],
    ['butterfly', 8],
    ['caterpillar', 10],
    ['snail', 9],
    ['spider', 5],
    ['worm', 6],
  ],
  held: ['spade', 'flag', 'icecream', 'drink', 'leaf', 'balloon'],
  heldChance: 0.24,
  poses: [['stand', 30], ['wave', 16], ['walk', 18], ['cheer', 10], ['sit', 8], ['hold', 8]],
}

function buildGarden(L: Layout): Built {
  const { w, h, rng, size } = L
  // Beds in two or three rows with grass paths between.
  const rows = h > w * 1.2 ? 3 : 2
  const cols = w > h * 1.2 ? 3 : 2
  const beds: Rect[] = []
  const padX = w * 0.06
  const padY = h * 0.08
  const gapX = size * 1.6
  const gapY = size * 1.9
  const bedW = (w - padX * 2 - gapX * (cols - 1)) / cols
  const bedH = (h - padY * 2 - gapY * (rows - 1)) / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = padX + c * (bedW + gapX)
      const y0 = padY + r * (bedH + gapY)
      beds.push({ x0, y0: y0 + size * 0.4, x1: x0 + bedW, y1: y0 + bedH })
    }
  }

  // Flowers planted in rows in each bed.
  for (const bed of beds) {
    const kind = pick(rng, ['tulip', 'sunflower', 'daisy', 'tulip'] as const)
    const colour = kind === 'daisy' ? WHITE : pick(rng, ['#e24139', '#e969a1', '#e6ac39', '#7d57d5', '#e67732'])
    const n = Math.max(2, Math.floor((bed.x1 - bed.x0) / (size * 1.5)))
    const lines = Math.max(1, Math.floor((bed.y1 - bed.y0) / (size * 2.4)))
    for (let row = 0; row < lines; row++) {
      const y = bed.y0 + ((row + 0.8) * (bed.y1 - bed.y0)) / (lines + 0.3)
      for (let k = 0; k < n; k++) {
        if (rng() < 0.35) continue
        const x = bed.x0 + ((k + 0.5) * (bed.x1 - bed.x0)) / n + range(rng, -0.2, 0.2) * size
        L.addProp(kind, x, y, size * range(rng, 1.7, 2.3), { colour, colour2: '#e6ac39', solid: false })
      }
    }
    // A toadstool or two where the soil is damp.
    if (rng() < 0.6) {
      L.addProp('toadstool', range(rng, bed.x0 + size, bed.x1 - size), range(rng, bed.y0 + size, bed.y1), size * range(rng, 1.1, 1.5), {
        colour: pick(rng, ['#e24139', '#e24139', '#e67732', '#7d57d5']),
      })
    }
  }

  // Tools and pots along the paths.
  L.addProp('wateringcan', range(rng, 0.15, 0.85) * w, range(rng, 0.2, 0.8) * h, size * 2.4, { colour: pick(rng, ['#40a276', '#3d99d8', '#34aeb4']) })
  for (let k = 0; k < 3; k++) {
    const x = range(rng, 0.08, 0.92) * w
    const y = range(rng, 0.1, 0.95) * h
    if (L.inSolid(x, y)) continue
    L.addProp('flowerpot', x, y, size * range(rng, 1.2, 1.5))
  }
  L.addProp('sign', range(rng, 0.1, 0.9) * w, range(rng, 0.1, 0.9) * h, size * 1.4)
  // A picket fence along the back.
  const panel = size * 3
  for (let x = panel * 0.5; x < w; x += panel * 0.98) {
    L.addProp('fence', x, size * 1.25, panel, { colour: '#f0e5cf', solid: false, flip: false })
  }

  // Stepping stones on the paths.
  const stones: { x: number; y: number; r: number }[] = []
  for (let k = 0; k < 22; k++) {
    stones.push({ x: rng() * w, y: rng() * h, r: size * range(rng, 0.3, 0.5) })
  }

  // A snail race down one path, and a queue of gardeners.
  const raceY = beds[0].y1 + gapY * 0.6
  L.march(
    [
      [w * 0.12, raceY],
      [w * 0.62, raceY + range(rng, -0.3, 0.3) * size],
    ],
    size * 1.3,
    speciesLook(L, 'snail'),
  )

  for (let k = 0; k < 520; k++) {
    const x = rng() * w
    const y = rng() * h
    const inBed = beds.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)
    if (inBed) {
      if (rng() < 0.4) L.decal('speck', x, y, size * range(rng, 0.03, 0.06), '#623c25', 0)
    } else {
      L.decal('blade', x, y, size * range(rng, 0.14, 0.22), rng() < 0.5 ? '#44a97c' : '#5fcb9b', range(rng, -0.4, 0.4))
    }
  }

  for (let k = 0; k < 10; k++) {
    const x = range(rng, 0.05, 0.95) * w
    const y = range(rng, 0.1, 0.95) * h
    L.flyer(x, y, randomLook(rng, L.cast, rng() < 0.55 ? 'bee' : 'butterfly'), range(rng, 0.6, 1.3))
  }

  return { ground: { kind: 'garden', beds, stones } }
}

// Pond --------------------------------------------------------------------

const POND_CAST: Cast = {
  species: [
    ['beetle', 32],
    ['ant', 12],
    ['bee', 7],
    ['grasshopper', 10],
    ['butterfly', 6],
    ['caterpillar', 8],
    ['snail', 6],
    ['spider', 5],
    ['worm', 3],
  ],
  held: ['tube', 'spade', 'icecream', 'drink', 'lollipop', 'flag'],
  heldChance: 0.3,
  poses: [['stand', 26], ['wave', 18], ['walk', 16], ['cheer', 12], ['sit', 18]],
}

function buildPond(L: Layout, shoreY: (x: number) => number): Built {
  const { w, h, rng, size } = L
  const shore: number[] = []
  for (let k = 0; k <= 16; k++) shore.push(shoreY((k / 16) * w))

  // Lily pads out on the water, somebody sitting on most of them.
  const pads: { x: number; y: number; r: number; rot: number }[] = []
  for (let k = 0; k < 40 && pads.length < 11; k++) {
    const x = range(rng, 0.08, 0.92) * w
    const y = range(rng, 0.05, 0.95) * h
    if (y < shoreY(x) + size * 1.2 || y > h - size * 0.8) continue
    const r = size * range(rng, 0.8, 1.1)
    if (pads.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) < p.r + r + size * 0.5)) continue
    pads.push({ x, y, r, rot: rng() * 6 })
  }

  // Beach things on the sand.
  const sandTop = size * 1.2
  for (let k = 0; k < 3; k++) {
    const x = range(rng, 0.12, 0.88) * w
    const y = range(rng, sandTop + size, shoreY(x) - size * 0.8)
    if (y < sandTop + size * 0.5 || L.inSolid(x, y)) continue
    L.addProp('umbrella', x, y, size * range(rng, 2.2, 2.6), { colour: RED, colour2: WHITE, solid: false })
  }
  const castleX = range(rng, 0.2, 0.8) * w
  L.addProp('sandcastle', castleX, Math.max(sandTop + size * 2, shoreY(castleX) - size * 1.2), size * 2.4, { colour: pick(rng, ['#3d99d8', '#e24139']) })
  for (let k = 0; k < 2; k++) {
    const x = range(rng, 0.1, 0.9) * w
    const y = range(rng, sandTop + size, shoreY(x) - size * 0.5)
    if (L.inSolid(x, y)) continue
    L.addProp('bucket', x, y, size * 1.1, { colour: pick(rng, ['#3d99d8', '#e6ac39', '#e969a1', '#34aeb4']) })
  }
  const guardX = rng() < 0.5 ? w * 0.12 : w * 0.88
  const guard = L.addProp('lifeguard', guardX, shoreY(guardX) - size * 0.6, size * 1.6)
  L.perch(guard, guard.y - guard.s * 1.12, 0, 1, () => ({ ...randomLook(rng, L.cast, 'beetle'), glasses: 'shades', hat: 'cap', hatColour: RED, hatTrim: WHITE }), { pose: 'wave' })

  // Reeds where the water meets the sand.
  for (let k = 0; k < 7; k++) {
    const x = range(rng, 0.03, 0.97) * w
    L.addProp('reeds', x, shoreY(x) + size * 0.25, size * range(rng, 1.6, 2.2), { solid: false })
  }
  for (let k = 0; k < 5; k++) {
    const x = range(rng, 0.03, 0.97) * w
    const y = range(rng, sandTop, shoreY(x) - size * 0.3)
    L.addProp('pebble', x, y, size * range(rng, 0.6, 0.9), { colour: pick(rng, ['#d5c098', '#b3bdc4', '#deceae']) })
  }

  // Sunbathers on towels are drawn as critters sitting; swimmers float in rings.
  for (const pad of pads) {
    if (rng() < 0.8) {
      L.addCritter(pad.x + range(rng, -0.2, 0.2) * pad.r, pad.y + pad.r * 0.1, randomLook(rng, L.cast), { pose: rng() < 0.5 ? 'sit' : 'wave', z: pad.y + 0.5 })
    }
  }

  // A boat or two.
  for (let k = 0; k < 2; k++) {
    const x = range(rng, 0.15, 0.85) * w
    const y = range(rng, 0.2, 0.95) * h
    if (y < shoreY(x) + size * 1.6 || y > h - size * 0.4) continue
    const boat = L.addProp('boat', x, y, size * 2.6, { colour: '#49b283', colour2: pick(rng, [WHITE, '#f299c0', '#e6ac39']) })
    L.perch(boat, boat.y - boat.s * 0.06, boat.s * 0.22, 2, () => randomLook(rng, L.cast), { pose: 'wave' })
  }

  // Sand speckle and ripples on the water.
  for (let k = 0; k < 480; k++) {
    const x = rng() * w
    const y = rng() * h
    if (y < shoreY(x)) {
      L.decal(rng() < 0.9 ? 'speck' : 'shell', x, y, size * range(rng, 0.03, 0.12), pick(rng, ['#c8a663', '#e6c990', '#f299c0', WHITE]), rng() * 6)
    } else if (rng() < 0.35) {
      L.decal('ripple', x, y, size * range(rng, 0.3, 0.7), 'rgba(255, 255, 255, 0.35)', 0)
    }
  }

  // Dragonflies are just butterflies here, darting over the water.
  for (let k = 0; k < 7; k++) {
    const x = range(rng, 0.05, 0.95) * w
    const y = range(rng, 0.1, 0.95) * h
    L.flyer(x, y, randomLook(rng, L.cast, rng() < 0.6 ? 'butterfly' : 'bee'), range(rng, 0.6, 1.2))
  }

  return { ground: { kind: 'pond', shore, pads } }
}

// Arcade ------------------------------------------------------------------

const ARCADE_CAST: Cast = {
  species: [
    ['beetle', 34],
    ['ant', 16],
    ['bee', 9],
    ['grasshopper', 9],
    ['butterfly', 5],
    ['caterpillar', 8],
    ['snail', 4],
    ['spider', 8],
    ['worm', 2],
  ],
  held: ['token', 'token', 'drink', 'plush', 'balloon', 'lollipop', 'icecream'],
  heldChance: 0.32,
  poses: [['stand', 28], ['wave', 14], ['walk', 18], ['cheer', 18], ['hold', 10]],
}

const CABINET_BODIES = ['#413262', '#324f62', '#4c3351', '#363962', '#533358', '#324c5e'] as const
const NEONS = ['#5eebac', '#ee77ab', '#eaba59', '#77beee', '#b59bf3'] as const

function buildArcade(L: Layout, wall: number): Built {
  const { w, h, rng, size } = L
  // Neon on the back wall.
  const signs = Math.max(3, Math.round(w / (size * 4)))
  for (let k = 0; k < signs; k++) {
    L.addProp('neon', ((k + 0.5) / signs) * w + range(rng, -0.3, 0.3) * size, wall * 0.86, size * range(rng, 1.2, 1.6), {
      colour: pick(rng, NEONS),
      variant: k,
      solid: false,
    })
  }

  // Rows of cabinets, a gap between each machine for players to stand in.
  const rows = Math.max(2, Math.round((h - wall) / (size * 4.4)))
  const rowGap = (h - wall) / (rows + 0.35)
  for (let r = 0; r < rows; r++) {
    const y = wall + rowGap * (r + 0.9)
    const cabW = size * 1.25
    const n = Math.max(3, Math.floor(w / (cabW * 2.3)))
    const offset = r % 2 ? 0.5 : 0
    for (let k = 0; k < n; k++) {
      const x = ((k + 0.5 + offset * 0.5) / (n + offset * 0.5)) * w
      if (rng() < 0.12) continue
      const roll = rng()
      if (roll < 0.14) {
        L.addProp('claw', x, y, cabW * 1.2, { colour: pick(rng, ['#e969a1', '#3d99d8', '#7d57d5']) })
      } else if (roll < 0.2) {
        L.addProp('changer', x, y, cabW * 0.9, { colour: pick(rng, ['#e24139', '#3d99d8']) })
      } else {
        L.addProp('cabinet', x, y, cabW, { colour: pick(rng, CABINET_BODIES), colour2: pick(rng, NEONS) })
      }
    }
  }

  // The prize counter, with a queue.
  const counterX = range(rng, 0.25, 0.75) * w
  const counterY = h - size * 1.6
  L.addProp('counter', counterX, counterY, size * 4.4, { colour: '#5d40a2', colour2: '#eaba59' })
  L.march(
    [
      [counterX - size * 2.6, counterY + size * 0.9],
      [counterX - size * 6, counterY + size * 1.1],
    ],
    size * 0.6,
    () => ({ ...randomLook(rng, L.cast), held: rng() < 0.5 ? 'token' : 'none' }),
    { pose: 'stand' },
  )
  L.addProp('bench', range(rng, 0.1, 0.9) * w, range(rng, wall + size * 3, h - size * 3), size * 2.4, { colour: '#543a8f' })

  for (let k = 0; k < 360; k++) {
    const x = rng() * w
    const y = wall + rng() * (h - wall)
    L.decal('confetti', x, y, size * range(rng, 0.1, 0.2), pick(rng, NEONS), rng() * 6)
  }
  for (let k = 0; k < 30; k++) {
    L.decal('crumb', rng() * w, wall + rng() * (h - wall), size * 0.1, '#e7af40', 0)
  }

  return { ground: { kind: 'arcade', wall } }
}

// Night market ------------------------------------------------------------

const NIGHT_CAST: Cast = {
  species: [
    ['beetle', 32],
    ['ant', 14],
    ['bee', 6],
    ['grasshopper', 9],
    ['butterfly', 7],
    ['caterpillar', 8],
    ['snail', 6],
    ['spider', 8],
    ['worm', 3],
  ],
  held: ['lantern', 'lantern', 'lantern', 'icecream', 'balloon', 'drink', 'lollipop'],
  heldChance: 0.34,
  poses: [['stand', 28], ['wave', 14], ['walk', 20], ['cheer', 14], ['sit', 8], ['hold', 8]],
}

function buildNight(L: Layout, horizon: number): Built {
  const { w, h, rng, size } = L
  const lights: Light[] = []

  // A winding path through the middle of the market.
  const path: number[] = []
  const pathX = (y: number) => w * (0.5 + 0.18 * Math.sin((y / h) * Math.PI * 2 + 0.6))
  for (let k = 0; k <= 20; k++) path.push(pathX(horizon + ((h - horizon) * k) / 20))

  // Stalls either side of it, their awnings in the Bug's colours as often as not.
  const rows = Math.max(2, Math.round((h - horizon) / (size * 4.2)))
  for (let r = 0; r < rows; r++) {
    const y = horizon + ((r + 0.85) * (h - horizon)) / (rows + 0.2)
    for (const side of [-1, 1]) {
      const x = pathX(y) + side * range(rng, 0.2, 0.3) * w
      if (x < size * 2 || x > w - size * 2) continue
      const striped = rng() < 0.55
      const stall = L.addProp('stall', x, y, size * range(rng, 2.8, 3.3), {
        colour: striped ? RED : pick(rng, ['#3d99d8', '#7d57d5', '#40a276', '#e67732']),
        colour2: WHITE,
        variant: r,
      })
      lights.push({ x: stall.x, y: stall.y - stall.s * 0.6, r: size * 3.2, colour: 'rgba(239, 201, 126, 0.5)' })
      // Somebody minding every stall.
      L.addCritter(stall.x + range(rng, -0.2, 0.2) * stall.s, stall.y - stall.s * 0.38, randomLook(rng, L.cast), { z: stall.z - 1, pose: 'wave' })
    }
  }

  // Tents at the back, lamps and a campfire.
  const tents = Math.max(2, Math.round(w / (size * 5)))
  for (let k = 0; k < tents; k++) {
    L.addProp('tent', ((k + 0.5) / tents) * w + range(rng, -0.5, 0.5) * size, horizon + size * 1.2, size * range(rng, 2.6, 3.2), {
      colour: pick(rng, ['#3d99d8', '#7d57d5', '#34aeb4', '#e67732']),
      colour2: pick(rng, [WHITE, '#e6ac39']),
    })
  }
  for (let k = 0; k < 4; k++) {
    const y = range(rng, horizon + size * 2, h - size)
    const x = pathX(y) + (rng() < 0.5 ? -1 : 1) * size * 1.6
    L.addProp('lamp', x, y, size * 1.1, { solid: false })
    lights.push({ x, y: y - size * 1.9, r: size * 3.4, colour: 'rgba(242, 212, 151, 0.55)' })
  }
  const fireY = range(rng, horizon + (h - horizon) * 0.4, h - size * 2)
  const fireX = w - pathX(fireY) > w * 0.5 ? pathX(fireY) + w * 0.2 : pathX(fireY) - w * 0.2
  L.addProp('campfire', fireX, fireY, size * 1.3)
  lights.push({ x: fireX, y: fireY - size * 0.4, r: size * 4.5, colour: 'rgba(234, 143, 85, 0.6)' })
  L.ring(fireX, fireY - size * 0.2, size * 1.9, size * 1.0, 7, () => randomLook(rng, L.cast), { pose: 'cheer' })
  for (let k = 0; k < 3; k++) {
    const x = range(rng, 0.05, 0.95) * w
    const y = range(rng, horizon + size, h - size * 0.4)
    L.addProp('log', x, y, size * 1.8, {})
  }
  for (let k = 0; k < 8; k++) {
    const x = range(rng, 0.03, 0.97) * w
    const y = range(rng, horizon + size, h)
    L.addProp('toadstool', x, y, size * range(rng, 0.8, 1.1), { colour: pick(rng, ['#7d57d5', '#34aeb4', '#e24139']), solid: false })
  }

  // String lights across the whole market.
  const garlands: Garland[] = []
  const strands = Math.max(2, Math.round((h - horizon) / (size * 6)))
  for (let k = 0; k < strands; k++) {
    const y0 = horizon + ((k + 0.4) * (h - horizon)) / strands
    const points: [number, number][] = []
    for (let t = 0; t <= 12; t++) {
      const x = (t / 12) * w
      points.push([x, y0 + Math.sin((t / 12) * Math.PI * 3) * size * 0.9 - size * 0.4])
    }
    garlands.push({ points, colours: ['#eaba59', '#ee77ab', '#77beee', '#78dfb1', '#ec9a66'] })
  }

  for (let k = 0; k < 420; k++) {
    const x = rng() * w
    const y = horizon + rng() * (h - horizon)
    const onPath = Math.abs(x - pathX(y)) < w * 0.08
    if (onPath) L.decal('speck', x, y, size * range(rng, 0.03, 0.07), '#6e594c', 0)
    else L.decal('blade', x, y, size * range(rng, 0.14, 0.22), rng() < 0.5 ? '#32604c' : '#347e5d', range(rng, -0.4, 0.4))
  }
  for (let k = 0; k < 60; k++) {
    L.decal('star', rng() * w, rng() * horizon * 0.9, size * range(rng, 0.04, 0.09), '#f8e7c6', 0)
  }

  // Fireflies: tiny glowing flyers.
  for (let k = 0; k < 6; k++) {
    const x = range(rng, 0.05, 0.95) * w
    const y = range(rng, horizon + size, h)
    L.flyer(x, y, randomLook(rng, L.cast, rng() < 0.5 ? 'butterfly' : 'bee'), range(rng, 0.6, 1.3))
  }

  return { ground: { kind: 'night', horizon, path }, garlands, lights, dusk: 0.42 }
}

// ------------------------------------------------------------------ decoys

/** Colours a look-alike may be given in place of one of the wanted bug's. */
const SHELLS = ['#3d99d8', '#40a276', '#e6ac39', '#7d57d5', '#e67732', '#e969a1', '#34aeb4', RED] as const
const TRIMS = [WHITE, INK, ...SHELLS] as const

/** A hat that differs from another by a detail: the pom-pom, the peak. */
const NEAR_HAT: Partial<Record<Hat, Hat>> = { bobble: 'beanie', beanie: 'bobble', cap: 'beanie' }

/** Anything from `list` but these. */
function other<T>(rng: Rng, list: readonly T[], ...not: T[]): T {
  return pick(rng, list.filter((v) => !not.includes(v)))
}

/** Look-alikes that match the wanted bug in everything but one thing. */
function twinOf(rng: Rng, index: number, wanted: WantedBug): Look {
  const t = wanted.look
  // The early scenes change something loud; the late ones something small.
  const loud: ((l: Look) => Look)[] = [
    (l) => ({ ...l, hatColour: other(rng, SHELLS, t.hatColour, t.hatTrim) }),
    (l) => ({ ...l, body: other(rng, SHELLS, t.body, t.trim) }),
    (l) => ({ ...l, hat: other(rng, ['cap', 'party', 'tophat', 'bobble', 'headphones'] as Hat[], t.hat, NEAR_HAT[t.hat] ?? t.hat) }),
  ]
  const near = NEAR_HAT[t.hat]
  const quiet: ((l: Look) => Look)[] = [
    ...(near ? [(l: Look): Look => ({ ...l, hat: near })] : []),
    (l) => ({ ...l, glasses: 'none' }),
    (l) => ({ ...l, glasses: t.glasses === 'round' ? 'shades' : 'round' }),
    (l) => ({ ...l, trim: other(rng, TRIMS, t.trim, t.body) }),
    (l) => ({ ...l, hatTrim: other(rng, TRIMS, t.hatTrim, t.hatColour) }),
  ]
  const pool = index < 2 ? loud : index < 3 ? [...loud, ...quiet] : quiet
  return pick(rng, pool)({ ...t })
}

/** Its shell with somebody else's hat. */
function shellStranger(rng: Rng, cast: Cast, wanted: WantedBug): Look {
  const t = wanted.look
  const species = weighted(rng, [['beetle', 4], ['bee', 1], ['caterpillar', 1], ['snail', 1]] as [Species, number][])
  const base = randomLook(rng, cast, species)
  if (species === 'beetle') {
    return { ...base, body: t.body, trim: t.trim, pattern: t.pattern, hat: weighted(rng, HATS.filter(([h]) => h !== t.hat)) }
  }
  return { ...base, body: t.body, trim: t.trim }
}

/** Its hat on somebody else, often with its glasses too. */
function hatStranger(rng: Rng, cast: Cast, wanted: WantedBug): Look {
  const t = wanted.look
  const base = randomLook(rng, cast)
  return { ...base, hat: t.hat, hatColour: t.hatColour, hatTrim: t.hatTrim, glasses: rng() < 0.4 ? t.glasses : base.glasses }
}

// ------------------------------------------------------------------- build

const CASTS: Record<SceneKind, Cast> = {
  picnic: PICNIC_CAST,
  garden: GARDEN_CAST,
  pond: POND_CAST,
  arcade: ARCADE_CAST,
  night: NIGHT_CAST,
}

/** Field height over width, clamped to shapes the layouts are designed for. */
export function clampAspect(aspect: number): number {
  return Math.max(0.5, Math.min(2.1, aspect))
}

export function sceneSize(aspect: number): { w: number; h: number } {
  const a = clampAspect(aspect)
  const w = Math.sqrt(WORLD_AREA / a)
  return { w, h: w * a }
}

function boxesOverlap(a: Rect, b: Rect) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
}

export function itemBounds(item: Item): Rect {
  if (item.critter) return critterBounds(item.critter)
  return propBounds(item.prop!)
}

/** The box round a critter's face — eyes, glasses and all — that must stay in view. */
export function faceBox(c: Critter): Rect {
  const f = faceCentre(c)
  const s = c.size
  return { x0: f.x - 0.25 * s, y0: f.y - 0.36 * s, x1: f.x + 0.25 * s, y1: f.y + 0.2 * s }
}

/**
 * Whether anything painted after this critter covers its face. The face is
 * what identifies the Bug, so it must always show; the rest of him may not.
 */
export function faceHiddenBy(target: Critter, items: Item[]): Item[] {
  const face = faceBox(target)
  const out: Item[] = []
  for (const item of items) {
    if (item.critter === target || item.z <= target.z) continue
    const covers = item.critter
      ? critterOccluders(item.critter).some((b) => boxesOverlap(face, b))
      : propOccluders(item.prop!).some((b) => boxesOverlap(face, b))
    if (covers) out.push(item)
  }
  return out
}

/** Whether a string of lights, hung over everything, runs across this box. */
function garlandCrosses(box: Rect, garlands: Garland[], unit: number): boolean {
  const pad = unit * 0.25
  for (const g of garlands) {
    for (let k = 1; k < g.points.length; k++) {
      const [x0, y0] = g.points[k - 1]
      const [x1, y1] = g.points[k]
      for (let t = 0; t <= 1; t += 0.1) {
        const x = x0 + (x1 - x0) * t
        const y = y0 + (y1 - y0) * t + unit * 0.12
        if (x > box.x0 - pad && x < box.x1 + pad && y > box.y0 - pad && y < box.y1 + pad) return true
      }
    }
  }
  return false
}

/**
 * The parts of a critter that cover whatever is behind it: its body and head
 * (and hat), wings or legs spread out to the sides, and anything held up.
 */
function critterOccluders(c: Critter): Rect[] {
  const s = c.size
  const look = c.look
  const up = c.lift * s
  const spread: Record<string, [number, number]> = {
    beetle: [0.3, 0.86],
    ant: [0.3, 0.86],
    grasshopper: [0.3, 0.9],
    bee: [0.47, 0.86],
    butterfly: [0.6, 0.86],
    spider: [0.5, 0.72],
    caterpillar: [0.6, 0.62],
    snail: [0.5, 0.6],
    worm: [0.27, 0.77],
  }
  const [half, height] = spread[look.species] ?? [0.3, 0.86]
  const top = look.hat !== 'none' ? Math.max(height, 1.02) : height
  const boxes: Rect[] = [{ x0: c.x - half * s, y0: c.y - top * s - up, x1: c.x + half * s, y1: c.y - up }]
  // Held things go up in the right hand, which is the left one when mirrored.
  const dir = c.flip ? -1 : 1
  const at = (x0: number, x1: number, y0: number, y1: number): Rect => {
    const a = c.x + dir * x0 * s
    const b = c.x + dir * x1 * s
    return { x0: Math.min(a, b), y0: c.y - y0 * s - up, x1: Math.max(a, b), y1: c.y - y1 * s - up }
  }
  switch (look.held) {
    case 'balloon':
      boxes.push(at(0.22, 0.52, 1.28, 0.9))
      break
    case 'flag':
      boxes.push(at(0.3, 0.6, 0.9, 0.7))
      break
    case 'crumb':
    case 'leaf':
    case 'plush':
      boxes.push({ x0: c.x - 0.36 * s, y0: c.y - 1.1 * s - up, x1: c.x + 0.36 * s, y1: c.y - 0.84 * s - up })
      break
    case 'none':
    case 'tube':
      break
    default:
      boxes.push(at(0.24, 0.46, 0.86, 0.45))
  }
  return boxes
}

/** The critter under a world point: whoever is painted last there wins. */
export function critterAt(scene: Scene, x: number, y: number): Critter | null {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const c = scene.items[i].critter
    if (!c) continue
    const s = c.size
    const top = c.y - (0.9 + c.lift) * s
    const bottom = c.y - c.lift * s
    if (x > c.x - 0.36 * s && x < c.x + 0.36 * s && y > top && y < bottom) return c
  }
  return null
}

/**
 * Did a tap at this world point land on the Bug?
 *
 * Yes if he is what is painted there, or if the nearest face to the tap is his
 * and not far off — a thumb on a phone lands a few pixels wide, and his face
 * is never covered, so the forgiveness cannot hand anybody a false find.
 */
export function tapFindsTarget(scene: Scene, x: number, y: number): boolean {
  const t = scene.target
  if (critterAt(scene, x, y) === t) return true
  let best: Critter | null = null
  let bestD = Infinity
  for (const c of scene.critters) {
    const f = faceCentre(c)
    const d = Math.hypot(f.x - x, f.y - y)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best === t && bestD < t.size * 0.55
}

export function buildScene(
  kind: SceneKind,
  index: number,
  seed: number,
  aspect: number,
  wanted: WantedBug = CLASSIC,
): Scene {
  const rng = mulberry32(seed)
  const { w, h } = sceneSize(aspect)
  const spec = sceneSpec(index)
  const size = spec.size
  const cast = CASTS[kind]

  let walkable: (x: number, y: number) => boolean = () => true
  let shoreY: ((x: number) => number) | null = null
  let wall = 0
  let horizon = 0

  if (kind === 'pond') {
    const phase = rng() * 6
    const base = h * range(rng, 0.36, 0.44)
    shoreY = (x: number) => base + Math.sin((x / w) * Math.PI * 2 + phase) * size * 1.2 + Math.sin((x / w) * Math.PI * 5 + phase * 2) * size * 0.4
    const sy = shoreY
    walkable = (x, y) => y < sy(x) - size * 0.1
  } else if (kind === 'arcade') {
    wall = h * 0.12
    walkable = (_x, y) => y > wall + size * 0.9
  } else if (kind === 'night') {
    horizon = h * 0.13
    walkable = (_x, y) => y > horizon + size * 0.9
  }

  const L = new Layout(w, h, rng, size, cast, walkable)

  let built: Built
  if (kind === 'picnic') built = buildPicnic(L)
  else if (kind === 'garden') built = buildGarden(L)
  else if (kind === 'pond') built = buildPond(L, shoreY!)
  else if (kind === 'arcade') built = buildArcade(L, wall)
  else built = buildNight(L, horizon)

  // Swimmers in the pond: rings round their middles, in water nobody walks on.
  // The water is most of the picture, so it takes a good share of the crowd,
  // or the beach packs solid and the pond sits empty.
  if (kind === 'pond' && shoreY) {
    const sy = shoreY
    let land = 0
    for (let k = 0; k <= 20; k++) land += sy((k / 20) * w) / h
    land /= 21
    const want = Math.round(spec.crowd * (1 - land) * 0.5)
    let swimmers = 0
    for (let tries = 0; tries < want * 40 && swimmers < want; tries++) {
      const x = range(rng, 0.05, 0.95) * w
      const y = range(rng, 0.05, 0.98) * h
      if (y < sy(x) + size * 0.9 || y > h - size * 0.2) continue
      if (L.critters.some((c) => Math.hypot(c.x - x, (c.y - y) * 1.2) < size * 0.8)) continue
      if ((built.ground.kind === 'pond' ? built.ground.pads : []).some((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) < p.r + size * 0.4)) continue
      const look = randomLook(rng, cast, rng() < 0.7 ? 'beetle' : 'ant')
      L.addCritter(x, y, { ...look, held: 'tube', heldColour: rng() < 0.5 ? RED : pick(rng, BRIGHT) }, { pose: 'wave' })
      swimmers++
    }
  }

  // The rest of the crowd, as dense as the room allows.
  const already = L.critters.length
  const room = w * h * 0.7
  const gap = Math.max(size * 0.62, Math.sqrt(room / spec.crowd) * 0.82)
  L.fillCrowd(Math.max(0, spec.crowd - already), gap)
  if (L.critters.length < spec.crowd) L.fillCrowd(spec.crowd - L.critters.length, size * 0.6)

  const items: Item[] = [
    ...L.props.map((prop) => ({ z: prop.z, prop })),
    ...L.critters.map((critter) => ({ z: critter.z, critter })),
  ]
  items.sort((a, b) => a.z - b.z)

  // Pick his spot: a grounded biped, clear of the edges, face in view.
  const margin = size * 0.9
  const candidates = L.critters.filter((c) => {
    if (c.lift > 0 || c.look.held === 'tube') return false
    const sp = c.look.species
    if (sp !== 'beetle' && sp !== 'ant' && sp !== 'bee' && sp !== 'grasshopper') return false
    if (c.x < margin || c.x > w - margin || c.y < size * 1.4 || c.y > h - size * 0.15) return false
    if (kind === 'arcade' && c.y < wall + size * 1.2) return false
    if (kind === 'night' && c.y < horizon + size * 1.2) return false
    return true
  })

  // Later scenes prefer a spot where something stands in front of his body.
  const tucked = spec.tuck
    ? candidates.filter((c) => {
        const body: Rect = { x0: c.x - c.size * 0.25, y0: c.y - c.size * 0.45, x1: c.x + c.size * 0.25, y1: c.y }
        return items.some(
          (it) => it.z > c.z && it.prop && !isLowProp(it.prop.kind) && propOccluders(it.prop).some((b) => boxesOverlap(body, b)),
        )
      })
    : []

  const shuffle = <T,>(list: T[]) => list.map((v) => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map((e) => e.v)
  const order = [...(tucked.length && rng() < 0.7 ? shuffle(tucked) : []), ...shuffle(candidates)]
  const garlands = built.garlands ?? []
  let target: Critter | null = null
  for (const c of order) {
    if (garlandCrosses(faceBox(c), garlands, size)) continue
    const blocking = faceHiddenBy(c, items)
    if (blocking.some((b) => b.prop)) continue
    // Critters in front of his face step out of the picture.
    for (const b of blocking) {
      const i = items.indexOf(b)
      if (i >= 0) items.splice(i, 1)
      const j = L.critters.indexOf(b.critter!)
      if (j >= 0) L.critters.splice(j, 1)
    }
    target = c
    break
  }
  if (!target) target = candidates[0] ?? L.critters[0]

  target.look = { ...wanted.look }
  if (target.pose === 'carry' || target.pose === 'hold') target.pose = 'wave'
  if (target.pose === 'sit' && rng() < 0.5) target.pose = 'stand'
  target.mood = rng() < 0.7 ? 'smile' : 'open'
  target.facing = rng() < 0.6 ? 0 : 1

  // Now the look-alikes, taken from the crowd well away from him.
  // Flyers and carriers keep their looks: a snail in the air, or arms up round
  // a crumb that is no longer there, would give the game away for nothing.
  const others = L.critters.filter(
    (c) =>
      c !== target &&
      c.lift === 0 &&
      c.pose !== 'carry' &&
      c.look.held !== 'tube' &&
      Math.hypot(c.x - target!.x, c.y - target!.y) > size * 2.5,
  )
  const shuffled = shuffle(others)
  let at = 0
  const take = (n: number, make: (c: Critter) => Look | null) => {
    let done = 0
    while (done < n && at < shuffled.length) {
      const c = shuffled[at++]
      const look = make(c)
      if (!look) continue
      c.look = look
      done++
    }
  }
  const bipeds = (c: Critter) => c.look.species === 'beetle' || c.look.species === 'ant' || c.look.species === 'bee' || c.look.species === 'grasshopper'
  take(spec.twins, (c) => (bipeds(c) ? twinOf(rng, index, wanted) : null))
  take(spec.stripes, () => shellStranger(rng, cast, wanted))
  take(spec.hats, (c) => (c.look.species === 'snail' ? null : hatStranger(rng, cast, wanted)))
  for (const c of L.critters) {
    if (c === target) continue
    const sp = c.look.species
    if (sp === 'snail' || sp === 'spider') continue
    if (c.look.glasses === 'none' && rng() < spec.glasses) c.look = { ...c.look, glasses: wanted.look.glasses }
    // Nobody else gets all of it.
    if (wearsAllOf(c.look, wanted)) c.look = { ...c.look, glasses: 'none' }
  }

  return {
    kind,
    index,
    w,
    h,
    unit: size,
    ground: built.ground,
    decals: L.decals,
    items,
    critters: L.critters,
    target,
    wanted,
    garlands: built.garlands ?? [],
    lights: built.lights ?? [],
    dusk: built.dusk ?? 0,
  }
}
