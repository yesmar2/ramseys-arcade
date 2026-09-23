import type { GamePreviewRun } from '../lib/gamePreviews'
import { quietly } from '../lib/quiet'

/** The longest slice of play at once: any longer and a pilot could skip past what it should see coming. */
const STEP = 1 / 30

/**
 * What a game hands over to play itself on a cabinet's screen: its own engine
 * and renderer, so the preview changes whenever the game does, and a pilot
 * that plays the way a person would.
 */
export type Sim<S> = {
  /** A fresh run at this size, already under way. */
  start(w: number, h: number): S
  /** One slice of play, `dt` seconds of it: the pilot's move, then the game's own tick. */
  step(s: S, dt: number, w: number, h: number): S
  /** True once the run has ended. The screen holds on the ending for `hold` seconds, then a new run starts. */
  over(s: S): boolean
  /** Draw the state as the game draws it, minus anything written over it for a player. */
  render(ctx: CanvasRenderingContext2D, s: S, w: number, h: number): void
  /** Follow the screen to a new size. Without it, a new run starts at the new size. */
  resize?(s: S, w: number, h: number): S
  /** Seconds of play before the first frame, so the still shows a game under way. Four unless said. */
  warmup?: number
  /** Seconds to hold on a finished run before the next one starts. 1.2 unless said. */
  hold?: number
  /**
   * For a game that scales itself to its canvas and was laid out for a big
   * screen, whose pieces would be specks on a cabinet's: draw it this many
   * times the screen's size and show only part of the drawing, its middle or
   * the part `focus` names. Give a function of the screen's size when the
   * right amount depends on it (a cabinet's screen, the banner's).
   */
  zoom?: Scale
  /** Where to look in a zoomed drawing, in its own CSS pixels. */
  focus?(s: S, w: number, h: number): { x: number; y: number }
  /**
   * For a game that draws at fixed pixel sizes, laid out for a phone-sized
   * canvas: draw it on a canvas this many times the screen's size and shrink
   * the whole drawing onto the screen. As with `zoom`, a function of the
   * screen's size when that decides it.
   */
  stage?: Scale
}

/** A multiple of the screen's size, fixed or worked out from the screen's width and height. */
export type Scale = number | ((w: number, h: number) => number)

function scaleAt(scale: Scale | undefined, w: number, h: number) {
  return typeof scale === 'function' ? scale(w, h) : (scale ?? 1)
}

function density() {
  return Math.min(window.devicePixelRatio || 1, 2)
}

/**
 * Size a canvas for the screen's density and set its transform to CSS pixels.
 * Rounded down, the way the games' own renderers size theirs, so a renderer
 * that checks the size finds it right and never resizes it back and forth.
 */
function fit(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
  const cw = Math.max(1, Math.floor(w * dpr))
  const ch = Math.max(1, Math.floor(h * dpr))
  if (ctx.canvas.width !== cw || ctx.canvas.height !== ch) {
    ctx.canvas.width = cw
    ctx.canvas.height = ch
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * A game playing itself, for `GamePreview`. Everything runs inside
 * `quietly`, so the run is never heard, felt or saved; it opens a few seconds
 * into play, moves in slices no longer than a thirtieth of a second, and starts
 * over a moment after it ends.
 */
export function runPreview<S>(sim: Sim<S>): GamePreviewRun {
  let s: S | null = null
  let size = ''
  let heldFor = 0
  let lens: CanvasRenderingContext2D | null = null
  // Seconds of the opening still to play before the first frame.
  let warmLeft = sim.warmup ?? 4

  const begin = (w: number, h: number) => {
    s = sim.start(w, h)
    size = `${w}x${h}`
  }

  const advance = (seconds: number, w: number, h: number) => {
    let left = seconds
    while (left > 1e-6 && s !== null) {
      const dt = Math.min(left, STEP)
      left -= dt
      if (sim.over(s)) {
        heldFor += dt
        if (heldFor >= (sim.hold ?? 1.2)) {
          heldFor = 0
          s = sim.start(w, h)
          continue
        }
      } else {
        heldFor = 0
      }
      s = sim.step(s, dt, w, h)
    }
  }

  const draw = (ctx: CanvasRenderingContext2D, state: S, w: number, h: number) => {
    const dpr = density()
    const zoom = scaleAt(sim.zoom, w, h)
    const stage = scaleAt(sim.stage, w, h)
    if (zoom <= 1 && stage <= 1) {
      fit(ctx, w, h, dpr)
      sim.render(ctx, state, w, h)
      return
    }
    // Draw off screen at the bigger size, then copy the part that shows.
    const big = Math.max(zoom, stage)
    const zw = w * big
    const zh = h * big
    lens ??= document.createElement('canvas').getContext('2d')
    if (!lens) return
    fit(lens, zw, zh, dpr)
    sim.render(lens, state, zw, zh)
    let x0 = 0
    let y0 = 0
    let sw = zw
    let sh = zh
    if (stage <= 1) {
      const f = sim.focus?.(state, zw, zh) ?? { x: zw / 2, y: zh / 2 }
      x0 = Math.min(Math.max(f.x - w / 2, 0), zw - w)
      y0 = Math.min(Math.max(f.y - h / 2, 0), zh - h)
      sw = w
      sh = h
    }
    // The renderer may size its canvas itself; read back the density it drew at.
    const k = lens.canvas.width / zw
    fit(ctx, w, h, dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(lens.canvas, x0 * k, y0 * k, sw * k, sh * k, 0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  return {
    warm(w, h, budgetMs) {
      return quietly(() => {
        const from = performance.now()
        if (s === null) {
          begin(w, h)
          // Setting up a run can be a slice's work on its own (a scene to build, a maze to lay); if it was, stop there.
          if (performance.now() - from > budgetMs / 2) return false
        }
        const until = from + budgetMs
        // A quarter of a second of play between looks at the clock keeps each slice short on a slow phone.
        while (warmLeft > 0 && performance.now() < until) {
          const d = Math.min(warmLeft, 0.25)
          advance(d, w, h)
          warmLeft -= d
        }
        return warmLeft <= 0
      })
    },
    paint(ctx, w, h, dt) {
      quietly(() => {
        const key = `${w}x${h}`
        if (s === null) {
          begin(w, h)
        } else if (key !== size) {
          size = key
          s = sim.resize ? sim.resize(s, w, h) : sim.start(w, h)
        }
        if (warmLeft > 0) {
          advance(warmLeft, w, h)
          warmLeft = 0
        }
        advance(Math.min(dt, 0.25), w, h)
        if (s !== null) draw(ctx, s, w, h)
      })
    },
  }
}
