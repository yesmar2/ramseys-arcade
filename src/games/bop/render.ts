import { playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import {
  CONTROL_HUE,
  CONTROL_LABEL,
  consoleLayout,
  QUICK_FRACTION,
  type Control,
  type GameState,
} from './game'

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  const step = 26 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = 'rgba(74, 168, 232, 0.09)'
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function tone(hue: number, on: boolean, punch: number) {
  return {
    fill: `hsla(${hue}, 52%, 58%, ${softFillAlpha(on ? 0.24 + 0.3 * punch : 0.22)})`,
    stroke: `hsla(${hue}, 52%, ${on ? 48 : 42}%, 0.95)`,
    ink: `hsla(${hue}, 45%, 30%, 0.9)`,
  }
}

function stateOf(state: GameState, control: Control) {
  const pressed = state.pressed === control && (state.pressLife > 0 || state.phase === 'gameover')
  const punch = pressed ? Math.max(0.45, Math.min(1, state.pressLife / 0.18)) : 1
  return { on: pressed, punch }
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: ReturnType<typeof tone>, lw: number) {
  ctx.fillStyle = t.fill
  ctx.strokeStyle = t.stroke
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  strokeOutlined(ctx)
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  drawBackground(ctx, w, h)
  const l = consoleLayout(w, h)
  const lw = Math.max(2, l.u * 0.9)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ---- Bop: the big button, with the timer as a ring around it.
  {
    const { on, punch } = stateOf(state, 'bop')
    const t = tone(CONTROL_HUE.bop, on, punch)
    const r = l.bop.r * (on ? 0.96 : 1)
    if (state.phase === 'call' && state.call && state.gap <= 0) {
      const frac = Math.max(0, state.timer / state.window)
      const hue = CONTROL_HUE[state.call]
      ctx.strokeStyle = `hsla(${hue}, 55%, 55%, 0.22)`
      ctx.lineWidth = l.u * 2.2
      ctx.beginPath()
      ctx.arc(l.bop.x, l.bop.y, l.bop.r + l.u * 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = `hsla(${hue}, 60%, ${frac > QUICK_FRACTION ? 58 : 50}%, 0.95)`
      ctx.beginPath()
      ctx.arc(l.bop.x, l.bop.y, l.bop.r + l.u * 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
      ctx.stroke()
    }
    disc(ctx, l.bop.x, l.bop.y, r, t, lw)
    disc(ctx, l.bop.x, l.bop.y, r * 0.62, { ...t, fill: `hsla(${CONTROL_HUE.bop}, 52%, 58%, ${softFillAlpha(on ? 0.5 : 0.32)})` }, lw * 0.8)
  }

  // ---- Twist: a knob with a pointer that turns.
  {
    const { on, punch } = stateOf(state, 'twist')
    const t = tone(CONTROL_HUE.twist, on, punch)
    disc(ctx, l.twist.x, l.twist.y, l.twist.r, t, lw)
    const a = -Math.PI / 2 + state.twistAngle
    ctx.strokeStyle = t.ink
    ctx.lineWidth = lw * 1.4
    ctx.beginPath()
    ctx.moveTo(l.twist.x + Math.cos(a) * l.twist.r * 0.3, l.twist.y + Math.sin(a) * l.twist.r * 0.3)
    ctx.lineTo(l.twist.x + Math.cos(a) * l.twist.r * 0.82, l.twist.y + Math.sin(a) * l.twist.r * 0.82)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const b = (i / 8) * Math.PI * 2
      ctx.fillStyle = t.stroke
      ctx.beginPath()
      ctx.arc(l.twist.x + Math.cos(b) * l.twist.r * 1.25, l.twist.y + Math.sin(b) * l.twist.r * 1.25, lw * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---- Pull: a lever in a slot; the handle drops when pulled.
  {
    const { on, punch } = stateOf(state, 'pull')
    const t = tone(CONTROL_HUE.pull, on, punch)
    const top = l.pull.y - l.pull.len * 0.35
    const bottom = l.pull.y + l.pull.len * 0.95
    ctx.strokeStyle = t.stroke
    ctx.lineWidth = lw * 2.6
    ctx.beginPath()
    ctx.moveTo(l.pull.x, top)
    ctx.lineTo(l.pull.x, bottom)
    ctx.stroke()
    const drop = on ? l.pull.len * 0.75 * punch : 0
    const hy = top + l.pull.r * 0.6 + drop
    ctx.strokeStyle = t.ink
    ctx.lineWidth = lw * 1.3
    ctx.beginPath()
    ctx.moveTo(l.pull.x, hy)
    ctx.lineTo(l.pull.x, hy + l.pull.r * 0.4)
    ctx.stroke()
    disc(ctx, l.pull.x, hy, l.pull.r * 0.72, t, lw)
  }

  // ---- Flick: a rocker switch; the paddle jumps up when flicked.
  {
    const { on, punch } = stateOf(state, 'flick')
    const t = tone(CONTROL_HUE.flick, on, punch)
    const bw = l.flick.r * 1.3
    const bh = l.flick.r * 2.1
    ctx.fillStyle = t.fill
    ctx.strokeStyle = t.stroke
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.roundRect(l.flick.x - bw / 2, l.flick.y - bh / 2, bw, bh, l.u * 2.5)
    ctx.fill()
    strokeOutlined(ctx)
    const up = on ? punch : 0
    const py = l.flick.y + bh * 0.22 - up * bh * 0.44
    ctx.fillStyle = t.ink
    ctx.beginPath()
    ctx.roundRect(l.flick.x - bw * 0.3, py - bh * 0.16, bw * 0.6, bh * 0.32, l.u * 1.5)
    ctx.fill()
  }

  // ---- Spin: a wheel with spokes that whirls round.
  {
    const { on, punch } = stateOf(state, 'spin')
    const t = tone(CONTROL_HUE.spin, on, punch)
    disc(ctx, l.spin.x, l.spin.y, l.spin.r, t, lw)
    const a0 = state.spinAngle + (on ? (1 - punch) * Math.PI * 2 : 0)
    ctx.strokeStyle = t.ink
    ctx.lineWidth = lw * 1.1
    for (let i = 0; i < 6; i++) {
      const a = a0 + (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(l.spin.x, l.spin.y)
      ctx.lineTo(l.spin.x + Math.cos(a) * l.spin.r * 0.82, l.spin.y + Math.sin(a) * l.spin.r * 0.82)
      ctx.stroke()
    }
    disc(ctx, l.spin.x, l.spin.y, l.spin.r * 0.22, t, lw * 0.8)
  }

  // ---- The call, written across the top of the console.
  if (state.phase === 'call' && state.call) {
    const hue = CONTROL_HUE[state.call]
    const text = state.gap > 0 ? '' : CONTROL_LABEL[state.call].toUpperCase() + '!'
    if (text) {
      ctx.font = `800 ${l.u * 9}px Outfit, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const ty = (h - l.size) / 2 + l.u * 10
      ctx.fillStyle = `hsla(${hue}, 55%, 55%, 0.96)`
      ctx.fillText(text, w / 2, ty)
    }
  } else if (state.phase === 'gameover' && state.ended) {
    ctx.font = `800 ${l.u * 7}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(232, 93, 117, 0.95)'
    ctx.fillText(state.ended === 'late' ? 'TOO SLOW' : 'WRONG ONE', w / 2, (h - l.size) / 2 + l.u * 10)
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.28})`
    ctx.fillRect(0, 0, w, h)
  }
}
