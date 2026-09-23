import { runPreview, type Sim } from '../previewKit'
import {
  bubbleSpot,
  createInitialState,
  hitAt,
  setScale,
  startGame,
  tick,
  type GameState,
  type Target,
} from './game'
import { renderGame } from './render'

/*
 * Pop playing itself, for its cabinet on the home page: the game's own engine
 * and renderer, and a pilot with one finger and a person's reactions. It sees
 * a bubble a quarter to six tenths of a second after it blows up, goes for
 * gold first and otherwise for whichever has been up longest, and needs a
 * moment to get from one bubble to the next, so once the field gets busy late
 * in the round some drift off before it gets to them. Its taps land on the
 * bubble, often in its middle, and now and then off it altogether. When the
 * forty-five seconds run out, a new round starts.
 */

/** What the pilot makes of one target: when it came up, when the pilot is onto it, and where on it the tap lands. */
type Sighting = { born: number; ready: number; off: number; angle: number }

/** How far from a disc's middle a tap lands, as a share of the disc: often in the middle, mostly on it, now and then clean off it. */
function pickOff(): number {
  const roll = Math.random()
  if (roll < 0.4) return Math.random() * 0.36
  if (roll < 0.9) return 0.46 + Math.random() * 0.5
  return 1.12 + Math.random() * 0.3
}

/** A person sees a target a quarter to six tenths of a second after it comes up; gold catches the eye sooner. */
function sight(born: number, gold: boolean): Sighting {
  const ready = born + 0.25 + Math.random() * (gold ? 0.2 : 0.35)
  return { born, ready, off: pickOff(), angle: Math.random() * Math.PI * 2 }
}

/** Gold first, then whichever target has been up longest. */
function sooner(a: Target, b: Target) {
  if (a.kind !== b.kind) return a.kind === 'gold'
  return a.age > b.age
}

export function makeSim(): Sim<GameState> {
  // The pilot's own clock, when its finger is free again, and what it has made of the target on each pad.
  let clock = 0
  let freeAt = 0
  let seen = new Map<number, Sighting>()

  const drive = (s: GameState, w: number, h: number): GameState => {
    for (const pad of s.pads) {
      const t = pad.target
      if (!t || t.hit) {
        seen.delete(pad.id)
        continue
      }
      // A target's age tells when it came up; one that came up later is a new target on the same pad.
      const born = clock - t.age
      const known = seen.get(pad.id)
      if (!known || Math.abs(known.born - born) > 0.05) seen.set(pad.id, sight(born, t.kind === 'gold'))
    }
    if (clock < freeAt) return s

    let pick: { id: number; target: Target; view: Sighting } | null = null
    for (const pad of s.pads) {
      const target = pad.target
      const view = seen.get(pad.id)
      // A target nearly back down is let go.
      if (!target || target.hit || !view || clock < view.ready || target.rise < 0.25) continue
      if (!pick || sooner(target, pick.target)) pick = { id: pad.id, target, view }
    }
    if (!pick) return s

    const { id, target, view } = pick
    // Where the bubble has drifted to, and how far it is blown up.
    const spot = bubbleSpot(target, w, h)
    const reach = spot.r * view.off
    const next = hitAt(s, spot.x + Math.cos(view.angle) * reach, spot.y + Math.sin(view.angle) * reach, w, h)
    // The finger needs a moment to get to the next bubble.
    freeAt = clock + 0.16 + Math.random() * 0.12
    // A tap off the disc leaves the target up, and the next try at it is aimed afresh.
    if (next.hits === s.hits) seen.set(id, { ...view, off: pickOff(), angle: Math.random() * Math.PI * 2 })
    return next
  }

  return {
    start: (w, h) => {
      clock = 0
      freeAt = 0
      seen = new Map()
      return setScale(startGame(createInitialState()), w, h)
    },
    step: (s, dt, w, h) => {
      clock += dt
      return tick(s.phase === 'playing' ? drive(s, w, h) : s, dt)
    },
    over: (s) => s.phase === 'gameover',
    // The board as the game draws it, minus the points written over it for a player.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, floaters: [] }, w, h),
    // Bubbles are placed afresh from the screen's size every frame; only the scale needs to follow it.
    resize: setScale,
    // Take in a little less of the field, so the bubbles are bigger on a small screen. The field keeps a tenth of
    // the canvas clear on every side, so every bubble stays in view. The pilot's taps are worked out at the
    // screen's own size, where the field is the same, only smaller.
    zoom: 1.2,
    // The still: a gold bubble up beside one just burst.
    poster: { seed: 4, at: 8 },
    // Its renderer times its twinkles and pulses by the page's clock; the run's own keeps the still the same.
    runClock: true,
    hold: 1.2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
