import { mixColor } from '../../lib/color'
import { isFlatTheme } from '../../lib/theme'
import { drawBug } from './bugSprite'
import { catchRadius, fieldRect, type GameState, type RoundState } from './game'
import {
  boardRowY,
  BOARD_GROUND,
  cableY,
  CARPET_GROUND,
  COUNTER_FELT,
  type Block,
  type Cabinet,
  type Cable,
  type Motif,
  type Scene,
  type Tie,
  type Token,
} from './scenes'

/**
 * Scene geometry is normalized: x against width, y against height. Everything
 * here paints a real surface in its own colours rather than a wash of the app
 * playfield — the bug hides against the one thing it is sitting on, not against
 * a drained room, so the scenes are free to be as saturated as they like.
 */

const HINT_RADIUS = 0.22

/** Hard outline. Crispness is mostly a matter of committing to an edge. */
function edge(ctx: CanvasRenderingContext2D, colour: string, width: number) {
  if (isFlatTheme()) return
  ctx.strokeStyle = colour
  ctx.lineWidth = Math.max(1, width)
  ctx.stroke()
}

function groundFor(scene: Scene): string {
  if (scene.kind === 'tokens') return COUNTER_FELT
  if (scene.kind === 'carpet') return CARPET_GROUND
  if (scene.kind === 'board') return BOARD_GROUND
  if (scene.kind === 'loom') return '#171d29'
  return '#151a24'
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  ctx.fillStyle = groundFor(scene)
  ctx.fillRect(0, 0, w, h)
}

// ---------------------------------------------------------------- cabinets

function drawCabinet(ctx: CanvasRenderingContext2D, cab: Cabinet, w: number, h: number) {
  const x = cab.x * w
  const y = cab.y * h
  const cw = cab.w * w
  const ch = cab.h * h
  const radius = Math.min(cw, ch) * 0.1

  // Enamel body, with a lit edge down one side so it reads as a solid object.
  ctx.fillStyle = cab.body
  ctx.beginPath()
  ctx.roundRect(x, y, cw, ch, radius)
  ctx.fill()
  edge(ctx, mixColor(cab.body, '#000000', 0.45), cw * 0.022)

  ctx.fillStyle = mixColor(cab.body, '#ffffff', 0.1)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.03, y + ch * 0.04, cw * 0.07, ch * 0.92, radius * 0.5)
  ctx.fill()

  // Marquee — the brightest thing on the cabinet, as it should be.
  ctx.fillStyle = cab.accent
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.12, y + ch * 0.07, cw * 0.76, ch * 0.15, radius * 0.45)
  ctx.fill()
  ctx.fillStyle = mixColor(cab.accent, '#ffffff', 0.5)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.16, y + ch * 0.09, cw * 0.68, ch * 0.05, radius * 0.3)
  ctx.fill()

  // Screen: a dark well washed with the cabinet's own glow, plus scanlines.
  const sx = x + cw * 0.13
  const sy = y + ch * 0.29
  const sw = cw * 0.74
  const sh = ch * 0.44
  ctx.fillStyle = mixColor('#05070c', cab.accent, 0.32 * cab.tone)
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sh, radius * 0.4)
  ctx.fill()
  edge(ctx, '#0a0d14', cw * 0.02)

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sh, radius * 0.4)
  ctx.clip()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = mixColor(cab.accent, '#ffffff', 0.55)
  const lines = 7
  for (let i = 0; i < lines; i++) {
    ctx.fillRect(sx, sy + (sh * (i + 0.25)) / lines, sw, Math.max(1, sh * 0.035))
  }
  ctx.restore()

  // Control deck.
  ctx.fillStyle = mixColor(cab.body, '#000000', 0.32)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.1, y + ch * 0.78, cw * 0.8, ch * 0.12, radius * 0.4)
  ctx.fill()
}

// ------------------------------------------------------------------- board

const MEDALS = ['#f5c542', '#cfd6e0', '#d08a45'] as const

