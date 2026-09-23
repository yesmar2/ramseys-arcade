import type { GamePreviewRun } from '../lib/gamePreviews'
import { quietly } from '../lib/quiet'

/**
 * Steps a second. Every run moves in whole steps of this size, however its
 * time is handed over, so a run from a seed plays out the same on every
 * visit; a step also never lets a pilot skip past what it should see coming.
 */
const HZ = 30
const STEP = 1 / HZ

/**
 * The size a cabinet's still is played out at before it's fitted to the
 * screen it goes on: the size the pilots were tuned at. Playing it out at one
 * size means one chosen moment looks the same on every cabinet and phone.
 */
export const POSTER_W = 216
export const POSTER_H = 162

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
  /**
   * The still the screen shows until it plays: this many seconds into a run
   * from this seed, the same moment on every visit, picked to show the game
   * at its best. Its randomness all comes from the seed, and it is played out
   * at the poster size, then fitted to the screen.
   */
  poster: { seed: number; at: number }
  /**
   * For a renderer that times its twinkles, blinks and pulses by
   * performance.now(): draw with that clock reading the run's own time, so
   * the still is the same frame on every visit. Not for a renderer that
   * paints to a time budget, which would never see its budget run out.
   */
  runClock?: boolean
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

/** A stand-in for Math.random that gives the same numbers in the same order from the same seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Run with Math.random answering from `random`, then put the real one back. */
export function withRandom<T>(random: () => number, run: () => T): T {
  const real = Math.random
  Math.random = random
  try {
    return run()
  } finally {
    Math.random = real
  }
}

/**
 * A run in whole steps: holding on an ending, then starting over. The preview
 * plays one; a tool picking a poster replays one the same way.
 */
export type Runner<S> = {
  readonly state: S
  /** Seconds played since the first run began, over every run since: the clock a `runClock` renderer reads. */
  readonly time: number
  start(w: number, h: number): void
  step(w: number, h: number): void
  resize(w: number, h: number): void
}

export function createRunner<S>(sim: Sim<S>): Runner<S> {
  let s: S | null = null
  let held = 0
  let steps = 0
  const hold = Math.round((sim.hold ?? 1.2) * HZ)
  return {
    get state() {
      if (s === null) throw new Error('The run has not started')
      return s
    },
    get time() {
      return steps * STEP
    },
    start(w, h) {
      s = sim.start(w, h)
      held = 0
    },
    step(w, h) {
      if (s === null) return
      steps += 1
      if (sim.over(s)) {
        held += 1
        if (held >= hold) {
          held = 0
          s = sim.start(w, h)
          return
        }
      } else {
        held = 0
      }
      s = sim.step(s, STEP, w, h)
    },
    resize(w, h) {
      if (s !== null) s = sim.resize ? sim.resize(s, w, h) : sim.start(w, h)
    },
  }
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

/** Run `draw` with performance.now() stopped at `seconds`, then put the page's own clock back. */
function atClock(seconds: number, draw: () => void) {
  const page = performance
  const own = Object.getOwnPropertyDescriptor(page, 'now')
  Object.defineProperty(page, 'now', { value: () => seconds * 1000, configurable: true, writable: true })
  try {
    draw()
  } finally {
    if (own) Object.defineProperty(page, 'now', own)
    else Reflect.deleteProperty(page, 'now')
  }
}

/** An off-screen canvas kept between frames, for games drawn bigger than the screen they end up on. */
export type Lens = { ctx: CanvasRenderingContext2D | null }

/**
 * Draw one frame of a state onto a screen, zoomed in or shrunk down as the
 * game asks. `time` is the run's clock, for a game that draws by it.
 */
export function paintFrame<S>(
  sim: Sim<S>,
  ctx: CanvasRenderingContext2D,
  state: S,
  w: number,
  h: number,
  lens: Lens,
  time: number,
) {
  const render = (target: CanvasRenderingContext2D, rw: number, rh: number) => {
    if (sim.runClock) atClock(time, () => sim.render(target, state, rw, rh))
    else sim.render(target, state, rw, rh)
  }
  const dpr = density()
  const zoom = scaleAt(sim.zoom, w, h)
  const stage = scaleAt(sim.stage, w, h)
  if (zoom <= 1 && stage <= 1) {
    fit(ctx, w, h, dpr)
    render(ctx, w, h)
    return
  }
  // Draw off screen at the bigger size, then copy the part that shows.
  const big = Math.max(zoom, stage)
  const zw = w * big
  const zh = h * big
  lens.ctx ??= document.createElement('canvas').getContext('2d')
  const off = lens.ctx
  if (!off) return
  fit(off, zw, zh, dpr)
  render(off, zw, zh)
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
  const k = off.canvas.width / zw
  fit(ctx, w, h, dpr)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(off.canvas, x0 * k, y0 * k, sw * k, sh * k, 0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * A game playing itself, for `GamePreview`. Everything runs inside
 * `quietly`, so the run is never heard, felt or saved. Its still is the
 * game's poster, played out from its seed; after that it plays on, and
 * starts over a moment after each run ends.
 */
export function runPreview<S>(sim: Sim<S>): GamePreviewRun {
  const run = createRunner(sim)
  const lens: Lens = { ctx: null }
  // Until the still is on the screen, every random number comes from the poster's seed.
  const random = seededRandom(sim.poster.seed)
  let opening = Math.round(sim.poster.at * HZ)
  let started = false
  let shown = false
  let size = ''
  let owed = 0

  /** Where the opening is played out: the poster size, when the game can be fitted to its screen afterwards. */
  const openingSize = (w: number, h: number): [number, number] => (sim.resize ? [POSTER_W, POSTER_H] : [w, h])
  const seeded = <T>(go: () => T): T => (shown ? go() : withRandom(random, go))

  const begin = (w: number, h: number) => {
    run.start(w, h)
    started = true
    size = `${w}x${h}`
  }

  return {
    warm(w, h, budgetMs) {
      return quietly(() =>
        seeded(() => {
          const [ow, oh] = openingSize(w, h)
          const from = performance.now()
          if (!started) {
            begin(ow, oh)
            // Setting up a run can be a slice's work on its own (a scene to build, a maze to lay); if it was, stop there.
            if (performance.now() - from > budgetMs / 2) return opening <= 0
          }
          const until = from + budgetMs
          // A look at the clock after every step: some games' steps are light, but a pilot that plays a shot out
          // before it takes it can spend a few milliseconds on one.
          for (; opening > 0 && performance.now() < until; opening--) run.step(ow, oh)
          return opening <= 0
        }),
      )
    },
    paint(ctx, w, h, dt) {
      quietly(() => {
        seeded(() => {
          const [ow, oh] = openingSize(w, h)
          if (!started) begin(ow, oh)
          for (; opening > 0; opening--) run.step(ow, oh)
          const key = `${w}x${h}`
          if (key !== size) {
            size = key
            run.resize(w, h)
          }
          owed += Math.min(dt, 0.25)
          for (; owed >= STEP - 1e-6; owed -= STEP) run.step(w, h)
          // Anything random in the drawing itself (a shake, a flame's flicker) comes from the run's clock, so a
          // moment is drawn the same way however often it's drawn: the still, above all.
          const moment = seededRandom(sim.poster.seed * 7919 + Math.round(run.time * HZ))
          withRandom(moment, () => paintFrame(sim, ctx, run.state, w, h, lens, run.time))
        })
        shown = true
      })
    },
  }
}
