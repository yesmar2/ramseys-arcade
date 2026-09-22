import type { Dir, GameState, Puff, Row, Vehicle } from './game'
import {
  BACK_LIMIT,
  BUMP,
  CLOSE_CALL_SHOW,
  MILESTONE_STEP,
  MOMENTUM_SHOW,
  PUFF_LIFE,
  STALL_WARN,
  stallLimitAt,
  cellMetrics,
  easeHop,
  getRailCycle,
  getRow,
  isLorry,
  laneSpan,
} from './game'
import { drawEyes } from '../eyes'
import {
  inkColor,
  isDarkTheme,
  isFlatTheme,
  playfieldColor,
  softFillAlpha,
  strokeOutlined,
} from '../../lib/theme'

const GRASS_A = 142
const TREE = 158
const HOPPER = 42

const TAU = Math.PI * 2
/** Canvas text cannot read the page's font variable, so the face is named here. */
const FONT = '"Outfit", system-ui, sans-serif'

/** Which way each facing points, for a bump against a tree. */
const FACING: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * Where the pupils go for each facing. Up is only a lean: the eyes already sit
 * high on the body, and pupils pushed to the top of them read as an eye-roll
 * rather than a hopper looking where it is going.
 */
const LOOK: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -0.35 },
  down: { x: 0, y: 0.8 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * Words on the board: the site's face, on a halo of the floor so they hold up
 * over traffic and trees in either theme. They used to be heavy system type in
 * plain white, which on the light floor was close to nothing at all.
 */
function boardText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.font = `600 ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = playfieldColor()
  ctx.lineWidth = Math.max(3, size * 0.28)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

/** Words land big and settle, so the moment reads before the words do. */
function landScale(age: number) {
  return age < 0.12 ? 1 + (0.12 - age) * 2.2 : 1
}

/**
 * Stable noise for one tile, so the detail on the ground stays where it was
 * put from frame to frame and run to run.
 */
function tileNoise(row: number, col: number, salt: number) {
  let h = Math.imul(row, 0x27d4eb2d) ^ Math.imul(col, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * The ground changes as you get deeper, so a long run has somewhere to arrive.
 *
 * Only the ground: grass, trees, water. Cars, logs, coins and the hopper keep
 * their hues everywhere, because those are the things a player reads to stay
 * alive and a palette is not worth making a hazard harder to pick out.
 *
 * Each row asks for its own biome, so a change arrives as a band sweeping down
 * the board ahead of you rather than the whole screen flipping at once.
 */
type Biome = {
  grass: number
  tree: number
  water: number
  /** Scales the saturation the land was authored at. */
  satMul: number
  /** Added to the land's lightness. */
  lightAdd: number
  /**
   * Water gets its own pair, because it has a job the grass does not: it has to
   * stay obviously deadly. Frost was the case that forced this — snow and river
   * had landed three degrees of hue apart, which is the safe ground and the
   * thing that drowns you rendered almost identically.
   */
  waterSatMul: number
  waterLightAdd: number
}

const BIOMES: Biome[] = [
  // Meadow — the numbers the game was drawn with.
  { grass: GRASS_A, tree: TREE, water: 205, satMul: 1, lightAdd: 0, waterSatMul: 1, waterLightAdd: 0 },
  // Autumn: the greens turn.
  { grass: 34, tree: 20, water: 200, satMul: 1.05, lightAdd: 1, waterSatMul: 1, waterLightAdd: -2 },
  // Night: everything cools and drops.
  { grass: 172, tree: 184, water: 226, satMul: 0.72, lightAdd: -11, waterSatMul: 0.9, waterLightAdd: -13 },
  // Frost: snow goes almost white, the river stays a cold blue so it still
  // reads as water rather than more ground.
  { grass: 198, tree: 205, water: 208, satMul: 0.2, lightAdd: 16, waterSatMul: 1.15, waterLightAdd: -10 },
]

/** Rows in a biome, and how many it takes to turn over. */
const BIOME_ROWS = 100
const BIOME_BLEND = 20

/** Shortest way round the wheel, so 350 to 10 goes forwards not backwards. */
function lerpHue(a: number, b: number, t: number) {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

function mixBiome(a: Biome, b: Biome, t: number): Biome {
  const mix = (x: number, y: number) => x + (y - x) * t
  return {
    grass: lerpHue(a.grass, b.grass, t),
    tree: lerpHue(a.tree, b.tree, t),
    water: lerpHue(a.water, b.water, t),
    satMul: mix(a.satMul, b.satMul),
    lightAdd: mix(a.lightAdd, b.lightAdd),
    waterSatMul: mix(a.waterSatMul, b.waterSatMul),
    waterLightAdd: mix(a.waterLightAdd, b.waterLightAdd),
  }
}

export function biomeAt(row: number): Biome {
  const r = Math.max(0, row)
  const index = Math.floor(r / BIOME_ROWS)
  const into = r - index * BIOME_ROWS
  const here = BIOMES[index % BIOMES.length]
  if (into < BIOME_ROWS - BIOME_BLEND) return here
  const next = BIOMES[(index + 1) % BIOMES.length]
  return mixBiome(here, next, (into - (BIOME_ROWS - BIOME_BLEND)) / BIOME_BLEND)
}

export type CrosswalkLayout = {
  cell: number
  visibleRows: number
  cols: number
  ox: number
  oy: number
  hudTop: number
  gridW: number
}

export function computeLayout(
  w: number,
  h: number,
  cols: number,
  focusCol = (cols - 1) / 2,
): CrosswalkLayout {
  const { cell: widthCell, availH, hudTop } = cellMetrics(w, h, cols)
  // Tall phones would otherwise show a dozen+ tiny rows. Cap the row budget so
  // tiles grow (sides crop) and pan horizontally to keep the hopper in frame.
  // Desktop stays tight too — seeing too many lanes ahead makes traffic too readable.
  const maxRows = w < 560 ? 8 : w < 900 ? 8 : 7
  const cell = availH / widthCell > maxRows ? availH / maxRows : widthCell
  const visibleRows = Math.max(5, Math.min(maxRows, Math.floor(availH / cell)))
  const gridW = cell * cols
  const gridH = visibleRows * cell
  let ox = (w - gridW) / 2
  if (gridW > w + 0.5) {
    const focusX = (focusCol + 0.5) * cell
    ox = w * 0.5 - focusX
    ox = Math.max(w - gridW, Math.min(0, ox))
  } else {
    ox = Math.max(0, ox)
  }
  const oy = hudTop + Math.max(0, (availH - gridH) * 0.5)
  return { cell, visibleRows, cols, ox, oy, hudTop, gridW }
}

function fill(hue: number, sat: number, light: number, alpha: number) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  traceRoundRect(ctx, x, y, w, h, r)
}

/** A rounded rectangle added to the current path, so many can go in one fill. */
function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Lane entities live at `x` and `x - span`; drawing both keeps the wrap seam
 * seamless without any pop-in at the screen edges.
 */
function eachLaneCopy(
  v: Vehicle,
  span: number,
  ox: number,
  cell: number,
  w: number,
  draw: (screenX: number) => void,
) {
  const vw = v.w * cell
  for (const laneX of [v.x, v.x - span]) {
    const sx = ox + laneX * cell
    if (sx + vw < -cell || sx > w + cell) continue
    draw(sx)
  }
}

/**
 * Road traffic, seen from above.
 *
 * These were pills with one pane of glass, which said "something is in this
 * lane" and nothing about which way it was going or what it was. A car has a
 * cabin now, glass fore and aft, lamps at either end and wheels showing past
 * its flanks; a lorry is a cab towing a ribbed box. Lamps and glass sit at the
 * nose, so a lane's direction reads off a still frame.
 *
 * The body is still exactly the box the vehicle collides on. The wheels stand
 * out above and below it, into its own lane, never ahead of it or behind it.
 */
type VehiclePaint = {
  body: string
  cab: string
  stroke: string
  glass: string
  tyre: string
  lamp: string
  tail: string
  line: number
}

function vehiclePaint(hue: number, h: number, dark: boolean): VehiclePaint {
  return {
    body: fill(hue, 58, dark ? 60 : 58, softFillAlpha(dark ? 0.32 : 0.26)),
    cab: fill(hue, 58, dark ? 58 : 56, softFillAlpha(dark ? 0.5 : 0.44)),
    stroke: fill(hue, 58, dark ? 62 : 42, 0.95),
    glass: dark
      ? `rgba(180, 222, 255, ${softFillAlpha(0.3)})`
      : `rgba(255, 255, 255, ${softFillAlpha(0.72)})`,
    tyre: dark ? 'rgba(8, 11, 16, 0.92)' : 'rgba(38, 48, 62, 0.8)',
    lamp: dark ? 'rgba(255, 243, 196, 0.95)' : 'rgba(250, 196, 50, 1)',
    tail: dark ? 'rgba(255, 96, 96, 0.9)' : 'rgba(214, 48, 58, 0.9)',
    line: Math.max(1.8, h * 0.08),
  }
}

/** Screen x of the point `f` of the way from a vehicle's tail (0) to its nose (1). */
function along(x: number, w: number, dir: number, f: number) {
  return dir > 0 ? x + w * f : x + w * (1 - f)
}

/** A rounded box between two points along the vehicle, `top` to `bottom` down it. */
function piece(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  from: number,
  to: number,
  top: number,
  bottom: number,
  radius: number,
) {
  const a = along(x, w, dir, from)
  const b = along(x, w, dir, to)
  roundRect(ctx, Math.min(a, b), y + h * top, Math.abs(b - a), h * (bottom - top), radius)
}

function drawWheels(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  at: number[],
  paint: VehiclePaint,
) {
  const ww = h * 0.36
  const out = h * 0.12
  // Tucked under the flank by the width of the outline, which hides the seam.
  const under = paint.line
  ctx.beginPath()
  for (const f of at) {
    const cx = along(x, w, dir, f)
    traceRoundRect(ctx, cx - ww / 2, y - out, ww, out + under, out * 0.5)
    traceRoundRect(ctx, cx - ww / 2, y + h - under, ww, out + under, out * 0.5)
  }
  ctx.fillStyle = paint.tyre
  ctx.fill()
}

function drawLamps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  paint: VehiclePaint,
) {
  const nose = along(x, w, dir, 1) - dir * h * 0.13
  const tail = along(x, w, dir, 0) + dir * h * 0.09
  ctx.beginPath()
  for (const s of [0.27, 0.73]) {
    ctx.moveTo(nose + h * 0.065, y + h * s)
    ctx.ellipse(nose, y + h * s, h * 0.065, h * 0.1, 0, 0, TAU)
  }
  ctx.fillStyle = paint.lamp
  ctx.fill()
  ctx.beginPath()
  for (const s of [0.25, 0.75]) {
    traceRoundRect(ctx, tail - h * 0.035, y + h * s - h * 0.08, h * 0.07, h * 0.16, h * 0.03)
  }
  ctx.fillStyle = paint.tail
  ctx.fill()
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  dir: number,
  dark: boolean,
) {
  const paint = vehiclePaint(hue, h, dark)
  drawWheels(ctx, x, y, w, h, dir, [0.21, 0.77], paint)

  roundRect(ctx, x, y, w, h, h * 0.3)
  ctx.fillStyle = paint.body
  ctx.fill()
  ctx.strokeStyle = paint.stroke
  ctx.lineWidth = paint.line
  strokeOutlined(ctx)

  // The cabin: a roof a shade deeper than the bonnet, glass at either end of it.
  piece(ctx, x, y, w, h, dir, 0.25, 0.75, 0.15, 0.85, h * 0.2)
  ctx.fillStyle = paint.cab
  ctx.fill()
  ctx.fillStyle = paint.glass
  piece(ctx, x, y, w, h, dir, 0.57, 0.73, 0.2, 0.8, h * 0.12)
  ctx.fill()
  piece(ctx, x, y, w, h, dir, 0.27, 0.35, 0.24, 0.76, h * 0.08)
  ctx.fill()

  drawLamps(ctx, x, y, w, h, dir, paint)
}

function drawLorry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  dir: number,
  dark: boolean,
) {
  const paint = vehiclePaint(hue, h, dark)
  drawWheels(ctx, x, y, w, h, dir, [0.1, 0.22, 0.85], paint)

  // The coupling, drawn first so the cab and the box both sit over its ends.
  ctx.fillStyle = paint.tyre
  piece(ctx, x, y, w, h, dir, 0.62, 0.76, 0.45, 0.55, 0)
  ctx.fill()

  ctx.strokeStyle = paint.stroke
  ctx.lineWidth = paint.line
  piece(ctx, x, y, w, h, dir, 0, 0.68, 0, 1, h * 0.16)
  ctx.fillStyle = paint.body
  ctx.fill()
  strokeOutlined(ctx)

  // Ribs across the box.
  ctx.strokeStyle = fill(hue, 58, dark ? 62 : 42, 0.3)
  ctx.lineWidth = Math.max(1, h * 0.045)
  ctx.beginPath()
  for (const f of [0.17, 0.34, 0.51]) {
    const rx = along(x, w, dir, f)
    ctx.moveTo(rx, y + h * 0.2)
    ctx.lineTo(rx, y + h * 0.8)
  }
  ctx.stroke()

  piece(ctx, x, y, w, h, dir, 0.71, 1, 0.04, 0.96, h * 0.28)
  ctx.fillStyle = paint.cab
  ctx.fill()
  ctx.strokeStyle = paint.stroke
  ctx.lineWidth = paint.line
  strokeOutlined(ctx)
  ctx.fillStyle = paint.glass
  piece(ctx, x, y, w, h, dir, 0.82, 0.92, 0.2, 0.8, h * 0.1)
  ctx.fill()

  drawLamps(ctx, x, y, w, h, dir, paint)
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
  /** Hue for this row's depth — trees turn with the ground they stand on. */
  hue = TREE,
  satMul = 1,
  lightAdd = 0,
) {
  const sat = (n: number) => Math.max(0, Math.min(100, n * satMul))
  const lit = (n: number) => Math.max(0, Math.min(100, n + lightAdd))
  const trunk = fill(hue, sat(38), lit(dark ? 38 : 34), 0.9)
  const leaf = fill(hue, sat(48), lit(dark ? 52 : 48), softFillAlpha(dark ? 0.34 : 0.28))
  const stroke = fill(hue, sat(48), lit(dark ? 58 : 36), 0.9)
  const tw = size * 0.22

  // A shadow where it stands, the same one the hopper throws.
  ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(30, 40, 60, 0.09)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + size * 0.42, size * 0.24, size * 0.07, 0, 0, TAU)
  ctx.fill()

  roundRect(ctx, cx - tw / 2, cy + size * 0.08, tw, size * 0.34, tw * 0.3)
  ctx.fillStyle = trunk
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy - size * 0.02, size * 0.34, 0, Math.PI * 2)
  ctx.fillStyle = leaf
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.5, size * 0.05)
  strokeOutlined(ctx)

  // Light catching the crown, so it reads as round rather than as a disc.
  ctx.strokeStyle = fill(hue, sat(48), lit(dark ? 70 : 84), dark ? 0.34 : 0.85)
  ctx.lineWidth = Math.max(1.5, size * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy - size * 0.02, size * 0.22, Math.PI * 1.08, Math.PI * 1.45)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

type HopperPose = {
  pulse: number
  dark: boolean
  dying: boolean
  deathT: number
  /** Forward-hop squeeze: 0 = round, 1 = max skinny. */
  squeeze: number
  cause: GameState['cause']
  /** Rows taken back to back right now. */
  chain: number
  /** Where the last hop went, or tried to: the pupils look that way. */
  facing: Dir
  /** Shut for a blink. */
  blink: boolean
}

function drawHopper(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  pose: HopperPose,
) {
  const { pulse, dark, dying, deathT, squeeze, cause, chain } = pose
  let drawX = cx
  let drawY = cy
  let deathScale = 1
  let squashX = 1
  let squashY = 1

  if (dying) {
    if (cause === 'stall') {
      drawY -= deathT * size * 3.2
      deathScale = 1 - deathT * 0.25
      squashX = 1 - deathT * 0.15
      squashY = 1 + deathT * 0.35
    } else if (cause === 'water' || cause === 'edge') {
      drawY += deathT * size * 0.85
      deathScale = 1 - deathT * 0.55
      squashX = 1 + deathT * 0.35
      squashY = 1 - deathT * 0.55
    } else {
      // Car / train — flatten hard.
      deathScale = 1 - deathT * 0.2
      squashX = 1 + deathT * 1.1
      squashY = Math.max(0.12, 1 - deathT * 0.92)
      drawY += deathT * size * 0.2
    }
  }

  const scale = (1 + pulse * 0.06) * deathScale
  // Land thud: briefly fat and short when hopPulse is high and we're not mid-squeeze.
  const land = !dying && pulse > 0.08 ? Math.min(1, pulse / 0.32) : 0
  const r = size * 0.3 * scale
  const rx = r * (1 - squeeze * 0.32) * squashX * (1 + land * 0.22)
  const ry = r * (1 + squeeze * 0.18) * squashY * (1 - land * 0.28)
  const fade = dying ? 1 - deathT * 0.35 : 1
  const bodyHue = dying ? 4 : HOPPER
  const bodySat = dying ? 72 : 62
  /*
   * Translucent, like the cars on the same road and the beads in Snake.
   *
   * This was the one solid fill on the field — alpha 1 where everything else
   * is a soft wash behind a saturated outline — which is what made it sit on
   * top of the board rather than in it.
   */
  const body = fill(bodyHue, bodySat, dark ? 58 : 54, softFillAlpha(dark ? 0.32 : 0.26) * fade)
  const stroke = fill(bodyHue, bodySat, dark ? 48 : 36, 0.95 * fade)

  /*
   * A chain shows as warmth gathering under the hopper — the same amber Snake
   * burns for boost, so momentum reads as one idea across the arcade. It lights
   * at the same count the readout starts at, so nothing glows that the HUD is
   * not also counting.
   */
  if (!dying && chain >= MOMENTUM_SHOW) {
    const heat = Math.min(1, (chain - MOMENTUM_SHOW + 1) / 12)
    const glowR = r * (1.6 + heat * 0.9)
    const glow = ctx.createRadialGradient(drawX, drawY, r * 0.4, drawX, drawY, glowR)
    glow.addColorStop(0, `rgba(245, 185, 66, ${0.32 * heat})`)
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.ellipse(drawX, drawY, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, size * 0.06)
  strokeOutlined(ctx)

  /*
   * Snake's eyes, at Snake's proportions. The radius comes off `r` rather than
   * `rx`, so a hopper mid-squeeze keeps round pupils while they ride along with
   * the body the squeeze gave it.
   *
   * They look the way the last hop went, and blink now and then. A crash
   * crosses them out, as Snake's are when it hits something, where this used
   * to scrawl a red X over the whole body; the river shuts them; the clock
   * running out leaves them wide open, looking up at what took it.
   */
  const eyes = { x: drawX, y: drawY, rx, ry, radius: r * 0.26 }
  // The ring only where the body is pale enough to lose a white eye against it.
  const ring = dark ? undefined : stroke
  if (dying) {
    if (cause === 'car' || cause === 'train') {
      drawEyes(ctx, { ...eyes, dead: inkColor() })
    } else if (cause === 'water' || cause === 'edge') {
      drawEyes(ctx, { ...eyes, line: stroke, closed: true })
    } else {
      drawEyes(ctx, { ...eyes, line: ring, look: FACING.up })
    }
    return
  }
  drawEyes(ctx, { ...eyes, line: pose.blink ? stroke : ring, look: LOOK[pose.facing], closed: pose.blink })
}

function drawCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
  bob = 0,
  /** Turn, in radians: the coin spins on its upright, never quite edge-on. */
  spin = 0,
) {
  const r = size * 0.22
  const y = cy - bob
  const turn = 0.58 + 0.42 * Math.abs(Math.cos(spin))
  ctx.beginPath()
  ctx.ellipse(cx, y, r * turn, r, 0, 0, TAU)
  ctx.fillStyle = fill(48, 92, dark ? 58 : 54, 1)
  ctx.fill()
  ctx.strokeStyle = fill(42, 90, dark ? 42 : 38, 1)
  ctx.lineWidth = Math.max(1.6, size * 0.05)
  strokeOutlined(ctx)
  // The rim, stamped just inside the edge.
  ctx.beginPath()
  ctx.ellipse(cx, y, r * 0.62 * turn, r * 0.62, 0, 0, TAU)
  ctx.strokeStyle = fill(42, 90, dark ? 42 : 38, 0.45)
  ctx.lineWidth = Math.max(1, size * 0.026)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.25 * turn, y - r * 0.28, r * 0.28 * turn, r * 0.28, 0, 0, TAU)
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
}

/** Brief shadow, then a fast Crossy-style snatch. */
/**
 * Time running out, drawn as pressure closing on the hopper.
 *
 * This used to be a hawk: a body, a head, a beak, two curved wings and three
 * talons, all at about a third of a tile and all inside four tenths of a
 * second. At that size and that speed it read as a dark smudge, and nothing in
 * this game is drawn that way — cars are rounded rectangles, trees are circles,
 * the hopper is an ellipse. So it is a ring and a shadow now, which is the same
 * vocabulary as the rest of the board and legible at a glance.
 *
 * The ring is the clock: it starts wide and amber and closes to a tight red
 * collar, pulsing faster as it goes. Nothing is coming from off-screen, so
 * there is nothing for the eye to track and miss.
 */
function drawStallThreat(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cell: number,
  w: number,
  h: number,
  idleTimer: number,
  time: number,
  /** Row the player is on — the stall limit tightens as the run goes deeper. */
  playerRow: number,
) {
  const warnStart = stallLimitAt(playerRow) - STALL_WARN
  if (idleTimer <= warnStart) return

  const t = Math.min(1, (idleTimer - warnStart) / STALL_WARN)
  // Late-weighted, so the first second is a nudge and the last is a shout.
  const heat = Math.pow(t, 1.6)
  // Amber to red, the same two ends the rail warning uses.
  const hue = 42 - heat * 40
  const beat = 0.5 + 0.5 * Math.sin(time * (7 + heat * 26))

  // Ground shadow: something overhead, without drawing the something.
  ctx.fillStyle = `rgba(18, 12, 26, ${0.12 + heat * 0.4})`
  ctx.beginPath()
  ctx.ellipse(px, py + cell * 0.34, cell * (0.3 + heat * 0.5), cell * (0.1 + heat * 0.16), 0, 0, Math.PI * 2)
  ctx.fill()

  // The closing ring — the clock made visible.
  const r = cell * (2.5 - heat * 1.9)
  ctx.save()
  ctx.strokeStyle = fill(hue, 88, 56, 0.35 + beat * 0.45 * (0.4 + heat * 0.6))
  ctx.lineWidth = Math.max(2, cell * (0.05 + heat * 0.06))
  ctx.setLineDash([cell * 0.3, cell * 0.22])
  ctx.lineDashOffset = -time * cell * (1.5 + heat * 5)
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // A soft wash inside it once it is genuinely close.
  if (heat > 0.35) {
    const wash = (heat - 0.35) / 0.65
    const grad = ctx.createRadialGradient(px, py, cell * 0.1, px, py, r)
    grad.addColorStop(0, fill(hue, 90, 56, wash * 0.22 * (0.5 + beat * 0.5)))
    grad.addColorStop(1, fill(hue, 90, 56, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Edges darkening in the last moment, so it lands even if the eye is on traffic.
  if (heat > 0.6) {
    const close = (heat - 0.6) / 0.4
    const vig = ctx.createRadialGradient(px, py, cell * 2, px, py, Math.max(w, h) * 0.8)
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vig.addColorStop(1, `rgba(24, 6, 10, ${close * 0.5})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, w, h)
  }
}

