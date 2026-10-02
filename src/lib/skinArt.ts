import { SPACE } from './seasonArt'

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

/**
 * The Comet tail, Snake's: a white head in an amber glow, then a trail of beads that shrink and fade from
 * amber to violet. `t` is how far down the body a bead is, 0 at the head to 1 at the tip of the tail.
 */
export const COMET_TAIL = {
  /** The head's radius, and its glow's, as parts of a bead's spacing. */
  head: 0.75,
  glow: 1.25,
  /** A bead's radius, as a part of the spacing, how see-through it is, and its colour. */
  bead(t: number): { r: number; alpha: number; rgb: [number, number, number] } {
    const k = Math.min(1, Math.max(0, t))
    // Amber to violet by way of a warm pink: straight across, the middle of the tail goes a muddy grey.
    const stops = [
      [245, 185, 66],
      [240, 112, 132],
      [138, 106, 212],
    ]
    const [from, to, u] = k < 0.5 ? [stops[0]!, stops[1]!, k * 2] : [stops[1]!, stops[2]!, k * 2 - 1]
    return {
      r: 0.57 - 0.29 * k,
      alpha: 1 - 0.55 * k,
      rgb: [0, 1, 2].map((i) => Math.round(from[i]! + (to[i]! - from[i]!) * u)) as [number, number, number],
    }
  },
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
