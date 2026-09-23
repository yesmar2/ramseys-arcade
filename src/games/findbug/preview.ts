import { isDarkTheme } from '../../lib/theme'
import { runPreview, type Sim } from '../previewKit'
import { homeCamera, type Field } from './camera'
import { faceCentre } from './critters'
import {
  createInitialState,
  DAZE_MS,
  markReady,
  MISS_MARK_MS,
  ROUNDS,
  setAspect,
  skipIntro,
  startGame,
  tapAt,
  tick,
  type GameState,
} from './game'
import { edgeColour, paintScene, SceneView, type Overlays } from './render'
import { faceHiddenBy, tapFindsTarget, type Scene } from './scenes'
import { likeness } from './wanted'

/*
 * Find the Bug playing itself, for its cabinet on the home page: the game's
 * own scenes, engine and painter, and a pilot that searches the way a person
 * does. It drags the view across the crowd a look at a time and rests on
 * each, sometimes taps somebody in his hat or his stripes and is wrong,
 * catches sight of him at the edge of the view, brings him to the middle and
 * taps him. The game's own found moment follows, then the next scene, through
 * all five, and then the run starts over.
 *
 * The cabinet never zooms out to the whole scene: at its size the critters
 * would be specks. It shows the scene at one magnification throughout, and the
 * game's scene view paints the whole scene once at that size, so each frame
 * only copies the part in view, sharp even while it pans.
 */

type Point = { x: number; y: number }

/** A place the view comes to rest, and what the pilot does there. */
type Stop = {
  /** The middle of the view, in world units. */
  x: number
  y: number
  /** Seconds dragging the view here from the stop before. */
  glide: number
  /** Seconds resting here before the tap, or before moving on. */
  rest: number
  /** Where to tap at the end of the rest, in world units. */
  tap: Point | null
}

type Pilot = {
  /** The scene this search was planned for. */
  scene: Scene
  stops: Stop[]
  /** The stop being made for, and seconds since setting out for it. */
  leg: number
  t: number
  /** Where the view set out from, and the middle of it now, in world units. */
  fromX: number
  fromY: number
  x: number
  y: number
  /** Seconds on the scene card. */
  carded: number
}

type Run = {
  game: GameState
  pilot: Pilot
  /** Seconds since the run began: the clock the found ring pulses and turns by. */
  clock: number
}

/** Seconds on each scene card before the pilot taps to go. Only the frosted scene behind the card is drawn. */
const CARD = 0.7

/**
 * The first scene's search, as [glide, rest] for each stop: the look it opens
 * on, one look on the way, catching sight of him, and him. Its times are
 * fixed, and the poster (below) is taken on the last of them, with the view at
 * rest on him before the tap: change them and the poster wants picking again.
 */
const FIRST: readonly (readonly [number, number])[] = [
  [0, 0.6],
  [1.2, 0.8],
  [1.1, 0.4],
  [0.8, 1.1],
]

/** Milliseconds a frame may spend painting a scene that is not painted yet. */
const PAINT_MS = 8

/**
 * Screen px per world unit. A 216px cabinet shows a stretch of crowd about
 * as wide as a phone does zoomed in twice, its critters about 35px tall; a
 * smaller screen shows a little less of it, so they shrink less than it does.
 */
function scaleFor(w: number) {
  return 0.7 * (w / 216) ** 0.6
}

