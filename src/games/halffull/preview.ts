import { runPreview, type Sim } from '../previewKit'
import { canLock, isSplitRound, levelRange, lock, moveLevel, nextRound, startRun, tick, TIP_TIME, type GameState } from './game'
import { dayPlan, pickLevel, splitPick } from './plan'
import { renderHalfFull, type View } from './render'

/*
 * Half Full pouring itself, for its cabinet on the home page: the game's own glasses, engine and
 * painter, and a pilot that pours the way a person does. It pours up to where the glass looks half
 * full to it, now and then past it and back, takes a moment to judge, and says "That's half". Then the
 * game's own Tip, into the measuring jug that says how full it really was, and on to the next glass,
 * through all five, the fair split last; then the run starts over.
 *
 * The pilot is the day's own modelled pourer (plan.ts), leaning a little on each glass's height the
 * way people do, so it lands near half, not on it: mostly green, now and then a yellow or an orange.
 */

/**
 * The day it always pours: one from before Half Full #1, so a cabinet never shows where half is on a
 * day that goes on a board. Its glasses are a tumbler, a bottle, a cone and a potion flask, then a vase
 * and a bowl to share between, in bright drinks. The poster (below) is timed on it.
 */
const DEMO_DAY = '2026-09-11'

type Pilot = {
  /** The round this pilot was set up for. */
  round: number
  /** Levels to pour to, in turn: sometimes one past it first, then the one it settles on. */
  aims: number[]
  /** Seconds before it next moves the level, locks, or goes on to the next glass. */
  wait: number
}

type Run = {
  game: GameState
  pilot: Pilot
  /** Seconds since the run began: the clock the bubbles and wobble go by. */
  clock: number
}

function rand(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** How this round will go: where the pilot judges half (or fair) to be, and whether it pours past it first. */
function newPilot(s: GameState): Pilot {
  // How much it goes by the glass's height and outline rather than what it holds (0 never, 1 wholly),
  // and how far off its aim is besides.
  const lean = rand(0.05, 0.45)
  const off = rand(-0.02, 0.02)
  const settle = isSplitRound(s.round) ? splitPick(s.plan.split, lean, off) : pickLevel(s.plan.pours[s.round]!, lean, 0.5, off)
  const [lo, hi] = levelRange(s)
  const aims = [settle]
  if (Math.random() < 0.35) {
    // Past it and back: a pour runs on a little, and so does a share.
    const way = settle >= s.level ? 1 : -1
    aims.unshift(clamp(settle + way * rand(50, 130), lo, hi))
  }
  // The glass slides in first, and a look at it before the finger goes down.
  return { round: s.round, aims, wait: rand(0.55, 0.8) }
}

/** Pour toward the next aim the way a finger drags: quick when far off, slowing as it gets close. */
function pour(p: Pilot, s: GameState, dt: number) {
  const aim = p.aims[0]
  if (aim === undefined) {
    // Judged: say so as soon as the game will take it, then watch the Tip and read the stamp before the next glass.
    if (canLock(s) && lock(s)) p.wait = TIP_TIME + rand(0.5, 0.8)
    return
  }
  const left = aim - s.levelF
  if (Math.abs(left) < 0.5) {
    p.aims.shift()
    // A breath before taking it back, a longer look before calling it half.
    p.wait = p.aims.length ? rand(0.2, 0.35) : rand(0.35, 0.7)
    return
  }
  const speed = clamp(Math.abs(left) * 3.2, 90, 520)
  moveLevel(s, Math.sign(left) * Math.min(Math.abs(left), speed * dt))
}

/** The page's display font, as the game reads it for the jug's count and the stamp. */
function displayFont() {
  if (typeof document === 'undefined') return 'system-ui, sans-serif'
  return getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'system-ui, sans-serif'
}

export function makeSim(): Sim<Run> {
  const plan = dayPlan(DEMO_DAY)
  let font = ''

  return {
    // A replay, as far as the game knows: nothing is kept on the device.
    start: () => {
      const game = startRun(plan, true)
      return { game, pilot: newPilot(game), clock: 0 }
    },
    step: (s, dt) => {
      const g = s.game
      if (s.pilot.round !== g.round) s.pilot = newPilot(g)
      const p = s.pilot
      if (p.wait > 0) p.wait -= dt
      else if (g.phase === 'pour') pour(p, g, dt)
      // After the split, this ends the day: the run holds on its stamp, then starts over.
      else if (g.phase === 'shown') nextRound(g)
      tick(g, dt)
      s.clock += dt
      return s
    },
    over: (s) => s.game.phase === 'done',
    render: (ctx, s, w, h) => {
      font ||= displayFont()
      // A cabinet has no prompt over the counter and no buttons under it: the counter's front is a strip.
      const front = Math.round(Math.max(18, h * 0.1))
      const view: View = { w, h, top: Math.round(Math.max(8, h * 0.03)), bottom: front, clear: front, font, time: s.clock }
      renderHalfFull(ctx, s.game, view)
    },
    // The run has no size; the counter is laid out afresh as each frame is drawn.
    resize: (s) => s,
    // The still: the first glass filling, lime soda pouring in from the jug above, its guest beside it.
    poster: { seed: 1, at: 2 },
    // Long enough to read the last stamp: how fair the share was.
    hold: 1.6,
    // The counter is laid out for a phone, with sizes in pixels it won't go under (the guests, the jug,
    // the pitcher). On a cabinet's small screen they would crowd the glass, so it's drawn twice as big
    // and shrunk to fit. A screen the size of the banner's needs none of that.
    stage: (w) => Math.min(2, Math.max(1, 432 / w)),
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
