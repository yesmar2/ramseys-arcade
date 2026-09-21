import type { GameState } from './game'
import { BEAD_SPACING, boostFuelLeft, foodBonusLeft, isBoosting, visualSegments } from './game'
import { playHeader } from '../playHeader'
import { isDarkTheme, isFlatTheme, playfieldColor, softFillAlpha } from '../../lib/theme'

/** How far the board panel is drawn outside the grid, on every side. */
const PANEL_PAD = 10

const HEAD_HUE = 158
/** Degrees of hue each bead steps away from the head — wraps the rainbow as you grow. */
const HUE_PER_BEAD = 10

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

  const dark = isDarkTheme()

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  // Same starfield treatment as Asteroids
  const step = 28 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.14)'
  for (let py = step * 0.4; py < h; py += step) {
    for (let px = step * 0.4; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // The board gets what is left after both strips, not the whole canvas: the
  // header is the room the score readout needs, the footer the room the level
  // and tank need.
  //
  // The panel is drawn PANEL_PAD outside the grid on every side, so the header
  // has to cover that too — clearing the grid alone still leaves the panel's
  // top border reaching up into the score.
  const header = playHeader(w) + PANEL_PAD
  const footer = Math.max(22, Math.min(w, h) * 0.07)
  // On a phone the board is limited by width — fifteen columns across 375px —
  // so every pixel of side margin comes straight off the cell. Trimmed to the
  // panel's own thickness plus a hair, which is as tight as it can be drawn
  // without the panel border running off the edge. Landscape is limited by
  // height instead, so this costs it nothing.
  const pad = Math.max(PANEL_PAD + 2, Math.min(w, h) * 0.03)
  const boardW = w - pad * 2
  const boardH = h - pad - header - footer
  const cell = Math.min(boardW / state.cols, boardH / state.rows)
  const gridW = cell * state.cols
  const gridH = cell * state.rows
  const ox = (w - gridW) / 2
  const oy = header + Math.max(0, (boardH - gridH) / 2)

  // Board panel
  const radius = Math.max(12, cell * 0.55)
  const flat = isFlatTheme()
  roundRect(ctx, ox - PANEL_PAD, oy - PANEL_PAD, gridW + PANEL_PAD * 2, gridH + PANEL_PAD * 2, radius)
  ctx.fillStyle = dark ? 'rgba(8, 14, 20, 0.55)' : 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  if (!flat) {
    ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.08)' : 'rgba(26, 43, 60, 0.06)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Soft grid dots
  ctx.fillStyle = dark ? 'rgba(46, 184, 160, 0.14)' : 'rgba(46, 184, 160, 0.12)'
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cx = ox + (x + 0.5) * cell
      const cy = oy + (y + 0.5) * cell
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1, cell * 0.06), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Everything that belongs to the playfield is confined to it. A trail can
  // reach past the board — the admin jump lays out a body longer than the board
  // is tall — and without this the beads are drawn up over the score.
  ctx.save()
  roundRect(ctx, ox - PANEL_PAD, oy - PANEL_PAD, gridW + PANEL_PAD * 2, gridH + PANEL_PAD * 2, radius)
  ctx.clip()

  const blockInset = cell * 0.06
  const blockRadius = Math.max(2, cell * 0.22)
  const blockPath = (key: string) => {
    const [wx, wy] = key.split(',').map(Number)
    roundRect(
      ctx,
      ox + wx * cell + blockInset,
      oy + wy * cell + blockInset,
      cell - blockInset * 2,
      cell - blockInset * 2,
      blockRadius,
    )
  }

  // The shape the next food brings, sketched where it will stand. A level you
  // can see coming is one you steer around instead of one you discover.
  if (state.nextWalls) {
    ctx.save()
    ctx.setLineDash([Math.max(3, cell * 0.16), Math.max(3, cell * 0.14)])
    ctx.strokeStyle = dark ? 'rgba(160, 190, 210, 0.3)' : 'rgba(26, 43, 60, 0.22)'
    ctx.lineWidth = Math.max(1, cell * 0.05)
    for (const key of state.nextWalls) {
      if (state.walls.has(key)) continue
      blockPath(key)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Barriers — read as built into the board, not dropped onto it, so the eye
  // sorts them from the food and the body at a glance. A block the head was
  // standing in when the level landed is drawn faint until the head leaves it,
  // which is exactly as long as it will not kill you.
  for (const wall of state.walls) {
    const asleep = state.dormant.has(wall)
    blockPath(wall)
    ctx.fillStyle = dark
      ? `rgba(122, 150, 172, ${asleep ? 0.12 : 0.3})`
      : `rgba(26, 43, 60, ${asleep ? 0.08 : 0.2})`
    ctx.fill()
    if (!flat) {
      ctx.strokeStyle = dark
        ? `rgba(160, 190, 210, ${asleep ? 0.2 : 0.45})`
        : `rgba(26, 43, 60, ${asleep ? 0.14 : 0.32})`
      ctx.lineWidth = Math.max(1, cell * 0.05)
      ctx.stroke()
    }
  }

  // Food
  {
    const fx = ox + (state.food.x + 0.5) * cell
    const fy = oy + (state.food.y + 0.5) * cell
    const r = cell * 0.32
    const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, r * 2.2)
    glow.addColorStop(0, 'rgba(245, 185, 66, 0.45)')
    glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(fx, fy, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    // Freshness ring: the bonus draining away. On the board, not in the rules
    // panel — the decision it asks for is made while moving.
    const fresh = foodBonusLeft(state.foodAge)
    if (fresh > 0) {
      const ringR = r * 1.75
      ctx.save()
      ctx.lineWidth = Math.max(1.6, cell * 0.1)
      ctx.lineCap = 'round'
      ctx.strokeStyle = dark ? 'rgba(245, 185, 66, 0.15)' : 'rgba(150, 100, 16, 0.15)'
      ctx.beginPath()
      ctx.arc(fx, fy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'hsla(38, 82%, 56%, 0.95)'
      ctx.beginPath()
      ctx.arc(fx, fy, ringR, -Math.PI / 2, -Math.PI / 2 + fresh * Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.fillStyle = `hsla(38, 58%, 58%, ${softFillAlpha(0.22)})`
    ctx.beginPath()
    ctx.arc(fx, fy, r, 0, Math.PI * 2)
    ctx.fill()
    if (!flat) {
      ctx.strokeStyle = 'hsla(38, 58%, 42%, 0.95)'
      ctx.lineWidth = Math.max(1.4, cell * 0.08)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.beginPath()
    ctx.arc(fx - r * 0.25, fy - r * 0.28, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
  }

  // Snake — fixed bead size and spacing so they kiss at every length
  const segments = visualSegments(state)
  const boosting = isBoosting(state)
  const lineW = Math.max(1.2, cell * 0.07)
  const sw = cell * BEAD_SPACING - (flat ? 0 : lineW)
  const sh = sw
  const gap = (cell - sw) / 2
  const segR = sw / 2

  // Head stays green; each bead steps through the rainbow and wraps when long enough
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const sx = ox + seg.x * cell + gap
    const sy = oy + seg.y * cell + gap
    const hue = ((HEAD_HUE + i * HUE_PER_BEAD) % 360 + 360) % 360
    const sat = 58 + Math.min(12, i * 0.15)

    // Boosting: a halo on the head and heat trailing off the beads behind it,
    // so the speed is visible on the snake and not only in how fast it moves.
    if (boosting) {
      if (i < 4) {
        const heat = (4 - i) / 4
        const glow = ctx.createRadialGradient(
          sx + sw / 2,
          sy + sh / 2,
          sw * 0.2,
          sx + sw / 2,
          sy + sh / 2,
          sw * 1.1,
        )
        glow.addColorStop(0, `rgba(245, 185, 66, ${0.4 * heat})`)
        glow.addColorStop(1, 'rgba(245, 185, 66, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(sx + sw / 2, sy + sh / 2, sw * 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
      if (i === 0) {
        ctx.save()
        ctx.strokeStyle = 'rgba(245, 185, 66, 0.9)'
        ctx.lineWidth = Math.max(1.6, cell * 0.11)
        ctx.beginPath()
        ctx.arc(sx + sw / 2, sy + sh / 2, sw * 0.82, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    roundRect(ctx, sx, sy, sw, sh, segR)
    ctx.fillStyle = `hsla(${hue}, ${sat}%, 58%, ${softFillAlpha(0.22)})`
    ctx.fill()
    if (!flat) {
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, 42%, 0.95)`
      ctx.lineWidth = lineW
      ctx.lineJoin = 'round'
      ctx.stroke()
    }

    if (i === 0) {
      const face = state.pendingDir ?? state.dir
      const eye = cell * 0.09
      let ex1 = sx + sw * 0.32
      let ey1 = sy + sh * 0.35
      let ex2 = sx + sw * 0.68
      let ey2 = sy + sh * 0.35
      if (face === 'left') {
        ex1 = sx + sw * 0.28
        ex2 = sx + sw * 0.28
        ey1 = sy + sh * 0.32
        ey2 = sy + sh * 0.68
      } else if (face === 'right') {
        ex1 = sx + sw * 0.72
        ex2 = sx + sw * 0.72
        ey1 = sy + sh * 0.32
        ey2 = sy + sh * 0.68
      } else if (face === 'down') {
        ey1 = sy + sh * 0.68
        ey2 = sy + sh * 0.68
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eye, 0, Math.PI * 2)
      ctx.arc(ex2, ey2, eye, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a2b3c'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eye * 0.45, 0, Math.PI * 2)
      ctx.arc(ex2, ey2, eye * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Floaters
  for (const f of state.floaters) {
    const px = ox + f.x * cell
    const py = oy + f.y * cell
    const alpha = Math.min(1, f.life * 2) * Math.min(1, f.life * 1.4)
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = `600 ${Math.max(14, cell * 0.55)}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c98a12'
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 8
    ctx.fillText(f.text, px, py)
    ctx.restore()
  }

  // Back out to the whole canvas for the footer and the flash.
  ctx.restore()

  // Footer: the boost tank, and only that. The level used to sit here too,
  // before it moved up to the readout where every other game keeps its run
  // state — a number printed twice is a number you check in two places.
  {
    const panelBottom = oy + gridH + PANEL_PAD
    const midY = panelBottom + (h - panelBottom) / 2
    const muted = dark ? 'rgba(231, 238, 243, 0.55)' : 'rgba(26, 43, 60, 0.5)'
    const label = Math.max(11, Math.min(footer * 0.52, cell * 0.42))

    const fuel = boostFuelLeft(state)
    const barW = Math.min(gridW * 0.42, label * 12)
    const barH = Math.max(4, label * 0.36)
    const barX = ox + (gridW - barW) / 2 + label * 0.5
    const barY = midY - barH / 2

    // A bolt ahead of the bar, so the strip says what it is measuring.
    const boltH = label * 0.95
    const boltX = barX - boltH * 0.85
    ctx.save()
    ctx.fillStyle = boosting ? 'rgba(245, 185, 66, 0.98)' : muted
    ctx.beginPath()
    ctx.moveTo(boltX + boltH * 0.34, midY - boltH / 2)
    ctx.lineTo(boltX, midY + boltH * 0.08)
    ctx.lineTo(boltX + boltH * 0.22, midY + boltH * 0.08)
    ctx.lineTo(boltX + boltH * 0.08, midY + boltH / 2)
    ctx.lineTo(boltX + boltH * 0.42, midY - boltH * 0.06)
    ctx.lineTo(boltX + boltH * 0.2, midY - boltH * 0.06)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.12)' : 'rgba(26, 43, 60, 0.1)'
    ctx.fill()

    if (fuel > 0) {
      roundRect(ctx, barX, barY, barW * fuel, barH, barH / 2)
      ctx.fillStyle = boosting ? 'rgba(245, 185, 66, 0.98)' : 'rgba(245, 185, 66, 0.6)'
      ctx.fill()
    }
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.3})`
    ctx.fillRect(0, 0, w, h)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
