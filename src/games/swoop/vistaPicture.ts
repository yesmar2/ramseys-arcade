import { mixColor } from '../../lib/color'
import { SWALLOW, type BirdDesign, type Patch } from './birdDesigns'
import { FLOCK_HUES } from './flock'
import { GOLD, goldenHills } from './golden'
import { heightAt, mulberry32, slopeAt, type Hills } from './sim'
import { swiftColours, type SwiftColours } from './swiftPaint'
import { DECO, decoLook, layDecos, type DecoKind, type DecoLook } from './vistaProps'
import { moodFor, rangeLooks, type Mood, type RangeLook } from './vistaSky'

/*
 * Swoop's new look as a still picture, in SVG: the day's sky, the far country, the day's hills lit from the
 * sun's side with what grows on them, the swallow with its ribbon, the flock behind it and a kite on its gold
 * slope. Ramsey, 2026-11-18, once the new look was everyone's and the pictures round the site still showed the
 * old swift at dusk: shown three ways to redraw them, on the home page's own row and at their other sizes, he
 * picked "B, flock and kite": what's new to play for, on the hill the day's first kite is really on.
 *
 * It's drawn from what the game itself is drawn from, so it can't drift from it: the bird's shapes
 * (birdDesigns.ts) in its colours (swiftPaint.ts swiftColours), the day's sky and far ranges (vistaSky.ts
 * moodFor, rangeLooks), what grows where (vistaProps.ts layDecos, decoLook), the hills' colours as scene.ts has
 * them, and the kite as kite.ts paints it. The game paints those on a canvas (vista.ts); here they're marks.
 *
 * One string of SVG, as the other dailies' pictures are (sling/towerPicture.ts), for the site's cards
 * (HillsPostcard.tsx), the day's share card (scripts/today-cards.mjs, at build) and the small game picture
 * (components/GameArt.tsx, from the files scripts/swoop-art.mjs writes) alike. It follows the theme as the game
 * does: a day sky on the light theme, a night one on the dark; the share card, dark like the site by default,
 * has the night's. Nothing here needs a browser.
 *
 * The hills from before the new look's first day keep the picture they had (hillsPicture.ts), as they keep the
 * look they were flown in (newLook.ts).
 */

const TAU = Math.PI * 2
const n1 = (v: number) => String(Math.round(v * 10) / 10)
const n2 = (v: number) => String(Math.round(v * 100) / 100)
const n3 = (v: number) => String(Math.round(v * 1000) / 1000)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const deg = (rad: number) => (rad * 180) / Math.PI

/** Your bird's red (scene.ts RED), and how far over its foot a bird's middle is (birdShape.ts SWIFT_LIFT). */
const RED = '#e8564f'
const SWIFT_LIFT = 0.55
/** The kite's two golds, its amber line and its tail's bows (kite.ts). */
const KITE = { lit: '#ffe28c', deep: '#eda522', amber: '#8a5514', bows: ['#e85d9a', '#3ecf8e', '#8a6ad4'] } as const
/** Where each far range stands down the picture, how tall its ridge is, and how far it goes on under it (vista.ts). */
const RANGE_AMP = [0.27, 0.09, 0.085] as const
const RANGE_FOOT = [0.5, 0.585, 0.665] as const
const RANGE_UNDER = [0.15, 0.145, 0.1] as const
/** The slope that takes the light or the shade in full, and how deep they lie on it, in metres (vista.ts). */
const FULL_SLOPE = 0.45
const LIGHT_DEEP = 3

/** A colour given as rgba(r, g, b, a), as an SVG attribute takes it anywhere: the colour, and how much of it shows. */
function tint(rgba: string): { colour: string; alpha: number } {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba)
  return m ? { colour: `rgb(${m[1]},${m[2]},${m[3]})`, alpha: m[4] == null ? 1 : Number(m[4]) } : { colour: rgba, alpha: 1 }
}

/** The hills' own colours, as scene.ts paletteFor has them on each theme. */
function hillColours(hue: string, dark: boolean) {
  const ground = dark ? '#0e1230' : '#ffffff'
  return {
    body: dark ? mixColor(hue, ground, 0.45) : mixColor(hue, ground, 0.18),
    deep: dark ? mixColor(hue, ground, 0.72) : mixColor(hue, '#1a2b3c', 0.38),
    turf: dark ? mixColor(hue, '#ffffff', 0.12) : mixColor(hue, '#ffffff', 0.42),
    seam: dark ? mixColor(hue, ground, 0.62) : mixColor(hue, '#1a2b3c', 0.22),
    blip: dark ? mixColor(hue, '#ffffff', 0.3) : mixColor(hue, '#ffffff', 0.55),
    edge: dark ? mixColor(hue, '#ffffff', 0.5) : mixColor(hue, '#1a2b3c', 0.45),
    shine: dark ? 0.18 : 0.6,
    ink: dark ? '#e7eef3' : '#1a2b3c',
  }
}

/* ------------------------------------------------------------------ the bird --- */

type BirdPose = { px: number; py: number; turn: number; size: number; folded?: boolean; flap?: number; small?: boolean }

/**
 * A bird of a design, as swiftPaint.ts paintBird paints one: `px`, `py` its middle on the picture, `turn` how far
 * it's turned (degrees, clockwise), `size` a unit of its frame in pixels; `small` for one of the flock, without
 * the parts too fine to see.
 */
