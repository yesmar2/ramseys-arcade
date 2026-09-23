import { runPreview, type Sim } from '../previewKit'
import {
  beginNextWave,
  createInitialState,
  resizeState,
  shipRadius,
  startGame,
  tick,
  type GameState,
} from './game'
import { renderGame } from './render'

/*
 * Asteroids playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that flies the ship the way a person does.
 * The gun fires by itself, as it does for a player, so the flying is the whole
 * of it. The pilot swings onto a rock, leading it a little and never quite
 * dead on; shifts ground every few seconds, moves in on rocks that are far
 * off, now and then goes for a power floating nearby, and wades in under a
 * shield. What it sees coming it shoots at, or flies clear of, a moment late,
 * jumping to hyperspace when it has left it too late; a new ship spends its
 * moment of grace getting clear. Plenty it never sees, misjudges or flies
 * into, more as the field fills and as a long run makes it bold, and that is
 * how the ships go; after the last one, a new run starts.
 */

const TAU = Math.PI * 2

/*
 * What a player learns of the ship by flying it, in the game's units before
 * its scale: how fast it turns with a key held, how hard it pushes, and how
 * fast and how long a shot flies.
 */
const TURN = 5.9
const THRUST = 420
const SHOT_SPEED = 480
const SHOT_LIFE = 0.55

/**
 * The field is drawn a third bigger than the cabinet's screen, and the screen
 * shows its full height and the three quarters of its width around the ship:
 * the page's own 16:9 field with its sides trimmed to fit a 4:3 screen, with
 * the ship big enough to read.
 */
const ZOOM = 4 / 3

/** The page plays on a 16:9 stage, so the field is 16:9 here too, with the same room between rocks. */
function fieldSize(w: number, h: number) {
  const long = Math.max(w, h) * ZOOM
  const short = Math.max(Math.min(w, h), (long * 9) / 16)
  return w >= h ? { fw: long, fh: short } : { fw: short, fh: long }
}

/** The way round from one heading to another, between -π and π. */
function turnTo(from: number, to: number) {
  return ((((to - from) % TAU) + TAU * 1.5) % TAU) - Math.PI
}

/** The short way across a field that wraps at its edges. */
function across(d: number, size: number) {
  return d - size * Math.round(d / size)
}

/** Roughly a normal spread, mean 0 and deviation 1, never past 3. */
function wobble() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2
}

type Mark = { id: number; kind: 'rock' | 'saucer' | 'missile'; x: number; y: number; vx: number; vy: number; r: number }

/** Something that will reach the ship if nothing changes: how soon, where it passes, and where it is now, from the ship. */
type Threat = { id: number; t: number; mx: number; my: number; ux: number; uy: number; rx: number; ry: number }

/** The saucer has an id of its own in the game; this is only the pilot's name for it. */
const SAUCER = -1

/** Everything the ship could shoot at, moving as it moves now. */
function marks(s: GameState): Mark[] {
  const slow = s.buffSlow > 0 ? 0.42 : 1
  const out: Mark[] = s.rocks.map((r) => ({ id: r.id, kind: 'rock', x: r.x, y: r.y, vx: r.vx * slow, vy: r.vy * slow, r: r.radius }))
  if (s.saucer) {
    const u = s.saucer
    out.push({ id: SAUCER, kind: 'saucer', x: u.x, y: u.y, vx: u.vx * slow, vy: u.vy * slow, r: u.radius })
  }
  for (const b of s.enemyBullets) {
    if (b.kind === 'missile') out.push({ id: b.id, kind: 'missile', x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.radius })
  }
  return out
}

/**
 * Where to point for a shot fired now to meet `m`: the true lead cut to
 * `lead` of itself, since a player judges it by eye. `t` is how long the shot
 * takes to get there, and `reach` says whether it gets there at all before
 * it burns out.
 */
