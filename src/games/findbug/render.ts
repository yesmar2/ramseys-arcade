import { inkColor, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import { drawBug, mixHex } from './bugSprite'
import { catchRadius, type GameState, type RoundState } from './game'
import {
  boardRowY,
  CODE_CHAR_W,
  CODE_FONT_H,
  CODE_LEFT,
  codeLineAt,
  type Cabinet,
  type CodeLine,
  type Decoy,
  type Scene,
} from './scenes'

/**
 * Normalized geometry resolves against width for x/sizes and height for y and
 * font size — the stage aspect is fixed, so the code scene's character grid
 * stays aligned with the anchors baked into the scene.
 */

const HINT_RADIUS = 0.22

/** Faded furniture tone — decoys and camouflaged bugs both land near here. */
function fade(t: number): string {
  return mixHex(inkColor(), playfieldColor(), t)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
}

function tokenColor(kind: CodeLine['tokens'][number]['kind']): string {
  if (kind === 'keyword') return 'hsl(265, 52%, 58%)'
  if (kind === 'number') return 'hsl(35, 68%, 50%)'
  if (kind === 'string') return 'hsl(150, 48%, 42%)'
  if (kind === 'punct') return fade(0.42)
  return fade(0.08)
}

function drawCodeScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  round: RoundState,
  w: number,
  h: number,
) {
  // Anchors were baked against a fixed character grid, so size the font until
  // its real advance matches that grid — otherwise tokens drift off the
  // semicolon the bug is supposed to be sitting on.
  const face = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  let fontPx = CODE_FONT_H * h
  ctx.font = `500 ${fontPx}px ${face}`
  const advance = ctx.measureText('0123456789').width / 10
  if (advance > 0) {
    fontPx *= (CODE_CHAR_W * w) / advance
    ctx.font = `500 ${fontPx}px ${face}`
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // While the bug sits on a line end, it is covering — eating — the semicolon.
  const perched = round.mode === 'idle' && !round.found
  const eatenLine = perched ? scene.anchors[round.anchorIndex]?.lineIndex : undefined

  scene.codeLines.forEach((line, i) => {
    const y = codeLineAt(i) * h
    let col = line.indent * 2
    for (const token of line.tokens) {
      if (token.text === ';' && i === eatenLine) {
        col += token.text.length
        continue
      }
      ctx.fillStyle = tokenColor(token.kind)
      ctx.fillText(token.text, (CODE_LEFT + col * CODE_CHAR_W) * w, y)
      col += token.text.length
    }
  })
}

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
  ctx.fillStyle = `${cab.accent}${Math.round(softFillAlpha(0.3) * 255).toString(16).padStart(2, '0')}`
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.1, y + ch * 0.08, cw * 0.8, ch * 0.13, radius * 0.5)
  ctx.fill()

  // Screen.
  ctx.fillStyle = mixHex(playfieldColor(), cab.accent, 0.22 * cab.tone)
  ctx.strokeStyle = fade(0.5)
  ctx.lineWidth = Math.max(1, cw * 0.015)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.14, y + ch * 0.28, cw * 0.72, ch * 0.42, radius * 0.4)
  ctx.fill()
  strokeOutlined(ctx)
}

function drawBoardScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
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

  scene.rows.forEach((row, i) => {
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

function drawDecoys(
  ctx: CanvasRenderingContext2D,
  decoys: Decoy[],
  timeS: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = fade(0.46)
  for (const d of decoys) {
    const wobble = d.driftAmp > 0 ? Math.sin(timeS * d.driftRate * Math.PI * 2 + d.driftPhase) : 0
    const x = (d.x + wobble * d.driftAmp) * w
    const y = d.y * h
    const r = d.r * w

    if (d.kind === 'screw') {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // Specks and stray punctuation read as a resting body at a glance.
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.25, r * 0.8, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHintVeil(ctx: CanvasRenderingContext2D, round: RoundState, w: number, h: number) {
  const bx = round.x * w
  const by = round.y * h
  ctx.save()
  ctx.fillStyle = mixHex(playfieldColor(), inkColor(), 0.08)
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

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const timeS = performance.now() / 1000
  const round = state.round
  const scene = round.scene

  drawBackground(ctx, w, h)

  if (scene.kind === 'code') drawCodeScene(ctx, scene, round, w, h)
  else if (scene.kind === 'cabinets') for (const cab of scene.cabinets) drawCabinet(ctx, cab, w, h)
  else drawBoardScene(ctx, scene, w, h)

  drawDecoys(ctx, scene.decoys, timeS, w, h)

  if (round.hintUsed && !round.found) drawHintVeil(ctx, round, w, h)

  // The bug sinks toward the furniture tone as rounds get harder, but never
  // past it — there is always contrast left to find.
  const camoTone = fade(0.55 * round.config.camo)
  const body = mixHex(camoTone, scene.camoColor, 0.18)
  // Reduced motion trades the hop for this pulse, so it has to read clearly.
  const look = {
    body: round.pulse > 0 ? mixHex(body, '#e85d75', round.pulse * 0.55) : body,
    leg: mixHex(body, inkColor(), 0.4),
  }

  drawBug(ctx, round.x * w, round.y * h, round.config.bugSize * w, {
    angle: round.angle,
    legPhase: round.legPhase,
    moving: round.mode === 'scurry',
    look,
    flash: round.found ? Math.max(0, 0.7 - round.foundAge) : 0,
  })

  if (round.found) {
    ctx.strokeStyle = 'hsl(150, 52%, 44%)'
    ctx.lineWidth = Math.max(2, w * 0.009)
    ctx.beginPath()
    ctx.arc(round.x * w, round.y * h, catchRadius(round) * w * (1 + round.foundAge * 0.6), 0, Math.PI * 2)
    ctx.stroke()
  }

  drawMissFlash(ctx, state, w, h)

  if (state.keyboardMode && state.phase === 'playing' && !round.found) {
    drawReticle(ctx, state.reticleX, state.reticleY, w, h)
  }
}
