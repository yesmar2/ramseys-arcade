import type { GamePreviewRun } from '../../lib/gamePreviews'
import { BLUE_ROUTES } from './blueRoutes'
import { laidNumber } from './daily'
import { Ghost, slingDay } from './runs'
import { TowerScene } from './scene'
import { climbWith, replayHands } from './sim'

/*
 * Sling playing a day's tower for its card on the home page's Dailies row (GamePreview, given the day): the blue
 * blip's climb, flown again from the plan's route (blueRoutes.ts) by the game's own renderer (scene.ts), from a
 * stretch a little way up so the card opens on a fling, not the first peg. Then it snaps back and climbs that
 * stretch again. Nothing is heard, and nothing kept.
 */

const STRETCH = 14
const REST = 0.5

export function createDayPreview(day: string): GamePreviewRun {
  const sling = slingDay(day)
  let ghost: Ghost | null = null
  let from = 0
  let to = 0
  let scene: TowerScene | null = null
  let t = 0
  return {
    paint(ctx, w, h, dt) {
      if (!scene) {
        if (dt <= 0) return
        scene = new TowerScene(ctx.canvas, sling.tower)
        scene.snap()
      }
      if (!ghost) {
        const route = BLUE_ROUTES[laidNumber(sling) - 1] ?? ''
        const run = climbWith(sling.tower, replayHands(route))
        ghost = new Ghost({ time: run.time, splits: run.splits, ghost: run.ghost })
        from = Math.min(Math.max(0, run.time - STRETCH), run.time * 0.3)
        to = Math.min(run.time, from + STRETCH)
        t = from
      }
      scene.resize(w, h)
      t += dt
      if (t > to + REST) {
        t = from
        scene.snap()
      }
      const pose = ghost.at(Math.min(t, to))
      scene.frame(
        {
          mode: 'play',
          t: Math.min(t, to),
          blip: { x: pose.x, y: pose.y, vx: 0, vy: 0, on: !pose.flying && !pose.floating, floating: pose.floating, peg: -1, held: 0 },
          best: 0,
          flag: -1,
          aim: null,
          ghost: null,
          ghostTag: '',
          ghostMine: false,
          ghostBlue: false,
          gone: -1,
          calm: false,
        },
        dt,
      )
    },
    dispose() {
      scene?.dispose()
      scene = null
    },
  }
}
