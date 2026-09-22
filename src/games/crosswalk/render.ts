import type { GameState, Vehicle } from './game'
import {
  BACK_LIMIT,
  MILESTONE_STEP,
  MOMENTUM_SHOW,
  STALL_WARN,
  stallLimitAt,
  cellMetrics,
  easeHop,
  getRailCycle,
  getRow,
  laneSpan,
} from './game'
import { drawEyes } from '../eyes'
import { isDarkTheme, isFlatTheme, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'

const GRASS_A = 142
const TREE = 158
const HOPPER = 42

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
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
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

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  dir: number,
  dark: boolean,
) {
  const body = fill(hue, 58, dark ? 60 : 58, softFillAlpha(dark ? 0.32 : 0.26))
  const stroke = fill(hue, 58, dark ? 62 : 42, 0.95)
  const line = Math.max(1.8, h * 0.08)
  roundRect(ctx, x, y, w, h, h * 0.28)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = line
  strokeOutlined(ctx)

  const glassW = w * 0.34
  const glassX = dir > 0 ? x + w * 0.34 : x + w * 0.32
  roundRect(ctx, glassX, y + h * 0.18, glassW, h * 0.58, h * 0.18)
  ctx.fillStyle = dark
    ? `rgba(180, 222, 255, ${softFillAlpha(0.22)})`
    : `rgba(255, 255, 255, ${softFillAlpha(0.48)})`
  ctx.fill()
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
}

function drawHopper(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  pulse: number,
  dark: boolean,
  dying = false,
  deathT = 0,
  /** Forward-hop squeeze: 0 = round, 1 = max skinny. */
  squeeze = 0,
  cause: GameState['cause'] = null,
  /** Rows taken back to back right now. */
  chain = 0,
) {
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

  if (dying) {
    if (cause === 'car' || cause === 'train') {
      ctx.strokeStyle = `rgba(180, 20, 20, ${0.9 - deathT * 0.4})`
      ctx.lineWidth = Math.max(2.5, size * 0.07)
      ctx.beginPath()
      ctx.moveTo(drawX - rx * 0.7, drawY - ry * 0.2)
      ctx.lineTo(drawX + rx * 0.7, drawY + ry * 0.15)
      ctx.moveTo(drawX + rx * 0.7, drawY - ry * 0.2)
      ctx.lineTo(drawX - rx * 0.7, drawY + ry * 0.15)
      ctx.stroke()
    }
    return
  }

  /*
   * Snake's eyes, at Snake's proportions. The radius comes off `r` rather than
   * `rx`, so a hopper mid-squeeze keeps round pupils while they ride along with
   * the body the squeeze gave it.
   */
  drawEyes(ctx, { x: drawX, y: drawY, rx, ry, radius: r * 0.26 })
}

function drawCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dark: boolean,
  bob = 0,
) {
  const r = size * 0.22
  const y = cy - bob
  ctx.beginPath()
  ctx.arc(cx, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill(48, 92, dark ? 58 : 54, 1)
  ctx.fill()
  ctx.strokeStyle = fill(42, 90, dark ? 42 : 38, 1)
  ctx.lineWidth = Math.max(1.6, size * 0.05)
  strokeOutlined(ctx)
  ctx.beginPath()
  ctx.arc(cx - r * 0.25, y - r * 0.28, r * 0.28, 0, Math.PI * 2)
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

function drawTrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const body = fill(350, 52, dark ? 52 : 48, 1)
  const stroke = fill(350, 52, dark ? 58 : 40, 1)
  roundRect(ctx, x, y, w, h, h * 0.18)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, h * 0.07)
  strokeOutlined(ctx)
  const carW = w / 4
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, x + i * carW + carW * 0.12, y + h * 0.16, carW * 0.76, h * 0.68, h * 0.12)
    ctx.fillStyle = dark ? 'rgba(255, 220, 220, 0.18)' : 'rgba(255, 255, 255, 0.35)'
    ctx.fill()
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
  ctx.strokeStyle = fill(32, 30, dark ? 52 : 28, 0.35)
  ctx.beginPath()
  ctx.moveTo(x + w * 0.2, y + h * 0.5)
  ctx.lineTo(x + w * 0.8, y + h * 0.5)
  strokeOutlined(ctx)
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

  if (row.kind === 'grass') {
    drawLaneBand(ctx, y, w, cell, fill(grassHue, sat(42), lit(dark ? 48 : 72), dark ? 0.28 : 0.22))
    if (!isFlatTheme()) {
      ctx.strokeStyle = fill(grassHue, sat(30), lit(dark ? 58 : 58), 0.12)
      ctx.lineWidth = 1
      ctx.strokeRect(ox + 0.5, y + 0.5, gridW - 1, cell - 1)
    }
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
        drawTrain(ctx, vx - streak, vy, vw, vh, dark)
        ctx.globalAlpha = 0.6
        drawTrain(ctx, vx - streak * 0.5, vy, vw, vh, dark)
        ctx.globalAlpha = 1
      }
      drawTrain(ctx, vx, vy, vw, vh, dark)
    }
  } else {
    drawLaneBand(ctx, y, w, cell, fill(220, 14, dark ? 34 : 78, dark ? 0.35 : 0.2))
    ctx.save()
    ctx.strokeStyle = fill(45, 70, 62, 0.22)
    ctx.setLineDash([cell * 0.12, cell * 0.18])
    /*
     * Anchored to the board, not to the screen.
     *
     * The line spans the viewport, so without this the dash pattern starts at
     * screen x=0 and the markings are welded to the window: when the view pans
     * sideways every car, tree, log and the hopper move with the world and the
     * lane markings alone stay put. They are the most road-like thing on the
     * row, so the eye takes them for the fixed ground, and then the ground is
     * the one thing not moving while everything else slides — which is what
     * made riding a log look like the board was sliding instead of the player.
     */
    ctx.lineDashOffset = -ox
    ctx.lineWidth = 2
    const midY = y + cell * 0.5
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()
    ctx.restore()

    const vy = y + cell * 0.22
    const vh = cell * 0.56
    for (const v of row.vehicles) {
      eachLaneCopy(v, span, ox, cell, w, (sx) => {
        drawVehicle(ctx, sx, vy, v.w * cell, vh, v.hue, row.dir, dark)
      })
    }
  }

  for (const treeCol of row.trees) {
    drawTree(ctx, ox + (treeCol + 0.5) * cell, y + cell * 0.52, cell * 0.88, dark, biome.tree, biome.satMul, biome.lightAdd)
  }

  const bob = Math.sin(performance.now() / 220 + worldRow) * cell * 0.04
  for (const coinCol of row.coins) {
    drawCoin(ctx, ox + (coinCol + 0.5) * cell, y + cell * 0.52, cell, dark, bob)
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
  ctx.font = `700 ${Math.max(9, Math.round(cell * 0.24))}px system-ui, sans-serif`
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
  ctx.font = `800 ${Math.max(10, Math.round(cell * 0.26))}px system-ui, sans-serif`
  const padX = cell * 0.22
  const tw = ctx.measureText(text).width + padX * 2
  const th = Math.max(16, cell * 0.42)
  const bx = w - tw - cell * 0.18
  const by = y - th - cell * 0.08
  roundRect(ctx, bx, by, tw, th, th * 0.35)
  ctx.fillStyle = `rgba(245, 185, 66, ${passed ? 0.28 : 0.92})`
  ctx.fill()
  ctx.fillStyle = passed ? 'rgba(255, 255, 255, 0.85)' : '#2a1c00'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + tw / 2, by + th / 2 + 0.5)
  ctx.restore()
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
      drawBestLine(ctx, y, w, ox, cell, state.target, state.beatBest)
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
    drawHopper(
      ctx,
      px,
      py - air * cell * 0.28,
      cell,
      state.hopPulse,
      dark,
      dying,
      deathT,
      squeeze,
      state.cause,
      state.streak,
    )
  }

  for (const pop of state.coinPops) {
    const t = Math.max(0, pop.t / 0.42)
    const cx = ox + (pop.c + 0.5) * cell
    const cy = rowScreenY(pop.r, cameraY, visibleRows, oy, cell) + cell * 0.2 - (1 - t) * cell * 0.8
    ctx.save()
    ctx.globalAlpha = t
    ctx.font = `800 ${Math.max(12, Math.round(cell * 0.32))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fill(48, 90, dark ? 62 : 48, 1)
    ctx.fillText('+1', cx, cy)
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
    const heat = state.nearMiss / 0.28
    ctx.strokeStyle = `rgba(255, 255, 255, ${heat * 0.35})`
    ctx.lineWidth = Math.max(2, cell * 0.06)
    ctx.beginPath()
    ctx.arc(px, py, cell * (0.5 + (1 - heat) * 0.5), 0, Math.PI * 2)
    ctx.stroke()
  }

  if (state.celebrate > 0) {
    const t = state.celebrate / 1.35
    ctx.fillStyle = `rgba(245, 185, 66, ${t * 0.16})`
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.font = `900 ${Math.max(18, Math.round(cell * 0.52))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const ty = oy + visibleRows * cell * 0.32 - (1 - t) * cell * 0.8
    ctx.fillStyle = `rgba(245, 185, 66, ${Math.min(1, t * 1.6)})`
    ctx.fillText('NEW BEST', w / 2, ty)
    ctx.restore()
  }

  if (dying && state.cause) {
    const labels: Record<NonNullable<GameState['cause']>, string> = {
      car: 'SPLAT!',
      train: 'SMOOSHED!',
      water: 'SPLASH!',
      edge: 'YEETED!',
      stall: 'TOO SLOW!',
    }
    const t = Math.min(1, deathT * 1.4)
    ctx.save()
    ctx.font = `900 ${Math.max(22, Math.round(cell * 0.58))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * Math.min(1, 2 - deathT * 1.2)})`
    ctx.fillText(labels[state.cause], w / 2, oy + visibleRows * cell * 0.28 - t * cell * 0.4)
    if (state.runCoins > 0) {
      ctx.font = `800 ${Math.max(14, Math.round(cell * 0.32))}px system-ui, sans-serif`
      ctx.fillStyle = `rgba(245, 185, 66, ${0.95 * Math.min(1, 2 - deathT * 1.2)})`
      ctx.fillText(`+${state.runCoins} coins`, w / 2, oy + visibleRows * cell * 0.28 + cell * 0.45)
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
