import { hushed } from '../lib/sound'
import * as asteroids from './asteroids/game'
import { renderGame as drawAsteroids } from './asteroids/render'
import * as barrage from './barrage/game'
import { renderGame as drawBarrage } from './barrage/render'
import * as bop from './bop/game'
import { renderGame as drawBop } from './bop/render'
import * as crosswalk from './crosswalk/game'
import { renderGame as drawCrosswalk } from './crosswalk/render'
import * as crumbtrail from './crumbtrail/game'
import { renderGame as drawCrumbtrail } from './crumbtrail/render'
import * as centroid from './dead-center/game'
import { renderGame as drawCentroid } from './dead-center/render'
import * as findbug from './findbug/game'
import { renderGame as drawFindBug } from './findbug/render'
import * as patriot from './patriot/game'
import { renderGame as drawPatriot } from './patriot/render'
import * as pellets from './pellets/game'
import { renderGame as drawPellets } from './pellets/render'
import * as simon from './simon/game'
import { renderGame as drawSimon } from './simon/render'
import * as snake from './snake/game'
import { renderGame as drawSnake } from './snake/render'
import * as stacker from './stacker/StackerEngine'
import { renderGame as drawStacker } from './stacker/render'
import * as pop from './whack/game'
import { renderGame as drawPop } from './whack/render'

/*
 * Posters: a still of each game for its tile on the home page and the banner.
 *
 * Nothing is drawn specially. Each poster builds a good moment of real play
 * from the game's own state, a few seconds in, and hands back the game's own
 * renderer to paint it at whatever size the tile is. So a poster is the game
 * as it looks in play, in the current theme, and it stays true as the game
 * changes. Building a moment runs the game's tick, which can call for sounds;
 * every build is hushed.
 *
 * A game without a poster keeps its thumb on a block of its colour.
 */

/** Paints one frame of a game into a canvas of this size. */
export type PosterFrame = (ctx: CanvasRenderingContext2D, w: number, h: number) => void
/** Builds the moment for a tile of this size and returns how to paint it. */
export type Poster = (w: number, h: number) => PosterFrame

/** Runs a game's tick for this many seconds at sixty frames a second. */
function run<S>(state: S, tick: (s: S, dt: number) => S, seconds: number): S {
  let s = state
  for (let t = 0; t < seconds; t += 1 / 60) s = tick(s, 1 / 60)
  return s
}

/** In development, the built moments are kept on the window for a look from the console. */
function keep<S>(slug: string, state: S): S {
  if (import.meta.env.DEV) {
    const w = window as unknown as { __posterStates?: Record<string, unknown> }
    w.__posterStates = { ...(w.__posterStates ?? {}), [slug]: state }
  }
  return state
}

