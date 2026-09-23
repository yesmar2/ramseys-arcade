import { runPreview, type Sim } from '../previewKit'
import {
  DESIGN_H,
  DESIGN_W,
  activatePower,
  createInitialState,
  fire,
  jumpToWave,
  resizeState,
  setCursor,
  startGame,
  tick,
  worldScale,
  type Blast,
  type GameState,
  type Incoming,
  type PowerKind,
} from './game'
import { renderGame } from './render'

/*
 * Patriot playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot at the mouse. It lets a missile come well
 * down the sky, moves the sight out ahead of it and clicks, and leaves alone
 * what is plainly about to fly into a fireball. Like a person it notices a new
 * trail a beat late, and one across the sky from where it is busy not until it
 * is nearly down; it goes for what matters most, or for the newest trail or
 * whatever is under the sight; it judges the lead by eye, usually short, which
 * the faster missiles outrun; it clicks at a person's pace, sometimes twice at
 * the same one; and it reaches for a power when things get hot. The cities go
 * one by one, and when the last one falls a new run starts.
 */

/*
 * What a player learns of the launchers by using them, in the game's units
 * before its scale: how fast a shot flies, how wide a burst grows and how
 * fast, how fast it dies away, how close it has to come, and how much the
 * Slow power slows the sky.
 */
const SHOT_SPEED = 400
const BURST = 82
const SEEKER_BURST = 152
const GROW = 120
const SHRINK = 70
const HIT_PAD = 4
const SLOWED = 0.32

/**
 * The field is drawn a third bigger than the cabinet's screen, and the screen
 * shows its full height and the three quarters of its width where the fight
 * is: the page's own 16:9 field with its sides trimmed to fit a 4:3 screen.
 */
const ZOOM = 4 / 3

/**
 * The wave each run opens on. The first few waves are a handful of slow
 * missiles, and a player who is paying attention stops every one of them, so
 * a run from the first wave is minutes of calm before a city falls. From the
 * fifth there are planes and violet missiles that split, and soon bombers and
 * blimps, and the cities go at a pace a cabinet can show.
 */
const OPENING_WAVE = 5

/** The page plays on a 16:9 stage, so the field is 16:9 here too, with the cities spaced as they are there. */
function fieldSize(w: number, h: number) {
  const fw = w * ZOOM
  return { fw, fh: Math.max(h, (fw * 9) / 16) }
}

/** Every speed in the game is set per this much of its scale. */
function pace(s: GameState) {
  return s.scale / worldScale(DESIGN_W, DESIGN_H)
}

/** Roughly a normal spread, mean 0 and deviation 1, never past 3. */
function wobble() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2
}

/** How far a missile going `speed` gets in `t` seconds, with the sky slowed while the Slow power lasts. */
function travel(s: GameState, speed: number, t: number) {
  const slow = Math.min(t, s.slowT)
  return speed * (slow * SLOWED + (t - slow))
}

/** Where a missile will be in `t` seconds, and whether it has come down by then. */
function missileAt(s: GameState, m: Incoming, t: number) {
  const total = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1
  const gone = Math.hypot(m.x - m.x0, m.y - m.y0)
  const next = Math.min(total, gone + travel(s, m.speed, t))
  const k = next / total
  return { x: m.x0 + (m.x1 - m.x0) * k, y: m.y0 + (m.y1 - m.y0) * k, down: next >= total - 0.5 }
}

/** Seconds until a missile comes down, or until a violet one splits, whichever it will do first. */
function timeLeft(s: GameState, m: Incoming) {
  const total = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1
  let left = total - Math.hypot(m.x - m.x0, m.y - m.y0)
  if (m.kind === 'split') left -= total * 0.5
  // `travel` turned round: the time the distance left will take.
  const slowGets = s.slowT * m.speed * SLOWED
  return left <= slowGets ? left / (m.speed * SLOWED) : s.slowT + (left - slowGets) / m.speed
}

