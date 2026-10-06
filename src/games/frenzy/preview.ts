import { runPreview, type Sim } from '../previewKit'
import {
  createInitialState,
  edible,
  fishRadius,
  playerRadius,
  resizeState,
  rodTip,
  setTarget,
  startGame,
  tick,
  type GameState,
} from './game'
import { renderGame } from './render'

/*
 * Frenzy playing itself, for its tile on the home page. Everything on screen is the game's own engine and
 * renderer, so the preview changes whenever the game does. The only thing added is a pilot that plays the
 * way a person would: it goes after the nearest fish it can eat, swims away from anything that can eat it,
 * gets out of the shark's lane when the warning shows, keeps off the fisherman's hook, and now and then
 * leaps out of the water. When it's
 * eaten, a new run starts.
 */

/** A tile is small: drawn at the game's own scale the little fish would be a few pixels long. */
const MIN_PPU = 0.8

const sized = (s: GameState, w: number, h: number) => resizeState({ ...s, minPpu: MIN_PPU }, w, h)

type Pilot = { mealId: number; pickIn: number; leapIn: number; leaping: number }

function pilot(s: GameState, m: Pilot, dt: number): GameState {
  const p = s.player
  if (p.air) return s
  const pr = playerRadius(s)
  let ax = 0
  let ay = 0
  for (const f of s.fishes) {
    if (edible(f.tier, p.size)) continue
    const dx = p.x - f.x
    const dy = p.y - f.y
    const d = Math.hypot(dx, dy) || 1
    const range = (fishRadius(f) + pr) * 5
    if (d < range) {
      ax += (dx / d) * (1 - d / range) * 4
      ay += (dy / d) * (1 - d / range) * 4
    }
  }
  const k = s.shark
  if (k && Math.abs(p.y - k.y) < k.r * 1.6) ay += (p.y < k.y ? -1 : 1) * 5
  // Keep clear of the fisherman's hook.
  const b = s.boat
  if (b.stage === 'cast' || b.stage === 'wait') {
    const tip = rodTip(b)
    const dx = p.x - tip.x
    const dy = p.y - b.hookY
    const d = Math.hypot(dx, dy) || 1
    if (d < pr * 4 + 40) {
      ax += (dx / d) * 4
      ay += (dy / d) * 4
    }
  }
  // Now and then, near the top, a leap.
  m.leapIn -= dt
  m.leaping -= dt
  if (m.leapIn <= 0 && p.y < 140) {
    m.leapIn = 6 + Math.random() * 6
    m.leaping = 1.5
  }
  if (m.leaping > 0) return setTarget(s, p.x + (p.vx >= 0 ? 60 : -60), -200)
  m.pickIn -= dt
  let meal = s.fishes.find((f) => f.id === m.mealId && edible(f.tier, p.size)) ?? null
  if (!meal || m.pickIn <= 0) {
    let best = 0
    meal = null
    for (const f of s.fishes) {
      if (!edible(f.tier, p.size) || f.y < 0) continue
      const score = (1 + f.tier) / (Math.hypot(f.x - p.x, f.y - p.y) + 60)
      if (score > best) {
        best = score
        meal = f
      }
    }
    m.mealId = meal?.id ?? -1
    m.pickIn = 0.6 + Math.random() * 0.5
  }
  if (meal) {
    const dx = meal.x - p.x
    const dy = meal.y - p.y
    const d = Math.hypot(dx, dy) || 1
    ax += (dx / d) * 1.6
    ay += (dy / d) * 1.6
  } else {
    ay += (120 - p.y) / 200
    ax += p.vx >= 0 ? 0.5 : -0.5
  }
  const len = Math.hypot(ax, ay) || 1
  return setTarget(s, p.x + (ax / len) * 70, p.y + (ay / len) * 70)
}

export function makeSim(): Sim<GameState> {
  const m: Pilot = { mealId: -1, pickIn: 0, leapIn: 5, leaping: 0 }
  return {
    start: (w, h) => {
      m.mealId = -1
      m.leapIn = 4
      return sized(startGame(createInitialState(w, h)), w, h)
    },
    step: (s, dt) => tick(s.phase === 'playing' ? pilot(s, m, dt) : s, dt),
    over: (s) => s.phase === 'gameover',
    // The water as the game draws it, without the words written over it for a player.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, floaters: [] }, w, h),
    resize: (s, w, h) => sized(s, w, h),
    // The still: a few bites in, with something bigger about.
    poster: { seed: 3, at: 14 },
    hold: 1.1,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
