import type { GamePreviewRun } from '../../lib/gamePreviews'
import { chosenSkin } from '../../lib/skins'
import { laidNumber } from './daily'
import { downhillAt, goldenHills, type GoldenHill } from './golden'
import { newLookFor } from './newLook'
import { Ghost, swoopDay, type GhostPose } from './runs'
import { HillsScene } from './scene'
import { GHOST_EVERY, GHOST_RATE, GHOST_STRIDE, GLIDE, GOOD_HANDS, heightAt, HOLD, makePerson, newBird, step, STREAK_ON, type Hills } from './sim'
import { VistaScene } from './vista'

/*
 * Swoop playing a day's hills for its card on the home page's Dailies row (GamePreview, given the day): a good
 * player's run (sim.ts GOOD_HANDS, the dev autopilot's quick hands), flown by the game's own renderer, the
 * camera riding with it. A tile is looked at for a few seconds, so it plays the run's quickest stretch, the
 * bird already up to speed and swooping, not the push off from a standstill: Ramsey, 2026-10-06, "it's just
 * the bird going really slow" (it flew the blue bird, the slow run to beat, from the start). Then it snaps back
 * and flies that stretch again. Nothing is heard, and nothing kept.
 *
 * A day is drawn as the game draws it (newLook.ts newLookFor): the hills from the new look's first day on by
 * vista.ts, with what the game has there, the flock that grows with the stretch's clean landings and scatters
 * at a thump, and the day's kites, caught where the run lands clean on their hills; the hills before it by
 * scene.ts, as their card always played them.
 */

/** How long a stretch the card plays, in seconds. */
const STRETCH = 14
/** How long the bird keeps on past the stretch before it flies it again, faded by the snap, in seconds. */
const REST = 0.4
/** A run that hasn't crossed the line by now is given up, in seconds (sim.ts flyWith's). */
const LIMIT = 300

/** Where the run came down, when, and how: `over` when it left the sim's streak at nought. */
type Landing = { at: number; kind: 'clean' | 'thump' | 'land'; x: number; y: number; vx: number; over: boolean }

type Highlight = { ghost: Ghost; from: number; to: number; landings: Landing[] }

const highlights = new Map<string, Highlight>()

const r2 = (v: number) => Math.round(v * 100) / 100

/** The good run, as sim.ts flyWith flies it and keeps its path, with its landings kept too. */
function goodRun(hills: Hills): { ghost: Ghost; time: number; landings: Landing[] } {
  const hands = makePerson(hills, GOOD_HANDS)
  const b = newBird(hills)
  const path: number[] = []
  const landings: Landing[] = []
  for (let steps = 0; !b.done && b.t < LIMIT; steps++) {
    const hold = hands(b)
    if (steps % GHOST_EVERY === 0) path.push(r2(b.x), r2(b.y), hold ? HOLD : GLIDE)
    const ev = step(hills, b, hold)
    if (ev === 'clean' || ev === 'thump' || ev === 'land') landings.push({ at: b.t, kind: ev, x: b.x, y: b.y, vx: b.vx, over: b.streak === 0 })
  }
  if (b.done) path.push(r2(b.x), r2(b.y), GLIDE)
  const time = b.done ? b.time : Infinity
  return { ghost: new Ghost({ time, splits: b.splits.slice(), ghost: path }), time, landings }
}

/** The good run's quickest STRETCH seconds, starting on the hill so it opens on a swoop down. */
function highlightOf(day: string, hills: Hills): Highlight {
  let found = highlights.get(day)
  if (found) return found
  const flight = goodRun(hills)
  const g = flight.ghost.run.ghost
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
  const to = Math.min(flight.time, from + STRETCH)
  found = { ghost: flight.ghost, from, to, landings: flight.landings.filter((l) => l.at > from && l.at <= to) }
  if (highlights.size > 2) highlights.clear()
  highlights.set(day, found)
  return found
}

export function createDayPreview(day: string): GamePreviewRun {
  const swoop = swoopDay(day)
  const { hills } = swoop
  let show: Highlight | null = null
  let scene: HillsScene | null = null
  /** The scene again, when the day is one flown in the new look, and its kites' hills. */
  let vista: VistaScene | null = null
  let kites: GoldenHill[] = []
  let t = 0
  let last: GhostPose | null = null
  /** The stretch's next landing to tell the scene of, and the clean landings in a row so far in the stretch. */
  let next = 0
  let streak = 0

  return {
    paint(ctx, w, h, dt) {
      // A still for a card that isn't playing is never seen, so the run (a moment's work, done once a day) and
      // the scene wait until the card first plays: a page whose card is never hovered does neither.
      if (!scene) {
        if (dt <= 0) return
        if (newLookFor(day)) {
          vista = new VistaScene(ctx.canvas, hills)
          kites = goldenHills(hills, swoop.n >= 1 ? laidNumber(swoop) : null)
          vista.setGolden(kites)
        }
        scene = vista ?? new HillsScene(ctx.canvas, hills)
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
        next = 0
        streak = 0
        scene.snap()
      }
      const pose = show.ghost.at(Math.min(t, show.to))
      const vx = last && dt > 0 ? (pose.x - last.x) / dt : 14
      const vy = last && dt > 0 ? (pose.y - last.y) / dt : 0
      last = pose
      const splits = show.ghost.run.splits
      let flag = -1
      while (flag + 1 < splits.length - 1 && splits[flag + 1]! <= t) flag++
      // The new look is told of each landing as the game tells it (SwoopGame.tsx), for the flock and the kites.
      // The streak is the stretch's own, from nought, as its flock is.
      while (vista && next < show.landings.length && show.landings[next]!.at <= t) {
        const l = show.landings[next++]!
        const before = streak
        streak = l.kind === 'clean' ? streak + 1 : l.over ? 0 : streak
        vista.landed(l.kind, l.x, l.y, l.vx, l.kind === 'clean' ? streak : 0)
        if (l.kind === 'clean') {
          const top = downhillAt(hills, l.x)
          const at = kites.findIndex((hill) => hill.top === top)
          if (at >= 0) vista.goldenCaught(at)
        } else if (before >= STREAK_ON && streak === 0) vista.streakOver(l.x, l.y)
      }
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
          ...(vista ? { streak } : {}),
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
      vista = null
    },
  }
}