/** How wide a blast will be in `t` seconds, or -1 if it is not burning then. */
function radiusAt(b: Blast, t: number, sc: number) {
  let tau = t - (b.wait ?? 0)
  if (tau < 0) return -1
  let r = b.r
  if (b.growing) {
    const grow = (b.growRate ?? GROW) * sc
    const from = Math.max(b.r, 6 * sc)
    const full = (b.maxR - from) / grow
    if (tau <= full) return from + grow * tau
    tau -= full
    r = b.maxR
  }
  const left = r - SHRINK * sc * tau
  return left > 2 * sc ? left : -1
}

/** Each shot on its way, as the blast it will open: how long until it goes off, and how wide it grows. */
function shotBlasts(s: GameState): Blast[] {
  const sc = s.scale
  const v = SHOT_SPEED * pace(s)
  return s.shots.map((shot) => {
    // A shot gathers pace from three quarters speed to 1.3 times it; this is the time that leaves it to run.
    const total = Math.hypot(shot.x1 - shot.x0, shot.y1 - shot.y0) || 1
    const gone = Math.min(1, Math.hypot(shot.x - shot.x0, shot.y - shot.y0) / total)
    return {
      id: shot.id,
      x: shot.x1,
      y: shot.y1,
      r: 6 * sc,
      maxR: (shot.burst ? SEEKER_BURST : BURST) * sc,
      growing: true,
      burst: shot.burst,
      wait: (total / (0.55 * v)) * Math.log(1.3 / (0.75 + 0.55 * gone)),
      growRate: GROW,
    }
  })
}

type Where = (t: number) => { x: number; y: number; down?: boolean }

/** Whether something on the move will fly into a blast, burning or still to come, within `horizon` seconds. */
function caught(s: GameState, where: Where, reach: number, horizon: number, pending: Blast[]) {
  const sc = s.scale
  const blasts = [...s.blasts, ...pending]
  if (blasts.length === 0) return false
  for (let t = 0; t <= horizon; t += 0.05) {
    const at = where(t)
    if (at.down) return false
    for (const b of blasts) {
      const r = radiusAt(b, t, sc)
      if (r >= 0 && Math.hypot(at.x - b.x, at.y - b.y) <= r + reach) return true
    }
  }
  return false
}

/** The launcher that will answer a click at `x`: the nearest one with shells, as the game picks it. */
function launcherFor(s: GameState, x: number) {
  let best: { x: number } | null = null
  for (const b of s.batteries) {
    if (!b.alive || b.ammo <= 0) continue
    if (!best || Math.abs(b.x - x) < Math.abs(best.x - x)) best = b
  }
  return best
}

/** Something the pilot could shoot at, and where it will be `t` seconds from now. */
type Mark = {
  kind: 'missile' | 'plane' | 'bomber' | 'drone'
  id: number
  where: Where
  /** How close a blast has to come to take it. */
  reach: number
  /** Seconds it will be there to be shot at. */
  left: number
  /** What stopping it is worth: most for a missile on a city. */
  worth: number
}

