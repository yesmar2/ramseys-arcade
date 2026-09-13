import { inkColor, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import { mixColor } from '../../lib/color'
import { drawBug } from './bugSprite'
import { catchRadius, type GameState, type RoundState } from './game'
import {
  boardRowY,
  cableY,
  type Block,
  type Cabinet,
  type Cable,
  type Decoy,
  type Motif,
  type Scene,
  type Tie,
  type Token,
} from './scenes'

/**
 * Normalized geometry resolves against width for x and sizes, height for y.
 * The stage aspect is fixed, so a scene's baked anchors stay put.
 */

const HINT_RADIUS = 0.22

/** Faded furniture tone — decoys and camouflaged bugs both land near here. */
function fade(t: number): string {
  return mixColor(inkColor(), playfieldColor(), t)
}

function alphaHex(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0')
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  // Floor scenes lay a surface down first, so the gaps between the clutter are
  // somewhere a camouflaged bug can actually hide.
  if (scene.ground === undefined) return
  ctx.fillStyle = fade(scene.ground)
  ctx.fillRect(0, 0, w, h)
}

// ---------------------------------------------------------------- cabinets

function drawCabinet(ctx: CanvasRenderingContext2D, cab: Cabinet, w: number, h: number) {
  const x = cab.x * w
  const y = cab.y * h
  const cw = cab.w * w
  const ch = cab.h * h
  const radius = Math.min(cw, ch) * 0.12

  ctx.fillStyle = fade(0.72)
  ctx.strokeStyle = fade(0.45)
  ctx.lineWidth = Math.max(1, cw * 0.02)
  ctx.beginPath()
  ctx.roundRect(x, y, cw, ch, radius)
  ctx.fill()
  strokeOutlined(ctx)

  // Marquee.
  ctx.fillStyle = `${cab.accent}${alphaHex(softFillAlpha(0.3))}`
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.1, y + ch * 0.08, cw * 0.8, ch * 0.13, radius * 0.5)
  ctx.fill()

  // Screen.
  ctx.fillStyle = mixColor(playfieldColor(), cab.accent, 0.22 * cab.tone)
  ctx.strokeStyle = fade(0.5)
  ctx.lineWidth = Math.max(1, cw * 0.015)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.14, y + ch * 0.28, cw * 0.72, ch * 0.42, radius * 0.4)
  ctx.fill()
  strokeOutlined(ctx)
}

// ------------------------------------------------------------------- board