function aimAt(s: GameState, m: Mark, lead: number) {
  const { ship, scale: sc } = s
  const rx = across(m.x - ship.x, s.stageW)
  const ry = across(m.y - ship.y, s.stageH)
  // A shot carries a fifth of the ship's own speed.
  const ux = m.vx - ship.vx * 0.2
  const uy = m.vy - ship.vy * 0.2
  const v = SHOT_SPEED * sc
  const nose = shipRadius(sc) + 4 * sc
  const a = ux * ux + uy * uy - v * v
  const b = 2 * (rx * ux + ry * uy - nose * v)
  const c = rx * rx + ry * ry - nose * nose
  // A shot outruns anything on the field, so there is one meeting ahead, unless it is on the nose already.
  const t = c <= 0 ? 0 : (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)
  const x = rx + ux * t * lead
  const y = ry + uy * t * lead
  return { angle: Math.atan2(y, x), t, dist: Math.hypot(rx, ry), reach: t <= SHOT_LIFE + m.r / v }
}

/**
 * How the pilot reads something's course: a little off in its heading and its
 * speed, and the same way off for as long as it is watched, the way a person
 * judges a rock by eye and is sure it will pass when it will not.
 */
type Reading = { turn: number; pace: number }

/**
 * What will reach the ship within `horizon` seconds if nothing changes, as
 * the pilot reads each course and with the ship flying at `vx`, `vy`. Nothing
 * counts before a new ship's grace or a shield runs out.
 */
function threats(s: GameState, read: (id: number) => Reading, horizon: number, vx = s.ship.vx, vy = s.ship.vy): Threat[] {
  const { ship, scale: sc } = s
  const hull = shipRadius(sc)
  const pad = 5 * sc
  const grace = Math.max(s.buffShield, ship.invuln)
  const out: Threat[] = []
  if (grace >= horizon) return out
  const check = (id: number, x: number, y: number, tvx: number, tvy: number, reach: number) => {
    const rx = across(x - ship.x, s.stageW)
    const ry = across(y - ship.y, s.stageH)
    const { turn, pace } = read(id)
    const cos = Math.cos(turn) * pace
    const sin = Math.sin(turn) * pace
    const ux = tvx * cos - tvy * sin - vx
    const uy = tvx * sin + tvy * cos - vy
    const uu = ux * ux + uy * uy
    const closest = uu > 1e-9 ? -(rx * ux + ry * uy) / uu : 0
    const t = Math.min(Math.max(closest, grace), horizon)
    const mx = rx + ux * t
    const my = ry + uy * t
    if (Math.hypot(mx, my) < reach) out.push({ id, t, mx, my, ux, uy, rx, ry })
  }
  const slow = s.buffSlow > 0 ? 0.42 : 1
  for (const r of s.rocks) check(r.id, r.x, r.y, r.vx * slow, r.vy * slow, r.radius + hull * 0.7 + pad)
  if (s.saucer) {
    const u = s.saucer
    check(SAUCER, u.x, u.y, u.vx * slow, u.vy * slow, u.radius + hull * 0.7 + pad)
  }
  for (const b of s.enemyBullets) {
    if (b.kind === 'missile') {
      // A missile steers for the ship, so count it as coming straight in.
      const d = Math.hypot(ship.x - b.x, ship.y - b.y) || 1
      const sp = Math.hypot(b.vx, b.vy)
      check(b.id, b.x, b.y, ((ship.x - b.x) / d) * sp, ((ship.y - b.y) / d) * sp, hull * 0.75 + b.radius + pad)
    } else {
      check(b.id, b.x, b.y, b.vx, b.vy, hull * 0.75 + b.radius + pad)
    }
  }
  return out.sort((p, q) => p.t - q.t)
}

/** A danger the pilot has come across: when it noticed it (never, if it did not), when it last was one, and how the pilot will take it. */
type Sighting = { at: number; last: number; jumps: boolean; slip: number }

