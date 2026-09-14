/**
 * The bug itself — a small pixel-ish beetle drawn on canvas.
 *
 * The bug never moves, so the sprite has no gait — the shell split and the
 * antennae are the only things that give it away once you are looking.
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
  look: BugLook
  /** 0–1 catch flash. */
  flash?: number
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
  const { angle, look } = draw
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
    const reach = size * 0.44
    const lift = ry * 0.82
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(baseX, side * ry * 0.4)
      ctx.lineTo(baseX, side * lift)
      ctx.lineTo(baseX, side * (lift + reach * 0.5))
      ctx.stroke()
    }
  }

  // Antennae.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(rx * 0.72, side * ry * 0.28)
    ctx.lineTo(rx * 1.34, side * ry * 0.72)
    ctx.stroke()
  }

  // Abdomen, outlined. The outline is what keeps the silhouette readable once
  // the body colour is sitting right on top of the surface it is hiding on —
  // without it a well-camouflaged bug is a smudge rather than a shape.
  ctx.fillStyle = look.body
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = look.leg
  ctx.lineWidth = Math.max(0.8, size * 0.055)
  ctx.stroke()

  // Shell split — the one hard line that gives it away once you're looking.
  ctx.strokeStyle = look.leg
  ctx.lineWidth = Math.max(0.7, size * 0.055)
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