function birdMarks(design: BirdDesign, c: SwiftColours, { px, py, turn, size, folded = false, flap = 1.1, small = false }: BirdPose): string {
  const line = Math.max(1.5 / size, small ? 0.11 : 0.075)
  const stroke = c.line ? ` stroke="${c.line}" stroke-width="${n3(line)}" stroke-linejoin="round"` : ''
  const patches = (list: readonly Patch[]) =>
    list
      .filter((p) => !(small && p.fine))
      .map((p) => `<path d="${p.d}" fill="${c[p.tone]}"${p.alpha != null && p.alpha < 1 ? ` fill-opacity="${p.alpha}"` : ''}/>`)
      .join('')
  const beat = (f: number) => n1(deg((0.5 - 0.5 * Math.sin(f)) * design.beat))
  const [rx, ry] = design.wingRoot
  let s = `<g transform="translate(${n1(px)} ${n1(py)}) rotate(${n1(turn)}) scale(${n2(size)})">`
  // The far wing, behind the body: a beat late, raised a little higher and smaller.
  if (!folded) {
    s += `<g transform="translate(0.2 -0.02) rotate(${beat(flap - 0.9)} ${rx} ${ry}) translate(${rx} ${ry}) rotate(${n1(deg(-0.26))}) scale(0.84) translate(${-rx} ${-ry})"><path d="${design.wing}" fill="${c.wingFar}"${stroke}/></g>`
  }
  for (const p of design.behind) s += `<path d="${p.d}" fill="${c[p.tone]}"${stroke}/>`
  s += `<path d="${design.body}" fill="${c.body}"/>${patches(design.patches)}`
  if (c.line) s += `<path d="${design.body}" fill="none"${stroke}/>`
  s += `<path d="${design.beakTop}" fill="${c.beak}"/><path d="${design.beakLow}" fill="${c.beakLow}"/>`
  if (c.line) s += `<path d="${design.beak}" fill="none" stroke="${c.line}" stroke-width="${n3(line * 0.7)}" stroke-linejoin="round"/>`
  const wing = folded ? design.folded : design.wing
  s += `<g${folded ? '' : ` transform="rotate(${beat(flap)} ${rx} ${ry})"`}><path d="${wing}" fill="${c.wing}"/>${patches(folded ? design.foldedPatches : design.wingPatches)}${c.line ? `<path d="${wing}" fill="none"${stroke}/>` : ''}</g>`
  const e = design.eye
  if (small) s += `<circle cx="${n3(e.px - 0.03)}" cy="${e.y}" r="${n3(e.pr * 1.05)}" fill="${c.eye}"/>`
  else {
    s += `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="#ffffff"${c.line ? ` stroke="${c.line}" stroke-width="${n3(line * 0.5)}"` : ''}/>`
    s += `<circle cx="${e.px}" cy="${e.y}" r="${e.pr}" fill="${c.eye}"/>`
    s += `<circle cx="${n3(e.px + e.pr * 0.4)}" cy="${n3(e.y - e.pr * 0.45)}" r="${n3(e.pr * 0.38)}" fill="#ffffff"/>`
  }
  return `${s}</g>`
}

/* ------------------------------------------------------------------ the kite --- */

/** A kite as kite.ts paints one, at rest: `m` a unit of its frame in pixels, `lean` how far it leans into the wind. */
function kiteMarks(px: number, py: number, m: number, lean: number): string {
  const line = Math.max(1.3 / m, 0.07)
  const at = (j: number): [number, number] => [-0.42 * j + Math.sin(j * 1.3) * 0.16 * j * 0.5, 1.3 + 0.46 * j + Math.cos(j) * 0.08 * j]
  let tail = 'M0 1.3'
  for (let j = 1; j <= 6; j++) tail += ` L${n2(at(j)[0])} ${n2(at(j)[1])}`
  let s = `<g transform="translate(${n1(px)} ${n1(py)}) rotate(${n1(deg(lean))}) scale(${n2(m)})">`
  s += `<path d="${tail}" fill="none" stroke="${KITE.amber}" stroke-width="${n3(line)}" stroke-linejoin="round"/>`
  KITE.bows.forEach((colour, b) => {
    const [x, y] = at(1.6 + b * 1.7)
    s += `<path d="M${n2(x - 0.3)} ${n2(y - 0.17)} L${n2(x)} ${n2(y)} L${n2(x - 0.3)} ${n2(y + 0.17)} Z M${n2(x + 0.3)} ${n2(y - 0.17)} L${n2(x)} ${n2(y)} L${n2(x + 0.3)} ${n2(y + 0.17)} Z" fill="${colour}"/>`
  })
  s += `<path d="M0 -1.5 L-1 -0.35 L0 1.3 Z" fill="${KITE.lit}"/><path d="M0 -1.5 L1 -0.35 L0 1.3 Z" fill="${KITE.deep}"/>`
  s += `<path d="M0 -1.5 L0 1.3 M-1 -0.35 L1 -0.35" fill="none" stroke="${KITE.amber}" stroke-width="${n3(Math.max(line * 0.8, 0.05))}"/>`
  s += `<path d="M0 -1.5 L1 -0.35 L0 1.3 L-1 -0.35 Z" fill="none" stroke="${KITE.amber}" stroke-width="${n3(line)}" stroke-linejoin="round"/>`
  return `${s}</g>`
}

/* ------------------------------------------------------- what grows on the hills --- */

type Puff = readonly [number, number, number]

/** How far each kind's foot goes under the hill's edge, in metres at size 1 (vistaProps.ts). */
const SINK: Record<number, number> = { [DECO.Tree]: 1.1, [DECO.Pine]: 1.1, [DECO.Bush]: 0.45, [DECO.Rock]: 0.3, [DECO.Grass]: 0.14, [DECO.Daisy]: 0.12, [DECO.Tulip]: 0.12, [DECO.Reed]: 0.14 }

/** A blade of grass, or a stem, from `x`, `h` tall, leaning `lean`. */
const blade = (x: number, h: number, lean: number, w: number, fill: string) =>
  `<path d="M${n2(x - w)} 0.1 Q${n2(x - w * 0.5 + lean * 0.4)} ${n2(-h * 0.6)} ${n2(x + lean)} ${n2(-h)} Q${n2(x + w * 0.6 + lean * 0.4)} ${n2(-h * 0.55)} ${n2(x + w)} 0.1 Z" fill="${fill}"/>`