type Pilot = {
  clock: number
  /** Seconds until the pilot next takes in the field; between looks, it holds to the last plan. */
  lookIn: number
  /** Shooting a rock, flying clear of one, going for a power, or making for a spot on the field. */
  mode: 'fight' | 'dodge' | 'fetch' | 'move'
  targetId: number
  /** How much of the true lead the pilot gives the rock it is after. */
  lead: number
  /** How far off the true line the pilot's aim is, in radians, and for how long before it drifts again. */
  miss: number
  missIn: number
  /** The way to face when dodging, and the place to make for when fetching or moving. */
  heading: number
  goX: number
  goY: number
  /** Seconds left of the thrust burst under way, and how square to the heading the ship must be to use it. */
  pushFor: number
  cone: number
  /** Seconds until the pilot next shifts ground, and left of the shift under way. */
  roamIn: number
  roamFor: number
  jump: boolean
  seen: Map<number, Sighting>
  /** How the pilot reads each course it has looked at. */
  readings: Map<number, Reading>
  /** Powers the pilot has seen float up, and whether it cares to go for each. */
  wants: Map<number, boolean>
  /** Seconds on the card between waves, before pressing on. */
  clearFor: number
  /** Where the screen looks, easing after the ship, and where the ship was last seen, to catch it wrapping. */
  camX: number
  camY: number
  shipX: number
  shipY: number
}

function freshPilot(s: GameState): Pilot {
  return {
    clock: 0,
    lookIn: 0,
    mode: 'fight',
    targetId: -2,
    lead: 1,
    miss: 0,
    missIn: 0,
    heading: 0,
    goX: 0,
    goY: 0,
    pushFor: 0,
    cone: 0,
    roamIn: 2 + Math.random() * 3,
    roamFor: 0,
    jump: false,
    seen: new Map(),
    readings: new Map(),
    wants: new Map(),
    clearFor: 0,
    camX: s.ship.x,
    camY: s.ship.y,
    shipX: s.ship.x,
    shipY: s.ship.y,
  }
}

/** A run that has gone on a while is played looser and bolder: up to this much less watchful. */
function loose(p: Pilot) {
  return Math.min(0.3, Math.max(0, (p.clock - 45) / 150))
}

