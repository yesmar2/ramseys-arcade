import type { GamePreviewRun } from '../../lib/gamePreviews'
import { chosenSkin } from '../../lib/skins'
import { Ghost, marbleDay, paceOf } from './runs'
import { MarbleScene } from './scene'
import { BALL_R, newBall, surfaceAt } from './sim'

/*
 * Marble Run rolling a day's course for its card on the home page's Dailies row (GamePreview, given the day):
 * the pace ball's run (runs.ts paceOf) rolled as your marble is, by the game's own 3D renderer (scene.ts), the
 * camera behind it, the gates turning green as it passes them, to the goal. The camera pulls back there a
 * moment, then it rolls the course again from the start. Nothing is heard, and nothing kept.
 *
 * The renderer is WebGL, on a canvas of its own, copied onto the card's each frame. It's only made once the
 * card is first hovered (a card can sit on the page all visit without ever playing), and let go with the card.
 */

/** How long the camera looks back over the goal before the course starts again, in seconds. */
const REST = 2.6

export function createDayPreview(day: string): GamePreviewRun {
  const { course } = marbleDay(day)
  let ghost: Ghost | null = null
  let scene: MarbleScene | null = null
  let gl: HTMLCanvasElement | null = null
  const ball = newBall(course)
  let t = 0
  let doneFor = 0
  let last: { x: number; y: number; z: number } | null = null

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the pace ball's run (a moment's work, done once
      // a day) and the 3D scene wait until the card first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        gl = document.createElement('canvas')
        scene = new MarbleScene(gl, course)
        scene.snap()
      }
      const run = (ghost ??= new Ghost(paceOf(day)))
      scene.resize(w, h)
      t += dt
      let pose = run.at(t)
      if (pose.done) {
        doneFor += dt
        if (doneFor > REST) {
          // Back to the start: a new run, the camera behind the marble again.
          t = 0
          doneFor = 0
          last = null
          scene.snap()
          pose = run.at(0)
        }
      }
      ball.x = pose.x
      ball.y = pose.y
      ball.z = pose.z
      // The course's hammers, arms and slabs where they were as the pace ball rolled it.
      ball.t = pose.done ? run.run.time : t
      ball.vx = last && dt > 0 ? (pose.x - last.x) / dt : 0
      ball.vy = last && dt > 0 ? (pose.y - last.y) / dt : 0
      ball.vz = last && dt > 0 ? (pose.z - last.z) / dt : 0
      last = { x: pose.x, y: pose.y, z: pose.z }
      const under = surfaceAt(course, pose.x, pose.z, pose.y)
      ball.support = under
      ball.air = !under || pose.y - BALL_R - under.y > 0.12
      const splits = run.run.splits
      let passed = 0
      while (passed < splits.length && splits[passed]! <= t) passed++
      // Rolled in the player's own skin, as their run would be.
      scene.frame(
        { ball, tilt: { x: 0, z: 0 }, mode: pose.done ? 'done' : 'play', doneFor, ghost: null, ghostTag: '', passed, skin: chosenSkin('marblerun') },
        dt,
      )
      // Onto the card's own canvas, at the screen's density.
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
    dispose() {
      scene?.dispose()
      scene = null
      gl = null
    },
  }
}