/** Each is drawn in metres, its foot at the origin, growing up, as vistaProps.ts paints it (the flowers more simply). */
function decoMarks(kind: DecoKind, shape: 0 | 1, L: DecoLook): string {
  if (kind === DECO.Tree) {
    const puffs: readonly Puff[] =
      shape === 0
        ? [
            [-1.2, -4.0, 1.35],
            [1.15, -4.1, 1.3],
            [0, -5.3, 1.75],
            [-0.2, -3.7, 1.3],
          ]
        : [
            [-0.9, -3.8, 1.25],
            [0.9, -3.9, 1.2],
            [-0.35, -5.0, 1.45],
            [0.6, -5.6, 1.3],
          ]
    return (
      `<path d="M-0.34 0 L-0.2 -3.6 L0.2 -3.6 L0.34 0 Z" fill="${L.trunk}"/>` +
      puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${n2(y + 0.22)}" r="${r}" fill="${L.leafDeep}"/>`).join('') +
      puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${n2(r * 0.95)}" fill="${L.leaf}"/>`).join('') +
      // The light's from the right: the crown's sunward side.
      puffs.map(([x, y, r]) => `<circle cx="${n2(x + r * 0.3)}" cy="${n2(y - r * 0.32)}" r="${n2(r * 0.56)}" fill="${L.leafLit}"/>`).join('')
    )
  }
  if (kind === DECO.Pine) {
    const tiers = shape === 0 ? 4 : 3
    const top = shape === 0 ? -8.1 : -7.2
    let s = `<rect x="-0.2" y="-1.6" width="0.4" height="1.6" fill="${L.trunk}"/>`
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers
      const y0 = -1.1 - (t * (-top - 1.1) * tiers) / (tiers + 0.6)
      const y1 = i === tiers - 1 ? top : y0 - (-top - 1.1) / (tiers - 0.2) - 0.5
      const half = 1.75 * (1 - t * 0.62)
      s += `<path d="M${n2(-half)} ${n2(y0)} L0 ${n2(y1)} L${n2(half)} ${n2(y0)} Z" fill="${L.leaf}"/>`
      s += `<path d="M0.1 ${n2(y0)} L0 ${n2(y1)} L${n2(half)} ${n2(y0)} Z" fill="${L.leafLit}"/>`
      s += `<path d="M${n2(-half)} ${n2(y0)} L${n2(-half * 0.3)} ${n2(y0 - 0.34)} L${n2(half * 0.5)} ${n2(y0)} Z" fill="${L.leafDeep}"/>`
    }
    return s
  }
  if (kind === DECO.Bush) {
    const puffs: readonly Puff[] =
      shape === 0
        ? [
            [-0.85, -0.55, 0.62],
            [0.0, -0.85, 0.82],
            [0.85, -0.5, 0.6],
          ]
        : [
            [-0.6, -0.6, 0.7],
            [0.5, -0.72, 0.78],
          ]
    const berries: readonly (readonly [number, number])[] = [
      [-0.7, -0.5],
      [0.15, -1.0],
      [0.75, -0.42],
      [-0.15, -0.5],
    ]
    return (
      puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${L.leaf}"/>`).join('') +
      `<rect x="-1.25" y="-0.6" width="2.5" height="0.6" fill="${L.leaf}"/>` +
      puffs.map(([x, y, r]) => `<circle cx="${n2(x + r * 0.28)}" cy="${n2(y - r * 0.3)}" r="${n2(r * 0.5)}" fill="${L.leafLit}"/>`).join('') +
      berries.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.11" fill="${L.petals[shape === 0 ? 2 : 1]}"/>`).join('')
    )
  }
  if (kind === DECO.Rock) {
    const pts: readonly (readonly [number, number])[] =
      shape === 0
        ? [
            [-0.9, 0],
            [-0.72, -0.62],
            [-0.2, -1.0],
            [0.5, -0.86],
            [0.92, -0.3],
            [0.95, 0],
          ]
        : [
            [-0.8, 0],
            [-0.55, -0.5],
            [0.1, -0.74],
            [0.7, -0.44],
            [0.86, 0],
          ]
    const d = (list: readonly (readonly [number, number])[]) => `M${list.map(([x, y]) => `${x} ${y}`).join(' L')} Z`
    // Its sunward face.
    return `<path d="${d(pts)}" fill="${L.rock}"/><path d="${d([...pts.slice(2), [0.25, -0.3]])}" fill="${L.rockLit}"/>`
  }
  if (kind === DECO.Grass) {
    const blades: readonly Puff[] =
      shape === 0
        ? [
            [-0.42, 0.55, -0.2],
            [-0.2, 0.82, -0.06],
            [0.02, 0.66, 0.12],
            [0.24, 0.86, 0.22],
            [0.46, 0.5, 0.26],
          ]
        : [
            [-0.34, 0.7, -0.22],
            [-0.08, 0.5, 0.02],
            [0.16, 0.8, 0.14],
            [0.4, 0.6, 0.28],
          ]
    return blades.map(([x, h, lean], i) => blade(x, h, lean, 0.09, i % 2 ? L.bladeLit : L.blade)).join('')
  }
  if (kind === DECO.Daisy) {
    const heads: readonly (readonly [number, number])[] =
      shape === 0
        ? [
            [-0.3, 0.62],
            [0.28, 0.86],
          ]
        : [[0, 0.8]]
    return heads
      .map(([x, h], i) => blade(x, h, 0.05, 0.05, L.blade) + `<circle cx="${n2(x + 0.05)}" cy="${n2(-h)}" r="0.2" fill="${L.petals[i % 2 ? 2 : 0]}"/><circle cx="${n2(x + 0.05)}" cy="${n2(-h)}" r="0.08" fill="${L.heart}"/>`)
      .join('')
  }
  if (kind === DECO.Tulip) {
    const heads: readonly (readonly [number, number])[] =
      shape === 0
        ? [
            [-0.25, 0.9],
            [0.3, 0.7],
          ]
        : [[0.05, 0.95]]
    return heads
      .map(
        ([x, h], i) =>
          blade(x, h, 0.04, 0.05, L.blade) +
          `<path d="M${n2(x - 0.16)} ${n2(-h - 0.02)} Q${n2(x - 0.2)} ${n2(-h - 0.36)} ${n2(x)} ${n2(-h - 0.2)} Q${n2(x + 0.24)} ${n2(-h - 0.36)} ${n2(x + 0.2)} ${n2(-h - 0.02)} Q${n2(x + 0.04)} ${n2(-h + 0.14)} ${n2(x - 0.16)} ${n2(-h - 0.02)} Z" fill="${L.petals[i % 2 ? 3 : 1]}"/>`,
      )
      .join('')
  }
  // A reed: a tall stem with a seed head.
  const reeds: readonly Puff[] =
    shape === 0
      ? [
          [-0.2, 1.5, -0.06],
          [0.2, 1.75, 0.1],
        ]
      : [[0, 1.7, 0.06]]
  return reeds.map(([x, h, lean]) => blade(x, h, lean, 0.045, L.blade) + `<ellipse cx="${n2(x + lean)}" cy="${n2(-h + 0.12)}" rx="0.09" ry="0.3" fill="${L.seed}"/>`).join('')
}

/* ---------------------------------------------------------------------- the sky --- */

type Part = { marks: string; defs: string }

/** A cloud's puffs, [x, r], each sitting on its flat bottom, in units of the cloud's size. */
const PUFFS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [-1.55, 0.52],
    [-0.75, 0.82],
    [0.3, 1.05],
    [1.3, 0.7],
    [1.95, 0.42],
  ],
  [
    [-1.1, 0.6],
    [-0.2, 0.95],
    [0.9, 0.72],
    [1.6, 0.42],
  ],
  [
    [-1.4, 0.45],
    [-0.6, 0.78],
    [0.35, 0.9],
    [1.2, 0.56],
  ],
]

