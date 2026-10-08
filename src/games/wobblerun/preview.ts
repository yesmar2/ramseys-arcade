import type { GamePreviewRun } from '../../lib/gamePreviews'
import { chosenSkin } from '../../lib/skins'
import { dailyGauntlet, laidNumber } from './daily.ts'
import { FAST_HANDS, liveHands } from './engine/bots.ts'
import { plannedCourse } from './engine/course.ts'
import { newRun, STEP, step } from './engine/sim.ts'
import type { Course, Input, Run } from './engine/types.ts'
import { WobbleScene } from './WobbleScene'

/*
 * Wobble Run playing a day's gauntlet for its card on the home page's Dailies row and the game page's hero
 * (GamePreview, given the day): the bean behind the start barrier as it drops, pouring down the start slide and
 * into the first round, played through the real engine by the dev autopilot's quick hands (bots.ts liveHands
 * with FAST_HANDS: gold lines and all, as Swoop's card shows a good player rather than the blue bird from a
 * standstill) and drawn by the game's own renderer (WobbleScene.ts), the camera behind it. After the stretch it
 * snaps back to the barrier and plays it again. Nothing is heard (the scene makes no sound; the game's sound is
 * the shell's), and nothing kept.
 *
 * The hands choose at each safe spot by trying every way out (a search that can take a tenth of a second), so
 * their run is worked out once a day, on a quiet run of its own, and kept as a tape of their inputs: warm records
 * it a slice at a time before the card's first frame, and every loop replays the tape (the sim plays the same for
 * the same inputs), so no search runs while the card plays.
 *
 * The renderer is WebGL, on a canvas of its own, copied onto the card's each frame. The scene is made only once
 * the card first plays (a card can sit on the page all visit without ever playing), and let go with the card; a
 * rail tile disposes it on losing its turn and makes it again when it comes back.
 */

/** Seconds of the countdown shown before GO (the barrier sinks at GO), and of the run after it. */
const LEAD = 0.8
const STRETCH = 16
/** Past the stretch (or a finish), how long before it starts again, s. */
const REST = 0.4
/** The steps a loop can play: the count, the stretch and the rest before it starts again, and a little over. */
const TAPE_STEPS = Math.ceil((LEAD + STRETCH + REST + 0.5) / STEP)

/**
 * A day's course and the hands' inputs over it, step by step from the countdown's start: the stick's x and y, and
 * jump (1) and dive (2). `rec` is the quiet run and the hands still recording it, let go once the tape is full.
 */
type Tape = {
  course: Course
  x: Float64Array
  y: Float64Array
  keys: Uint8Array
  n: number
  rec: { run: Run; hands: ReturnType<typeof liveHands> } | null
}

/** The day's course and its tape, laid once a day. */
const tapes = new Map<string, Tape>()
function tapeOf(day: string): Tape {
  let tape = tapes.get(day)
  if (!tape) {
    const daily = dailyGauntlet(day)
    const course = plannedCourse(laidNumber(daily), daily.attempt, daily.k, daily.name)
    tape = {
      course,
      x: new Float64Array(TAPE_STEPS),
      y: new Float64Array(TAPE_STEPS),
      keys: new Uint8Array(TAPE_STEPS),
      n: 0,
      rec: { run: newRun(course, { countdown: LEAD, quiet: true }), hands: liveHands(course, FAST_HANDS) },
    }
    if (tapes.size > 2) tapes.clear()
    tapes.set(day, tape)
  }
  return tape
}

/** Records the tape on to `upTo` steps, or until `until` (performance.now()) has passed; whether it got that far. */
function record(tape: Tape, upTo: number, until = Infinity): boolean {
  const rec = tape.rec
  while (rec && tape.n < upTo) {
    if (performance.now() > until) return false
    const input = rec.hands.input(rec.run)
    tape.x[tape.n] = input.x
    tape.y[tape.n] = input.y
    tape.keys[tape.n] = (input.jump ? 1 : 0) | (input.dive ? 2 : 0)
    tape.n++
    step(rec.run, input)
  }
  if (tape.n >= TAPE_STEPS) tape.rec = null
  return true
}

/** Step i's input off the tape (recorded on to it first if warm didn't get that far); past the tape, nothing held. */
function inputAt(tape: Tape, i: number, into: Input): Input {
  if (i >= TAPE_STEPS) {
    into.x = into.y = 0
    into.jump = into.dive = false
    return into
  }
  record(tape, i + 1)
  const keys = tape.keys[i]!
  into.x = tape.x[i]!
  into.y = tape.y[i]!
  into.jump = (keys & 1) !== 0
  into.dive = (keys & 2) !== 0
  return into
}

export function createDayPreview(day: string): GamePreviewRun {
  let scene: WobbleScene | null = null
  let gl: HTMLCanvasElement | null = null
  let tape: Tape | null = null
  let run: Run | null = null
  let played = 0
  let carry = 0
  let over = 0
  let doneFor = 0
  const input: Input = { x: 0, y: 0, jump: false, dive: false }

  const start = (course: Course) => {
    run = newRun(course, { countdown: LEAD })
    played = 0
    carry = 0
    over = 0
    doneFor = 0
    scene?.snap()
  }

  return {
    // The hands' run worked out before the first frame, a slice at a time (one choice can run over its slice).
    warm(_w, _h, budgetMs) {
      return record(tapeOf(day), TAPE_STEPS, performance.now() + budgetMs)
    },
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen: no scene is made until it first plays.
      if (!scene) {
        if (dt <= 0) return
        tape = tapeOf(day)
        gl = document.createElement('canvas')
        scene = new WobbleScene(gl, tape.course, { pixelRatio: 1.5, preview: true })
        start(tape.course)
      }
      scene.resize(w, h)
      const r = run!
      if (dt > 0) {
        // The run, stepped as the game steps it, off the hands' tape; its events give the bean its juice.
        carry += Math.min(dt, 0.1)
        while (carry >= STEP) {
          carry -= STEP
          step(r, inputAt(tape!, played++, input))
          scene.events(r.ev, r)
        }
        if (r.done) doneFor += dt
        if (r.t > STRETCH || doneFor > 2.4) over += dt
        if (over > REST) start(r.course)
      }
      const shown = run!
      // Played in the player's own skin, as their run would be.
      scene.frame({ mode: shown.done ? 'done' : 'play', run: shown, doneFor, ghosts: [], skin: chosenSkin('wobblerun') }, dt)
      // Onto the card's own canvas, at the screen's density, in the same task as the render.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = Math.max(1, Math.floor(w * dpr))
      const ch = Math.max(1, Math.floor(h * dpr))
      if (ctx.canvas.width !== cw || ctx.canvas.height !== ch) {
        ctx.canvas.width = cw
        ctx.canvas.height = ch
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (gl) ctx.drawImage(gl, 0, 0, cw, ch)
    },
    // Let go of the scene (its WebGL context); if the card plays again, it's made afresh from the barrier (the
    // day's tape is kept).
    dispose() {
      scene?.dispose()
      scene = null
      gl = null
      run = null
      tape = null
    },
  }
}