function drawCrossingLights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  flash: boolean,
  dark: boolean,
) {
  const postW = cell * 0.14
  const postH = cell * 0.62
  const postY = y + cell * 0.2
  ctx.fillStyle = fill(45, 10, dark ? 42 : 32, 1)
  roundRect(ctx, x - postW / 2, postY, postW, postH, postW * 0.2)
  ctx.fill()

  const lampR = cell * 0.09
  const lampY = postY + cell * 0.14
  const on = flash
  ctx.beginPath()
  ctx.arc(x, lampY, lampR, 0, Math.PI * 2)
  ctx.fillStyle = on ? 'rgba(255, 220, 60, 1)' : 'rgba(80, 60, 20, 0.7)'
  ctx.fill()
  ctx.strokeStyle = on ? 'rgba(255, 180, 0, 0.9)' : 'rgba(60, 50, 30, 0.6)'
  ctx.lineWidth = Math.max(1.5, cell * 0.03)
  strokeOutlined(ctx)

  ctx.beginPath()
  ctx.arc(x, lampY + lampR * 2.1, lampR * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = on ? 'rgba(255, 50, 40, 1)' : 'rgba(60, 20, 20, 0.7)'
  ctx.fill()
  ctx.strokeStyle = on ? 'rgba(220, 30, 20, 0.95)' : 'rgba(50, 20, 20, 0.6)'
  strokeOutlined(ctx)

  if (on) {
    ctx.fillStyle = 'rgba(255, 200, 80, 0.18)'
    ctx.beginPath()
    ctx.arc(x, lampY, lampR * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * An engine and three coaches, coupled. It was one long slab with four panes,
 * which read as a very long car; the nose, its lamp and the gaps between the
 * coaches are what say train in the half second it is on screen.
 */
function drawTrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
  dark: boolean,
) {
  const body = fill(350, 52, dark ? 52 : 48, 1)
  const stroke = fill(350, 52, dark ? 58 : 40, 1)
  const pane = dark ? 'rgba(255, 220, 220, 0.2)' : 'rgba(255, 255, 255, 0.4)'
  const units = 4
  const gap = h * 0.16
  const unitW = (w - gap * (units - 1)) / units

  ctx.fillStyle = dark ? 'rgba(12, 6, 10, 0.85)' : 'rgba(70, 36, 44, 0.75)'
  ctx.fillRect(x + unitW * 0.5, y + h * 0.42, w - unitW, h * 0.16)

  for (let i = 0; i < units; i++) {
    const ux = x + i * (unitW + gap)
    const engine = dir > 0 ? i === units - 1 : i === 0
    roundRect(ctx, ux, y, unitW, h, engine ? h * 0.42 : h * 0.16)
    ctx.fillStyle = body
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(2, h * 0.07)
    strokeOutlined(ctx)
    ctx.fillStyle = pane
    if (engine) {
      piece(ctx, ux, y, unitW, h, dir, 0.64, 0.8, 0.18, 0.82, h * 0.1)
      ctx.fill()
      ctx.fillStyle = dark ? 'rgba(255, 246, 204, 1)' : 'rgba(255, 226, 120, 1)'
      ctx.beginPath()
      ctx.arc(along(ux, unitW, dir, 0.93), y + h * 0.5, h * 0.11, 0, TAU)
      ctx.fill()
    } else {
      ctx.beginPath()
      for (const f of [0.1, 0.4, 0.7]) {
        traceRoundRect(ctx, ux + unitW * f, y + h * 0.2, unitW * 0.2, h * 0.6, h * 0.1)
      }
      ctx.fill()
    }
  }
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(32, 42, dark ? 40 : 36, softFillAlpha(dark ? 0.42 : 0.34))
  const stroke = fill(32, 42, dark ? 48 : 30, 0.9)
  roundRect(ctx, x, y, w, h, h * 0.22)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.8, h * 0.07)
  strokeOutlined(ctx)

  // Bark: two runs of grain, staggered so the log does not look ruled.
  ctx.strokeStyle = fill(32, 30, dark ? 52 : 28, 0.35)
  ctx.lineWidth = Math.max(1.2, h * 0.06)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + w * 0.16, y + h * 0.36)
  ctx.lineTo(x + w * 0.54, y + h * 0.36)
  ctx.moveTo(x + w * 0.42, y + h * 0.66)
  ctx.lineTo(x + w * 0.84, y + h * 0.66)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // The sawn ends, pale wood with a ring in it.
  for (const ex of [x + h * 0.26, x + w - h * 0.26]) {
    ctx.beginPath()
    ctx.ellipse(ex, y + h / 2, h * 0.14, h * 0.32, 0, 0, TAU)
    ctx.fillStyle = fill(36, 50, dark ? 56 : 74, dark ? 0.42 : 0.8)
    ctx.fill()
    ctx.strokeStyle = fill(32, 42, dark ? 48 : 30, 0.55)
    ctx.lineWidth = Math.max(1, h * 0.045)
    ctx.stroke()
  }
}

/** Static stepping stone — reads as solid ground, unlike the drifting logs. */
function drawRock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
) {
  const body = fill(210, 10, dark ? 46 : 62, 1)
  const stroke = fill(210, 12, dark ? 30 : 38, 0.95)
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.42, cy + size * 0.24)
  ctx.lineTo(cx - size * 0.3, cy - size * 0.16)
  ctx.lineTo(cx - size * 0.06, cy - size * 0.3)
  ctx.lineTo(cx + size * 0.24, cy - size * 0.22)
  ctx.lineTo(cx + size * 0.42, cy + size * 0.1)
  ctx.lineTo(cx + size * 0.28, cy + size * 0.28)
  ctx.closePath()
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.6, size * 0.06)
  strokeOutlined(ctx)

  // Top highlight sells it as a raised surface you can land on.
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.22, cy - size * 0.12)
  ctx.lineTo(cx - size * 0.04, cy - size * 0.22)
  ctx.lineTo(cx + size * 0.16, cy - size * 0.14)
  ctx.lineTo(cx - size * 0.02, cy - size * 0.02)
  ctx.closePath()
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.42)'
  ctx.fill()
}

