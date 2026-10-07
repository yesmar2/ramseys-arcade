import type { GamePreviewRun } from '../../lib/gamePreviews'
import { chosenSkin } from '../../lib/skins'
import { dailyTrack } from './daily'
import { HotLapScene } from './scene'
import { botDriver, buildTrack, newRun, STEP, stepRun, type Controls, type Run, type Track } from './sim'

/*
 * Hot Lap driving a day's track for its card on the home page's Dailies row (GamePreview, given the day): the
 * pace car's driver (sim.ts botDriver) lapping the track in the game's own physics and its own 3D renderer
 * (scene.ts), the camera behind the car, rubber left on the road where it slides. Over the line it carries on
 * a moment, then starts the lap again from the grid. Nothing is heard, and nothing kept.
 *
 * The renderer is WebGL, on a canvas of its own, copied onto the card's each frame. It's only made once the
 * card is first hovered (a card can sit on the page all visit without ever playing), and let go with the card.
 */

/** How long the car carries on past the line before the lap starts again, in seconds. */
const REST = 2

export function createDayPreview(day: string): GamePreviewRun {
  let scene: HotLapScene | null = null
  let gl: HTMLCanvasElement | null = null
  let track: Track | null = null
  let drive: ((run: Run) => Controls) | null = null
  let run: Run | null = null
  let owed = 0
  let after = 0

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the track and the 3D scene wait until the card
      // first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        const daily = dailyTrack(day)
        track = buildTrack(daily.pieces, daily.shape)
        gl = document.createElement('canvas')
        scene = new HotLapScene(gl, track)
        drive = botDriver(track)
        run = newRun(track)
        scene.startLap()
      }
      if (!track || !drive || !run) return
      // The game's own steps, as many as the time that's gone by holds.
      owed += Math.min(dt, 0.25)
      while (owed >= STEP) {
        const before = run.bumped
        stepRun(run, drive(run), track)
        if (run.bumped > 0 && before === 0) scene.bump()
        if (run.finished) after += STEP
        owed -= STEP
      }
      if (run.finished && after > REST) {
        // Back to the grid: a new lap, the camera behind the car again.
        run = newRun(track)
        after = 0
        scene.startLap()
      }
      scene.resize(w, h)
      // Driven in the player's own skin, as their lap would be.
      scene.frame({ run, showroom: false, driving: true, ghost: null, cardAside: false, skin: chosenSkin('hotlap') }, dt)
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
