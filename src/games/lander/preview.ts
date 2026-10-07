import type { GamePreviewRun } from '../../lib/gamePreviews'
import { Ghost, landerDay, paceOf, type GhostPose } from './runs'
import { CaveScene } from './scene'

/*
 * Lander playing a day's cave for its card on the home page's Dailies row (GamePreview, given the day): the
 * blue ship's run (runs.ts paceOf), flown as your own ship is, by the game's own renderer (scene.ts), the
 * camera riding with it, its flame and sparks, the gates turning green as it passes them, down onto the
 * pad. It rests there a moment, then flies the cave again from the top. Nothing is heard, and nothing kept.
 */

/** How long the ship sits on the pad before it flies the cave again, in seconds. */
const REST = 2.2

export function createDayPreview(day: string): GamePreviewRun {
  const { cave } = landerDay(day)
  let ghost: Ghost | null = null
  let scene: CaveScene | null = null
  let t = 0
  let rest = 0
  let last: GhostPose | null = null

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the blue ship's run (a moment's work, done once
      // a day) and the scene wait until the card first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        scene = new CaveScene(ctx.canvas, cave)
        scene.snap()
      }
      const run = (ghost ??= new Ghost(paceOf(day)))
      scene.resize(w, h)
      t += dt
      let pose = run.at(t)
      if (pose.done) {
        rest += dt
        if (rest > REST) {
          // Back to the top: a new run.
          t = 0
          rest = 0
          last = null
          scene.snap()
          pose = run.at(0)
        }
      }
      const vx = last && dt > 0 ? (pose.x - last.x) / dt : 0
      const vy = last && dt > 0 ? (pose.y - last.y) / dt : 0
      last = pose
      const splits = run.run.splits
      let gate = -1
      while (gate + 1 < splits.length && splits[gate + 1]! <= t) gate++
      scene.frame(
        {
          mode: pose.done ? 'done' : 'play',
          ship: { x: pose.x, y: pose.y, a: pose.a, vx, vy },
          engine: pose.engine ? 1 : 0,
          gate,
          ghost: null,
          ghostTag: '',
          ghostMine: false,
          calm: false,
          out: null,
          // The cave's moving things where they were as the blue ship flew it.
          t: pose.done ? run.run.time : t,
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
