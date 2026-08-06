import type { FallingPiece, GameState, Slab } from './StackerEngine'
import { SLAB_H } from './StackerEngine'

function project(x: number, y: number, z: number, cx: number, cy: number) {
  const isoX = (x - z) * 0.9
  const isoY = (x + z) * 0.5 - y
  return { x: cx + isoX, y: cy + isoY }
}

function slabColor(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function pathPoly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
}

function drawSlab(
  ctx: CanvasRenderingContext2D,
  slab: Slab,
  y: number,
  cx: number,
  cy: number,
  opts: { alpha?: number } = {},
) {
  const alpha = opts.alpha ?? 1
  const hw = slab.w / 2
  const hd = slab.d / 2
  const x = slab.x
  const z = slab.z
  const h = SLAB_H

  const top = [
    project(x - hw, y + h, z - hd, cx, cy),
    project(x + hw, y + h, z - hd, cx, cy),
    project(x + hw, y + h, z + hd, cx, cy),
    project(x - hw, y + h, z + hd, cx, cy),
  ]
  const midR = [
    project(x + hw, y + h, z - hd, cx, cy),
    project(x + hw, y + h, z + hd, cx, cy),
    project(x + hw, y, z + hd, cx, cy),
    project(x + hw, y, z - hd, cx, cy),
  ]
  const midL = [
    project(x - hw, y + h, z + hd, cx, cy),
    project(x + hw, y + h, z + hd, cx, cy),
    project(x + hw, y, z + hd, cx, cy),
    project(x - hw, y, z + hd, cx, cy),
  ]

  const hue = slab.hue
  const sat = 58

  // Right face
  ctx.fillStyle = slabColor(hue, sat, 52, alpha)
  pathPoly(ctx, midR)
  ctx.fill()

  // Left face
  ctx.fillStyle = slabColor(hue, sat, 42, alpha)
  pathPoly(ctx, midL)
  ctx.fill()

  // Top face
  const topLight = slab.perfect ? 78 : 68
  ctx.fillStyle = slabColor(hue, sat, topLight, alpha)
  pathPoly(ctx, top)
  ctx.fill()

  // Edge highlight
  ctx.strokeStyle = slabColor(hue, 30, 90, 0.4 * alpha)
  ctx.lineWidth = 1.25
  pathPoly(ctx, top)
  ctx.stroke()
}

function drawFalling(ctx: CanvasRenderingContext2D, piece: FallingPiece, cx: number, cy: number) {
  const slab: Slab = {
    x: piece.x, z: piece.z, w: piece.w, d: piece.d,
    hue: piece.hue, perfect: false,
  }
  drawSlab(ctx, slab, piece.y, cx, cy, { alpha: Math.max(0, piece.life) })
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Soft light wash — no hard mid-band
  ctx.fillStyle = '#edf7f4'
  ctx.fillRect(0, 0, w, h)

  const sky = ctx.createRadialGradient(w * 0.2, h * -0.05, 20, w * 0.25, 0, w * 0.9)
  sky.addColorStop(0, 'rgba(200, 232, 248, 0.9)')
  sky.addColorStop(1, 'rgba(200, 232, 248, 0)')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const mint = ctx.createRadialGradient(w * 0.95, h * 0.15, 10, w, h * 0.2, w * 0.7)
  mint.addColorStop(0, 'rgba(197, 240, 228, 0.75)')
  mint.addColorStop(1, 'rgba(197, 240, 228, 0)')
  ctx.fillStyle = mint
  ctx.fillRect(0, 0, w, h)

  const sun = ctx.createRadialGradient(w * 0.5, h * 1.05, 20, w * 0.5, h, w * 0.65)
  sun.addColorStop(0, 'rgba(255, 233, 184, 0.55)')
  sun.addColorStop(1, 'rgba(255, 233, 184, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h)

  // Subtle dot pattern
  ctx.fillStyle = 'rgba(74, 168, 232, 0.1)'
  for (let py = 14; py < h; py += 28) {
    for (let px = 14; px < w; px += 28) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake * 14 : 0
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake * 10 : 0
  // Full 1:1 camera follow so the tower never climbs into the HUD
  const cx = w / 2 + shakeX
  const cy = h * 0.72 + state.cameraY + shakeY

  // Ground shadow disc
  ctx.save()
  ctx.translate(cx, cy + 10)
  ctx.scale(1, 0.35)
  const ground = ctx.createRadialGradient(0, 0, 12, 0, 0, 160)
  ground.addColorStop(0, 'rgba(26, 43, 60, 0.12)')
  ground.addColorStop(1, 'rgba(26, 43, 60, 0)')
  ctx.fillStyle = ground
  ctx.beginPath()
  ctx.arc(0, 0, 160, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Draw stack
  const start = Math.max(0, state.stack.length - 40)
  for (let i = start; i < state.stack.length; i++) {
    drawSlab(ctx, state.stack[i], i * SLAB_H, cx, cy)
  }

  // Falling chops
  for (const f of state.falling) {
    drawFalling(ctx, f, cx, cy)
  }

  // Moving slab
  if (state.phase === 'playing' || state.phase === 'menu') {
    const y = state.stack.length * SLAB_H
    drawSlab(ctx, state.moving, y, cx, cy, {
      alpha: state.phase === 'menu' ? 0.85 : 1,
    })
  }

  // Perfect-stack floaters
  for (const f of state.floaters) {
    const p = project(f.x, f.y, f.z, cx, cy)
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = '700 20px Fredoka, Nunito, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 10
    ctx.fillText(f.text, p.x, p.y)
    ctx.restore()
  }

  // Flash wash
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.25})`
    ctx.fillRect(0, 0, w, h)
  }
}