/** The clouds' shapes, each kept once in the picture's defs for every cloud of its kind to be drawn from. */
const cloudDefs = () =>
  PUFFS.map((puffs, kind) => `<g id="c${kind}">${puffs.map(([x, r]) => `<circle cx="${x}" cy="${n2(-r)}" r="${r}"/>`).join('')}<rect x="${puffs[0]![0]}" y="-0.5" width="${n2(puffs[puffs.length - 1]![0] - puffs[0]![0])}" height="0.5"/></g>`).join('')

/** A cloud, its flat bottom's middle at (x, y), `s` its size in pixels: by day shaded along its bottom, by night lit along its top. */
function cloudMarks(x: number, y: number, s: number, kind: number, mood: Mood, alpha: number): string {
  const shape = `#c${kind % PUFFS.length}`
  const inner = mood.dark
    ? `<use href="${shape}" fill="${mood.cloud.lit}"/><use href="${shape}" x="-0.06" y="0.09" fill="${mood.cloud.body}"/>`
    : `<use href="${shape}" fill="${mood.cloud.shade}"/><use href="${shape}" y="-0.14" fill="${mood.cloud.body}"/>`
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n2(s)})" opacity="${alpha}">${inner}</g>`
}

/** The sky from the top of the picture down, its stars or its northern lights, and the sun or the moon. */
function skyMarks(w: number, h: number, mood: Mood, rnd: () => number, scale: number): Part {
  let marks = `<rect width="${w}" height="${h}" fill="url(#sky)"/>`
  let defs = `<linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">${mood.sky.map(([at, colour]) => `<stop offset="${at}" stop-color="${colour}"/>`).join('')}</linearGradient>`
  // Stars: about as many as the picture's share of a screen has, never fewer than a sky needs to read as night.
  if (mood.stars) {
    const count = Math.max(14, Math.round(mood.stars * 0.2))
    for (let i = 0; i < count; i++) {
      const x = rnd() * w
      const y = rnd() * h * 0.5
      const big = rnd() < 0.12
      marks += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n2((big ? 1.3 : 0.5 + rnd() * 0.6) * scale)}" fill="#ffffff" opacity="${n2(0.3 + rnd() * 0.6)}"/>`
    }
  }
  if (mood.aurora) {
    const veil = (id: string, colour: string, most: number) =>
      `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colour}" stop-opacity="0"/><stop offset="0.47" stop-color="${colour}" stop-opacity="${most}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></linearGradient>`
    defs += veil('aur', '#7dffc8', 0.42) + veil('aur2', '#b79bff', 0.26)
    const curtain = (y0: number, tall: number, phase: number, fill: string) => {
      const top: string[] = []
      const low: string[] = []
      // From off one side of the picture to off the other.
      const dx = Math.max(6, w / 40)
      for (let x = -dx; x < w + dx * 2; x += dx) {
        const u = x / w
        const y = y0 + Math.sin(u * 5.2 + phase) * h * 0.035 + Math.sin(u * 11 + phase * 2) * h * 0.012 + u * h * 0.05
        top.push(`${n1(x)} ${n1(y)}`)
        low.unshift(`${n1(x)} ${n1(y + tall)}`)
      }
      return `<path d="M${top.join(' L')} L${low.join(' L')} Z" fill="url(#${fill})"/>`
    }
    marks += curtain(h * 0.06, h * 0.26, 0.4, 'aur') + curtain(h * 0.16, h * 0.2, 2.1, 'aur2') + curtain(h * 0.2, h * 0.22, 3.6, 'aur')
  }
  const orb = mood.orb
  const cx = orb.x * w
  const cy = orb.y * h
  const r = orb.r * Math.min(w, h * 1.25)
  // Its glow, widest round a low sun.
  const reach = r * (orb.kind === 'sun' && orb.y > 0.3 ? 6.5 : orb.kind === 'soft' ? 5 : 4)
  const halo = tint(orb.halo)
  defs += `<radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(reach)}"><stop offset="0" stop-color="${halo.colour}" stop-opacity="${halo.alpha}"/><stop offset="1" stop-color="${halo.colour}" stop-opacity="0"/></radialGradient>`
  marks += `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(reach)}" fill="url(#halo)"/>`
  if (orb.kind === 'crescent') {
    // The bite out of it, from the upper left: what's left is lit from the lower right, where the sun went down.
    defs += `<mask id="bite"><rect x="${n1(cx - r * 2)}" y="${n1(cy - r * 2)}" width="${n1(r * 4)}" height="${n1(r * 4)}" fill="#000000"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="#ffffff"/><circle cx="${n1(cx - r * 0.48)}" cy="${n1(cy - r * 0.34)}" r="${n1(r * 0.96)}" fill="#000000"/></mask>`
    marks += `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${orb.core}" mask="url(#bite)"/>`
  } else {
    defs += `<radialGradient id="orb" gradientUnits="userSpaceOnUse" cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}"><stop offset="0.55" stop-color="${orb.core}"/><stop offset="1" stop-color="${orb.rim}"/></radialGradient>`
    marks += `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="url(#orb)"${orb.kind === 'soft' ? ' opacity="0.9"' : ''}/>`
    if (orb.kind === 'full') {
      // The moon's seas.
      const sea = mixColor(orb.rim, '#6f7896', 0.45)
      marks += `<ellipse cx="${n1(cx - r * 0.3)}" cy="${n1(cy - r * 0.22)}" rx="${n1(r * 0.3)}" ry="${n1(r * 0.22)}" fill="${sea}" opacity="0.4"/><ellipse cx="${n1(cx + r * 0.28)}" cy="${n1(cy + r * 0.2)}" rx="${n1(r * 0.22)}" ry="${n1(r * 0.28)}" fill="${sea}" opacity="0.35"/><circle cx="${n1(cx + r * 0.1)}" cy="${n1(cy - r * 0.48)}" r="${n1(r * 0.12)}" fill="${sea}" opacity="0.35"/>`
    }
  }
  return { marks, defs }
}