/** Take in the field and settle what to do until the next look. */
function look(s: GameState, p: Pilot) {
  const { ship, scale: sc } = s
  const speed = Math.hypot(ship.vx, ship.vy)
  p.jump = false
  const read = (id: number) => {
    let r = p.readings.get(id)
    if (!r) {
      r = { turn: wobble() * 0.25, pace: 1 + wobble() * 0.2 }
      p.readings.set(id, r)
    }
    return r
  }

  const all = marks(s)
  const aims = all.map((m) => ({ m, aim: aimAt(s, m, m.id === p.targetId ? p.lead : 1) }))
  // Nose on a rock and shooting it, a player sees little else.
  const onTarget = aims.find((a) => a.m.id === p.targetId)
  const locked = p.mode === 'fight' && !!onTarget && onTarget.aim.reach && Math.abs(turnTo(ship.angle, onTarget.aim.angle)) < 0.35

  // What is coming, and which of it the pilot has noticed, a beat after it
  // started coming. Something closing from behind the ship is easier to miss
  // than something in front of it, and the more there is flying about, the
  // more slips past. A new ship comes in looking about it, and uses its
  // moment of grace to get clear of what will be on it after.
  const fresh = ship.invuln > 0 && s.buffShield <= 0
  const crowd = all.filter((m) => Math.hypot(across(m.x - ship.x, s.stageW), across(m.y - ship.y, s.stageH)) < 200 * sc).length
  const danger = threats(s, read, fresh ? Math.max(0.85, ship.invuln + 0.6) : 0.85)
  for (const d of danger) {
    let e = p.seen.get(d.id)
    if (!e) {
      const behind = Math.abs(turnTo(ship.angle, Math.atan2(d.ry, d.rx))) > 2
      const busy = Math.min(0.2, 0.02 * crowd)
      const missed = Math.random() < (fresh ? 0.15 : (locked ? 0.75 : 0.55) + (behind ? 0.2 : 0) + busy + loose(p))
      e = {
        at: missed ? Infinity : p.clock + 0.28 + Math.random() * 0.32,
        last: p.clock,
        jumps: Math.random() < 0.55,
        slip: wobble() * 0.4,
      }
      p.seen.set(d.id, e)
    }
    e.last = p.clock
  }
  for (const [id, e] of p.seen) if (p.clock - e.last > 1) p.seen.delete(id)
  const known = danger.filter((d) => (p.seen.get(d.id)?.at ?? Infinity) <= p.clock)
  // Forget the courses of what has gone.
  if (p.readings.size > 200) {
    const live = new Set(all.map((m) => m.id))
    for (const e of s.enemyBullets) live.add(e.id)
    for (const id of p.readings.keys()) if (!live.has(id)) p.readings.delete(id)
  }

  if (known.length > 0) {
    const first = known[0]!
    const sighting = p.seen.get(first.id)!
    // Coming at the nose, the instinct is to shoot it rather than fly clear,
    // big or small, even though a big one only breaks into pieces that keep coming.
    const ahead = aims.find((a) => a.m.id === first.id)
    if (ahead && ahead.aim.reach && first.t > 0.25 && Math.abs(turnTo(ship.angle, ahead.aim.angle)) < 0.6) {
      p.mode = 'fight'
      if (p.targetId !== first.id) {
        p.targetId = first.id
        p.lead = 0.6 + Math.random() * 0.4
      }
      p.pushFor = 0
      return
    }
    // Otherwise fly out of the way: away from where each will pass, the
    // soonest counting most, on a line the pilot judges roughly.
    let ax = 0
    let ay = 0
    for (const d of known) {
      const len = Math.hypot(d.mx, d.my)
      let dx = -d.mx
      let dy = -d.my
      if (len < 4 * sc) {
        // Coming dead on: go across its path, whichever side is less of a turn.
        dx = -d.uy
        dy = d.ux
        if (Math.abs(turnTo(ship.angle, Math.atan2(dy, dx))) > Math.PI / 2) {
          dx = -dx
          dy = -dy
        }
      }
      const n = Math.hypot(dx, dy) || 1
      const k = 1 / Math.max(0.15, d.t)
      ax += (dx / n) * k
      ay += (dy / n) * k
    }
    p.mode = 'dodge'
    p.heading = Math.atan2(ay, ax) + sighting.slip
    p.cone = 0.75
    p.pushFor = 0.25
    // Too late to turn and fly clear: the last-ditch jump, if the pilot thinks of it.
    const late = first.t < Math.abs(turnTo(ship.angle, p.heading)) / TURN + 0.25
    if (late && first.t < 0.45 && s.hyperspaceCooldown <= 0 && sighting.jumps) {
      p.jump = true
      sighting.jumps = false
    }
    return
  }

  // Before a push, now and then a careful moment checks it does not carry the
  // ship into a rock; more often, the pilot just goes.
  const clearTo = (angle: number) => {
    if (Math.random() < 0.75 + loose(p) * 0.8) return true
    const boost = THRUST * sc * 0.3
    return threats(s, read, 1, ship.vx + Math.cos(angle) * boost, ship.vy + Math.sin(angle) * boost).length === 0
  }
  const toward = (x: number, y: number) => Math.atan2(across(y - ship.y, s.stageH), across(x - ship.x, s.stageW))

  // A power floating close by is worth the trip, if it will still be there
  // and the pilot cares for it; plenty are left to drift away.
  for (const q of s.powerups) if (!p.wants.has(q.id)) p.wants.set(q.id, Math.random() < 0.3)
  if (p.wants.size > 60) {
    const live = new Set(s.powerups.map((q) => q.id))
    for (const id of p.wants.keys()) if (!live.has(id)) p.wants.delete(id)
  }
  const power = s.powerups
    .filter((q) => q.life > 1.5 && p.wants.get(q.id))
    .map((q) => ({ q, d: Math.hypot(across(q.x - ship.x, s.stageW), across(q.y - ship.y, s.stageH)) }))
    .filter((c) => c.d < 120 * sc)
    .sort((a, b) => a.d - b.d)[0]
  if (power) {
    p.mode = 'fetch'
    p.goX = power.q.x
    p.goY = power.q.y
    p.cone = 0.3
    if (p.pushFor <= 0 && speed < 170 * sc && clearTo(toward(p.goX, p.goY))) p.pushFor = 0.12 + Math.random() * 0.16
    return
  }

  const cx = s.stageW / 2
  const cy = s.stageH / 2
  const midReach = Math.hypot(cx, cy)

  // Under a shield there is nothing to fear, and a player wades in close,
  // which is where the shield leaves them when it runs out.
  const brave = s.buffShield > 1.2

  // Every few seconds a player shifts ground for a better angle, somewhere
  // away from the edges, shooting at whatever the nose passes on the way and
  // trusting the gun to clear the path.
  if (!brave && p.roamIn <= 0 && p.roamFor <= 0) {
    p.goX = s.stageW * (0.15 + Math.random() * 0.7)
    p.goY = s.stageH * (0.15 + Math.random() * 0.7)
    p.roamFor = 1 + Math.random() * 0.7
    p.roamIn = (2 + Math.random() * 2.5) * (1 - loose(p))
  }
  if (!brave && p.roamFor > 0) {
    p.mode = 'move'
    p.cone = 0.35
    if (p.pushFor <= 0 && speed < 260 * sc) p.pushFor = 0.35 + Math.random() * 0.3
    return
  }

  // Pick what to shoot: what takes least time to turn onto and reach, keeping
  // to the one already chosen, going first for what is coming this way, for
  // the saucer and its missiles, and for rocks toward the middle of the field.
  const coming = new Set(known.map((d) => d.id))
  let best: (typeof aims)[number] | null = null
  let bestCost = Infinity
  for (const a of aims) {
    const { m, aim } = a
    let cost = Math.abs(turnTo(ship.angle, aim.angle)) / TURN
    cost += aim.reach ? aim.t : 0.5 + aim.dist / (220 * sc)
    cost += (0.35 * Math.hypot(m.x - cx, m.y - cy)) / midReach
    if (m.id === p.targetId) cost -= 0.35
    if (coming.has(m.id)) cost -= 0.4
    if (m.kind === 'saucer') cost -= 0.4
    if (m.kind === 'missile') cost -= 0.6
    if (cost < bestCost) {
      bestCost = cost
      best = a
    }
  }
  if (!best) return
  if (best.m.id !== p.targetId) {
    p.targetId = best.m.id
    p.lead = 0.35 + Math.random() * 0.65
  }
  p.mode = 'fight'
  p.cone = 0.3
  // Anything but close: move in on it in short pushes, to be sure of it; under a shield, right in.
  if (brave) {
    if (best.aim.dist > 60 * sc && p.pushFor <= 0 && speed < 240 * sc) p.pushFor = 0.2 + Math.random() * 0.2
  } else if (best.aim.dist > 150 * sc && p.pushFor <= 0 && speed < 170 * sc && best.aim.dist < 480 * sc && clearTo(best.aim.angle)) {
    p.pushFor = 0.12 + Math.random() * 0.2
  }
  // Wandered far from the middle with nothing in reach: head back that way instead.
  const off = Math.hypot(across(ship.x - cx, s.stageW), across(ship.y - cy, s.stageH))
  if (!best.aim.reach && off > midReach * 0.45) {
    p.mode = 'move'
    p.goX = cx
    p.goY = cy
    if (p.pushFor <= 0 && speed < 120 * sc && clearTo(toward(cx, cy))) p.pushFor = 0.15 + Math.random() * 0.15
  }
}