function marks(s: GameState): Mark[] {
  const sc = s.scale
  const out: Mark[] = []
  const slowBy = (t: number) => Math.min(t, s.slowT) * SLOWED + Math.max(0, t - s.slowT)
  for (const m of s.incoming) {
    const aim = m.aim
    const onCity = aim.type === 'city' && s.cities.some((c) => c.id === aim.id && c.alive)
    const onLauncher = aim.type === 'battery' && s.batteries.some((b) => b.id === aim.id && b.alive)
    // Where a missile will come down shows on the ground in its last four
    // seconds; before that, every trail looks as dangerous as the next.
    const marked = Math.hypot(m.x1 - m.x, m.y1 - m.y) / (m.speed * (s.slowT > 0 ? SLOWED : 1)) <= 4
    let worth = !marked ? 0.7 : onCity ? 1 : onLauncher ? 0.75 : 0.2
    // One violet missile is two when it splits, and they could go anywhere.
    if (m.kind === 'split') worth = Math.max(worth, 0.6) * 1.4
    out.push({ kind: 'missile', id: m.id, where: (t) => missileAt(s, m, t), reach: HIT_PAD * sc, left: timeLeft(s, m), worth })
  }
  for (const pl of s.planes) {
    const off = pl.vx > 0 ? s.stageW + 60 - pl.x : pl.x + 60
    out.push({
      kind: 'plane',
      id: pl.id,
      where: (t) => ({ x: pl.x + pl.vx * slowBy(t), y: pl.y }),
      reach: 19 * sc,
      left: off / Math.abs(pl.vx),
      worth: pl.dropsLeft > 0 ? 0.6 : 0.35,
    })
  }
  for (const bo of s.bombers) {
    // A bomber turns back at the edges; judge it only a second ahead.
    out.push({ kind: 'bomber', id: bo.id, where: (t) => ({ x: bo.x + bo.vx * slowBy(Math.min(t, 1)), y: bo.y }), reach: 32 * sc, left: 10, worth: 0.4 })
  }
  for (const d of s.drones) {
    const off = d.vx > 0 ? s.stageW + 50 - d.x : d.x + 50
    out.push({ kind: 'drone', id: d.id, where: (t) => ({ x: d.x + d.vx * slowBy(t), y: d.y }), reach: 19 * sc, left: off / Math.abs(d.vx), worth: 0.45 })
  }
  return out
}

/**
 * Where to put the sight for a shot that clicks in `lag` seconds to meet
 * `m`: out ahead of it by `lead` of the true lead, a player's guess.
 */
function leadPoint(s: GameState, m: Mark, lag: number, lead: number) {
  const v = SHOT_SPEED * pace(s)
  const muzzle = s.groundY - 18 * s.scale
  const flightTo = (at: { x: number; y: number }) => {
    const from = launcherFor(s, at.x)
    return from ? Math.hypot(at.x - from.x, at.y - muzzle) / v : 0
  }
  let at = m.where(lag)
  for (let i = 0; i < 4; i++) at = m.where(lag + flightTo(at) * lead)
  return { x: at.x, y: at.y, flight: flightTo(at) }
}

/** What the pilot is going for: which mark, and its own sense of the lead and of where it is. */
type Plan = { kind: Mark['kind']; id: number; lead: number; dx: number; dy: number }

type Pilot = {
  clock: number
  plan: Plan | null
  /** Set between the two clicks of a double shot. */
  again: boolean
  /** Where the pilot's hand has the sight, and where it drifts to with nothing to fire at. */
  cx: number
  cy: number
  watchX: number
  watchY: number
  /** The spot the hand is keeping with, and which plan it belongs to. */
  trackId: number
  trackX: number
  trackY: number
  /** Seconds until the pilot next thinks over what to go for, and until its finger is ready to click again. */
  thinkIn: number
  readyIn: number
  /** When each missile catches the pilot's eye, or will. */
  noticed: Map<number, number>
  /** What the pilot has fired at, and when: it waits to see before firing at it again. */
  firedAt: Map<number, number>
  /** Blimps it has seen, and whether it cares to shoot each. */
  wants: Map<number, boolean>
  /** Seconds before the pilot thinks of a power again. */
  powerIn: number
  /** Where the screen looks, easing after the sight. */
  camX: number
}

function freshPilot(s: GameState): Pilot {
  return {
    clock: 0,
    plan: null,
    again: false,
    cx: s.cursor.x,
    cy: s.cursor.y,
    watchX: s.cursor.x,
    watchY: s.cursor.y,
    trackId: -1,
    trackX: 0,
    trackY: 0,
    thinkIn: 0,
    readyIn: 0.4,
    noticed: new Map(),
    firedAt: new Map(),
    wants: new Map(),
    powerIn: 4,
    camX: s.stageW / 2,
  }
}

