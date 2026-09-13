/**
 * The bug itself — a small pixel-ish beetle drawn on canvas.
 *
 * Kept free of game state so the site-wide hunt can mount the same sprite in a
 * standalone canvas without pulling in the round logic.
 */

export type BugLook = {
  /** Shell / abdomen fill. */
  body: string
  /** Legs and antennae — always a touch darker than the body so the bug never
   *  fully dissolves into the scenery, however strong the camouflage. */
  leg: string
}

export type BugDraw = {
  /** Facing direction in radians. */
  angle: number
  /** Advances while scurrying so the legs cycle. */
  legPhase: number
  moving: boolean
  look: BugLook
  /** 0–1 catch flash. */
  flash?: number
}

/** Mix two hex colors — used to sink the bug into a scene's palette. */
export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  const k = Math.max(0, Math.min(1, t))
  const ch = (x: number, y: number) => Math.round(x + (y - x) * k)
  return `rgb(${ch(a.r, b.r)}, ${ch(a.g, b.g)}, ${ch(a.b, b.b)})`
}

function parseHex(value: string) {
  const hex = value.trim().replace('#', '')
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    }
  }
  if (hex.length !== 6) return { r: 26, g: 43, b: 60 }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

/**
 * @param size Body length in canvas px. Everything else scales off it.
 */
export function drawBug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  draw: BugDraw,
) {
  const { angle, legPhase, moving, look } = draw
  const flash = draw.flash ?? 0
  const rx = size * 0.5
  const ry = size * 0.32

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Legs first so they read as underneath the shell.
  ctx.strokeStyle = look.leg
  ctx.lineWidth = Math.max(0.9, size * 0.075)
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    // Splay the front legs forward and the back legs aft.
    const baseX = rx * (0.42 - i * 0.42)
    const swing = moving ? Math.sin(legPhase * Math.PI * 2 + i * 1.9) * size * 0.16 : 0
    const reach = size * 0.44
    const lift = ry * 0.82
    for (const side of [-1, 1]) {
      // Alternate the gait left/right so it scuttles rather than hops.
      const phase = side > 0 ? swing : -swing
      ctx.beginPath()
      ctx.moveTo(baseX, side * ry * 0.4)
      ctx.lineTo(baseX + phase * 0.5, side * lift)
      ctx.lineTo(baseX + phase, side * (lift + reach * 0.5))
      ctx.stroke()
    }
  }

  // Antennae.
  const twitch = moving ? Math.sin(legPhase * Math.PI * 2.7) * 0.22 : 0
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(rx * 0.72, side * ry * 0.28)
    ctx.lineTo(rx * 1.34, side * (ry * 0.72 + twitch * size * 0.1))
    ctx.stroke()
  }

  // Abdomen.
  ctx.fillStyle = look.body
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Shell split — the one hard line that gives it away once you're looking.
  ctx.strokeStyle = look.leg
  ctx.lineWidth = Math.max(0.6, size * 0.05)
  ctx.beginPath()
  ctx.moveTo(-rx * 0.82, 0)
  ctx.lineTo(rx * 0.5, 0)
  ctx.stroke()

  // Head.
  ctx.fillStyle = look.leg
  ctx.beginPath()
  ctx.ellipse(rx * 0.78, 0, size * 0.17, ry * 0.66, 0, 0, Math.PI * 2)
  ctx.fill()

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, flash)})`
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 1.5, ry * 1.7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}