export const posters: Record<string, Poster> = {
  /* A long snake mid-wiggle, food somewhere ahead, on a small board so the cells read at tile size. */
  snake: (w, h) => {
    const portrait = h > w
    const cols = portrait ? 8 : 10
    const rows = portrait ? 10 : 8
    const state = hushed(() => {
      const fresh = snake.jumpToLength(snake.startGame(snake.createInitialState(cols, rows)), 8)
      let s = run(fresh, snake.tick, 0.1)
      s = run(snake.queueTurn(s, 'left'), snake.tick, 0.3)
      s = run(snake.queueTurn(s, 'right'), snake.tick, 0.25)
      s = run(snake.queueTurn(s, 'right'), snake.tick, 0.45)
      s = run(snake.queueTurn(s, 'left'), snake.tick, 0.15)
      // A wall or a tail would end the run; a straight snake beats a dead one.
      return s.phase === 'playing' ? s : fresh
    })
    return (ctx, cw, ch) => drawSnake(ctx, state, cw, ch)
  },

  /* Wave six, ten rocks drifting in, the ship under thrust. */
  asteroids: (w, h) => {
    const state = hushed(() => {
      const started = asteroids.jumpToWave(asteroids.startGame(asteroids.createInitialState(w, h)), 6)
      const drifted = run(started, asteroids.tick, 0.95)
      const burning = run({ ...drifted, thrust: true }, asteroids.tick, 0.15)
      return { ...burning, ship: { ...burning.ship, invuln: 0, thrusting: true } }
    })
    return (ctx, cw, ch) => drawAsteroids(ctx, state, cw, ch)
  },

  /* Eight slabs up, the next one sliding in. */
  stacker: () => {
    const state = hushed(() =>
      run(stacker.jumpToHeight(stacker.startGame(stacker.createInitialState()), 8), stacker.tick, 0.32),
    )
    return (ctx, cw, ch) => drawStacker(ctx, state, cw, ch)
  },

  /* The first note of a round: one pad lit. */
  simon: (w, h) => {
    const state = hushed(() => {
      let s = simon.startGame(simon.resizeState(simon.createInitialState(w, h), w, h))
      for (let t = 0; t < 3 && s.lit === null; t += 1 / 60) s = simon.tick(s, 1 / 60)
      return s
    })
    return (ctx, cw, ch) => drawSimon(ctx, state, cw, ch)
  },

  /* A second and a half in: bubbles up and rising. */
  pop: (w, h) => {
    const state = hushed(() => run(pop.setScale(pop.startGame(pop.createInitialState()), w, h), pop.tick, 1.6))
    return (ctx, cw, ch) => drawPop(ctx, state, cw, ch)
  },

  /* Round one's shape, the clock just started. */
  centroid: (w, h) => {
    const state = hushed(() => run(centroid.startGame(centroid.createInitialState(w, h)), centroid.tick, 0.5))
    return (ctx, cw, ch) => drawCentroid(ctx, state, cw, ch)
  },

  /* A stretch of road with traffic on the move: the first row past the start whose view holds two roads. */
  crosswalk: (w, h) => {
    const state = hushed(() => {
      const fresh = crosswalk.startGame(crosswalk.createInitialState(crosswalk.pickCols(w, h)))
      // The view runs from two rows behind the player to three ahead.
      const roadsAround = (row: number) => {
        let n = 0
        for (let r = row - 2; r <= row + 3; r++) if (crosswalk.getRow(fresh, r).kind === 'road') n++
        return n
      }
      let row = 8
      for (let r = 8; r < 48; r++) {
        if (roadsAround(r) >= 2) {
          row = r
          break
        }
      }
      const started = crosswalk.jumpToRow(fresh, row)
      const moving = run(started, crosswalk.tick, 1.2)
      return moving.phase === 'playing' ? moving : started
    })
    return (ctx, cw, ch) => drawCrosswalk(ctx, state, cw, ch)
  },

  /* Ten rows down the corridor, crumbs ahead and the tide behind. */
  crumbtrail: (w, h) => {
    const view = crumbtrail.crumbtrailViewportFor(w, h)
    const state = hushed(() => {
      const started = crumbtrail.jumpToDepth(
        crumbtrail.startGame(crumbtrail.createInitialState(view), view),
        10,
      )
      const moving = run(started, crumbtrail.tick, 1.0)
      return moving.phase === 'playing' ? moving : started
    })
    return (ctx, cw, ch) => drawCrumbtrail(ctx, state, cw, ch)
  },

  /* The maze, a second and a half in: the chasers leaving the house. */
  pellets: () => {
    const state = hushed(() => {
      const started = pellets.startGame(pellets.createInitialState())
      const moving = run(started, pellets.tick, 1.5)
      return moving.phase === 'playing' ? moving : started
    })
    return (ctx, cw, ch) => drawPellets(ctx, state, cw, ch)
  },

  /* Wave three under way: missiles streaking down on the cities, two shots bursting to meet them. */
  patriot: (w, h) => {
    const state = hushed(() => {
      const started = patriot.jumpToWave(patriot.startGame(patriot.createInitialState(w, h), w, h), 3, w)
      // The world runs at tile scale, so the missiles take seconds to come down
      // into view. A shot climbs in under half a second and its blast has grown
      // and gone a second later, so the two fired late are mid-burst when the
      // frame is taken: one near full size, one still opening.
      let s = started
      for (let t = 0; t < 7.0; t += 1 / 60) {
        if (Math.abs(t - 5.9) < 1 / 120) s = patriot.fire(s, { x: w * 0.36, y: h * 0.38 })
        if (Math.abs(t - 6.3) < 1 / 120) s = patriot.fire(s, { x: w * 0.66, y: h * 0.32 })
        s = patriot.tick(s, 1 / 60, w)
      }
      return keep('patriot', s.phase === 'playing' ? s : started)
    })
    return (ctx, cw, ch) => drawPatriot(ctx, state, cw, ch)
  },

  /* Wave three, the formation marching, the cannon's shots in the air, before a volley starts to charge. */
  barrage: (w, h) => {
    const portrait = h > w
    const state = hushed(() => {
      const started = barrage.jumpToWave(barrage.startGame(barrage.createInitialState(portrait), portrait), 3)
      let s = barrage.setFiring(started, true)
      let best = s
      // A charging ship paints a warning band down the field; take the frame just before one does.
      for (let t = 0; t < 1.6; t += 0.1) {
        s = run(s, barrage.tick, 0.1)
        if (s.phase !== 'playing') break
        const charging = s.ships.some((ship) => ship.charge > 0.05)
        if (s.shots.length > 0 && !charging) best = s
        if (charging) break
      }
      return best
    })
    return (ctx, cw, ch) => drawBarrage(ctx, state, cw, ch)
  },

  /* The console with its first call lit. */
  bop: (w, h) => {
    const state = hushed(() => {
      const started = bop.startGame(bop.resizeState(bop.createInitialState(w, h), w, h))
      const called = run(started, bop.tick, 0.3)
      return called.phase === 'call' ? called : started
    })
    return (ctx, cw, ch) => drawBop(ctx, state, cw, ch)
  },

  /* The first scene, bugs in it. */
  findbug: (w, h) => {
    const portrait = h > w
    const state = hushed(() => {
      const started = findbug.startGame(findbug.createInitialState(portrait), portrait)
      return run(started, findbug.tick, 0.5)
    })
    return (ctx, cw, ch) => drawFindBug(ctx, state, cw, ch)
  },
}

export function hasPoster(slug: string): boolean {
  return slug in posters
}