/** Take in the sky and settle what to go for, if anything. */
function choose(s: GameState, p: Pilot) {
  const sc = s.scale
  const pending = shotBlasts(s)
  const ammo = s.batteries.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0)
  // With shells short and more to come, a player saves them for what is falling on something.
  const spare = ammo > s.toSpawn + s.incoming.length + 4
  // About how long until a click: the hand's travel and the finger.
  const lagFor = (x: number, y: number) => 0.12 + Math.min(0.35, Math.hypot(x - p.cx, y - p.cy) / (s.stageW * 2.2)) + Math.max(0, p.readyIn)

  // Busy: going for something, or with a trail already in the eye. With
  // nothing on its hands, a player looks round the sky and sees what it missed.
  const busy = p.plan !== null || s.incoming.some((m) => (p.noticed.get(m.id) ?? Infinity) <= p.clock)
  if (!busy) {
    for (const [id, at] of p.noticed) {
      if (at > p.clock + 0.6) p.noticed.set(id, p.clock + 0.3 + Math.random() * 0.3)
    }
  }

  // Everything worth a shot now: noticed, low enough, still to be met in the
  // open sky, and not plainly about to fly into a fireball.
  const options: { m: Mark; score: number; seenAt: number; d: number }[] = []
  let watch: { m: Mark; left: number } | null = null
  for (const m of marks(s)) {
    const now = m.where(0)
    let seenAt = 0
    if (m.kind === 'missile') {
      // A new trail catches the eye a moment after it comes into the sky. One
      // across the sky while the pilot is busy elsewhere goes unseen until it
      // is nearly down.
      const seen = p.noticed.get(m.id)
      if (seen === undefined) {
        if (now.y > s.groundY * 0.03) {
          const far = busy && Math.abs(now.x - p.cx) > s.stageW * 0.09
          p.noticed.set(m.id, p.clock + (far ? Math.max(0.6, m.left - 0.2 - Math.random() * 0.5) : 0.4 + Math.random() * 0.6))
        }
        continue
      }
      if (p.clock < seen) continue
      seenAt = seen
      if (!watch || m.left < watch.left) watch = { m, left: m.left }
    }
    if (m.kind === 'drone') {
      if (!p.wants.has(m.id)) p.wants.set(m.id, Math.random() < 0.7)
      if (!p.wants.get(m.id)) continue
    }
    if (m.worth < 0.5 && !spare) continue
    // Fired at it a moment ago: wait and see.
    const fired = p.firedAt.get(m.id)
    if (fired !== undefined && p.clock - fired < 1.6) continue
    const lag = lagFor(now.x, now.y)
    const aim = leadPoint(s, m, lag, 1)
    // Too late: the shot would get there after it has landed, or so low it hardly matters.
    if (lag + aim.flight > m.left - 0.05) continue
    if (aim.y > s.groundY - 24 * sc) continue
    // A missile is left to come well down the sky before it is met, the way a player waits to be sure of it.
    if (m.kind === 'missile' && aim.y < s.groundY * 0.45) continue
    if (caught(s, m.where, m.reach, Math.min(m.left, 0.5), pending)) continue
    const score = m.worth / (Math.max(0, m.left - lag - aim.flight) + 0.6)
    options.push({ m, score, seenAt, d: Math.hypot(now.x - p.cx, now.y - p.cy) })
  }

  // With nothing to fire at yet, the hand drifts toward the trail that will land first.
  if (watch) {
    const at = watch.m.where(1.2)
    p.watchX = at.x
    p.watchY = Math.min(Math.max(at.y, s.groundY * 0.45), s.groundY * 0.7)
  }

  // A player sticks with what they went for until they have fired at it.
  if (p.plan && options.some((o) => o.m.kind === p.plan!.kind && o.m.id === p.plan!.id)) return
  p.again = false
  if (options.length === 0) {
    p.plan = null
    return
  }
  // Then goes for what matters most, or as often for the newest trail in the
  // sky, which catches the eye, or for whatever is under the sight.
  const roll = Math.random()
  const by = (f: (o: (typeof options)[number]) => number) => options.reduce((a, b) => (f(b) > f(a) ? b : a))
  const pick = (roll < 0.35 ? by((o) => o.seenAt) : roll < 0.55 ? by((o) => -o.d) : by((o) => o.score)).m
  // A person's feel for the lead: usually short of it, now and then right on
  // the missile itself, and sometimes a touch too far. Short hardly matters
  // while missiles are slow; as they speed up, they outrun the burst.
  const feel = Math.random()
  p.plan = {
    kind: pick.kind,
    id: pick.id,
    lead: feel < 0.25 ? Math.random() * 0.3 : feel < 0.85 ? 0.35 + Math.random() * 0.6 : 0.95 + Math.random() * 0.4,
    dx: wobble() * 5 * sc,
    dy: wobble() * 5 * sc,
  }
}