function rand(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Slow off the mark and slow to stop, the way a finger drags the view. */
function ease(t: number) {
  return t * t * (3 - 2 * t)
}

/** Seconds to drag the view `d` screens: longer for further, but far from in proportion. */
function glideFor(d: number) {
  return clamp(0.7 + 0.55 * d, 0.75, 1.45)
}

/**
 * Plan a search of the scene for a screen `w` by `h`: where the view opens
 * and rests on its way to him, and what gets tapped. The view never looks
 * past the scene's edges, and he stays out of it until the pilot is meant
 * to catch sight of him.
 */
function plan(scene: Scene, first: boolean, w: number, h: number): Stop[] {
  const k = scaleFor(w)
  const vw = w / k
  const vh = h / k
  const x0 = vw / 2
  const x1 = Math.max(x0, scene.w - vw / 2)
  const y0 = vh / 2
  const y1 = Math.max(y0, scene.h - vh / 2)
  const inside = (x: number, y: number): Point => ({ x: clamp(x, x0, x1), y: clamp(y, y0, y1) })
  /** Distance in screens, so a stretch across and one down count alike. */
  const apart = (a: Point, b: Point) => Math.hypot((a.x - b.x) / vw, (a.y - b.y) / vh)

  const bug = scene.target
  const face = faceCentre(bug)
  // Whether any of him is on screen with the view resting at `v`.
  const seen = (v: Point) => Math.abs(face.x - v.x) < vw / 2 + bug.size * 0.4 && Math.abs(face.y - v.y) < vh / 2 + bug.size * 0.5
  // He ends up near the middle of the view, not dead on it.
  const home = inside(face.x + rand(-0.08, 0.08) * vw, face.y + bug.size * 0.12 + rand(-0.08, 0.08) * vh)

  // Open somewhere well away from him.
  const [lo, hi] = first ? [1, 1.6] : [1.1, 2.3]
  let start = inside(rand(x0, x1), rand(y0, y1))
  let bestMiss = Infinity
  for (let i = 0; i < 60 && bestMiss > 0; i++) {
    const p = { x: rand(x0, x1), y: rand(y0, y1) }
    if (seen(p)) continue
    const d = apart(p, home)
    const miss = d < lo ? lo - d : d > hi ? d - hi : 0
    if (miss < bestMiss) {
      start = p
      bestMiss = miss
    }
  }

  // Where he comes into sight: on the way in from the start, a little short of him.
  const dirX = (start.x - home.x) / vw
  const dirY = (start.y - home.y) / vh
  const dirD = Math.hypot(dirX, dirY) || 1
  const spot = inside(home.x + (dirX / dirD) * 0.3 * vw, home.y + (dirY / dirD) * 0.3 * vh)

  // Looks on the way there, zigzagging either side of the straight line.
  const dx = spot.x - start.x
  const dy = spot.y - start.y
  const span = Math.hypot(dx / vw, dy / vh) || 1
  const nx = -(dy / vh) / span
  const ny = dx / vw / span
  const looks: { at: Point; along: number; tap: Point | null }[] = []
  const hops = first ? 1 : clamp(Math.round(span / 0.85), 1, 3)
  let side = Math.random() < 0.5 ? -1 : 1
  for (let i = 1; i <= hops; i++) {
    const along = i / (hops + 1)
    let at: Point | null = null
    for (let tries = 0; tries < 6 && !at; tries++) {
      const off = tries < 5 ? side * rand(0.12, 0.4) : 0
      const p = inside(start.x + dx * along + nx * off * vw, start.y + dy * along + ny * off * vh)
      if (!seen(p)) at = p
    }
    side = -side
    // The first scene keeps its look whatever, to keep to its times.
    if (!at && first) at = inside(start.x + dx * along, start.y + dy * along)
    if (at) looks.push({ at, along, tap: null })
  }

  // Now and then, a wrong tap on the way: somebody near the path who shares
  // two of the wanted bug's three looks (shell, hat, glasses), whose face
  // shows, and who is far enough off that tapping him cannot count as a find.
  if (!first && Math.random() < 0.5) {
    const len2 = dx * dx + dy * dy || 1
    let pick: { at: Point; along: number; tap: Point; score: number } | null = null
    for (const c of scene.critters) {
      if (c === bug || c.lift > 0) continue
      const like = likeness(c.look, scene.wanted)
      if (like < 2) continue
      const f = faceCentre(c)
      const along = clamp(((f.x - start.x) * dx + (f.y - start.y) * dy) / len2, 0, 1)
      if (along < 0.1 || along > 0.85) continue
      const off = apart(f, { x: start.x + dx * along, y: start.y + dy * along })
      if (off > 0.8) continue
      const score = off - like * 0.16 + Math.random() * 0.3
      if (pick && score >= pick.score) continue
      const at = inside(f.x + rand(-0.12, 0.12) * vw, f.y + rand(-0.1, 0.1) * vh)
      if (seen(at) || tapFindsTarget(scene, f.x, f.y) || faceHiddenBy(c, scene.items).length > 0) continue
      pick = { at, along, tap: f, score }
    }
    if (pick) {
      // It takes the place of the look nearest it, so the scene runs no longer.
      if (looks.length > 1) {
        let near = 0
        for (let i = 1; i < looks.length; i++) {
          if (Math.abs(looks[i].along - pick.along) < Math.abs(looks[near].along - pick.along)) near = i
        }
        looks.splice(near, 1)
      }
      looks.push({ at: pick.at, along: pick.along, tap: pick.tap })
      looks.sort((a, b) => a.along - b.along)
    }
  }

  const stops: Stop[] = [{ x: start.x, y: start.y, glide: 0, rest: rand(0.45, 0.8), tap: null }]
  const add = (at: Point, rest: number, tap: Point | null) => {
    const last = stops[stops.length - 1]
    stops.push({ x: at.x, y: at.y, glide: glideFor(apart(at, last)), rest, tap })
  }
  for (const look of looks) {
    if (look.tap) {
      add(look.at, rand(0.45, 0.65), look.tap)
      // Wrong: the scene dims and takes no taps for a moment, and the pilot stays put while it does.
      stops.push({ x: look.at.x, y: look.at.y, glide: 0, rest: rand(0.9, 1.15), tap: null })
    } else {
      add(look.at, rand(0.45, 0.9), null)
    }
  }
  if (first || apart(spot, home) > 0.08) add(spot, rand(0.28, 0.45), null)
  add(home, rand(0.55, 0.8), face)

  if (first) {
    stops.forEach((stop, i) => {
      const [glide, rest] = FIRST[Math.min(i, FIRST.length - 1)]
      stop.glide = glide
      stop.rest = rest
    })
  }
  return stops
}

function newPilot(game: GameState, w: number, h: number): Pilot {
  const stops = plan(game.scene, game.index === 0, w, h)
  const start = stops[0]
  return { scene: game.scene, stops, leg: 0, t: 0, fromX: start.x, fromY: start.y, x: start.x, y: start.y, carded: 0 }
}

/** Drag the view from stop to stop, resting at each and tapping where the plan says. */
function fly(p: Pilot, game: GameState, dt: number): GameState {
  const stop = p.stops[p.leg]
  p.t += dt
  if (p.t < stop.glide) {
    const e = ease(p.t / stop.glide)
    p.x = p.fromX + (stop.x - p.fromX) * e
    p.y = p.fromY + (stop.y - p.fromY) * e
    return game
  }
  p.x = stop.x
  p.y = stop.y
  if (p.t < stop.glide + stop.rest) return game
  let g = game
  if (stop.tap) {
    // A tap in the dimmed moment after a wrong one is not taken; wait it out.
    if (g.dazeMs > 0) return g
    g = tapAt(g, stop.tap.x, stop.tap.y).state
  }
  if (p.leg < p.stops.length - 1) {
    p.leg += 1
    p.t = 0
    p.fromX = p.x
    p.fromY = p.y
  }
  return g
}

/**
 * Where the scene sits on a screen `w` by `h`: all of it at the cabinet's
 * magnification, placed so the pilot's view is what shows, kept to whole
 * device pixels so the painted scene lands on the screen's pixels and stays
 * sharp.
 */
function fieldFor(p: Pilot, scene: Scene, w: number, h: number, dpr: number): Field {
  const k = scaleFor(w)
  const x0 = clamp(p.x - w / (2 * k), 0, Math.max(0, scene.w - w / k))
  const y0 = clamp(p.y - h / (2 * k), 0, Math.max(0, scene.h - h / k))
  return {
    x: Math.round(-x0 * k * dpr) / dpr,
    y: Math.round(-y0 * k * dpr) / dpr,
    w: scene.w * k,
    h: scene.h * k,
    scale: k,
  }
}

/**
 * What the game draws over the scene, as its page works it out: the found
 * moment's spotlight and ring, where the wrong taps landed, and the dim after
 * one. The hint circles never come up, since the pilot never takes long
 * enough, and there is no keyboard cursor.
 */
function overlaysFor(g: GameState, now: number): Overlays {
  const t = g.scene.target
  const face = faceCentre(t)
  let veil: Overlays['veil'] = null
  let ring: Overlays['ring'] = null
  if (g.phase === 'found' || g.phase === 'timeout') {
    const p = Math.min(1, g.phaseMs / 320)
    veil = { x: face.x, y: face.y + t.size * 0.12, r: t.size * (1.9 - 0.7 * p), alpha: 0.55 * p }
    ring = {
      x: face.x,
      y: face.y + t.size * 0.12,
      r: t.size * (0.7 + 0.04 * Math.sin(now / 110)),
      alpha: p,
      colour: g.phase === 'found' ? '#3dcf8d' : '#eaba59',
    }
  }
  return {
    cover: g.phase === 'menu' || g.phase === 'intro' || g.phase === 'gameover',
    dim: g.phase === 'playing' && g.dazeMs > 0 ? (g.dazeMs / DAZE_MS) * 0.55 : 0,
    veil,
    ring,
    misses: g.marks.map((m) => ({ x: m.x, y: m.y, age: m.ageMs / MISS_MARK_MS })),
    reticle: null,
  }
}

/**
 * Paint just the part of the scene in view, straight onto the screen, with
 * the game's own painter. It stands in while the scene view has no painting
 * of this scene at this size: for the still frame, which may be all a
 * cabinet ever shows, and for the moments before a fresh painting is done.
 */
function paintView(ctx: CanvasRenderingContext2D, scene: Scene, field: Field, w: number, h: number) {
  const k = field.scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  ctx.fillStyle = edgeColour(scene)
  ctx.fillRect(0, 0, w, h)
  ctx.transform(k, 0, 0, k, field.x, field.y)
  paintScene(ctx, scene, { x0: -field.x / k, y0: -field.y / k, x1: (w - field.x) / k, y1: (h - field.y) / k })
  ctx.restore()
}

export function makeSim(): Sim<Run> {
  // The game's scene view, which keeps the painting of the scene in play,
  // and the size and theme it paints for: either changing needs a fresh one.
  let view: SceneView | null = null
  let viewFor = ''
  // The run clock at the last frame drawn, to tell a frame of play from a redraw of a still one.
  let drawnAt = -Infinity

  return {
    start: (w, h) => {
      const aspect = h / w
      const game = startGame(createInitialState(aspect), aspect)
      return { game, pilot: newPilot(game, w, h), clock: 0 }
    },
    step: (s, dt, w, h) => {
      if (s.pilot.scene !== s.game.scene) s.pilot = newPilot(s.game, w, h)
      let g = s.game
      if (g.phase === 'intro') {
        // The scene is painted as it comes on screen, so it is ready as far as the pilot is concerned.
        g = markReady(g)
        s.pilot.carded += dt
        if (s.pilot.carded >= CARD) g = skipIntro(g)
      } else if (g.phase === 'playing') {
        g = fly(s.pilot, g, dt)
      }
      s.game = tick(g, dt * 1000)
      s.clock += dt
      return s
    },
    // The run ends on its last find. The hold below is shorter than the
    // game's own pause on a find, so the run starts over from the ring round
    // him rather than from the frosted end-of-run card.
    over: (s) => s.game.phase === 'gameover' || (s.game.index === ROUNDS - 1 && s.game.phase === 'found'),
    render: (ctx, s, w, h) => {
      const g = s.game
      const scene = g.scene
      const m = ctx.getTransform()
      const dpr = m.a > 0 ? m.a : 1
      const field = fieldFor(s.pilot, scene, w, h, dpr)
      const key = `${Math.round(field.w * dpr)}x${Math.round(field.h * dpr)}${isDarkTheme() ? ' dark' : ''}`
      if (!view || key !== viewFor) {
        view = new SceneView()
        viewFor = key
      }
      const live = s.clock > drawnAt && s.clock - drawnAt < 1
      drawnAt = s.clock
      const cover = g.phase !== 'playing' && g.phase !== 'found' && g.phase !== 'timeout'
      // Painting is only started while the preview plays, so a cabinet that
      // only ever shows its still frame never paints a whole scene.
      if (cover || live || view.ready(scene)) {
        const now = s.clock * 1000
        const camera = homeCamera(scene.w, scene.h)
        view.frame(ctx, w, h, scene, field, camera, dpr, overlaysFor(g, now), false, now, live ? PAINT_MS : 0)
      }
      if (!cover && !view.ready(scene)) paintView(ctx, scene, field, w, h)
    },
    // A new size keeps the search going; the view repaints for it.
    resize: (s, w, h) => {
      s.game = setAspect(s.game, h / w)
      return s
    },
    // The still: the picnic, with its watermelon, cupcake and critters everywhere.
    poster: { seed: 3, at: 6 },
    hold: 1.2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