/** The clouds: a far row of little ones, to go behind the mountains, and a near row to go before them; by a misty morning, banks of fog. */
function cloudRows(w: number, h: number, mood: Mood, rnd: () => number): { far: string; near: string; defs: string } {
  if (mood.cloud.fog) {
    let near = ''
    for (let i = 0; i < 3; i++) near += `<ellipse cx="${n1((0.15 + i * 0.36 + rnd() * 0.1) * w)}" cy="${n1(h * (0.4 + rnd() * 0.14))}" rx="${n1(w * (0.3 + rnd() * 0.12))}" ry="${n1(h * 0.07)}" fill="url(#fog)"/>`
    return { far: '', near, defs: `<radialGradient id="fog"><stop offset="0" stop-color="${mood.cloud.body}" stop-opacity="0.85"/><stop offset="1" stop-color="${mood.cloud.body}" stop-opacity="0"/></radialGradient>` }
  }
  const unit = 0.064 * Math.min(h, w * 1.1)
  // A cloud that would sit over the sun or the moon moves along.
  const clear = (x: number, y: number, s: number) => (Math.abs(x - mood.orb.x * w) < s * 3.2 + mood.orb.r * w && Math.abs(y - mood.orb.y * h) < s * 1.6 + mood.orb.r * h * 1.4 ? x - w * 0.34 : x)
  let far = ''
  const farCount = mood.dark ? 2 : 3
  for (let i = 0; i < farCount; i++) {
    const s = unit * (0.42 + rnd() * 0.2)
    const y = h * (0.1 + rnd() * 0.2)
    far += cloudMarks(clear(((i + 0.2 + rnd() * 0.6) / farCount) * w, y, s), y, s, Math.floor(rnd() * 3), mood, mood.cloud.far)
  }
  let near = ''
  const nearCount = mood.dark ? 1 : 2
  for (let i = 0; i < nearCount; i++) near += cloudMarks(((i + 0.1 + rnd() * 0.5) / nearCount) * w * 0.62, h * (0.2 + rnd() * 0.2), unit * (0.8 + rnd() * 0.5), Math.floor(rnd() * 3), mood, mood.cloud.near)
  return { far, near, defs: cloudDefs() }
}

/* -------------------------------------------------------------- the far country --- */

const wave = (x: number, P: number, n: number, phase: number) => Math.sin((x / P) * n * TAU + phase)
const peaks = (x: number, P: number, n: number, phase: number) => 1 - Math.abs(Math.sin((x / P) * n * Math.PI + phase))

/**
 * The light on a shape's sunward slopes and the shade on the others, as two masks to draw through: what's left
 * of the shape (`id`, a path kept in the picture's defs) when a copy of it slid `reach` to the left, or to the
 * right, is taken away, no deeper than `deep` under its edge. Sliding it away from the sun bares the slopes
 * that face the sun, the steeper the more, and nothing of the ones turned from it; so the shape is written once,
 * and the light and the shade cost a few words each. A picture is a string, and every mark in it is carried.
 * The sun's to the right: down to the right faces it (vista.ts).
 */
function lightMasks(id: string, reach: number, deep: number): string {
  const mask = (name: string, dx: number) =>
    `<mask id="${id}${name}"><use href="#${id}" fill="#ffffff"/><use href="#${id}" x="${n1(dx)}" fill="#000000"/><use href="#${id}" y="${n1(deep)}" fill="#000000"/></mask>`
  return mask('l', -reach) + mask('s', reach)
}

/**
 * A ridge filled down to the picture's foot, the light along its sunward slopes and the shade along the others,
 * where they'd be thick enough to see.
 */
function ridgeMarks(w: number, h: number, ridge: (x: number) => number, top: number, foot: number, look: RangeLook, thick: number, id: string, step: number): Part {
  const lit = thick >= 2.4
  // Wide of the picture by as far as the light's copy slides, so the picture's own edges bare nothing.
  const over = step + (lit ? thick * 2 : 0)
  let d = ''
  for (let x = -over; x < w + over + step; x += step) d += `${d ? ' L' : 'M'}${n1(x)} ${n1(ridge(x))}`
  let defs = `<path id="${id}" d="${d} V${n1(h + 2)} H${n1(-over)} Z"/><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(top)}" x2="0" y2="${n1(foot)}"><stop offset="0" stop-color="${look.top}"/><stop offset="1" stop-color="${look.foot}"/></linearGradient>`
  let marks = `<use href="#${id}" fill="url(#${id}g)"/>`
  if (lit) {
    defs += lightMasks(id, thick * 2, thick * 1.35)
    marks += `<rect width="${w}" height="${h}" fill="${look.lit}" fill-opacity="0.55" mask="url(#${id}l)"/><rect width="${w}" height="${h}" fill="${look.shade}" fill-opacity="0.5" mask="url(#${id}s)"/>`
  }
  return { marks, defs }
}

/**
 * The three far ranges, as vistaSky.ts rangePicture draws each: mountains with snow on their tops, then two rows
 * of wooded hills; `between` (the near clouds) goes before the mountains and behind the woods.
 */
