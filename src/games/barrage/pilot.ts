import {
  CORE_R,
  FIELD_H,
  SPECIES,
  setSteer,
  shipBounds,
  triggerBarrage,
  type Bullet,
  type GameState,
} from './game'

/*
 * A pilot for Barrage: the ship flying itself, the way a person flies it.
 *
 * A few times a second it looks at the bullets near the ship, runs each a
 * little way forward, and weighs a ring of places it could move to by how
 * close the bullets would come to the ship's heart on the way there, against
 * where it would like to be: under the ship it is shooting at, low in the
 * field, off the walls. It moves its finger no faster than a hand does, grazes
 * when that is safe, and lets its Barrage go when every way out looks bad.
 *
 * Now and then it doesn't see something — more often the worse it is — so it
 * loses ships the way a person does, and a run ends.
 */

export type PilotOptions = {
  /** 0–1: how quickly it reacts, how far ahead it reads, how rarely it lapses. */
  skill: number
}

export type Pilot = {
  drive(s: GameState, dt: number): void
  reset(): void
}

/** How far ahead it reads the bullets, in seconds. */
const LOOK = [0.05, 0.11, 0.18, 0.26, 0.35, 0.45] as const
/** How close to the ship's heart a bullet may come before the pilot minds, in field widths. */
const COMFORT = 0.022
/**
 * How close it goes looking for a graze: its own nerve, not the size of the
 * game's graze circle, so a wider circle gives it more grazes without drawing it
 * deeper into the curtain.
 */
const GRAZE_NERVE = 0.035

type P = { x: number; y: number }

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a)
}

export function makePilot(options: PilotOptions = { skill: 0.7 }): Pilot {
  const skill = Math.max(0, Math.min(1, options.skill))
  /** How fast its finger moves, field widths a second. */
  const hand = 0.9 + skill * 0.7
  let thinkIn = 0
  let goal: P = { x: 0.5, y: FIELD_H - 0.14 }
  let finger: P | null = null
  let blindFor = 0
  let lastBarrage = -10

  const reset = () => {
    thinkIn = 0
    goal = { x: 0.5, y: FIELD_H - 0.14 }
    finger = null
    blindFor = 0
    lastBarrage = -10
  }

  /** Where it would like to be: under what it is shooting at, low, and off the walls. */
  const preference = (s: GameState) => {
    let target: P | null = null
    let best = Infinity
    for (const e of s.enemies) {
      if (e.gone || e.y < 0.02) continue
      const spec = SPECIES[e.species]
      // The flagship first, then whatever is lowest and nearest across.
      const score = e.species === 'queen' ? -10 : Math.abs(e.x - s.ship.x) * 1.5 - e.y + e.hp / (spec.hp * 8)
      if (score < best) {
        best = score
        target = { x: e.x, y: e.y }
      }
    }
    return { x: target ? target.x : 0.5, y: FIELD_H - 0.24 }
  }

  /** How bad a move from `from` to `to` looks, against the bullets it can see. */
  const risk = (s: GameState, near: Bullet[], from: P, to: P, noise: number) => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy) || 1e-6
    let cost = 0
    let grazes = 0
    for (const t of LOOK) {
      const k = Math.min(1, (hand * t) / dist)
      const px = from.x + dx * k
      const py = from.y + dy * k
      for (const b of near) {
        const tt = Math.max(0, t - b.wait)
        const bx = b.x + b.vx * tt + noise * (b.vx >= 0 ? 1 : -1)
        const by = b.y + b.vy * tt
        const gap = Math.hypot(bx - px, by - py) - (CORE_R + b.r * 0.72)
        if (gap < COMFORT) cost += ((COMFORT - gap) * 900) / (1 + t * 2.5)
        else if (!b.grazed && gap < GRAZE_NERVE) grazes += 1
      }
    }
    // Ramming a ship is as bad as a bullet.
    for (const e of s.enemies) {
      const spec = SPECIES[e.species]
      const d = Math.hypot(e.x - to.x, e.y - to.y)
      if (d < spec.body + 0.05) cost += (spec.body + 0.05 - d) * 400
    }
    return { cost, grazes }
  }

  const think = (s: GameState) => {
    const ship = { x: s.ship.x, y: s.ship.y }
    const bounds = shipBounds()
    const near: Bullet[] = []
    if (blindFor <= 0) {
      for (const b of s.bullets) {
        if (Math.abs(b.x - ship.x) < 0.42 && Math.abs(b.y - ship.y) < 0.42) near.push(b)
      }
    }
    const want = preference(s)
    const noise = (1 - skill) * rnd(-0.012, 0.012)
    const options: P[] = [ship]
    const at = (x: number, y: number) =>
      options.push({ x: Math.max(bounds.x0, Math.min(bounds.x1, x)), y: Math.max(bounds.y0 + 0.2, Math.min(bounds.y1, y)) })
    for (const r of [0.025, 0.06, 0.11, 0.17]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        at(ship.x + Math.cos(a) * r, ship.y + Math.sin(a) * r)
      }
    }
    // Further across, for a gap in a wall or a clear side of the field.
    for (const dx of [-0.45, -0.32, 0.32, 0.45]) for (const dy of [-0.06, 0, 0.06]) at(ship.x + dx, ship.y + dy)
    let bestP = ship
    let bestCost = Infinity
    let worstBest = 0
    for (const o of options) {
      const { cost, grazes } = risk(s, near, ship, o, noise)
      const place = Math.abs(o.x - want.x) * 1.6 + Math.abs(o.y - want.y) * 1.1 + Math.hypot(o.x - ship.x, o.y - ship.y) * 0.4
      const total = cost + place - grazes * 0.04 * skill
      if (total < bestCost) {
        bestCost = total
        bestP = o
        worstBest = cost
      }
    }
    goal = bestP
    // Every way out looks bad: let the Barrage go.
    if (s.stock >= 1 && worstBest > 2.5 + (1 - skill) * 4 && s.time - lastBarrage > 1.5) {
      triggerBarrage(s)
      lastBarrage = s.time
    } else if (s.stock >= 3 && s.bullets.length > 120 && s.time - lastBarrage > 4 && Math.random() < 0.3) {
      // A full hand and a sky full of bullets: cash it in.
      triggerBarrage(s)
      lastBarrage = s.time
    }
  }

  const drive = (s: GameState, dt: number) => {
    if (s.phase !== 'playing') {
      finger = null
      setSteer(s, null)
      return
    }
    blindFor -= dt
    // A lapse: for a moment it stops reading the bullets. More often the worse it is.
    if (blindFor <= 0 && Math.random() < dt * (0.02 + (1 - skill) * 0.35)) blindFor = rnd(0.15, 0.4)
    thinkIn -= dt
    if (thinkIn <= 0) {
      thinkIn = rnd(0.05, 0.08) + (1 - skill) * 0.08
      think(s)
    }
    // The finger moves toward the goal no faster than a hand.
    if (!finger) finger = { x: s.ship.x, y: s.ship.y }
    const dx = goal.x - finger.x
    const dy = goal.y - finger.y
    const d = Math.hypot(dx, dy)
    const step = hand * dt
    if (d <= step) finger = { x: goal.x, y: goal.y }
    else finger = { x: finger.x + (dx / d) * step, y: finger.y + (dy / d) * step }
    setSteer(s, finger)
  }

  return { drive, reset }
}