/** Reach for a power when it is called for, and not every time. */
function reachForPower(s: GameState, p: Pilot): GameState {
  if (p.powerIn > 0) return s
  p.powerIn = 0.6
  const has = (k: PowerKind) => s.pack[k] > 0
  if (!has('ammo') && !has('shield') && !has('slow') && !has('burst')) return s
  const pending = shotBlasts(s)
  const ammo = s.batteries.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0)
  const cities = s.cities.filter((c) => c.alive).length
  // What is coming down on a city with nothing to stop it, and how soon.
  const open = s.incoming
    .filter((m) => {
      const aim = m.aim
      return aim.type === 'city' && s.cities.some((c) => c.id === aim.id && c.alive)
    })
    .map((m) => ({ m, t: timeLeft(s, m) }))
    .filter(({ m, t }) => !caught(s, (u) => missileAt(s, m, u), HIT_PAD * s.scale, Math.min(t, 2.5), pending))
  const soon = open.filter((o) => o.t < 2.2).length
  let use: PowerKind | null = null
  if (has('ammo') && ammo <= 4 && s.toSpawn + s.incoming.length > 1) use = 'ammo'
  else if (has('shield') && !s.cities.some((c) => c.shielded) && (soon >= 2 || (cities <= 2 && soon >= 1))) use = 'shield'
  else if (has('slow') && s.slowT <= 0 && (s.incoming.length >= 5 || soon >= 2)) use = 'slow'
  else if (has('burst') && ammo > 0 && open.some((o) => o.t < 1.4)) use = 'burst'
  if (!use || Math.random() < 0.35) return s
  p.powerIn = 2.5
  return activatePower(s, use)
}

