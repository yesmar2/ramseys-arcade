import type { Swatch } from '../../data/games'
/** The depths the old open-ocean Frenzy had: the species still say where they lived. */
type ZoneId = 'shallows' | 'twilight' | 'midnight' | 'abyss'

/*
 * Every fish in the ocean. A species is how a fish looks and how it behaves;
 * its level — the number on it, which decides who eats whom — is dealt
 * separately when it spawns, relative to yours. So a shark is always a shark,
 * but whether it is a threat or a meal depends on how big you have grown.
 */

export type SpeciesId =
  | 'sardine'
  | 'clownfish'
  | 'tang'
  | 'angelfish'
  | 'puffer'
  | 'lanternfish'
  | 'hatchetfish'
  | 'barracuda'
  | 'grouper'
  | 'shark'
  | 'swordfish'
  | 'anglerfish'
  | 'goldfish'

/**
 * - school: moves with its school, scatters when you come for it.
 * - solo: wanders, flees when you can eat it.
 * - chaser: notices you, telegraphs, lunges, tires.
 * - patroller: crosses the water fast in long straight runs; never chases.
 * - ambusher: waits in the dark behind a lure and strikes in a straight line.
 * - golden: a rare prize that is faster than you — catch it with a dash.
 */
export type Behavior = 'school' | 'solo' | 'chaser' | 'patroller' | 'ambusher' | 'golden'
export type Role = 'prey' | 'predator' | 'bonus'

export type TailKind = 'fork' | 'lunate' | 'round' | 'fan'
export type FinKind = 'none' | 'small' | 'triangle' | 'sail' | 'long' | 'spiky' | 'double'
export type PatternKind =
  | 'none'
  | 'bands'
  | 'bars'
  | 'spots'
  | 'lateral'
  | 'swoosh'
  | 'mottled'
  | 'photophores'
export type MouthKind = 'small' | 'wide' | 'under' | 'jaws'

export type FishArt = {
  /** Visual body length ÷ collision radius. */
  length: number
  /** Body height ÷ body length. */
  height: number
  /** Half-thickness at u = 0, .1, .3, .55, .8, 1 along the body, nose to tail base. */
  profile: readonly [number, number, number, number, number, number]
  tail: TailKind
  /** Tail length ÷ body height. */
  tailSize: number
  dorsal: FinKind
  /** Dorsal height ÷ body height. */
  dorsalSize: number
  /** A matching fin underneath (tall-bodied reef fish). */
  anal: boolean
  pattern: PatternKind
  /** Eye radius ÷ body height. */
  eye: number
  mouth: MouthKind
  /** Swordfish bill length ÷ body length. */
  bill?: number
  /** Anglerfish lure colour. */
  lure?: string
  gills?: boolean
  /** Photophores and golden shimmer glow this colour in the dark. */
  glow?: string
  /** The palette colour the whole fish is drawn in. */
  swatch: Swatch
  /** A tail in a second palette colour, when the fish is known by it. */
  tailSwatch?: Swatch
}

export type Species = {
  id: SpeciesId
  /** Used in "Eaten by a …". */
  name: string
  role: Role
  behavior: Behavior
  zones: readonly ZoneId[]
  /** Relative odds among the species that could spawn in the same spot. */
  weight: number
  /** Top speed ÷ the player's. Prey stays under 1 so it can always be caught. */
  speed: number
  /** Tail beats per second at cruise. */
  swimRate: number
  art: FishArt
}

const SHALLOW_AND_TWILIGHT: readonly ZoneId[] = ['shallows', 'twilight']
const DEEP: readonly ZoneId[] = ['midnight', 'abyss']

