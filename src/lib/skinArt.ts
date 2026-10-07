import { FROST, SPACE } from './seasonArt'

/*
 * The season skins' drawings, kept once for both places a skin shows: its picture on the pass (RewardArt, as
 * SVG) and the game, where the player flies in it (on the game's canvas). Each is a list of shapes on a
 * 100-wide board, nose up, in SVG path data; a game scales and turns the board onto its own ship, so the
 * picture and the ship can't drift apart. Ramsey found them apart (2026-10-02): the pictures had been drawn
 * first and the games had only repainted their own ships.
 *
 * Only the look: each game still measures its ship as it always has, so a skin never changes a hitbox.
 */

export type ArtShape = {
  d: string
  fill?: string
  stroke?: string
  width?: number
  cap?: 'round' | 'butt'
  join?: 'round' | 'miter'
  alpha?: number
}

export type SkinArt = {
  /** The ship. */
  body: ArtShape[]
  /** Its engine's flame, drawn under the ship: always in the picture, in a game only while the engine burns. */
  flame: ArtShape[]
  /** The colours its game burns its engine in, outer and core, to match the picture; the games' orange without. */
  burn?: SkinBurn
}

export type SkinBurn = { outer: readonly [number, number, number]; core: readonly [number, number, number] }

/** A burn's colour as CSS, at an opacity. */
export function burnColor(rgb: readonly [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

export const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

export const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`

/**
 * The Moonhopper, Lander's: a domed lander on red legs. On Lander's hull its feet are the hull's feet and its
 * dome the nose, so everything the cave can touch (nose, shoulders, feet, the notch) is on the drawing.
 */
export const MOONHOPPER: SkinArt = {
  flame: [
    { d: 'M42 68L50 92L58 68z', fill: SPACE.orange },
    { d: 'M45 68L50 82L55 68z', fill: SPACE.amber },
  ],
  body: [
    { d: 'M50 20V8', stroke: SPACE.muted, width: 2 },
    { d: circle(50, 7, 3), fill: SPACE.red },
    { d: 'M36 66L24 84M64 66L76 84', stroke: SPACE.red, width: 4, cap: 'round' },
    { d: 'M18 86h12M70 86h12', stroke: SPACE.red, width: 4, cap: 'round' },
    { d: roundRect(28, 54, 44, 14, 4), fill: SPACE.red },
    { d: circle(50, 40, 20), fill: SPACE.star },
    { d: 'M31 46A20 20 0 0 0 69 46z', fill: '#d9d4f0' },
    { d: roundRect(39, 30, 22, 12, 6), fill: '#0b0f1a' },
    { d: roundRect(43, 32.5, 6, 3, 1.5), fill: '#5fe0c8' },
  ],
}

/** The Comet, Asteroids': an amber arrow with a dark heart. */
export const COMET_SHIP: SkinArt = {
  flame: [
    { d: 'M42 76L50 96L58 76z', fill: SPACE.orange },
    { d: 'M46 76L50 88L54 76z', fill: SPACE.amber },
  ],
  body: [
    { d: 'M50 12L74 84L50 72L26 84Z', fill: SPACE.amber, stroke: '#7a4e00', width: 2.5, join: 'round' },
    { d: 'M50 30L58 58L50 54L42 58z', fill: SPACE.night },
  ],
}

/** The Nova fighter, Barrage's: star white, swept wings, a teal canopy and violet wingtip lights. */
export const NOVA_FIGHTER: SkinArt = {
  flame: [{ d: 'M44 80L50 94L56 80z', fill: SPACE.orange }],
  body: [
    { d: 'M50 10L62 50L82 68L62 68L58 80L42 80L38 68L18 68L38 50Z', fill: SPACE.star, stroke: SPACE.violet, width: 2.5, join: 'round' },
    { d: 'M45 46a5 10 0 1 0 10 0a5 10 0 1 0 -10 0z', fill: '#2eb8a0' },
    { d: circle(28, 64, 3), fill: SPACE.violet },
    { d: circle(72, 64, 3), fill: SPACE.violet },
  ],
}

/** The Shuttle, Asteroids' (Season 1's Pass+): an orbiter seen from above, black nose and wing edges. */
export const SHUTTLE: SkinArt = {
  flame: [
    { d: 'M43 86L46 98L49 86z', fill: SPACE.orange },
    { d: 'M51 86L54 98L57 86z', fill: SPACE.orange },
    { d: 'M47 86L50 100L53 86z', fill: SPACE.amber },
  ],
  body: [
    {
      d: 'M50 9C55 12 57 20 57 28L58 50L81 74L81 82L58 82L56 86L44 86L42 82L19 82L19 74L42 50L43 28C43 20 45 12 50 9Z',
      fill: SPACE.star,
      stroke: '#2a3352',
      width: 2,
      join: 'round',
    },
    { d: 'M42.5 50L19 74L19 77.5L43.5 53.5Z', fill: '#1a2233' },
    { d: 'M57.5 50L81 74L81 77.5L56.5 53.5Z', fill: '#1a2233' },
    { d: 'M50 9C53.5 11 55.5 15 56.3 20L43.7 20C44.5 15 46.5 11 50 9Z', fill: '#1a2233' },
    { d: 'M45 23L55 23L54 27L46 27Z', fill: '#1a2233' },
    { d: 'M46.5 32V70M53.5 32V70', stroke: '#b9b6d4', width: 1.5 },
    { d: 'M28 79.5h13M59 79.5h13', stroke: SPACE.orange, width: 2, cap: 'round' },
    { d: 'M50 66V84', stroke: '#2a3352', width: 2, cap: 'round' },
    { d: circle(45.5, 87, 2.2), fill: '#3a4160' },
    { d: circle(54.5, 87, 2.2), fill: '#3a4160' },
    { d: circle(50, 88, 2.2), fill: '#3a4160' },
  ],
}

/**
 * The Eagle, Lander's (Season 1's Pass+): a moon lander of the old kind, its descent stage in foil, a cabin
 * with triangle windows on top, legs splayed to round pads. On Lander's hull as the Moonhopper is: its feet on
 * the hull's feet, so every point of the hull the cave can touch is on the drawing.
 */
export const EAGLE: SkinArt = {
  flame: [
    { d: 'M44 74L50 94L56 74z', fill: SPACE.orange },
    { d: 'M46.5 74L50 86L53.5 74z', fill: SPACE.amber },
  ],
  body: [
    { d: 'M32 64L23 84M68 64L77 84', stroke: '#8f96b8', width: 3, cap: 'round' },
    { d: 'M37 70L25 84M63 70L75 84', stroke: '#8f96b8', width: 2, cap: 'round' },
    { d: 'M18 86a6 2.2 0 1 0 12 0a6 2.2 0 1 0 -12 0zM70 86a6 2.2 0 1 0 12 0a6 2.2 0 1 0 -12 0z', fill: '#c9cde0' },
    { d: 'M30 56L34 52H66L70 56V68L66 72H34L30 68Z', fill: SPACE.amber, stroke: SPACE.brass, width: 2, join: 'round' },
    { d: 'M38 56L36 70M48 54L49 71M60 55L62 70', stroke: SPACE.brass, width: 1, alpha: 0.7 },
    { d: 'M45 72H55L57 76H43Z', fill: '#3a4160' },
    { d: 'M36 52L37 38L42 28H58L63 38L64 52Z', fill: '#e3e1ef', stroke: '#8f96b8', width: 2, join: 'round' },
    { d: 'M42.5 32.5H48.5V39.5ZM57.5 32.5H51.5V39.5Z', fill: SPACE.night },
    { d: roundRect(46, 23, 8, 5, 1), fill: '#c9cde0', stroke: '#8f96b8', width: 1 },
    { d: 'M62 32L69 26.5', stroke: '#8f96b8', width: 1.5 },
    { d: circle(71, 25, 3.5), fill: '#e3e1ef', stroke: '#8f96b8', width: 1 },
    { d: 'M33 39h4v4h-4zM63 39h4v4h-4z', fill: SPACE.red },
  ],
}

/** The Ringship, Barrage's (Season 1's Pass+): a round ship in a ring of light, a teal canopy and a nose gun. */
export const RINGSHIP: SkinArt = {
  flame: [{ d: 'M45 70L50 88L55 70z', fill: SPACE.orange }],
  body: [
    // The far side of the ring, behind the hull, then the hull, then the near side over it.
    { d: 'M18 56A32 9 0 0 1 82 56', stroke: SPACE.amber, width: 3.5, alpha: 0.8 },
    { d: circle(24, 60, 5), fill: SPACE.violet, stroke: '#5a3fa6', width: 1.5 },
    { d: circle(76, 60, 5), fill: SPACE.violet, stroke: '#5a3fa6', width: 1.5 },
    { d: 'M47 37L50 22L53 37Z', fill: SPACE.violet, stroke: '#5a3fa6', width: 1, join: 'round' },
    { d: circle(50, 52, 16), fill: SPACE.star, stroke: SPACE.violet, width: 2.5 },
    { d: circle(50, 50, 7), fill: '#2eb8a0' },
    { d: circle(47.8, 47.8, 2), fill: '#ffffff', alpha: 0.75 },
    { d: 'M18 56A32 9 0 0 0 82 56', stroke: SPACE.orange, width: 3.5 },
    { d: circle(18, 56, 2.4), fill: SPACE.amber },
    { d: circle(82, 56, 2.4), fill: SPACE.amber },
  ],
}

/** The Orbiter, Asteroids' (Season 1's Pass+, bonus level): a silver starfighter, swept wings, a teal canopy. */
export const ORBITER: SkinArt = {
  flame: [{ d: 'M42 86L45 98L48 86zM52 86L55 98L58 86z', fill: '#7fc8ff' }],
  body: [
    { d: 'M50 8L57 34L60 56L84 70L84 80L60 76L56 86L44 86L40 76L16 80L16 70L40 56L43 34Z', fill: '#c9d3ea', stroke: '#2a3352', width: 2, join: 'round' },
    { d: 'M50 18L54 34L50 38L46 34Z', fill: '#2eb8a0' },
    { d: 'M44 46H56M43 52H57', stroke: SPACE.indigo, width: 2.5 },
    { d: 'M17 73h7M76 73h7', stroke: SPACE.orange, width: 2.5, cap: 'round' },
    { d: circle(45, 86, 2.5), fill: '#7fc8ff' },
    { d: circle(55, 86, 2.5), fill: '#7fc8ff' },
  ],
}

/**
 * The Starhopper, Lander's (Season 1's Pass+, bonus level): a tall steel rocket standing on its legs, red fins.
 * Its feet on the hull's feet as every Lander skin's are, its nose over the hull's.
 */
export const STARHOPPER: SkinArt = {
  flame: [
    { d: 'M44 74L50 94L56 74z', fill: SPACE.orange },
    { d: 'M46.5 74L50 86L53.5 74z', fill: SPACE.amber },
  ],
  body: [
    { d: 'M41 64L25 85M59 64L75 85', stroke: '#8f96b8', width: 3, cap: 'round' },
    { d: 'M19 86a5 2 0 1 0 10 0a5 2 0 1 0 -10 0zM71 86a5 2 0 1 0 10 0a5 2 0 1 0 -10 0z', fill: '#c9cde0' },
    { d: 'M38 50L29 70H38ZM62 50L71 70H62Z', fill: SPACE.red },
    { d: 'M38 70V30C38 20 43 13 50 9C57 13 62 20 62 30V70Z', fill: '#d9dde8', stroke: '#8f96b8', width: 2, join: 'round' },
    { d: 'M38 40H62M38 55H62', stroke: '#aab0c8', width: 1 },
    { d: circle(50, 26, 3.5), fill: SPACE.night },
    { d: 'M44 70H56L58 74H42Z', fill: '#3a4160' },
  ],
}

/** The Stingray, Barrage's (Season 1's Pass+): a dark manta-winged fighter edged in teal. */
export const STINGRAY: SkinArt = {
  flame: [
    { d: 'M46 76L50 92L54 76z', fill: SPACE.orange },
    { d: 'M48 76L50 86L52 76z', fill: SPACE.amber },
  ],
  body: [
    {
      d: 'M50 12C56 22 60 34 64 44C74 48 86 54 90 62C80 64 70 64 62 66L56 72L50 80L44 72L38 66C30 64 20 64 10 62C14 54 26 48 36 44C40 34 44 22 50 12Z',
      fill: '#1f2a66',
      stroke: '#5fe0c8',
      width: 2.5,
      join: 'round',
    },
    { d: 'M36 50L22 60M64 50L78 60', stroke: '#5fe0c8', width: 1.5, alpha: 0.6 },
    { d: 'M46 40a4 9 0 1 0 8 0a4 9 0 1 0 -8 0z', fill: '#5fe0c8' },
    { d: circle(12, 62, 2.5), fill: SPACE.orange },
    { d: circle(88, 62, 2.5), fill: SPACE.orange },
  ],
}

/*
 * The Hangar's (lib/skins.ts HANGAR_SKINS): skins for good, traded for tickets. Not space: the arcade's own
 * looks, so a season's skins stay the season's.
 */

/** The Gold Lander, Lander's: a moon lander of the old school, a gold foil stage on four legs, a grey cabin. */
export const GOLD_LANDER: SkinArt = {
  flame: [
    { d: 'M43 70L50 94L57 70z', fill: '#ff9a3c' },
    { d: 'M46 70L50 84L54 70z', fill: '#ffe08a' },
  ],
  body: [
    { d: 'M36 64L24 84M64 64L76 84M42 66L36 84M58 66L64 84', stroke: '#c9a227', width: 3.5, cap: 'round' },
    { d: 'M18 86h12M70 86h12', stroke: '#c9a227', width: 4, cap: 'round' },
    { d: 'M28 50L34 44H66L72 50V64L66 70H34L28 64Z', fill: '#e8b23a', stroke: '#8a6510', width: 2, join: 'round' },
    { d: 'M34 52H66M34 58H66', stroke: '#fff1b8', width: 1.5, alpha: 0.7 },
    { d: 'M36 44L40 24H60L64 44Z', fill: '#c7ccd6', stroke: '#5b6270', width: 2, join: 'round' },
    { d: roundRect(44, 28, 12, 9, 2), fill: '#1b2230' },
    { d: 'M50 24V12', stroke: '#5b6270', width: 2 },
    { d: circle(50, 10, 2.5), fill: '#e8b23a' },
  ],
}

/** The Retro Wedge, Asteroids': the old vector arcade's arrow, a green outline glowing on the dark. */
export const RETRO_WEDGE: SkinArt = {
  flame: [{ d: 'M42 76L50 94L58 76', stroke: '#7cf29a', width: 3, join: 'round' }],
  body: [
    { d: 'M50 12L74 84L50 72L26 84Z', stroke: '#7cf29a', width: 7, join: 'round', alpha: 0.25 },
    { d: 'M50 12L74 84L50 72L26 84Z', fill: '#06120a', stroke: '#7cf29a', width: 3, join: 'round' },
  ],
}

/** The Paper Plane, Barrage's: a folded white plane with a ruled-paper crease and a red tip. */
export const PAPER_PLANE: SkinArt = {
  flame: [{ d: 'M45 78L50 92L55 78z', fill: '#ff9a3c' }],
  body: [
    { d: 'M50 10L86 74L54 66L50 80L46 66L14 74Z', fill: '#f7f4ea', stroke: '#9aa3b5', width: 2, join: 'round' },
    { d: 'M50 10L50 80', stroke: '#9aa3b5', width: 1.5 },
    { d: 'M50 10L46 66M50 10L54 66', stroke: '#c9cfdb', width: 1.2 },
    { d: 'M24 70L76 70', stroke: '#7fb2e5', width: 1, alpha: 0.6 },
    { d: 'M50 10L47 18H53Z', fill: '#e8564f' },
  ],
}

export type RGB = [number, number, number]

/**
 * A Snake skin drawn as beads (Snake draws its body this way for one): a head in a glow, then a trail of
 * beads that shrink and fade through its colours. `bead(t)`: `t` is how far down the body a bead is, 0 at
 * the head to 1 at the tip of the tail.
 */
export type SnakeTail = {
  /** The head's radius, and its glow's, as parts of a bead's spacing. */
  head: number
  glow: number
  headFill: RGB
  headRing: RGB
  glowColor: RGB
  eyes: string
  /** A planet's ring across the head, tilted, when it has one. */
  planetRing?: RGB
  bead(t: number): { r: number; alpha: number; rgb: RGB }
}

function snakeTail(look: { headFill: RGB; headRing: RGB; glowColor: RGB; eyes: string; planetRing?: RGB; stops: readonly [RGB, RGB, RGB] }): SnakeTail {
  return {
    head: 0.75,
    glow: 1.25,
    headFill: look.headFill,
    headRing: look.headRing,
    glowColor: look.glowColor,
    eyes: look.eyes,
    ...(look.planetRing ? { planetRing: look.planetRing } : {}),
    bead(t) {
      const k = Math.min(1, Math.max(0, t))
      const [a, b, c] = look.stops
      const [from, to, u] = k < 0.5 ? [a, b, k * 2] : [b, c, k * 2 - 1]
      return {
        r: 0.57 - 0.29 * k,
        alpha: 1 - 0.55 * k,
        rgb: [0, 1, 2].map((i) => Math.round(from[i]! + (to[i]! - from[i]!) * u)) as RGB,
      }
    },
  }
}

/** The Saturn tail, Snake's (Season 1's Pass+): a pale gold planet of a head in its ring, beads to rust and dusk violet. */
export const SATURN_TAIL = snakeTail({
  headFill: [240, 217, 160],
  headRing: [214, 160, 90],
  glowColor: [245, 200, 120],
  eyes: SPACE.night,
  planetRing: [245, 185, 66],
  stops: [
    [248, 214, 140],
    [240, 150, 80],
    [184, 128, 214],
  ],
})

/*
 * Season 2's (Cold Snap, Northern Lights: Ramsey picked A, 2026-10-06). They burn teal, green or violet in
 * their games, as their pictures do (`burn`).
 */

const TEAL_BURN: SkinBurn = { outer: [51, 198, 214], core: [200, 255, 240] }
const GREEN_BURN: SkinBurn = { outer: [92, 242, 176], core: [216, 255, 242] }
const VIOLET_BURN: SkinBurn = { outer: [155, 123, 255], core: [240, 234, 255] }

/**
 * The Ice Breaker, Lander's: a polar lander in snow white with a navy band of green lights, a cab with a dark
 * visor and snow on its roof. Its feet on the hull's feet, its cab over the hull's nose, as every Lander skin's.
 */
export const ICE_BREAKER: SkinArt = {
  burn: TEAL_BURN,
  flame: [
    { d: 'M42 70L50 92L58 70z', fill: FROST.teal },
    { d: 'M45 70L50 84L55 70z', fill: '#c8fff0' },
  ],
  body: [
    { d: 'M38 64L24 84M62 64L76 84', stroke: FROST.muted, width: 4, cap: 'round' },
    { d: 'M18 86h12M70 86h12', stroke: FROST.muted, width: 4, cap: 'round' },
    { d: 'M44 66H56L58 72H42Z', fill: FROST.line },
    { d: 'M30 46H70L74 66H26Z', fill: FROST.snow, stroke: FROST.line, width: 2, join: 'round' },
    { d: 'M28.6 57H71.4L72.5 62H27.5Z', fill: FROST.panel },
    { d: circle(36, 59.5, 1.6) + circle(50, 59.5, 1.6) + circle(64, 59.5, 1.6), fill: FROST.green },
    { d: 'M33 66L34.5 71L36 66ZM64 66L65.5 70L67 66Z', fill: FROST.ice },
    { d: 'M36 46C36 30 42 22 50 22C58 22 64 30 64 46Z', fill: FROST.snow, stroke: FROST.line, width: 2, join: 'round' },
    { d: 'M41 39C41 33 45 30 50 30C55 30 59 33 59 39Z', fill: FROST.night },
    { d: 'M44 36C45 33.5 47 32.5 50 32.5', stroke: FROST.green, width: 2, cap: 'round' },
    { d: 'M38 30C40 23 46 20 50 20C54 20 60 23 62 30C59 28.5 57 31 54 29.5C52 28.5 49 31.5 46 29.5C43 28 41 31 38 30Z', fill: '#ffffff', stroke: FROST.ice, width: 1 },
  ],
}

/** The Icicle, Asteroids': a long icicle of a ship on navy wings, an aurora-green heart, green wingtips. */
export const ICICLE: SkinArt = {
  burn: GREEN_BURN,
  flame: [
    { d: 'M43 80L50 98L57 80z', fill: FROST.green },
    { d: 'M46.5 80L50 91L53.5 80z', fill: '#d8fff2' },
  ],
  body: [
    { d: 'M50 40L76 82L56 76L50 84L44 76L24 82Z', fill: FROST.line, stroke: FROST.ice, width: 2, join: 'round' },
    { d: 'M50 10L58 40L56 76L50 84L44 76L42 40Z', fill: FROST.snow, stroke: FROST.ice, width: 2, join: 'round' },
    { d: 'M50 10L58 40L56 76L50 84Z', fill: FROST.ice, alpha: 0.55 },
    { d: 'M50 34L53 48L50 62L47 48Z', fill: FROST.green },
    { d: 'M25 81.5L31 78.5M75 81.5L69 78.5', stroke: FROST.green, width: 2.5, cap: 'round' },
  ],
}

/** The Snowbird, Barrage's: a white bird of a fighter, wings swept like feathers, a dark canopy and green wingtips. */
export const SNOWBIRD: SkinArt = {
  burn: TEAL_BURN,
  flame: [{ d: 'M45 76L50 92L55 76z', fill: FROST.teal }],
  body: [
    { d: 'M50 30C58 40 70 46 88 50C80 58 66 60 58 62L56 76L44 76L42 62C34 60 20 58 12 50C30 46 42 40 50 30Z', fill: FROST.snow, stroke: FROST.line, width: 2, join: 'round' },
    { d: 'M20 52L36 54M80 52L64 54M28 56L40 57M72 56L60 57', stroke: FROST.line, width: 1.3, alpha: 0.6 },
    { d: 'M50 10C55 18 57 30 57 44L56 76H44L43 44C43 30 45 18 50 10Z', fill: FROST.ice, stroke: FROST.line, width: 2, join: 'round' },
    { d: 'M46 30a4 9 0 1 0 8 0a4 9 0 1 0 -8 0z', fill: FROST.night },
    { d: 'M48 26.5C48.6 24.5 49.4 23.6 50.6 23.4', stroke: FROST.green, width: 1.6, cap: 'round' },
    { d: circle(13, 50, 2.4) + circle(87, 50, 2.4), fill: FROST.green },
  ],
}

/** The Ice crystal, Asteroids' (Season 2's Pass+): a shard of clear ice with two smaller shards for fins, a green heart. */
export const ICE_CRYSTAL: SkinArt = {
  burn: GREEN_BURN,
  flame: [
    { d: 'M44 80L50 96L56 80z', fill: FROST.green },
    { d: 'M47 80L50 90L53 80z', fill: '#d8fff2' },
  ],
  body: [
    { d: 'M42 44L24 66L30 74L42 62ZM58 44L76 66L70 74L58 62Z', fill: '#1d3f6e', stroke: FROST.ice, width: 1.8, join: 'round' },
    { d: 'M25 66.5L30 73.5M75 66.5L70 73.5', stroke: FROST.green, width: 2, cap: 'round' },
    { d: 'M50 10L60 26L60 70L50 82L40 70L40 26Z', fill: FROST.ice, stroke: FROST.snow, width: 2, join: 'round' },
    { d: 'M50 10L40 26L40 70L50 82Z', fill: FROST.snow, alpha: 0.7 },
    { d: 'M40 26H60M40 70H60M50 10V82', stroke: '#9fd4f7', width: 1 },
    { d: 'M50 36L55 46L50 56L45 46Z', fill: FROST.green },
  ],
}

/** The North Star, Asteroids' (Season 2's Pass+): a four-pointed star, its long point the nose, violet at its heart. */
export const NORTH_STAR: SkinArt = {
  burn: VIOLET_BURN,
  flame: [
    { d: 'M46 84L50 98L54 84z', fill: FROST.violet },
    { d: 'M48 84L50 92L52 84z', fill: '#ffffff' },
  ],
  body: [
    { d: 'M50 8L56 42L80 50L56 58L52 84H48L44 58L20 50L44 42Z', fill: FROST.snow, stroke: FROST.violet, width: 2, join: 'round' },
    { d: 'M50 22L53 44L66 50L53 56L50 70L47 56L34 50L47 44Z', fill: '#c9b8ff' },
    { d: circle(50, 50, 4), fill: FROST.green },
    { d: 'M21 50h5M74 50h5', stroke: FROST.green, width: 2, cap: 'round' },
  ],
}

/**
 * The Gondola, Lander's (Season 2's Pass+): a red-roofed ski-lift cabin on skids, hanging from its grip. The
 * hanger runs over the hull's nose, the cabin over its shoulders and notch, the skids on its feet.
 */
export const GONDOLA: SkinArt = {
  burn: TEAL_BURN,
  flame: [
    { d: 'M43 72L50 92L57 72z', fill: FROST.teal },
    { d: 'M46 72L50 84L54 72z', fill: '#c8fff0' },
  ],
  body: [
    { d: 'M36 70L24 84M64 70L76 84', stroke: FROST.muted, width: 3.5, cap: 'round' },
    { d: 'M16 86H32M68 86H84', stroke: FROST.muted, width: 3.5, cap: 'round' },
    { d: 'M50 28V10M50 10H58', stroke: FROST.muted, width: 2.5, cap: 'round' },
    { d: roundRect(46, 5, 12, 6, 2), fill: FROST.line },
    { d: 'M44 72H56L58 76H42Z', fill: FROST.line },
    { d: roundRect(30, 34, 40, 38, 5), fill: FROST.snow, stroke: FROST.line, width: 2 },
    { d: 'M29 35L36 27H64L71 35Z', fill: '#e8564f', stroke: '#9e2f2a', width: 1.5, join: 'round' },
    { d: roundRect(34, 39, 14, 15, 2) + roundRect(52, 39, 14, 15, 2), fill: FROST.night },
    { d: 'M36 51L46 41M54 51L64 41', stroke: FROST.green, width: 1.2, alpha: 0.6 },
    { d: 'M30 61H70', stroke: '#e8564f', width: 4 },
    { d: 'M50 56V72', stroke: FROST.line, width: 1.2 },
  ],
}

/** The Snowy owl, Barrage's (Season 2's Pass+): a white owl with its wings spread, amber eyes, flecked dark. */
export const SNOWY_OWL: SkinArt = {
  burn: TEAL_BURN,
  flame: [{ d: 'M46 76L50 90L54 76z', fill: FROST.teal }],
  body: [
    {
      d: 'M50 34C62 30 80 34 92 46C84 50 76 50 70 54C66 58 60 60 56 62L50 66L44 62C40 60 34 58 30 54C24 50 16 50 8 46C20 34 38 30 50 34Z',
      fill: FROST.snow,
      stroke: FROST.muted,
      width: 2,
      join: 'round',
    },
    { d: 'M80 44L88 47M74 46L82 50M20 44L12 47M26 46L18 50', stroke: FROST.muted, width: 1.6, cap: 'round' },
    { d: 'M50 10C60 10 64 20 64 32C64 50 58 68 50 80C42 68 36 50 36 32C36 20 40 10 50 10Z', fill: '#ffffff', stroke: FROST.muted, width: 2 },
    { d: circle(50, 24, 10), fill: '#f4f8ff' },
    { d: circle(45.5, 23, 3.4) + circle(54.5, 23, 3.4), fill: FROST.amber },
    { d: circle(45.5, 23, 1.6) + circle(54.5, 23, 1.6), fill: FROST.night },
    { d: 'M48.5 27L50 31L51.5 27Z', fill: FROST.line },
    { d: 'M46 40l2 1M54 44l-2 1M48 52l2 1M52 58l-2 1M44 48l2 1', stroke: FROST.line, width: 1.4, cap: 'round', alpha: 0.7 },
  ],
}

/** The Frost dragon, Barrage's (Season 2's Pass+, bonus level): a white dragon on navy wings lit aurora green, horns of ice. */
export const FROST_DRAGON: SkinArt = {
  burn: GREEN_BURN,
  flame: [
    { d: 'M45 74L50 94L55 74z', fill: FROST.green },
    { d: 'M47.5 74L50 86L52.5 74z', fill: '#e8fff6' },
  ],
  body: [
    { d: 'M50 34L90 26L82 42L88 52L72 56L62 62L56 74H44L38 62L28 56L12 52L18 42L10 26Z', fill: '#1d3f6e', stroke: FROST.ice, width: 2, join: 'round' },
    { d: 'M52 39L83 31L77 42L82 49L68 52M48 39L17 31L23 42L18 49L32 52', stroke: FROST.green, width: 1.6, alpha: 0.75, join: 'round' },
    { d: 'M50 36L90 26M50 36L10 26M56 48L88 52M44 48L12 52', stroke: FROST.ice, width: 1.6, cap: 'round' },
    { d: 'M45 16L40 7M55 16L60 7', stroke: FROST.ice, width: 2.2, cap: 'round' },
    { d: 'M50 10C55 14 58 22 57 32L58 60L56 74L50 80L44 74L42 60L43 32C42 22 45 14 50 10Z', fill: FROST.snow, stroke: FROST.line, width: 2, join: 'round' },
    { d: 'M50 28L52 32L50 36L48 32ZM50 40L52 44L50 48L48 44ZM50 52L52 56L50 60L48 56Z', fill: FROST.teal },
    { d: circle(46.5, 20, 1.7) + circle(53.5, 20, 1.7), fill: FROST.green },
  ],
}

/**
 * The Yeti, Lander's (Season 2's Pass+, bonus level): a shaggy white yeti in green snow goggles, stood on its
 * big feet. Its fur covers the hull's nose, shoulders and notch; its feet are the hull's feet.
 */
export const YETI: SkinArt = {
  burn: TEAL_BURN,
  flame: [
    { d: 'M43 72L50 94L57 72z', fill: FROST.teal },
    { d: 'M46 72L50 85L54 72z', fill: '#c8fff0' },
  ],
  body: [
    { d: 'M38 66L26 84M62 66L74 84', stroke: '#dfe9f5', width: 7, cap: 'round' },
    { d: 'M16 86a8 3.4 0 1 0 16 0a8 3.4 0 1 0 -16 0zM68 86a8 3.4 0 1 0 16 0a8 3.4 0 1 0 -16 0z', fill: '#8fa6c8' },
    { d: 'M44 68H56L58 74H42Z', fill: FROST.line },
    {
      d: 'M50 22Q53.7 19.1 56.5 23Q60.9 21.3 62.4 26Q67.2 25.7 67.4 30.6Q72 31.8 70.9 36.6Q75.1 39.1 72.8 43.4Q76.2 47 72.8 50.6Q75.1 54.9 70.9 57.4Q72 62.2 67.4 63.4Q67.2 68.3 62.4 68Q60.9 72.7 56.5 71Q53.7 74.9 50 72Q46.3 74.9 43.5 71Q39.1 72.7 37.6 68Q32.8 68.3 32.6 63.4Q28 62.2 29.1 57.4Q24.9 54.9 27.2 50.6Q23.8 47 27.2 43.4Q24.9 39.1 29.1 36.6Q28 31.8 32.6 30.6Q32.8 25.7 37.6 26Q39.1 21.3 43.5 23Q46.3 19.1 50 22Z',
      fill: '#ffffff',
      stroke: '#c9d8ea',
      width: 1.5,
      join: 'round',
    },
    { d: 'M37 44C37 36 43 33 50 33C57 33 63 36 63 44C63 54 57 58 50 58C43 58 37 54 37 44Z', fill: '#8aa0c4' },
    { d: 'M27 40H73', stroke: FROST.violet, width: 3 },
    { d: roundRect(37.5, 35, 11.5, 9, 4) + roundRect(51, 35, 11.5, 9, 4), fill: FROST.green, stroke: FROST.night, width: 1.6 },
    { d: 'M40 37.5L44 37.5M53.5 37.5L57.5 37.5', stroke: '#ffffff', width: 1.4, cap: 'round', alpha: 0.85 },
    { d: 'M44 50Q50 54 56 50', stroke: FROST.night, width: 1.8, cap: 'round' },
    { d: 'M46 51L47 54L48 51.6ZM52 51.6L53 54L54 51Z', fill: '#ffffff' },
  ],
}

/** The Snowdrift tail, Snake's: a snow-white head in an aurora glow, beads cooling from snow to ice blue to teal. */
export const SNOWDRIFT_TAIL = snakeTail({
  headFill: [238, 247, 255],
  headRing: [51, 198, 214],
  glowColor: [92, 242, 176],
  eyes: FROST.night,
  stops: [
    [238, 247, 255],
    [150, 210, 250],
    [51, 198, 214],
  ],
})

/** The Candy Stripe tail, Snake's (the Hangar's): a white head, then beads in turn red and white, like a cane. */
export const CANDY_TAIL: SnakeTail = {
  head: 0.75,
  glow: 1.25,
  headFill: [255, 255, 255],
  headRing: [232, 64, 84],
  glowColor: [255, 120, 140],
  eyes: '#3a1018',
  bead(t) {
    const k = Math.min(1, Math.max(0, t))
    // Turn and turn about down the body: about fourteen beads to a long tail.
    const red = Math.floor(k * 14) % 2 === 0
    return { r: 0.57 - 0.29 * k, alpha: 1 - 0.45 * k, rgb: red ? [232, 64, 84] : [255, 246, 240] }
  },
}

/**
 * Snake's bead-tail skins, by id. The Blazing comet, Astro worm, Aurora serpent and Ice dragon are creatures of
 * their own instead (games/snake/skinBodies.ts), Ramsey's picks (2026-10-07): "the snakes need to be different".
 */
export const SNAKE_TAILS: Record<string, SnakeTail> = {
  'snake-saturn-tail': SATURN_TAIL,
  'snake-candy-stripe': CANDY_TAIL,
  'snake-snowdrift-tail': SNOWDRIFT_TAIL,
}

/** Asteroids' skins: the drawing, and where its nose and tail are on the board, to lay it along the hull. */
export const ASTEROIDS_ART: Record<string, { art: SkinArt; nose: number; tail: number }> = {
  'asteroids-comet': { art: COMET_SHIP, nose: 12, tail: 84 },
  'asteroids-shuttle': { art: SHUTTLE, nose: 9, tail: 86 },
  'asteroids-orbiter': { art: ORBITER, nose: 8, tail: 86 },
  'asteroids-retro': { art: RETRO_WEDGE, nose: 12, tail: 84 },
  'asteroids-icicle': { art: ICICLE, nose: 10, tail: 84 },
  'asteroids-ice-crystal': { art: ICE_CRYSTAL, nose: 10, tail: 82 },
  'asteroids-north-star': { art: NORTH_STAR, nose: 8, tail: 84 },
}

/** Lander's skins: feet 52 apart on the board's y 86, as the hull's are. */
export const LANDER_ART: Record<string, SkinArt> = {
  'lander-moonhopper': MOONHOPPER,
  'lander-eagle': EAGLE,
  'lander-starhopper': STARHOPPER,
  'lander-gold': GOLD_LANDER,
  'lander-icebreaker': ICE_BREAKER,
  'lander-gondola': GONDOLA,
  'lander-yeti': YETI,
}

/** Barrage's skins: nose at the board's y 10, tail at 80, as the usual ship is long. */
export const BARRAGE_ART: Record<string, SkinArt> = {
  'barrage-nova': NOVA_FIGHTER,
  'barrage-ringship': RINGSHIP,
  'barrage-stingray': STINGRAY,
  'barrage-paper-plane': PAPER_PLANE,
  'barrage-snowbird': SNOWBIRD,
  'barrage-snowy-owl': SNOWY_OWL,
  'barrage-frost-dragon': FROST_DRAGON,
}

const paths = new Map<string, Path2D>()

/**
 * Draws shapes from a skin's board on a canvas whose transform already puts the board where the ship is.
 * `minLine` keeps a line from thinning to nothing on a small ship, in board units.
 */
export function drawSkinArt(ctx: CanvasRenderingContext2D, shapes: readonly ArtShape[], minLine = 0) {
  const alpha = ctx.globalAlpha
  for (const s of shapes) {
    let path = paths.get(s.d)
    if (!path) {
      path = new Path2D(s.d)
      paths.set(s.d, path)
    }
    ctx.globalAlpha = alpha * (s.alpha ?? 1)
    if (s.fill) {
      ctx.fillStyle = s.fill
      ctx.fill(path)
    }
    if (s.stroke) {
      ctx.strokeStyle = s.stroke
      ctx.lineWidth = Math.max(s.width ?? 1, minLine)
      ctx.lineCap = s.cap ?? 'butt'
      ctx.lineJoin = s.join ?? 'miter'
      ctx.stroke(path)
    }
  }
  ctx.globalAlpha = alpha
}