/** The pilot's hand for one slice of play: the sight moved, perhaps a click, perhaps a power. */
function drive(s: GameState, p: Pilot, dt: number): GameState {
  p.clock += dt
  p.thinkIn -= dt
  p.readyIn -= dt
  p.powerIn -= dt
  const sc = s.scale

  const find = (plan: Plan | null) => (plan ? marks(s).find((m) => m.kind === plan.kind && m.id === plan.id) : undefined)
  if (p.thinkIn <= 0 || !find(p.plan)) {
    choose(s, p)
    p.thinkIn = 0.12 + Math.random() * 0.12
  }
  s = reachForPower(s, p)

  // The hand moves the sight the way a hand moves a mouse: quickly, then settling.
  const reach = (x: number, y: number, rate: number) => {
    const k = 1 - Math.exp(-dt * rate)
    let mx = (x - p.cx) * k
    let my = (y - p.cy) * k
    const most = s.stageW * 2.2 * dt
    const len = Math.hypot(mx, my)
    if (len > most) {
      mx *= most / len
      my *= most / len
    }
    p.cx += mx
    p.cy += my
  }

  const plan = p.plan
  const mark = find(plan)
  if (!plan || !mark) {
    reach(p.watchX, p.watchY, 2.5)
    return setCursor(s, p.cx, p.cy)
  }

  // Out to the lead point, and once there, keeping with it as it moves, the
  // way an eye and hand follow something across a screen.
  const aim = leadPoint(s, mark, Math.max(0, p.readyIn) + 0.05, plan.lead)
  const ax = aim.x + plan.dx
  const ay = Math.min(aim.y + plan.dy, s.groundY - 24 * sc)
  if (p.trackId === plan.id) {
    p.cx += ax - p.trackX
    p.cy += ay - p.trackY
  }
  p.trackId = plan.id
  p.trackX = ax
  p.trackY = ay
  reach(ax, ay, 9)
  let next = setCursor(s, p.cx, p.cy)

  // Click once the sight is on the spot and the finger is ready, if there is anything left to fire.
  const there = Math.hypot(ax - p.cx, ay - p.cy) < 10 * sc
  if (there && p.readyIn <= 0 && next.batteries.some((b) => b.alive && b.ammo > 0)) {
    next = fire(next)
    p.firedAt.set(plan.id, p.clock)
    if (!p.again && Math.random() < 0.2) {
      // A second shot at the same one, to be sure of it.
      p.again = true
      p.readyIn = 0.16 + Math.random() * 0.12
      p.thinkIn = p.readyIn + 0.5
      plan.dx = wobble() * 8 * sc
      plan.dy = wobble() * 8 * sc
    } else {
      p.again = false
      p.plan = null
      // A person's pace between clicks, and now and then a longer look.
      p.readyIn = 0.55 + Math.random() * 0.4 + (Math.random() < 0.25 ? 0.5 + Math.random() * 0.7 : 0)
      p.thinkIn = 0
    }
  }
  return next
}

export function makeSim(): Sim<GameState> {
  let p = freshPilot(createInitialState())

  return {
    start: (w, h) => {
      const { fw, fh } = fieldSize(w, h)
      // A new run, taken straight on to a later wave the way the page's own start card does it for an admin.
      const s = jumpToWave(startGame(createInitialState(fw, fh), fw, fh), OPENING_WAVE, fw)
      p = freshPilot(s)
      return s
    },
    step: (s, dt) => {
      // The page lets the game carry itself from one wave to the next; the pilot only plays the waves.
      const next = tick(s.phase === 'playing' ? drive(s, p, dt) : s, dt, s.stageW)
      // The screen drifts after the sight, where the fight is.
      p.camX += (p.cx - p.camX) * (1 - Math.exp(-dt * 1.5))
      if (next.wave !== s.wave) {
        p.noticed.clear()
        p.firedAt.clear()
      }
      return next
    },
    over: (s) => s.phase === 'gameover',
    // The sky as the game draws it, minus what is written over it for a
    // player: the wave's name and its tip, the points and words that float
    // up, and the powers flying off to buttons this screen does not have.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, banner: null, floaters: [], pickups: [] }, w, h),
    resize: (s, w, h) => {
      const { fw, fh } = fieldSize(w, h)
      const next = resizeState(s, fw, fh)
      const kx = fw / s.stageW
      const ky = fh / s.stageH
      p.cx *= kx
      p.cy *= ky
      p.watchX *= kx
      p.watchY *= ky
      p.trackId = -1
      p.camX *= kx
      return next
    },
    // The still: a sky full of trails and planes, a blast going off over the whole skyline.
    poster: { seed: 3, at: 9 },
    // The last city's fall plays out in the game itself; this is a moment on what it leaves.
    hold: 1.4,
    zoom: ZOOM,
    // Follow the fight across the field, never past its edges, always down to the ground.
    focus: (s, zw, zh) => {
      const vw = zw / ZOOM
      const vh = zh / ZOOM
      return {
        x: Math.min(Math.max(p.camX, vw / 2), s.stageW - vw / 2),
        y: s.stageH - vh / 2,
      }
    },
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