function rangeMarks(w: number, h: number, mood: Mood, hue: string, rnd: () => number, between: string): Part {
  const looks = rangeLooks(mood, hue)
  const V = Math.min(h, w * 1.1)
  const P = Math.max(w * 1.45, 240)
  // The mountains' peaks are sharp and want more points than the wooded hills, which roll.
  const step = Math.max(2, w / 96)
  const rolling = Math.max(2.5, w / 52)
  const along = rnd() * P
  let marks = ''
  let defs = ''
  const add = (part: Part) => {
    marks += part.marks
    defs += part.defs
  }
  for (const tier of [0, 1, 2] as const) {
    if (tier === 1) marks += between
    const amp = RANGE_AMP[tier] * V
    const top = h * RANGE_FOOT[tier] - amp - 3
    const foot = top + amp + h * RANGE_UNDER[tier]
    const look = looks[tier]
    const p = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU] as const
    if (tier === 0) {
      // Two rows of peaks: the far one tall, with snow; a lower one before it.
      const m = (x: number) => 0.56 * peaks(x + along, P, 3, p[0]) + 0.29 * peaks(x + along, P, 7, p[1]) + 0.15 * peaks(x + along, P, 15, p[2])
      const back = (x: number) => top + amp * (1 - m(x)) * 0.96
      add(ridgeMarks(w, h, back, top, foot, look, amp * 0.2, 'r0', step))
      // Snow, down from each top as far as it's high, its hem ragged.
      const snow = mood.dark ? mixColor(look.top, mood.cloud.lit, 0.42) : mixColor(look.top, '#ffffff', 0.82)
      let upper: string[] = []
      let hem: string[] = []
      let d = ''
      const close = () => {
        if (upper.length > 1) d += `M${upper.join(' L')} L${hem.join(' L')} Z `
        upper = []
        hem = []
      }
      const fine = Math.max(1.5, step * 0.6)
      for (let x = -fine, i = 0; x <= w + fine; x += fine, i++) {
        const over = m(x) - 0.6
        if (over > 0) {
          const y = back(x)
          upper.push(`${n1(x)} ${n1(y)}`)
          hem.unshift(`${n1(x)} ${n1(y + over * amp * 0.62 + (Math.floor(i / 3) % 2 ? amp * 0.014 : -amp * 0.014))}`)
        } else close()
      }
      close()
      if (d) marks += `<path d="${d.trim()}" fill="${snow}"/>`
      const front = (x: number) => top + amp * (0.5 + 0.5 * (1 - (0.6 * peaks(x + along, P, 4, p[3]) + 0.4 * peaks(x + along, P, 9, p[4]))))
      add(ridgeMarks(w, h, front, top + amp * 0.5, foot, { ...look, top: mixColor(look.top, look.shade, 0.3) }, amp * 0.1, 'r0b', step))
      continue
    }
    const ridge =
      tier === 1
        ? (x: number) => top + amp * (0.5 - 0.5 * (0.58 * wave(x + along, P, 2, p[0]) + 0.3 * wave(x + along, P, 5, p[1]) + 0.12 * wave(x + along, P, 11, p[2])))
        : (x: number) => top + amp * (0.5 - 0.5 * (0.6 * wave(x + along, P, 1, p[0]) + 0.3 * wave(x + along, P, 3, p[1]) + 0.1 * wave(x + along, P, 8, p[2])))
    // Trees along the ridge, standing behind it: in woods with gaps between. In a small picture the far row's are
    // specks, and a speck's worth of them is drawn: fewer, each the simplest shape that reads as a tree.
    const unit = amp * (tier === 1 ? 0.11 : 0.2)
    const sparse = Math.max(1, 2.6 / unit)
    let trees = ''
    for (let x = -unit * 2; x < w + unit * 2; ) {
      const wood = wave(x + along, P, tier === 1 ? 5 : 3, p[3]) + 0.35 * wave(x + along, P, 13, p[4])
      const gap = unit * (tier === 1 ? 0.9 : 1.5) * (0.7 + rnd() * 0.9) * sparse
      if (wood > -0.25) {
        const y = ridge(x) + unit * 0.25
        const s = unit * (0.7 + rnd() * 0.7) * Math.sqrt(sparse)
        if (rnd() < (tier === 1 ? 0.6 : 0.45)) trees += `M${n1(x - s * 0.5)} ${n1(y)}l${n1(s * 0.5)} ${n1(-s * 2.1)}l${n1(s * 0.5)} ${n1(s * 2.1)}z`
        else {
          // A round tree: its crown, two puffs of it (one, where it's too small to tell), and its trunk on the near row.
          const round = (cx: number, cy: number, r: number) => `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(r * 2)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-r * 2)} 0z`
          trees += s < 3.2 ? round(x + s * 0.15, y - s * 0.7, s * 0.72) : round(x, y - s * 0.85, s * 0.7) + round(x + s * 0.42, y - s * 0.5, s * 0.5)
          if (tier === 2 && s >= 3.2) trees += `M${n1(x - s * 0.08)} ${n1(y - s * 0.3)}h${n1(s * 0.16)}v${n1(s * 0.4)}h${n1(-s * 0.16)}z`
        }
      }
      x += gap
    }
    if (trees) marks += `<path d="${trees}" fill="${look.detail}"/>`
    add(ridgeMarks(w, h, ridge, top, foot, look, amp * (tier === 1 ? 0.22 : 0.3), `r${tier}`, rolling))
  }
  return { marks, defs }
}

/* ----------------------------------------------------------------- the picture --- */

/** The day's biggest top: the one highest over the bottom after it, in the first nine tenths of the way (hillsPicture.ts). */
function biggestTop(hills: Hills): number {
  let top = 1
  let best = -Infinity
  for (let i = 2; i < hills.xs.length - 2; i++) {
    const y = hills.ys[i]!
    if (hills.xs[i]! > hills.finish * 0.9) break
    if (y > hills.ys[i - 1]! && y > hills.ys[i + 1]! && y - hills.ys[i + 1]! > best) {
      best = y - hills.ys[i + 1]!
      top = i
    }
  }
  return top
}

type Still = {
  dark: boolean
  /** The top your bird has just flown off, as its place in the hills' list: the day's biggest unless told. */
  top?: number
  /** How many metres the picture shows across. */
  wide: number
  /** The bird's size, as a share of twice life: what a card needs to show it. */
  bird: number
  /** How long your bird has been in the air, in seconds. */
  air: number
  /** How many of the flock fly behind yours. */
  flock?: number
  /** A kite pegged to the slope down from the top, its slope edged in gold. */
  kite?: boolean
  /** Your bird in the picture's middle, close in, in place of the hill's top a third of the way across. */
  centre?: boolean
}

