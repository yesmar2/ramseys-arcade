import { runPreview, type Sim } from '../previewKit'
import {
  clearPointerDir,
  createInitialState,
  fishRadius,
  radiusForLevel,
  requestDash,
  resizeState,
  setPointerDir,
  startGame,
  tick,
  type Fish,
  type GameState,
} from './game'
import { renderGame } from './render'
import { rocksNear } from './world'

/*
 * Frenzy playing itself, for its tile on the home page. Everything on screen
 * is the game's own engine and renderer, so the preview changes whenever the
 * game does. The only thing added is a pilot that plays the way a person
 * would: it picks a fish it can eat and goes after it, runs from anything that
 * could eat it, keeps off jellies, mines and rock, and dashes when a hunter
 * lunges. When it is eaten, a new run starts.
 */

type Pilot = {
  mealId: number
  pickIn: number
  wander: number
  wanderIn: number
  lastX: number
  lastY: number
  stuckFor: number
  escapeFor: number
  escapeAngle: number
}

const HUNTING = new Set(['alert', 'windup', 'lunge', 'strike'])

/**
 * The renderer draws any fish shorter than 15px as a plain oval and tail, so a
 * tile left at its own small scale shows nothing but plain fish. Draw it at the
 * scale the game itself has on a 390px phone instead, where even a starting
 * fish is about 24px long and gets its stripes, fins and eye.
 */
const PHONE_SCALE = 390 / 540

function sized(s: GameState): GameState {
  s.scale = Math.max(s.scale, PHONE_SCALE)
  return s
}

function newRun(w: number, h: number): GameState {
  return sized(startGame(createInitialState(w, h)))
}

function freshPilot(): Pilot {
  return {
    mealId: -1,
    pickIn: 0,
    wander: Math.random() * Math.PI * 2,
    wanderIn: 0,
    lastX: 0,
    lastY: 0,
    stuckFor: 0,
    escapeFor: 0,
    escapeAngle: 0,
  }
}

function pilot(s: GameState, m: Pilot, dt: number): GameState {
  const p = s.player
  const pr = radiusForLevel(p.level)
  let ax = 0
  let ay = 0
  let dash: number | null = null
  let fleeing = false

  const away = (x: number, y: number, range: number, weight: number) => {
    const dx = p.x - x
    const dy = p.y - y
    const d = Math.hypot(dx, dy) || 1
    if (d >= range) return
    const k = (1 - d / range) * weight
    ax += (dx / d) * k
    ay += (dy / d) * k
  }

  for (const f of s.fishes) {
    if (f.level <= p.level) continue
    const fr = fishRadius(f)
    const hunting = HUNTING.has(f.state)
    away(f.x, f.y, (fr + pr) * (hunting ? 9 : 5), hunting ? 5 : 2.5)
    const d = Math.hypot(p.x - f.x, p.y - f.y)
    if (hunting && d < (fr + pr) * 9) fleeing = true
    if ((f.state === 'lunge' || f.state === 'strike') && d < (fr + pr) * 4 && p.dashCd <= 0) {
      dash = Math.atan2(p.y - f.y, p.x - f.x)
    }
  }
  for (const j of s.jellies) away(j.x, j.y, j.r * 3 + pr * 2, 3)
  for (const mine of s.mines) away(mine.x, mine.y, mine.r * 5 + pr * 2, 4)
  for (const rock of rocksNear(s.seed, p.x, p.y, pr * 6 + 240)) away(rock.x, rock.y, rock.r + pr * 3, 2.5)

  // A player picks a fish and sticks with it for a moment, rather than retargeting every frame.
  m.pickIn -= dt
  let meal: Fish | null = s.fishes.find((f) => f.id === m.mealId && f.level <= p.level) ?? null
  if (!meal || m.pickIn <= 0) {
    let mealScore = 0
    meal = null
    for (const f of s.fishes) {
      if (f.level > p.level) continue
      const d = Math.hypot(f.x - p.x, f.y - p.y)
      const score = (0.6 + f.level / p.level) / (d + 80)
      if (score > mealScore) {
        mealScore = score
        meal = f
      }
    }
    m.mealId = meal ? meal.id : -1
    m.pickIn = 0.5 + Math.random() * 0.6
  }
  if (meal) {
    const dx = meal.x - p.x
    const dy = meal.y - p.y
    const d = Math.hypot(dx, dy) || 1
    ax += (dx / d) * 1.8
    ay += (dy / d) * 1.8
    if (dash === null && d > pr * 1.6 && d < pr * 4 && p.dashCd <= 0 && Math.random() < dt * 0.3) {
      dash = Math.atan2(dy, dx)
    }
  } else {
    m.wanderIn -= dt
    if (m.wanderIn <= 0) {
      m.wander += (Math.random() - 0.5) * 2.2
      m.wanderIn = 1.2 + Math.random()
    }
    ax += Math.cos(m.wander)
    ay += Math.sin(m.wander)
  }

  // Stay in the sunlit shallows, where the preview reads best.
  if (p.y > 1100) ay -= (p.y - 1100) / 250
  if (p.y < 140) ay += (140 - p.y) / 60

  // A pilot pinned against rock picks a new direction and commits to it for a moment.
  if (Math.hypot(p.x - m.lastX, p.y - m.lastY) < 30 * dt) m.stuckFor += dt
  else m.stuckFor = 0
  m.lastX = p.x
  m.lastY = p.y
  if (m.stuckFor > 0.6 && m.escapeFor <= 0) {
    m.escapeFor = 0.9
    m.escapeAngle = Math.atan2(ay, ax) + Math.PI * (0.5 + Math.random())
  }
  if (m.escapeFor > 0) {
    m.escapeFor -= dt
    ax = Math.cos(m.escapeAngle)
    ay = Math.sin(m.escapeAngle)
  }

  // Cruise at a player's pace; only a hunter on your tail gets full speed.
  const len = Math.hypot(ax, ay)
  const reach = fleeing || m.escapeFor > 0 ? 120 : 52
  let next = len < 0.05 ? clearPointerDir(s) : setPointerDir(s, (ax / len) * reach, (ay / len) * reach)
  if (dash !== null) next = requestDash(next, dash)
  return next
}

export function makeSim(): Sim<GameState> {
  const m = freshPilot()
  return {
    start: (w, h) => {
      Object.assign(m, freshPilot())
      return newRun(w, h)
    },
    step: (s, dt) => tick(s.phase === 'playing' ? pilot(s, m, dt) : s, dt),
    over: (s) => s.phase === 'gameover',
    // The world as the game draws it, minus what is written over it for a
    // player: the how-to line, the combo count and the zone banners.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, elapsed: Math.max(s.elapsed, 9.5), combo: 0, banners: [] }, w, h),
    resize: (s, w, h) => sized(resizeState(s, w, h)),
    // The still: the fish mid-dash through a school, with a bigger hunter nearby.
    poster: { seed: 3, at: 17 },
    hold: 1.1,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