/** The pilot's hands for one slice of play: which way to turn, whether to push, whether to jump. */
function drive(s: GameState, p: Pilot, dt: number): GameState {
  const { ship } = s
  p.roamIn -= dt
  p.roamFor -= dt
  p.lookIn -= dt
  if (p.lookIn <= 0) {
    look(s, p)
    p.lookIn = 0.08 + Math.random() * 0.08
  }
  p.missIn -= dt
  if (p.missIn <= 0) {
    p.miss = wobble() * 0.16
    p.missIn = 0.5 + Math.random() * 0.6
  }

  let want: number | null = null
  if (p.mode === 'fight') {
    const m = marks(s).find((k) => k.id === p.targetId)
    if (m) {
      want = aimAt(s, m, p.lead).angle
    } else if (p.targetId !== -2) {
      // Got it. A beat, nose held where it was, before swinging to the next.
      p.targetId = -2
      p.lookIn = 0.25 + Math.random() * 0.2
    }
  } else if (p.mode === 'dodge') {
    want = p.heading
  } else {
    want = Math.atan2(across(p.goY - ship.y, s.stageH), across(p.goX - ship.x, s.stageW))
  }

  // Turning is a key held for the whole slice, or for part of it once the nose is nearly round.
  let turn = 0
  let facing = false
  if (want !== null) {
    const diff = turnTo(ship.angle, want + p.miss)
    turn = Math.abs(diff) < 0.02 ? 0 : Math.max(-1, Math.min(1, diff / (TURN * dt)))
    facing = Math.abs(diff) < p.cone
  }
  p.pushFor -= dt
  const thrust = p.pushFor > 0 && facing
  const jump = p.jump
  p.jump = false

  // The same fields the page sets from the keys: a turn each way, thrust, and hyperspace on the down key.
  return {
    ...s,
    turnLeft: turn <= -1,
    turnRight: turn >= 1,
    turn: Math.abs(turn) < 1 ? turn : 0,
    thrust,
    reverse: jump,
  }
}

