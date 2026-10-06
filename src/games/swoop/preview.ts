import type { GamePreviewRun } from '../../lib/gamePreviews'
import { Ghost, paceOf, swoopDay, type GhostPose } from './runs'
import { HillsScene } from './scene'
import { heightAt } from './sim'

/*
 * Swoop playing a day's hills for its card on the home page's Dailies row (GamePreview, given the day): the
 * blue bird's run (runs.ts paceOf), flown as your own bird is, by the game's own renderer (scene.ts), the
 * camera riding with it, down the slopes and off the tops, the flags turning green as it passes them, over the
 * line. It rests there a moment, then flies the hills again from the start. Nothing is heard, and nothing kept.
 */

/** How long the bird rests past the line before it flies the hills again, in seconds. */
const REST = 1.6

export function createDayPreview(day: string): GamePreviewRun {
  const { hills } = swoopDay(day)
  let ghost: Ghost | null = null
  let scene: HillsScene | null = null
  let t = 0
  let rest = 0
  let last: GhostPose | null = null

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the blue bird's run (a moment's work, done once
      // a day) and the scene wait until the card first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        scene = new HillsScene(ctx.canvas, hills)
        scene.snap()
      }
      const run = (ghost ??= new Ghost(paceOf(day)))
      scene.resize(w, h)
      t += dt
      let pose = run.at(t)
      if (pose.done) {
        rest += dt
        if (rest > REST) {
          // Back to the start: a new run.
          t = 0
          rest = 0
          last = null
          scene.snap()
          pose = run.at(0)
        }
      }
      const vx = last && dt > 0 ? (pose.x - last.x) / dt : 8
      const vy = last && dt > 0 ? (pose.y - last.y) / dt : 0
      last = pose
      const splits = run.run.splits
      let flag = -1
      while (flag + 1 < splits.length - 1 && splits[flag + 1]! <= t) flag++
      scene.frame(
        {
          mode: pose.done ? 'done' : 'play',
          bird: { x: pose.x, y: pose.y, vx: pose.done ? 8 : vx, vy: pose.done ? 0 : vy, ground: Math.abs(pose.y - heightAt(hills, pose.x)) < 0.08 },
          hold: pose.dive,
          flag,
          ghost: null,
          ghostTag: '',
          ghostMine: false,
          ghostBlue: false,
          calm: false,
        },
        dt,
      )
    },
    // Let go of the scene; if the card plays again, it's made afresh.
    dispose() {
      scene?.dispose()
      scene = null
    },
  }
}