function drawBoardScene(
  ctx: CanvasRenderingContext2D,
  rows: readonly { rank: number; name: string; score: number }[],
  w: number,
  h: number,
) {
  const fontPx = Math.min(h * 0.032, w * 0.05)
  ctx.textBaseline = 'middle'

  ctx.font = `700 ${fontPx * 0.78}px Outfit, system-ui, sans-serif`
  ctx.fillStyle = '#5f7fae'
  ctx.textAlign = 'left'
  ctx.fillText('RANK', w * 0.1, h * 0.07)
  ctx.fillText('NAME', w * 0.24, h * 0.07)
  ctx.textAlign = 'right'
  ctx.fillText('SCORE', w * 0.9, h * 0.07)

  rows.forEach((row, i) => {
    const y = boardRowY(i, rows.length) * h
    const pill = i % 2 === 0 ? '#1d2740' : '#222c47'
    const medal: string | null = MEDALS[i] ?? null

    ctx.fillStyle = pill
    ctx.beginPath()
    ctx.roundRect(w * 0.07, y - fontPx * 0.92, w * 0.86, fontPx * 1.84, fontPx * 0.42)
    ctx.fill()

    ctx.font = `800 ${fontPx}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillStyle = medal ?? '#556f96'
    ctx.fillText(String(row.rank), w * 0.1, y)
    ctx.fillStyle = medal ?? '#dce6f5'
    ctx.fillText(row.name, w * 0.24, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = medal ?? '#7fe0b0'
    ctx.fillText(row.score.toLocaleString(), w * 0.9, y)
  })
}

// -------------------------------------------------------------------- loom

function drawCable(ctx: CanvasRenderingContext2D, c: Cable, w: number, h: number) {
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(c.x0 * w, cableY(0) * h)
    ctx.bezierCurveTo(
      c.x1 * w,
      cableY(1 / 3) * h,
      c.x2 * w,
      cableY(2 / 3) * h,
      c.x3 * w,
      cableY(1) * h,
    )
  }

  ctx.lineCap = 'round'

  // Dark casing, sheath colour, then a highlight down one side.
  ctx.strokeStyle = mixColor(c.colour, '#000000', 0.55)
  ctx.lineWidth = c.width * w
  path()
  ctx.stroke()

  ctx.strokeStyle = c.colour
  ctx.lineWidth = c.width * w * 0.72
  path()
  ctx.stroke()

  ctx.save()
  ctx.translate(-c.width * w * 0.2, 0)
  ctx.strokeStyle = mixColor(c.colour, '#ffffff', 0.45)
  ctx.lineWidth = c.width * w * 0.18
  path()
  ctx.stroke()
  ctx.restore()
}

function drawTie(ctx: CanvasRenderingContext2D, tie: Tie, w: number, h: number) {
  const th = w * 0.015
  ctx.fillStyle = '#39414f'
  ctx.beginPath()
  ctx.roundRect(tie.x * w, tie.y * h - th / 2, tie.w * w, th, th * 0.35)
  ctx.fill()
  edge(ctx, '#20252e', w * 0.003)
}

function drawBlock(ctx: CanvasRenderingContext2D, b: Block, w: number, h: number) {
  const x = b.x * w
  const y = b.y * h
  const bw = b.w * w
  const bh = b.h * h
  const radius = Math.min(bw, bh) * 0.14

  ctx.fillStyle = '#4a5468'
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, radius)
  ctx.fill()
  edge(ctx, '#262c38', bw * 0.02)

  // Brass pins.
  ctx.fillStyle = '#d9a441'
  const pinW = bw / (b.pins * 2 + 1)
  for (let i = 0; i < b.pins; i++) {
    ctx.beginPath()
    ctx.roundRect(x + pinW * (i * 2 + 1), y + bh * 0.62, pinW, bh * 0.3, pinW * 0.3)
    ctx.fill()
  }
}

// ------------------------------------------------------------------ tokens

function drawToken(ctx: CanvasRenderingContext2D, t: Token, w: number, h: number) {
  const x = t.x * w
  const y = t.y * h
  const r = t.r * w
  const face = mixColor(t.colour, '#000000', (1 - t.tone) * 0.3)

  // Rim, struck face, milled edge.
  ctx.fillStyle = mixColor(face, '#000000', 0.4)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(x, y - r * 0.05, r * 0.88, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = mixColor(face, '#ffffff', 0.42)
  ctx.lineWidth = Math.max(1, r * 0.1)
  ctx.beginPath()
  ctx.arc(x, y - r * 0.05, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = Math.max(1, r * 0.08)
  ctx.strokeStyle = mixColor(face, '#000000', 0.32)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.88, y - r * 0.05 + Math.sin(a) * r * 0.88)
    ctx.lineTo(x + Math.cos(a) * r, y - r * 0.05 + Math.sin(a) * r)
    ctx.stroke()
  }
}

// ------------------------------------------------------------------ carpet

function drawMotif(ctx: CanvasRenderingContext2D, m: Motif, w: number, h: number) {
  const size = m.size * w
  ctx.save()
  ctx.translate(m.x * w, m.y * h)
  ctx.rotate(m.rot)
  ctx.fillStyle = m.accent
  ctx.strokeStyle = m.accent
  ctx.lineWidth = Math.max(1.5, size * 0.16)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (m.kind === 'dot') {
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = mixColor(m.accent, '#ffffff', 0.5)
    ctx.lineWidth = Math.max(1, size * 0.08)
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  } else if (m.kind === 'tri') {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.48)
    ctx.lineTo(size * 0.44, size * 0.34)
    ctx.lineTo(-size * 0.44, size * 0.34)
    ctx.closePath()
    ctx.fill()
  } else if (m.kind === 'zig') {
    ctx.beginPath()
    ctx.moveTo(-size * 0.5, size * 0.24)
    ctx.lineTo(-size * 0.17, -size * 0.24)
    ctx.lineTo(size * 0.17, size * 0.24)
    ctx.lineTo(size * 0.5, -size * 0.24)
    ctx.stroke()
  } else {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? size * 0.5 : size * 0.2
      const px = Math.cos(a) * rr
      const py = Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

// ------------------------------------------------------------------ shared

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  if (scene.kind === 'cabinets') {
    for (const cab of scene.cabinets) drawCabinet(ctx, cab, w, h)
    return
  }
  if (scene.kind === 'board') {
    drawBoardScene(ctx, scene.rows, w, h)
    return
  }
  if (scene.kind === 'loom') {
    for (const c of scene.cables) drawCable(ctx, c, w, h)
    for (const t of scene.ties) drawTie(ctx, t, w, h)
    for (const b of scene.blocks) drawBlock(ctx, b, w, h)
    return
  }
  if (scene.kind === 'tokens') {
    for (const t of scene.tokens) drawToken(ctx, t, w, h)
    return
  }
  for (const m of scene.motifs) drawMotif(ctx, m, w, h)
}

/**
 * Decoys take the colour of the ground they lie on, so they read as grit in the
 * scene rather than as a layer painted over it.
 */
function drawDecoys(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  ctx.fillStyle = mixColor(groundFor(scene), '#ffffff', 0.34)
  for (const d of scene.decoys) {
    const x = d.x * w
    const y = d.y * h
    const r = d.r * w

    if (d.kind === 'screw') {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // Specks read as a resting body at a glance — that is the whole point.
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.25, r * 0.8, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHintVeil(ctx: CanvasRenderingContext2D, round: RoundState, w: number, h: number) {
  const bx = round.x * w
  const by = round.y * h
  ctx.save()
  ctx.fillStyle = '#05070c'
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  // Reversed arc punches the hole the player still has to search.
  ctx.arc(bx, by, HINT_RADIUS * w, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.restore()
}

function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const px = x * w
  const py = y * h
  const r = w * 0.05
  ctx.strokeStyle = 'hsl(198, 70%, 52%)'
  ctx.lineWidth = Math.max(1.5, w * 0.005)
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px - r * 1.5, py)
  ctx.lineTo(px - r * 0.4, py)
  ctx.moveTo(px + r * 0.4, py)
  ctx.lineTo(px + r * 1.5, py)
  ctx.moveTo(px, py - r * 1.5)
  ctx.lineTo(px, py - r * 0.4)
  ctx.moveTo(px, py + r * 0.4)
  ctx.lineTo(px, py + r * 1.5)
  ctx.stroke()
}

function drawMissFlash(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const t = state.missFlash
  if (t <= 0) return
  ctx.strokeStyle = `hsla(352, 62%, 54%, ${t})`
  ctx.lineWidth = Math.max(2, w * 0.008)
  ctx.beginPath()
  ctx.arc(state.missX * w, state.missY * h, w * 0.03 * (1.6 - t), 0, Math.PI * 2)
  ctx.stroke()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const field = fieldRect(w, h, state.round.aspect)

  // Carry the surround in the scene's own ground, so a window that does not
  // match the board reads as more of the same surface rather than as bars.
  ctx.fillStyle = groundFor(state.round.scene)
  ctx.fillRect(0, 0, w, h)

  // Everything below is authored against a canvas that is exactly the scene, so
  // shift into the field and hand it the field's size.
  ctx.save()
  ctx.translate(field.x, field.y)
  drawField(ctx, state, field.w, field.h)
  ctx.restore()
}

function drawField(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const round = state.round
  const scene = round.scene

  drawBackground(ctx, scene, w, h)
  drawScene(ctx, scene, w, h)
  drawDecoys(ctx, scene, w, h)

  if (round.hintUsed && !round.found) drawHintVeil(ctx, round, w, h)

  /*
   * Camouflage is against the one surface the bug is perched on, not against a
   * drained scene — that is what lets everything above stay saturated. It sinks
   * toward that colour as the rounds get harder, while the legs stay a hard
   * dark line so the silhouette is crisp however close the match gets.
   */
  const lit = mixColor(round.camoBase, '#ffffff', 0.5)
  const body = mixColor(lit, round.camoBase, round.config.camo)

  drawBug(ctx, round.x * w, round.y * h, round.config.bugSize * w, {
    angle: round.angle,
    look: { body, leg: mixColor(body, '#05070c', 0.6) },
    flash: round.found ? Math.max(0, 0.7 - round.foundAge) : 0,
  })

  if (round.found) {
    ctx.strokeStyle = 'hsl(150, 60%, 50%)'
    ctx.lineWidth = Math.max(2, w * 0.009)
    ctx.beginPath()
    ctx.arc(
      round.x * w,
      round.y * h,
      catchRadius(round) * w * (1 + round.foundAge * 0.6),
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }

  drawMissFlash(ctx, state, w, h)

  if (state.keyboardMode && state.phase === 'playing' && !round.found) {
    drawReticle(ctx, state.reticleX, state.reticleY, w, h)
  }
}