function drawBoardScene(
  ctx: CanvasRenderingContext2D,
  rows: readonly { rank: number; name: string; score: number }[],
  w: number,
  h: number,
) {
  const fontPx = h * 0.032
  ctx.textBaseline = 'middle'

  ctx.font = `700 ${fontPx * 0.85}px Outfit, system-ui, sans-serif`
  ctx.fillStyle = fade(0.5)
  ctx.textAlign = 'left'
  ctx.fillText('RANK', w * 0.1, h * 0.08)
  ctx.fillText('NAME', w * 0.24, h * 0.08)
  ctx.textAlign = 'right'
  ctx.fillText('SCORE', w * 0.9, h * 0.08)

  rows.forEach((row, i) => {
    const y = boardRowY(i) * h

    ctx.fillStyle = fade(0.82)
    ctx.beginPath()
    ctx.roundRect(w * 0.07, y - fontPx * 0.9, w * 0.86, fontPx * 1.8, fontPx * 0.4)
    ctx.fill()

    ctx.font = `700 ${fontPx}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillStyle = fade(0.45)
    ctx.fillText(String(row.rank), w * 0.1, y)
    ctx.fillStyle = fade(0.08)
    ctx.fillText(row.name, w * 0.24, y)
    ctx.textAlign = 'right'
    ctx.fillText(row.score.toLocaleString(), w * 0.9, y)
  })
}

// -------------------------------------------------------------------- loom

function drawCable(ctx: CanvasRenderingContext2D, c: Cable, w: number, h: number) {
  // Same cubic the anchors were sampled from, so a perch lands on the stroke.
  ctx.strokeStyle = fade(c.tone)
  ctx.lineWidth = c.width * w
  ctx.lineCap = 'round'
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
  ctx.stroke()

  // A lighter core sells it as a sheathed cable rather than a painted stripe.
  ctx.strokeStyle = fade(Math.max(0.18, c.tone - 0.16))
  ctx.lineWidth = c.width * w * 0.36
  ctx.stroke()
}

function drawTie(ctx: CanvasRenderingContext2D, tie: Tie, w: number, h: number) {
  const th = w * 0.014
  ctx.fillStyle = fade(0.5)
  ctx.beginPath()
  ctx.roundRect(tie.x * w, tie.y * h - th / 2, tie.w * w, th, th * 0.4)
  ctx.fill()
}

function drawBlock(ctx: CanvasRenderingContext2D, b: Block, w: number, h: number) {
  const x = b.x * w
  const y = b.y * h
  const bw = b.w * w
  const bh = b.h * h
  const radius = Math.min(bw, bh) * 0.16

  ctx.fillStyle = fade(0.66)
  ctx.strokeStyle = fade(0.42)
  ctx.lineWidth = Math.max(1, bw * 0.02)
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, radius)
  ctx.fill()
  strokeOutlined(ctx)

  ctx.fillStyle = fade(0.34)
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

  ctx.fillStyle = fade(t.tone)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = fade(Math.max(0.2, t.tone - 0.22))
  ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2)
  ctx.stroke()

  // A milled edge gives the rim the same broken silhouette a bug's legs have.
  ctx.lineWidth = Math.max(1, r * 0.09)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88)
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    ctx.stroke()
  }
}

// ------------------------------------------------------------------ carpet

function drawMotif(ctx: CanvasRenderingContext2D, m: Motif, w: number, h: number) {
  const size = m.size * w
  ctx.save()
  ctx.translate(m.x * w, m.y * h)
  ctx.rotate(m.rot)
  ctx.fillStyle = `${m.accent}${alphaHex(softFillAlpha(0.34))}`
  ctx.strokeStyle = `${m.accent}${alphaHex(softFillAlpha(0.5))}`
  ctx.lineWidth = Math.max(1, size * 0.1)

  if (m.kind === 'dot') {
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2)
    ctx.fill()
  } else if (m.kind === 'tri') {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.5)
    ctx.lineTo(size * 0.46, size * 0.36)
    ctx.lineTo(-size * 0.46, size * 0.36)
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
      const r = i % 2 === 0 ? size * 0.5 : size * 0.21
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r
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

function drawDecoys(ctx: CanvasRenderingContext2D, decoys: Decoy[], w: number, h: number) {
  ctx.fillStyle = fade(0.46)
  for (const d of decoys) {
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
  ctx.fillStyle = mixColor(playfieldColor(), inkColor(), 0.08)
  ctx.globalAlpha = 0.82
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
  const round = state.round
  const scene = round.scene

  drawBackground(ctx, scene, w, h)
  drawScene(ctx, scene, w, h)
  drawDecoys(ctx, scene.decoys, w, h)

  if (round.hintUsed && !round.found) drawHintVeil(ctx, round, w, h)

  // The bug sinks toward the surface it is sitting on as rounds get harder, but
  // never all the way — and the legs stay lighter still, so there is always
  // contrast left to find.
  const body = mixColor(fade(0.18), fade(scene.camoTone), round.config.camo)

  drawBug(ctx, round.x * w, round.y * h, round.config.bugSize * w, {
    angle: round.angle,
    look: { body, leg: mixColor(body, inkColor(), 0.4) },
    flash: round.found ? Math.max(0, 0.7 - round.foundAge) : 0,
  })

  if (round.found) {
    ctx.strokeStyle = 'hsl(150, 52%, 44%)'
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