/** A still of the hills `w` by `h`, as an SVG string. */
function vistaSvg(hills: Hills, w: number, h: number, { dark, top = biggestTop(hills), wide, bird, air, flock = 0, kite = false, centre = false }: Still): string {
  const hue = hills.hue
  const mood = moodFor(hills.n, dark)
  const C = hillColours(hue, dark)
  const k = w / wide
  const scale = w / 480
  const tx = hills.xs[top]!
  const ty = hills.ys[top]!
  // Your bird's flight off the top at about 22 m/s, and the way it came up the hill before.
  const speed = 22
  const d0 = slopeAt(hills, tx + 0.5)
  const n0 = Math.sqrt(1 + d0 * d0)
  const vx = speed / n0
  const vy0 = (speed * d0) / n0 + 4
  const flight = (t: number): [number, number] => (t >= 0 ? [tx + vx * t, ty + vy0 * t - 10 * t * t] : [tx + vx * t, heightAt(hills, tx + vx * t)])
  const heading = (t: number) => (t >= 0 ? Math.atan2(vy0 - 20 * t, vx) : Math.atan(slopeAt(hills, tx + vx * t)))
  const [bx, by] = flight(air)
  const size = Math.max(14 * scale, 2.4 * k) * bird
  // The kite's hill is the slope down from this top. Its kite is pegged far enough down it to fly clear ahead of
  // your bird, as far as the slope allows: further down than in the game (golden.ts PERCH), for the picture's sake.
  const from = tx
  const to = hills.xs[top + 1] ?? tx + 30
  const pegShare = clamp(Math.max(0.62, (bx + (size / k) * 4.6 + 2 - from) / (to - from)), 0.62, 0.88)
  const pegX = from + (to - from) * pegShare
  const pegY = heightAt(hills, pegX)
  // Where the picture looks: the top a third of the way across, or far enough left that a pegged kite is well
  // inside it; or your bird in its middle.
  const topAt = kite ? clamp(0.76 - (pegX - 2 - tx) / wide, 0.08, 0.34) : 0.34
  const left = centre ? bx - wide * 0.5 : tx - wide * topAt
  const sky = centre ? by + (h / k) * 0.47 : ty + (h / k) * 0.56
  const X = (x: number) => (x - left) * k
  const Y = (y: number) => (sky - y) * k
  const rnd = mulberry32(4129 + hills.n * 7)
  let defs = ''
  let out = ''

  // The sky, the clouds and the far country.
  const skyPart = skyMarks(w, h, mood, rnd, scale)
  const clouds = cloudRows(w, h, mood, rnd)
  const ranges = rangeMarks(w, h, mood, hue, rnd, clouds.near)
  defs += skyPart.defs + clouds.defs + ranges.defs
  out += skyPart.marks + clouds.far + ranges.marks

  // The hills' line across the picture, written once (in the defs) and drawn from there for the ground, the turf,
  // the seams, the edge and the light on it. A hill is a long slow curve: points this far apart draw it without
  // a corner to be seen. It's wide of the picture by as far as the light's copy of it slides (lightMasks).
  const step = Math.max(2, w / 72)
  const deep = Math.min(LIGHT_DEEP * k, h * 0.105)
  const reach = (deep / FULL_SLOPE) * 0.9
  const over = reach + step * 2
  let line = ''
  let highest = h
  for (let px = -over; px < w + over + step; px += step) {
    const y = Y(heightAt(hills, left + px / k))
    highest = Math.min(highest, y)
    line += `${line ? ' L' : 'M'}${n1(px)} ${n1(y)}`
  }
  defs += `<path id="hl" d="${line} V${n1(h + 8)} H${n1(-over)} Z"/>`
  /** The hills' line again, `dy` down the picture, as a stroke. */
  const lineAt = (dy: number, colour: string, width: number, more = '') => `<use href="#hl" y="${n1(dy)}" fill="none" stroke="${colour}" stroke-width="${n1(width)}"${more}/>`

  // What stands on the hills, its feet under their edge: no tree where one of the flock is still on the hill, and
  // the grass and flowers only where they'd be more than specks.
  const seats = Array.from({ length: flock }, (_, j) => tx + vx * (air - 0.19 * (j + 1) - 0.05)).filter((x) => x < tx)
  const L = decoLook(hue, dark)
  const kept = new Set<string>()
  for (const d of layDecos(hills)) {
    if (d.x < left - 6) continue
    if (d.x > left + wide + 6) break
    const sprig = d.kind >= DECO.Grass
    if (sprig && k * 1.5 < 5.5) continue
    if (d.kind <= DECO.Pine && seats.some((x) => Math.abs(d.x - x) < 3.4)) continue
    const m = (sprig ? k * 1.5 : k) * d.size
    // Each kind's shape is written once, in the defs, and drawn from there wherever one stands.
    const id = `d${d.kind}${d.shape}`
    if (!kept.has(id)) {
      kept.add(id)
      defs += `<g id="${id}">${decoMarks(d.kind, d.shape, L)}</g>`
    }
    out += `<use href="#${id}" transform="translate(${n1(X(d.x))} ${n1(Y(d.y) + (SINK[d.kind] ?? 0) * m)}) scale(${n2(m)})"/>`
  }

  // The ground: its body, the turf, the seams of earth and the row of blips between them. The lines are as heavy
  // as the game's at its usual distance, and no heavier than that close in.
  defs += `<linearGradient id="earth" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(highest)}" x2="0" y2="${n1(highest + 40 * k)}"><stop offset="0" stop-color="${C.body}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>`
  out += `<use href="#hl" fill="url(#earth)"/>`
  const turf = Math.min(Math.max(3 * scale, 1.1 * k), h * 0.04)
  out += lineAt(turf * 0.5, C.turf, turf)
  const seam = Math.min(Math.max(1.5 * scale, 0.32 * k), h * 0.011)
  for (const depth of [4.2, 13.5]) out += lineAt(depth * k, C.seam, seam)
  const blip = Math.min(Math.max(1.4 * scale, 0.36 * k), h * 0.013)
  for (let x = Math.ceil(left / 3.2) * 3.2; x <= left + wide; x += 3.2) {
    const y = Y(heightAt(hills, x) - 8.6)
    if (y < h + blip) out += `<circle cx="${n1(X(x))}" cy="${n1(y)}" r="${n1(blip)}" fill="${C.blip}"/>`
  }
  // The light down every slope that faces the sun, and the shade down every one turned from it.
  const light = tint(mood.light)
  const shade = tint(mood.shade)
  defs += lightMasks('hl', reach, deep * 1.3)
  out += `<rect width="${w}" height="${h}" fill="${shade.colour}" fill-opacity="${shade.alpha}" mask="url(#hls)"/><rect width="${w}" height="${h}" fill="${light.colour}" fill-opacity="${light.alpha}" mask="url(#hll)"/>`
  // The kite's slope, edged in gold from its top to its foot, fading in and out at its ends.
  if (kite) {
    const gold = Math.min(1.3 * k, h * 0.05)
    defs += `<linearGradient id="gk" gradientUnits="userSpaceOnUse" x1="${n1(X(from))}" y1="0" x2="${n1(X(to))}" y2="0"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset="0.12" stop-color="${GOLD}" stop-opacity="0.75"/><stop offset="0.88" stop-color="${GOLD}" stop-opacity="0.75"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>`
    out += lineAt(gold * 0.5, 'url(#gk)', gold)
  }
  // The edge along the top, and a line of light just under it where the sun is on the slope.
  out += lineAt(0, C.edge, Math.min(Math.max(2.5 * scale, 0.42 * k), h * 0.016), ' stroke-linejoin="round"')
  const under = Math.min(Math.max(3 * scale, 0.55 * k), h * 0.02)
  const glint = Math.min(Math.max(1.5 * scale, 0.26 * k), h * 0.01)
  out += `<g mask="url(#hll)">${lineAt(under, '#ffffff', glint, ` stroke-opacity="${C.shine}"`)}</g>`

  // The kite, pegged to its slope and flying over it in its glow, as high as the picture has room for.
  if (kite) {
    const m = Math.max(k, 6.5 * scale) * 1.5
    const high = clamp((Y(pegY) - h * 0.2) / k, 5, 11.5)
    const kx = X(pegX - 2)
    const ky = Y(pegY + high)
    const peg = Math.max(5 * scale, 0.55 * k)
    defs += `<radialGradient id="glow"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.6"/><stop offset="0.4" stop-color="${GOLD}" stop-opacity="0.24"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`
    out += `<rect x="${n1(X(pegX) - 1.25 * scale)}" y="${n1(Y(pegY) - peg)}" width="${n1(2.5 * scale)}" height="${n1(peg)}" fill="${C.ink}" opacity="0.8"/>`
    out += `<circle cx="${n1(kx)}" cy="${n1(ky)}" r="${n1(size * 3.2)}" fill="url(#glow)"/>`
    const hx = X(pegX)
    const hy = Y(pegY + 0.5)
    out += `<path d="M${n1(hx)} ${n1(hy)} Q${n1(hx + (kx - hx) * 0.62)} ${n1(hy + (ky - hy) * 0.3)} ${n1(kx)} ${n1(ky)}" fill="none" stroke="${C.ink}" stroke-opacity="0.6" stroke-width="${n2(1.3 * scale)}"/>`
    out += kiteMarks(kx, ky, m, 0.5)
  }

  // The bird's shadow on the hill straight under it: smaller and fainter the higher it flies.
  const floor = heightAt(hills, bx)
  const fade = 1 / (1 + Math.max(0, by - floor) / 9)
  const shadow = size * (0.6 + 0.45 * fade)
  out += `<ellipse cx="${n1(X(bx))}" cy="${n1(Y(floor) + Math.max(1, 0.12 * k))}" rx="${n1(shadow)}" ry="${n1(shadow * 0.26)}" transform="rotate(${n1(-deg(Math.atan(slopeAt(hills, bx))))} ${n1(X(bx))} ${n1(Y(floor))})" fill="${dark ? '#020410' : '#14283c'}" fill-opacity="${n2((dark ? 0.3 : 0.18) * fade)}"/>`

  // The ribbon behind it: widest at the bird, fading out along where it's been; white by night, as the game has it.
  const ribbonWide = 0.42 * Math.max(k, 7 * scale) * Math.sqrt(bird)
  const upper: string[] = []
  const lower: string[] = []
  for (let t = 0.02; t <= air + 0.001; t += 0.03) {
    const a = heading(t)
    const [x, y] = flight(t)
    const wide2 = ribbonWide * (1 - (air - t) / 0.5) ** 0.85 * Math.min(1, t / 0.06 + 0.2)
    const px = X(x)
    const py = Y(y) - size * SWIFT_LIFT
    upper.push(`${n1(px - Math.sin(a) * wide2)} ${n1(py - Math.cos(a) * wide2)}`)
    lower.unshift(`${n1(px + Math.sin(a) * wide2)} ${n1(py + Math.cos(a) * wide2)}`)
  }
  const tail = flight(0.02)
  const ribbon = dark ? '#ffffff' : RED
  defs += `<linearGradient id="rib" gradientUnits="userSpaceOnUse" x1="${n1(X(bx))}" y1="${n1(Y(by))}" x2="${n1(X(tail[0]))}" y2="${n1(Y(tail[1]))}"><stop offset="0" stop-color="${ribbon}" stop-opacity="0.7"/><stop offset="1" stop-color="${ribbon}" stop-opacity="0"/></linearGradient>`
  out += `<path d="M${upper.join(' L')} L${lower.join(' L')} Z" fill="url(#rib)"/>`

  /** A bird on the way at `t`, `rel` its size against yours: where its middle is on the picture, and how it's turned. */
  const place = (t: number, rel: number, lift = 0): BirdPose => {
    const [x, y] = flight(t)
    const a = heading(t)
    const s = size * rel
    return { px: X(x) - Math.sin(a) * s * SWIFT_LIFT, py: Y(y + lift) - Math.cos(a) * s * SWIFT_LIFT, turn: -deg(a), size: s, folded: t < 0 }
  }
  // The flock: the nearest just behind you in the air, the rest still coming over the top.
  for (let j = flock; j >= 1; j--) {
    const t = air - 0.19 * j - 0.05
    out += birdMarks(SWALLOW, swiftColours(FLOCK_HUES[(j - 1) % FLOCK_HUES.length]!, dark, 'soft'), { ...place(t, 0.56, t >= 0 ? (j % 2 ? 0.9 : -0.5) : 0), small: true, flap: 0.4 + j * 1.3 })
  }
  out += birdMarks(SWALLOW, swiftColours(RED, dark, 'soft'), place(air, 1))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${out}</svg>`
}

/**
 * A day's picture, `w` by `h`: the hill the day's first kite is on, close in (or its biggest hill, for hills
 * that have no kites), your bird just off its top with three of the flock behind, and the kite ahead on its
 * gold slope. A wide box shows more of the way, a tall one less.
 */
export function dayPictureSvg(hills: Hills, w: number, h: number, dark: boolean): string {
  const wide = 38 * clamp(w / h / (4 / 3), 0.62, 1.22)
  return vistaSvg(hills, w, h, { dark, top: goldenHills(hills, hills.n)[0]?.top, wide, bird: 0.8, air: 0.3, flock: 3, kite: true })
}

/**
 * The hills of the small game picture: the stretch round Pebble Ridge's biggest top (hills #34, the new look's
 * first), kept here as numbers so the picture needs no day laid, in Swoop's own green.
 */
const ART_HILLS: Hills = {
  n: 34,
  attempt: 0,
  name: 'Pebble Ridge',
  hue: '#3ecf8e',
  xs: [0, 28.8, 79.7, 139.2, 196.6, 238.4, 283.7, 319.2],
  ys: [17.6, 35.1, 1.1, 40.8, 2.4, 30.3, 0, 23.7],
  finish: 319,
  flags: [],
  tops: 4,
}

/**
 * The small game picture, 4 by 3 (its middle square is the icon): close on the swallow over a green hill, since
 * in most places it's shown a few dozen pixels across. components/GameArt.tsx shows it from two files, by day and
 * by night, which scripts/swoop-art.mjs writes from this: run that again when this changes.
 */
export function gameArtSvg(dark: boolean): string {
  return vistaSvg(ART_HILLS, 240, 180, { dark, top: 3, wide: 21, bird: 0.82, air: 0.4, centre: true })
}
