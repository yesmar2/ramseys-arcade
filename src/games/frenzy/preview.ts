import { runPreview, type Sim } from '../previewKit'
import {
  SHARK_RADIUS,
  WORLD_H,
  createInitialState,
  fishRadius,
  playerRadius,
  resizeState,
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
 * and gets out of the shark's lane when the warning shows. When it's eaten, a new run starts.
 */

/**
 * A tile is small: drawn at its own scale the little fish would be a few pixels long. Draw it at least at
 * the scale a phone has, centred, and let the edges of the water fall off the tile.
 */
const MIN_PPU = 0.78

function sized(s: GameState, w: number, h: number): GameState {
  const fit = resizeState(s, w, h)
  if (fit.ppu >= MIN_PPU) return fit
  return { ...fit, ppu: MIN_PPU, offX: (w - fit.W * MIN_PPU) / 2, offY: (h - WORLD_H * MIN_PPU) / 2 }
}

type Pilot = { mealId: number; pickIn: number }

function pilot(s: GameState, m: Pilot, dt: number): GameState {
  const p = s.player
  const pr = playerRadius(s)
  let ax = 0
  let ay = 0
  for (const f of s.fishes) {
    if (f.tier <= p.size) continue
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
  if (k && Math.abs(p.y - k.y) < SHARK_RADIUS * 1.4) ay += (p.y < k.y ? -1 : 1) * 5
  m.pickIn -= dt
  let meal = s.fishes.find((f) => f.id === m.mealId && f.tier <= p.size) ?? null
  if (!meal || m.pickIn <= 0) {
    let best = 0
    meal = null
    for (const f of s.fishes) {
      if (f.tier > p.size || f.x < 10 || f.x > s.W - 10) continue
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
    ax += (s.W / 2 - p.x) / s.W
    ay += (WORLD_H / 2 - p.y) / WORLD_H
  }
  const len = Math.hypot(ax, ay) || 1
  return setTarget(s, p.x + (ax / len) * 70, p.y + (ay / len) * 70)
}

export function makeSim(): Sim<GameState> {
  const m: Pilot = { mealId: -1, pickIn: 0 }
  return {
    start: (w, h) => {
      m.mealId = -1
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