/**
 * The screen looks a little ahead of the ship's nose, where its shots are
 * going, and eases after it; it cuts straight there when the ship wraps round
 * the field or jumps.
 */
function follow(s: GameState, p: Pilot, dt: number) {
  const ahead = s.stageH * 0.14
  const x = s.ship.x + Math.cos(s.ship.angle) * ahead
  const y = s.ship.y + Math.sin(s.ship.angle) * ahead
  if (Math.abs(s.ship.x - p.shipX) > s.stageW / 2 || Math.abs(s.ship.y - p.shipY) > s.stageH / 2) {
    p.camX = x
    p.camY = y
  } else {
    const k = 1 - Math.exp(-dt * 3)
    p.camX += (x - p.camX) * k
    p.camY += (y - p.camY) * k
  }
  p.shipX = s.ship.x
  p.shipY = s.ship.y
}

export function makeSim(): Sim<GameState> {
  let p = freshPilot(createInitialState())

  return {
    start: (w, h) => {
      const { fw, fh } = fieldSize(w, h)
      const s = startGame(createInitialState(fw, fh))
      p = freshPilot(s)
      return s
    },
    step: (s, dt) => {
      p.clock += dt
      let next = s
      if (s.phase === 'playing') {
        next = drive(s, p, dt)
      } else if (s.phase === 'waveClear') {
        // A moment on the card between waves, then on to the next, as the page's button does.
        p.clearFor += dt
        if (p.clearFor > 1.1) {
          p.clearFor = 0
          next = beginNextWave(s)
        }
      }
      next = tick(next, dt)
      // A new ship, and fresh eyes: what the last one missed is looked at again.
      if (next.lives < s.lives) p.seen.clear()
      follow(next, p, dt)
      return next
    },
    over: (s) => s.phase === 'gameover',
    // The field as the game draws it, minus what is written over it for a
    // player: the points that float up off each hit, the combo count and the
    // wave's name as it begins.
    render: (ctx, s, w, h) => renderGame(ctx, { ...s, floaters: [], combo: 0, waveIntro: 0 }, w, h),
    resize: (s, w, h) => {
      const { fw, fh } = fieldSize(w, h)
      const next = resizeState(s, fw, fh)
      p.camX *= fw / s.stageW
      p.camY *= fh / s.stageH
      p.shipX = next.ship.x
      p.shipY = next.ship.y
      return next
    },
    // The still: half a minute into a run, the ship firing into a breaking rock, cratered rocks all round.
    poster: { seed: 1, at: 32 },
    // Its renderer times its twinkles and pulses by the page's clock; the run's own keeps the still the same.
    runClock: true,
    // Long enough for the last ship to finish coming apart.
    hold: 1.6,
    zoom: ZOOM,
    // Follow the ship, but never look past the edge of the field.
    focus: (s, zw, zh) => {
      const vw = zw / ZOOM
      const vh = zh / ZOOM
      return {
        x: Math.min(Math.max(p.camX, vw / 2), s.stageW - vw / 2),
        y: Math.min(Math.max(p.camY, vh / 2), s.stageH - vh / 2),
      }
    },
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
