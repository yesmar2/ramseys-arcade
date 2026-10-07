import type { GamePreviewRun } from '../../lib/gamePreviews'
import { chosenSkin } from '../../lib/skins'
import { Ghost, swoopDay, type GhostPose } from './runs'
import { HillsScene } from './scene'
import { flyWith, GHOST_RATE, GHOST_STRIDE, GOOD_HANDS, heightAt, makePerson, type Hills } from './sim'

/*
 * Swoop playing a day's hills for its card on the home page's Dailies row (GamePreview, given the day): a good
 * player's run (sim.ts GOOD_HANDS, the dev autopilot's quick hands), flown by the game's own renderer
 * (scene.ts), the camera riding with it. A tile is looked at for a few seconds, so it plays the run's quickest
 * stretch, the bird already up to speed and swooping, not the push off from a standstill: Ramsey, 2026-10-06,
 * "it's just the bird going really slow" (it flew the blue bird, the slow run to beat, from the start). Then it
 * snaps back and flies that stretch again. Nothing is heard, and nothing kept.
 */

/** How long a stretch the card plays, in seconds. */
const STRETCH = 14
/** How long the bird keeps on past the stretch before it flies it again, faded by the snap, in seconds. */
const REST = 0.4

type Highlight = { ghost: Ghost; from: number; to: number }

const highlights = new Map<string, Highlight>()

/** The good run's quickest STRETCH seconds, starting on the hill so it opens on a swoop down. */
function highlightOf(day: string, hills: Hills): Highlight {
  let found = highlights.get(day)
  if (found) return found
  const flight = flyWith(hills, makePerson(hills, GOOD_HANDS))
  const ghost = new Ghost({ time: flight.time, splits: flight.splits, ghost: flight.ghost })
  const g = flight.ghost
  const S = GHOST_STRIDE
  const samples = g.length / S - 1
  const span = Math.round(STRETCH * GHOST_RATE)
  let best = 0
  let bestGain = -Infinity
  for (let i = 0; i + span < samples; i += 4) {
    const onHill = Math.abs(g[i * S + 1]! - heightAt(hills, g[i * S]!)) < 0.3
    const gain = g[(i + span) * S]! - g[i * S]! - (onHill ? 0 : 40)
    if (gain > bestGain) {
      bestGain = gain
      best = i
    }
  }
  const from = best / GHOST_RATE
  found = { ghost, from, to: Math.min(flight.time, from + STRETCH) }
  if (highlights.size > 2) highlights.clear()
  highlights.set(day, found)
  return found
}

export function createDayPreview(day: string): GamePreviewRun {
  const { hills } = swoopDay(day)
  let show: Highlight | null = null
  let scene: HillsScene | null = null
  let t = 0
  let last: GhostPose | null = null

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the run (a moment's work, done once a day) and
      // the scene wait until the card first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        scene = new HillsScene(ctx.canvas, hills)
        scene.snap()
      }
      show ??= highlightOf(day, hills)
      if (!t) t = show.from
      scene.resize(w, h)
      t += dt
      if (t > show.to + REST) {
        // Back to the stretch's start.
        t = show.from
        last = null
        scene.snap()
      }
      const pose = show.ghost.at(Math.min(t, show.to))
      const vx = last && dt > 0 ? (pose.x - last.x) / dt : 14
      const vy = last && dt > 0 ? (pose.y - last.y) / dt : 0
      last = pose
      const splits = show.ghost.run.splits
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
          // Flown in the player's own skin, as their run would be.
          skin: chosenSkin('swoop'),
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