export const SPECIES: Record<SpeciesId, Species> = {
  sardine: {
    id: 'sardine',
    name: 'sardine',
    role: 'prey',
    behavior: 'school',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 1,
    speed: 0.92,
    swimRate: 3.4,
    art: {
      length: 2.5,
      height: 0.25,
      profile: [0.25, 0.75, 1, 0.88, 0.48, 0.2],
      tail: 'fork',
      tailSize: 1.15,
      dorsal: 'small',
      dorsalSize: 0.4,
      anal: false,
      pattern: 'lateral',
      eye: 0.19,
      mouth: 'small',
      swatch: 'sky',
    },
  },
  clownfish: {
    id: 'clownfish',
    name: 'clownfish',
    role: 'prey',
    behavior: 'solo',
    zones: ['shallows'],
    weight: 3,
    speed: 0.82,
    swimRate: 2.8,
    art: {
      length: 2.2,
      height: 0.5,
      profile: [0.36, 0.8, 1, 0.94, 0.62, 0.4],
      tail: 'round',
      tailSize: 0.56,
      dorsal: 'double',
      dorsalSize: 0.42,
      anal: true,
      pattern: 'bands',
      eye: 0.14,
      mouth: 'small',
      swatch: 'orange',
    },
  },
  tang: {
    id: 'tang',
    name: 'tang',
    role: 'prey',
    behavior: 'solo',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 3,
    speed: 0.88,
    swimRate: 2.9,
    art: {
      length: 2.1,
      height: 0.58,
      profile: [0.3, 0.8, 1, 0.9, 0.5, 0.22],
      tail: 'lunate',
      tailSize: 0.78,
      dorsal: 'long',
      dorsalSize: 0.26,
      anal: true,
      pattern: 'swoosh',
      eye: 0.13,
      mouth: 'small',
      swatch: 'indigo',
      tailSwatch: 'amber',
    },
  },
  angelfish: {
    id: 'angelfish',
    name: 'angelfish',
    role: 'prey',
    behavior: 'solo',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 2,
    speed: 0.78,
    swimRate: 2.3,
    art: {
      length: 1.9,
      height: 0.82,
      profile: [0.34, 0.84, 1, 0.9, 0.5, 0.2],
      tail: 'round',
      tailSize: 0.6,
      dorsal: 'long',
      dorsalSize: 0.48,
      anal: true,
      pattern: 'bars',
      eye: 0.1,
      mouth: 'small',
      swatch: 'amber',
    },
  },
  puffer: {
    id: 'puffer',
    name: 'pufferfish',
    role: 'prey',
    behavior: 'solo',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 1.6,
    speed: 0.66,
    swimRate: 3.8,
    art: {
      length: 1.9,
      height: 0.66,
      profile: [0.46, 0.9, 1, 0.95, 0.62, 0.32],
      tail: 'round',
      tailSize: 0.55,
      dorsal: 'small',
      dorsalSize: 0.26,
      anal: false,
      pattern: 'spots',
      eye: 0.17,
      mouth: 'small',
      swatch: 'teal',
    },
  },
  lanternfish: {
    id: 'lanternfish',
    name: 'lanternfish',
    role: 'prey',
    behavior: 'school',
    zones: DEEP,
    weight: 1,
    speed: 0.92,
    swimRate: 3.4,
    art: {
      length: 2.3,
      height: 0.3,
      profile: [0.3, 0.8, 1, 0.85, 0.45, 0.2],
      tail: 'fork',
      tailSize: 1.0,
      dorsal: 'small',
      dorsalSize: 0.34,
      anal: false,
      pattern: 'photophores',
      eye: 0.26,
      mouth: 'small',
      glow: '#72f2ff',
      swatch: 'violet',
    },
  },
  hatchetfish: {
    id: 'hatchetfish',
    name: 'hatchetfish',
    role: 'prey',
    behavior: 'solo',
    zones: ['twilight', 'midnight', 'abyss'],
    weight: 2.6,
    speed: 0.84,
    swimRate: 3.1,
    art: {
      length: 1.7,
      height: 0.72,
      profile: [0.26, 0.62, 1, 0.8, 0.36, 0.18],
      tail: 'fork',
      tailSize: 0.72,
      dorsal: 'small',
      dorsalSize: 0.3,
      anal: false,
      pattern: 'photophores',
      eye: 0.2,
      mouth: 'small',
      glow: '#a8f6ff',
      swatch: 'sky',
    },
  },
  barracuda: {
    id: 'barracuda',
    name: 'barracuda',
    role: 'predator',
    behavior: 'patroller',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 2,
    speed: 1.06,
    swimRate: 2.4,
    art: {
      length: 3.0,
      height: 0.2,
      profile: [0.16, 0.6, 0.9, 1, 0.7, 0.26],
      tail: 'fork',
      tailSize: 1.15,
      dorsal: 'double',
      dorsalSize: 0.5,
      anal: false,
      pattern: 'bars',
      eye: 0.17,
      mouth: 'under',
      swatch: 'violet',
    },
  },
  grouper: {
    id: 'grouper',
    name: 'grouper',
    role: 'predator',
    behavior: 'chaser',
    zones: SHALLOW_AND_TWILIGHT,
    weight: 2,
    speed: 1,
    swimRate: 2.2,
    art: {
      length: 2.3,
      height: 0.45,
      profile: [0.42, 0.86, 1, 0.9, 0.55, 0.3],
      tail: 'round',
      tailSize: 0.7,
      dorsal: 'spiky',
      dorsalSize: 0.42,
      anal: true,
      pattern: 'mottled',
      eye: 0.12,
      mouth: 'wide',
      swatch: 'pink',
    },
  },
  shark: {
    id: 'shark',
    name: 'shark',
    role: 'predator',
    behavior: 'chaser',
    zones: ['twilight', 'midnight', 'abyss'],
    weight: 3,
    speed: 1.04,
    swimRate: 1.9,
    art: {
      length: 2.9,
      height: 0.28,
      profile: [0.1, 0.52, 0.9, 1, 0.55, 0.18],
      tail: 'lunate',
      tailSize: 1.3,
      dorsal: 'triangle',
      dorsalSize: 1.05,
      anal: false,
      pattern: 'none',
      eye: 0.1,
      mouth: 'under',
      gills: true,
      swatch: 'sky',
    },
  },
  swordfish: {
    id: 'swordfish',
    name: 'swordfish',
    role: 'predator',
    behavior: 'patroller',
    zones: ['twilight', 'midnight'],
    weight: 1.4,
    speed: 1.18,
    swimRate: 2.2,
    art: {
      length: 2.8,
      height: 0.24,
      profile: [0.1, 0.6, 0.95, 1, 0.55, 0.18],
      tail: 'lunate',
      tailSize: 1.25,
      dorsal: 'sail',
      dorsalSize: 1.25,
      anal: false,
      pattern: 'none',
      eye: 0.14,
      mouth: 'small',
      bill: 0.42,
      swatch: 'indigo',
    },
  },
  anglerfish: {
    id: 'anglerfish',
    name: 'anglerfish',
    role: 'predator',
    behavior: 'ambusher',
    zones: DEEP,
    weight: 2,
    speed: 0.62,
    swimRate: 1.6,
    art: {
      length: 2.0,
      height: 0.62,
      profile: [0.52, 0.96, 1, 0.9, 0.55, 0.25],
      tail: 'round',
      tailSize: 0.55,
      dorsal: 'small',
      dorsalSize: 0.2,
      anal: false,
      pattern: 'spots',
      eye: 0.08,
      mouth: 'jaws',
      lure: '#ffd66e',
      swatch: 'pink',
    },
  },
  goldfish: {
    id: 'goldfish',
    name: 'golden fish',
    role: 'bonus',
    behavior: 'golden',
    zones: ['shallows', 'twilight', 'midnight', 'abyss'],
    weight: 1,
    speed: 1.34,
    swimRate: 3.9,
    art: {
      length: 2.0,
      height: 0.5,
      profile: [0.36, 0.8, 1, 0.9, 0.5, 0.25],
      tail: 'fan',
      tailSize: 1.0,
      dorsal: 'long',
      dorsalSize: 0.46,
      anal: true,
      pattern: 'none',
      eye: 0.15,
      mouth: 'small',
      glow: '#ffe27a',
      swatch: 'amber',
    },
  },
}