/**
 * Which season's small things lie on the grass: the biome a row mostly belongs
 * to, switching halfway through the blend.
 */
function seasonAt(row: number) {
  return Math.floor((Math.max(0, row) + BIOME_BLEND / 2) / BIOME_ROWS) % BIOMES.length
}

/** Palette hues for meadow flowers. No yellows, so nothing on the grass looks like a coin. */
const FLOWER_HUES = [330, 262, 205]

/**
 * Tufts on every lawn, and one thing per season among them: flowers in the
 * meadow, fallen leaves in autumn, fireflies at night. Frost keeps its snow
 * bare. All of it is small and faint, and none of it is on a row that can
 * kill you, so it gives the safe ground a texture without adding anything a
 * player has to read.
 */
function drawGrassDetail(
  ctx: CanvasRenderingContext2D,
  row: Row,
  worldRow: number,
  y: number,
  w: number,
  ox: number,
  cell: number,
  dark: boolean,
  hue: number,
  sat: (n: number) => number,
  lit: (n: number) => number,
  time: number,
) {
  const first = Math.floor(-ox / cell) - 1
  const last = Math.ceil((w - ox) / cell)
  const season = seasonAt(worldRow)
  const blade = cell * 0.075

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = fill(hue, sat(36), lit(dark ? 64 : 38), dark ? 0.26 : 0.3)
  ctx.lineWidth = Math.max(1, cell * 0.018)
  ctx.beginPath()
  for (let c = first; c <= last; c++) {
    if (row.trees.includes(c)) continue
    for (let k = 0; k < 2; k++) {
      if (tileNoise(worldRow, c, k) > 0.5) continue
      const tx = ox + (c + 0.14 + tileNoise(worldRow, c, k + 10) * 0.72) * cell
      const ty = y + (0.3 + tileNoise(worldRow, c, k + 20) * 0.56) * cell
      // Three blades from three roots, leaning apart. Blades that met at one
      // root drew a small arrow pointing down, which is not what grass does.
      ctx.moveTo(tx - blade * 0.4, ty)
      ctx.lineTo(tx - blade * 0.62, ty - blade * 0.72)
      ctx.moveTo(tx, ty)
      ctx.lineTo(tx + blade * 0.04, ty - blade * 1.1)
      ctx.moveTo(tx + blade * 0.4, ty)
      ctx.lineTo(tx + blade * 0.66, ty - blade * 0.8)
    }
  }
  ctx.stroke()

  for (let c = first; c <= last; c++) {
    if (row.trees.includes(c) || row.coins.includes(c)) continue
    const n = tileNoise(worldRow, c, 40)
    const fx = ox + (c + 0.2 + tileNoise(worldRow, c, 41) * 0.6) * cell
    const fy = y + (0.25 + tileNoise(worldRow, c, 42) * 0.55) * cell
    if (season === 0 && n < 0.14) {
      const petal = cell * 0.028
      ctx.fillStyle = fill(FLOWER_HUES[Math.floor(n * 100) % FLOWER_HUES.length], 70, dark ? 74 : 62, dark ? 0.62 : 0.85)
      ctx.beginPath()
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * TAU + n * 9
        ctx.moveTo(fx + Math.cos(a) * petal + petal, fy + Math.sin(a) * petal)
        ctx.arc(fx + Math.cos(a) * petal, fy + Math.sin(a) * petal, petal, 0, TAU)
      }
      ctx.fill()
      ctx.fillStyle = fill(42, 90, dark ? 66 : 50, 0.9)
      ctx.beginPath()
      ctx.arc(fx, fy, petal * 0.7, 0, TAU)
      ctx.fill()
    } else if (season === 1 && n < 0.22) {
      ctx.fillStyle = fill(n < 0.11 ? 14 : 34, 72, dark ? 58 : 50, dark ? 0.5 : 0.6)
      ctx.beginPath()
      ctx.ellipse(fx, fy, cell * 0.05, cell * 0.024, n * 40, 0, TAU)
      ctx.fill()
    } else if (season === 2 && n < 0.08) {
      // A slow drift and a slower glow, each on its own clock.
      const phase = n * 400
      const gx = fx + Math.sin(time * 0.7 + phase) * cell * 0.08
      const gy = fy + Math.cos(time * 0.5 + phase) * cell * 0.05
      const glow = 0.35 + 0.65 * Math.max(0, Math.sin(time * 1.3 + phase))
      const halo = ctx.createRadialGradient(gx, gy, 0, gx, gy, cell * 0.09)
      halo.addColorStop(0, fill(72, 90, 72, 0.5 * glow))
      halo.addColorStop(1, fill(72, 90, 72, 0))
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(gx, gy, cell * 0.09, 0, TAU)
      ctx.fill()
      ctx.fillStyle = fill(72, 95, 80, 0.9 * glow)
      ctx.beginPath()
      ctx.arc(gx, gy, cell * 0.018, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Road paint. A dashed divider runs between two lanes of one road and a thin
 * kerb edges the road where it meets anything else, so a stretch of road reads
 * as one carriageway and cars run between the lines rather than along them.
 *
 * Anchored to the board, not the screen, for the reason set out where the
 * lane markings used to be drawn.
 */
function drawRoadMarkings(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  worldRow: number,
  y: number,
  w: number,
  ox: number,
  cell: number,
  dark: boolean,
) {
  const laneAbove = getRow(state, worldRow + 1).kind === 'road'
  const laneBelow = getRow(state, worldRow - 1).kind === 'road'
  ctx.save()
  if (laneAbove) {
    ctx.strokeStyle = dark ? fill(45, 70, 66, 0.34) : fill(40, 60, 46, 0.34)
    ctx.lineWidth = Math.max(2, cell * 0.035)
    ctx.setLineDash([cell * 0.3, cell * 0.24])
    ctx.lineDashOffset = -ox
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.strokeStyle = dark ? fill(220, 16, 74, 0.16) : fill(220, 18, 40, 0.18)
  ctx.lineWidth = Math.max(1.5, cell * 0.022)
  ctx.beginPath()
  if (!laneAbove) {
    ctx.moveTo(0, y + cell * 0.05)
    ctx.lineTo(w, y + cell * 0.05)
  }
  if (!laneBelow) {
    ctx.moveTo(0, y + cell * 0.95)
    ctx.lineTo(w, y + cell * 0.95)
  }
  ctx.stroke()
  ctx.restore()
}

function drawLaneBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  cell: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(0, y, w, cell + 0.5)
}

function playerPos(state: GameState) {
  if (!state.hop) return { c: state.col, r: state.row }
  const t = easeHop(state.hop.t)
  return {
    c: state.hop.fromC + (state.hop.toC - state.hop.fromC) * t,
    r: state.hop.fromR + (state.hop.toR - state.hop.fromR) * t,
  }
}

function rowScreenY(
  worldRow: number,
  cameraY: number,
  visibleRows: number,
  oy: number,
  cell: number,
) {
  return oy + (visibleRows - 1 - (worldRow - cameraY)) * cell
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  worldRow: number,
  y: number,
  w: number,
  ox: number,
  gridW: number,
  cell: number,
  dark: boolean,
) {
  const row = getRow(state, worldRow)
  const span = laneSpan(state.cols)
  // Each row takes the biome at its own depth, so a change sweeps down the
  // board ahead of the hopper instead of the screen flipping all at once.
  const biome = biomeAt(worldRow)
  const grassHue = worldRow % 2 === 0 ? biome.grass : biome.grass + 10
  const sat = (base: number) => Math.max(0, Math.min(100, base * biome.satMul))
  const lit = (base: number) => Math.max(0, Math.min(100, base + biome.lightAdd))
  const wSat = (base: number) => Math.max(0, Math.min(100, base * biome.waterSatMul))
  const wLit = (base: number) => Math.max(0, Math.min(100, base + biome.waterLightAdd))

  const time = performance.now() / 1000

  if (row.kind === 'grass') {
    drawLaneBand(ctx, y, w, cell, fill(grassHue, sat(42), lit(dark ? 48 : 72), dark ? 0.28 : 0.22))
    if (!isFlatTheme()) {
      ctx.strokeStyle = fill(grassHue, sat(30), lit(dark ? 58 : 58), 0.12)
      ctx.lineWidth = 1
      ctx.strokeRect(ox + 0.5, y + 0.5, gridW - 1, cell - 1)
    }
    drawGrassDetail(ctx, row, worldRow, y, w, ox, cell, dark, grassHue, sat, lit, time)
  } else if (row.kind === 'water') {
    drawLaneBand(ctx, y, w, cell, fill(biome.water, wSat(58), wLit(dark ? 46 : 62), dark ? 0.42 : 0.28))
    ctx.strokeStyle = fill(biome.water, wSat(50), wLit(dark ? 58 : 48), 0.2)
    ctx.lineWidth = 1
    // Stepped from the board's origin so the ripples sit in the water rather
    // than on the glass — same fault as the lane markings above.
    const dotStep = cell * 0.55
    const dotPhase = ((((ox + cell * 0.2) % dotStep) + dotStep) % dotStep)
    for (let wave = dotPhase; wave < w; wave += dotStep) {
      ctx.beginPath()
      ctx.arc(wave, y + cell * 0.55, cell * 0.08, 0, Math.PI * 2)
      ctx.stroke()
    }
    const vy = y + cell * 0.28
    const vh = cell * 0.44
    for (const log of row.vehicles) {
      eachLaneCopy(log, span, ox, cell, w, (sx) => {
        drawLog(ctx, sx, vy, log.w * cell, vh, dark)
      })
    }
    for (const rockCol of row.rocks) {
      drawRock(ctx, ox + (rockCol + 0.5) * cell, y + cell * 0.52, cell * 0.86, dark)
    }
  } else if (row.kind === 'rail') {
    const cycle = getRailCycle(row)
    const warnGlow = cycle.phase === 'warn' && cycle.flash
    drawLaneBand(
      ctx,
      y,
      w,
      cell,
      fill(45, 12, dark ? 36 : 70, warnGlow ? (dark ? 0.42 : 0.28) : dark ? 0.35 : 0.22),
    )
    // Sleepers under the rails, pitched from the board's origin like the road paint.
    const tie = cell * 0.5
    ctx.beginPath()
    for (let tx = ((ox % tie) + tie) % tie - tie; tx < w + tie; tx += tie) {
      traceRoundRect(ctx, tx - cell * 0.07, y + cell * 0.25, cell * 0.14, cell * 0.52, cell * 0.03)
    }
    ctx.fillStyle = fill(30, 22, dark ? 30 : 56, dark ? 0.6 : 0.42)
    ctx.fill()
    ctx.fillStyle = fill(38, 20, dark ? 52 : 38, 0.55)
    const railY = y + cell * 0.34
    ctx.fillRect(0, railY, w, cell * 0.08)
    ctx.fillRect(0, railY + cell * 0.26, w, cell * 0.08)

    if (cycle.phase === 'warn') {
      // Keep signals in the canvas even when the playfield is wider than the
      // viewport (mobile crop / desktop zoom) — posts used to sit off-screen.
      const inset = Math.max(cell * 0.4, 10)
      const leftX = Math.max(ox + cell * 0.35, inset)
      const rightX = Math.min(ox + gridW - cell * 0.35, w - inset)
      drawCrossingLights(ctx, leftX, y, cell, cycle.flash, dark)
      drawCrossingLights(ctx, rightX, y, cell, cycle.flash, dark)
    }

    for (const v of row.vehicles) {
      const vx = ox + v.x * cell
      const vw = v.w * cell
      const vy = y + cell * 0.18
      const vh = cell * 0.64
      if (vx + vw < -cell || vx > w + cell) continue
      if (cycle.phase === 'pass') {
        const streak = row.dir * cell * 0.55
        ctx.globalAlpha = 0.35
        drawTrain(ctx, vx - streak, vy, vw, vh, row.dir, dark)
        ctx.globalAlpha = 0.6
        drawTrain(ctx, vx - streak * 0.5, vy, vw, vh, row.dir, dark)
        ctx.globalAlpha = 1
      }
      drawTrain(ctx, vx, vy, vw, vh, row.dir, dark)
    }
  } else {
    drawLaneBand(ctx, y, w, cell, fill(220, 14, dark ? 34 : 78, dark ? 0.35 : 0.2))
    /*
     * Markings are anchored to the board, not to the screen.
     *
     * A line spans the viewport, so without this the dash pattern starts at
     * screen x=0 and the markings are welded to the window: when the view pans
     * sideways every car, tree, log and the hopper move with the world and the
     * lane markings alone stay put. They are the most road-like thing on the
     * row, so the eye takes them for the fixed ground, and then the ground is
     * the one thing not moving while everything else slides — which is what
     * made riding a log look like the board was sliding instead of the player.
     */
    drawRoadMarkings(ctx, state, worldRow, y, w, ox, cell, dark)

    const vy = y + cell * 0.22
    const vh = cell * 0.56
    for (const v of row.vehicles) {
      const draw = isLorry(v, state.cols) ? drawLorry : drawCar
      eachLaneCopy(v, span, ox, cell, w, (sx) => {
        draw(ctx, sx, vy, v.w * cell, vh, v.hue, row.dir, dark)
      })
    }
  }

  for (const treeCol of row.trees) {
    drawTree(ctx, ox + (treeCol + 0.5) * cell, y + cell * 0.52, cell * 0.88, dark, biome.tree, biome.satMul, biome.lightAdd)
  }

  const bob = Math.sin(time * 4.5 + worldRow) * cell * 0.04
  for (const coinCol of row.coins) {
    drawCoin(ctx, ox + (coinCol + 0.5) * cell, y + cell * 0.52, cell, dark, bob, time * 2.4 + coinCol + worldRow)
  }
}

/** Faint distance ticks so progress feels measurable mid-run. */
function drawMilestone(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  ox: number,
  cell: number,
  label: number,
  dark: boolean,
) {
  ctx.save()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(30, 40, 60, 0.14)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([cell * 0.16, cell * 0.16])
  // Dashes belong to the board, so they slide with it when the view pans.
  ctx.lineDashOffset = -ox
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.font = `600 ${Math.max(9, Math.round(cell * 0.24))}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.34)' : 'rgba(30, 40, 60, 0.32)'
  ctx.fillText(String(label), ox + cell * 0.18, y - cell * 0.06)
  ctx.restore()
}

/** The record line — the whole point of the next run. */
function drawBestLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  ox: number,
  cell: number,
  best: number,
  passed: boolean,
  dark: boolean,
) {
  ctx.save()
  const alpha = passed ? 0.35 : 0.95
  ctx.strokeStyle = `rgba(245, 185, 66, ${alpha})`
  ctx.lineWidth = Math.max(2, cell * 0.05)
  ctx.setLineDash([cell * 0.3, cell * 0.2])
  ctx.lineDashOffset = -ox
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineDashOffset = 0

  const text = passed ? `BEAT ${best}` : `BEST ${best}`
  ctx.font = `600 ${Math.max(10, Math.round(cell * 0.26))}px ${FONT}`
  const padX = cell * 0.22
  const tw = ctx.measureText(text).width + padX * 2
  const th = Math.max(16, cell * 0.42)
  const bx = w - tw - cell * 0.18
  const by = y - th - cell * 0.08
  roundRect(ctx, bx, by, tw, th, th * 0.35)
  ctx.fillStyle = `rgba(245, 185, 66, ${passed ? 0.28 : 0.92})`
  ctx.fill()
  // Behind you it steps back, but white on a pale pill vanished on the light floor.
  ctx.fillStyle = passed ? (dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(92, 62, 8, 0.78)') : '#2a1c00'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + tw / 2, by + th / 2 + 0.5)
  ctx.restore()
}

/** A blink every few seconds, a little off Snake's beat so the two are not in step. */
function blinking(time: number) {
  const period = 3.3
  return time % period > period - 0.13
}

/**
 * Where a hop landed: two puffs of dust thrown out to the sides, or on a log a
 * ring spreading on the water around it. Left in the world where it happened,
 * so a quick run of hops leaves a short trail rather than a cloud that follows.
 */
function drawPuff(
  ctx: CanvasRenderingContext2D,
  puff: Puff,
  x: number,
  y: number,
  cell: number,
  dark: boolean,
) {
  const t = 1 - puff.t / PUFF_LIFE
  const fade = 1 - t
  if (puff.wet) {
    ctx.strokeStyle = fill(205, 70, dark ? 74 : 46, fade * 0.55)
    ctx.lineWidth = Math.max(1.5, cell * 0.03)
    ctx.beginPath()
    ctx.ellipse(x, y + cell * 0.2, cell * (0.3 + t * 0.26), cell * (0.1 + t * 0.07), 0, 0, TAU)
    ctx.stroke()
    return
  }
  ctx.fillStyle = dark ? `rgba(226, 232, 240, ${fade * 0.3})` : `rgba(70, 84, 104, ${fade * 0.22})`
  ctx.beginPath()
  for (const side of [-1, 1]) {
    const dx = x + side * cell * (0.2 + t * 0.18)
    const dy = y + cell * (0.25 - t * 0.05)
    const r = cell * (0.045 + t * 0.05)
    ctx.moveTo(dx + r, dy)
    ctx.arc(dx, dy, r, 0, TAU)
  }
  ctx.fill()
}

/** Going under: rings spreading from where the hopper went in. */
function drawSplash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  deathT: number,
  dark: boolean,
) {
  ctx.save()
  ctx.lineWidth = Math.max(1.5, cell * 0.035)
  for (const delay of [0, 0.22]) {
    const t = (deathT - delay) / 0.7
    if (t <= 0 || t >= 1) continue
    ctx.strokeStyle = fill(205, 72, dark ? 76 : 44, (1 - t) * 0.7)
    ctx.beginPath()
    ctx.ellipse(x, y + cell * 0.12, cell * (0.2 + t * 0.55), cell * (0.08 + t * 0.2), 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

const DEATH_WORD: Record<NonNullable<GameState['cause']>, string> = {
  car: 'SPLAT!',
  train: 'SMOOSHED!',
  water: 'SPLASH!',
  edge: 'YEETED!',
  stall: 'TOO SLOW!',
}

/** Each way to go in the colour of what did it: traffic red, river blue, the clock's orange. */
function deathColour(cause: NonNullable<GameState['cause']>, dark: boolean) {
  if (cause === 'water' || cause === 'edge') return fill(205, 76, dark ? 70 : 42, 1)
  if (cause === 'stall') return fill(24, 86, dark ? 64 : 46, 1)
  return fill(354, 72, dark ? 68 : 48, 1)
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dark = isDarkTheme()
  const pos = playerPos(state)
  const layout = computeLayout(w, h, state.cols, pos.c)
  const { cell, visibleRows, ox, oy, gridW } = layout

  /*
   * Tell the page where the field starts, so the strip above it — score,
   * figures and the controls at either end — can share one middle. Nothing in
   * the DOM can see the canvas, so without this they each guess. Written only
   * when it changes, so it costs nothing per frame.
   */
  const host = ctx.canvas.parentElement
  if (host) {
    const middle = Math.round(oy / 2)
    if (host.dataset.readoutMiddle !== String(middle)) {
      host.dataset.readoutMiddle = String(middle)
      host.style.setProperty('--readout-middle', `${middle}px`)
    }
  }

  const cameraY = state.cameraY
  const shake =
    state.shake > 0
      ? {
          x: (Math.random() - 0.5) * cell * 0.22 * state.shake,
          y: (Math.random() - 0.5) * cell * 0.18 * state.shake,
        }
      : { x: 0, y: 0 }

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(shake.x, shake.y)
  const dying = state.phase === 'dying'

  const topRow = Math.ceil(cameraY + visibleRows + 2)
  const bottomRow = Math.floor(cameraY) - 4
  for (let worldRow = topRow; worldRow >= bottomRow; worldRow--) {
    const y = rowScreenY(worldRow, cameraY, visibleRows, oy, cell)
    if (y > h + cell || y + cell < 0) continue
    drawRow(ctx, state, worldRow, y, w, ox, gridW, cell, dark)
  }

  for (let worldRow = bottomRow; worldRow <= topRow; worldRow++) {
    if (worldRow <= 0 || worldRow % MILESTONE_STEP !== 0) continue
    if (state.target > 0 && worldRow === state.target) continue
    const y = rowScreenY(worldRow, cameraY, visibleRows, oy, cell)
    if (y < -cell || y > h + cell) continue
    drawMilestone(ctx, y, w, ox, cell, worldRow, dark)
  }

  if (state.target > 0 && state.phase !== 'menu') {
    const y = rowScreenY(state.target, cameraY, visibleRows, oy, cell)
    if (y > -cell * 2 && y < h + cell) {
      drawBestLine(ctx, y, w, ox, cell, state.target, state.beatBest, dark)
    }
  }

  const px = ox + (pos.c + 0.5) * cell
  const py = rowScreenY(pos.r, cameraY, visibleRows, oy, cell) + cell * 0.52
  const deathT = dying ? 1 - state.deathAnim / 0.95 : 0
  const hop = state.hop
  const hopT = hop ? easeHop(Math.min(1, hop.t)) : 0
  const air = hop ? Math.sin(hopT * Math.PI) : 0
  const squeeze =
    hop && hop.toR > hop.fromR ? Math.sin(Math.min(1, hop.t) * Math.PI) : 0

  for (const puff of state.puffs) {
    drawPuff(ctx, puff, ox + (puff.c + 0.5) * cell, rowScreenY(puff.r, cameraY, visibleRows, oy, cell) + cell * 0.52, cell, dark)
  }

  if (dying && (state.cause === 'water' || state.cause === 'edge')) {
    drawSplash(ctx, px, py, cell, deathT, dark)
  }

  // Ground shadow shrinks while airborne so the hop reads as a real lift.
  if (!dying && py > -cell && py < h + cell) {
    const shadowScale = 1 - air * 0.45
    ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(30, 40, 60, 0.16)'
    ctx.beginPath()
    ctx.ellipse(
      px,
      py + cell * 0.28,
      cell * 0.22 * shadowScale,
      cell * 0.08 * shadowScale,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  if (py > -cell * 4 && py < h + cell) {
    // A hop that met a tree or the edge shoves out toward it and back.
    const shove = state.bump > 0 && !dying ? Math.sin((1 - state.bump / BUMP) * Math.PI) * cell * 0.08 : 0
    const toward = FACING[state.facing]
    drawHopper(ctx, px + toward.x * shove, py - air * cell * 0.28 + toward.y * shove, cell, {
      pulse: state.hopPulse,
      dark,
      dying,
      deathT,
      squeeze,
      cause: state.cause,
      chain: state.streak,
      facing: state.facing,
      blink: !hop && blinking(performance.now() / 1000),
    })
  }

  for (const pop of state.coinPops) {
    const t = Math.max(0, pop.t / 0.42)
    const cx = ox + (pop.c + 0.5) * cell
    const rowY = rowScreenY(pop.r, cameraY, visibleRows, oy, cell)
    const cy = rowY + cell * 0.2 - (1 - t) * cell * 0.8
    ctx.save()
    // A ring off the coin where it was, as the tally takes it.
    ctx.globalAlpha = t * 0.7
    ctx.strokeStyle = fill(46, 92, dark ? 62 : 50, 1)
    ctx.lineWidth = Math.max(1.5, cell * 0.04 * t)
    ctx.beginPath()
    ctx.arc(cx, rowY + cell * 0.52, cell * (0.22 + (1 - t) * 0.34), 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = Math.min(1, t * 2.5)
    boardText(ctx, '+1', cx, cy, Math.max(12, cell * 0.34 * landScale(1 - t)), fill(46, 90, dark ? 64 : 40, 1))
    ctx.restore()
  }

  for (const bit of state.deathBits) {
    const a = Math.max(0, bit.life / bit.max)
    const bx = ox + bit.x * cell
    const by = rowScreenY(bit.y, cameraY, visibleRows, oy, cell) + cell * 0.5
    ctx.beginPath()
    ctx.arc(bx, by, bit.size * cell, 0, Math.PI * 2)
    ctx.fillStyle = fill(bit.hue, 70, dark ? 58 : 52, a)
    ctx.fill()
  }

  if (state.nearMiss > 0) {
    // Ink rather than white: a white ring on the light floor was never seen.
    const heat = state.nearMiss / 0.28
    ctx.strokeStyle = dark ? `rgba(255, 255, 255, ${heat * 0.35})` : `rgba(26, 43, 60, ${heat * 0.3})`
    ctx.lineWidth = Math.max(2, cell * 0.06)
    ctx.beginPath()
    ctx.arc(px, py, cell * (0.5 + (1 - heat) * 0.5), 0, Math.PI * 2)
    ctx.stroke()
  }

  if (state.closeCall > 0 && state.phase === 'playing') {
    const life = state.closeCall / CLOSE_CALL_SHOW
    ctx.save()
    ctx.globalAlpha = Math.min(1, life * 3)
    boardText(
      ctx,
      'close!',
      px,
      py - air * cell * 0.28 - cell * (0.62 + (1 - life) * 0.3),
      Math.max(12, cell * 0.3 * landScale(1 - life)),
      fill(22, 86, dark ? 66 : 46, 1),
    )
    ctx.restore()
  }

  if (state.celebrate > 0) {
    const t = state.celebrate / 1.35
    ctx.fillStyle = `rgba(245, 185, 66, ${t * 0.16})`
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    const ty = oy + visibleRows * cell * 0.32 - (1 - t) * cell * 0.8
    ctx.globalAlpha = Math.min(1, t * 1.6)
    boardText(ctx, 'NEW BEST', w / 2, ty, Math.max(18, cell * 0.56 * landScale(1 - t)), fill(40, 86, dark ? 66 : 40, 1))
    ctx.restore()
  }

  if (dying && state.cause) {
    const t = Math.min(1, deathT * 1.4)
    const fade = 0.95 * Math.min(1, 2 - deathT * 1.2)
    const ty = oy + visibleRows * cell * 0.28
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    boardText(
      ctx,
      DEATH_WORD[state.cause],
      w / 2,
      ty - t * cell * 0.4,
      Math.max(22, cell * 0.64 * landScale(deathT)),
      deathColour(state.cause, dark),
    )
    if (state.runCoins > 0) {
      boardText(ctx, `+${state.runCoins} coins`, w / 2, ty + cell * 0.45, Math.max(14, cell * 0.32), fill(40, 86, dark ? 66 : 40, 1))
    }
    ctx.restore()
  }

  ctx.restore()

  if (state.deathFlash > 0) {
    const heat = state.deathFlash / 0.7
    ctx.fillStyle = `rgba(255, 60, 60, ${heat * 0.42})`
    ctx.fillRect(0, 0, w, h)
  }

  if (state.phase === 'playing' && state.row < Math.floor(cameraY) + BACK_LIMIT) {
    const dangerY = rowScreenY(Math.floor(cameraY) + BACK_LIMIT, cameraY, visibleRows, oy, cell)
    const bottomY = oy + visibleRows * cell
    const grad = ctx.createLinearGradient(0, dangerY, 0, bottomY)
    grad.addColorStop(0, 'rgba(232, 93, 117, 0)')
    grad.addColorStop(1, 'rgba(232, 93, 117, 0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(0, dangerY, w, bottomY - dangerY)
  }

  if (state.phase === 'playing' && state.idleTimer > stallLimitAt(state.row) - STALL_WARN) {
    drawStallThreat(ctx, px, py, cell, w, h, state.idleTimer, performance.now() / 1000, state.row)
  }
}
