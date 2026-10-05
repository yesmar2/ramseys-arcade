import { todaysHole } from '../../lib/dailyHole'
import type { GamePreviewRun } from '../../lib/gamePreviews'
import { createInitialState, startGame, tick, type GameState } from './game'
import { AceScene } from './scene'

/*
 * Ace Chase showing a day's hole for its card on the home page's Dailies row (GamePreview, given the day): the
 * flyover every hole opens with, in over the target and back down the hole to the tee, in the game's own 3D
 * (scene.ts). It rests at the tee a moment, then flies the hole again. It never takes a shot: a preview that
 * holed out would show everyone the day's answer.
 *
 * The renderer is WebGL, on a canvas of its own, copied onto the card's each frame. It's only made once the
 * card is first hovered (a card can sit on the page all visit without ever playing), and let go with the card.
 */

/** How long the camera rests at the tee before the flyover starts again, in seconds. */
const REST = 1.5

export function createDayPreview(day: string): GamePreviewRun {
  let scene: AceScene | null = null
  let gl: HTMLCanvasElement | null = null
  let state: GameState | null = null
  let rest = 0
  const flyover = () => startGame(createInitialState(todaysHole(day).def))

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the hole and the 3D scene wait until the card
      // first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        gl = document.createElement('canvas')
        scene = new AceScene(gl)
        state = flyover()
      }
      if (!state) return
      state = tick(state, dt)
      if (state.phase === 'aim') {
        rest += dt
        if (rest > REST) {
          rest = 0
          state = flyover()
        }
      }
      scene.resize(w, h, { top: 0, bottom: h })
      scene.frame(state, dt)
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