/** The player: the arcade's magenta. */
const PLAYER_BASE: FishArt = {
  length: 2.2,
  height: 0.44,
  profile: [0.34, 0.82, 1, 0.9, 0.52, 0.24],
  tail: 'fork',
  tailSize: 1.0,
  dorsal: 'small',
  dorsalSize: 0.42,
  anal: false,
  pattern: 'lateral',
  eye: 0.17,
  mouth: 'small',
  swatch: 'magenta',
}

/**
 * You, at each size: a new shape every time you grow, always in the arcade's magenta (Ramsey, 2026-10-06:
 * "should the fish change when it evolves?"). Fry and Minnow are little darting fish; Darter grows a sail;
 * Hunter is long and lean with an underbite; Predator heavy with jaws; Brute carries a bill; Apex is a shark;
 * Leviathan a grander shark that glows.
 */
const PLAYER_LOOKS: readonly FishArt[] = [
  PLAYER_BASE,
  { ...PLAYER_BASE, dorsal: 'sail', dorsalSize: 0.62, tailSize: 1.1 },
  { ...PLAYER_BASE, height: 0.5, dorsal: 'long', dorsalSize: 0.66, tail: 'fan', tailSize: 1.1, anal: true },
  { ...SPECIES.barracuda.art, height: 0.24, swatch: 'magenta', tailSwatch: undefined },
  { ...SPECIES.grouper.art, swatch: 'magenta', tailSwatch: 'pink' },
  { ...SPECIES.swordfish.art, height: 0.3, swatch: 'magenta', tailSwatch: 'pink' },
  { ...SPECIES.shark.art, swatch: 'magenta', tailSwatch: 'pink' },
  { ...SPECIES.shark.art, height: 0.32, dorsalSize: (SPECIES.shark.art.dorsalSize ?? 0.5) * 1.25, tailSize: SPECIES.shark.art.tailSize * 1.15, swatch: 'magenta', tailSwatch: 'violet', glow: '#ffd2ff' },
]

export function playerArt(stage: number): FishArt {
  return PLAYER_LOOKS[Math.max(0, Math.min(PLAYER_LOOKS.length - 1, stage))]!
}

