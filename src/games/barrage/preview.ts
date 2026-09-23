import { runPreview, type Sim } from '../previewKit'
import {
  LINE_PAUSE,
  WAVE_BANNER,
  cannonRect,
  carrierRadius,
  createInitialState,
  dropRadius,
  emitterOf,
  enterProgress,
  introTime,
  roundsReady,
  setFiring,
  setSteer,
  shipX,
  shipY,
  shotSize,
  startGame,
  tick,
  type GameState,
  type Ship,
} from './game'
import { renderGame } from './render'

/*
 * Barrage playing itself, for its cabinet on the home page: the game's own
 * engine and renderer, and a pilot that plays the way a person does. It works
 * the front of the fleet from underneath, leading the march, and takes a lit
 * ship when there is time to stop it before it fires; otherwise it reads the
 * lanes and stands in a cold one. It brings the supply runner down when a gap
 * opens under it, and runs under what falls. It looks the field over a few
 * times a second rather than every frame, now and then misjudges where a
 * volley will come down, and once in a while doesn't see one coming at all,
 * more often as the waves get harder, so a run ends the way a person's does.
 */

/*
 * What a player picks up about the game by playing it, in field widths and
 * seconds: how fast the cannon runs and its rounds climb, how fast a capsule
 * falls, how close to the wall the fleet turns, and how far apart the rounds
 * of one lane come down.
 */
const RUN = 0.82
const RISE = 1.5
const FALL = 0.3
const WALL = 0.028
const ROUND_GAP = 0.11
/** The room the pilot means to leave between the cannon and a round going past it: not much. */
const CLEARANCE = 0.004

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

/** Roughly normal, spread about 1: enough for a hand that is a little off. */
function wobble() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2
}

/** The front ship of each column, the only one a round from below can reach. */
function fronts(s: GameState): Ship[] {
  const front = new Map<number, Ship>()
  for (const ship of s.ships) {
    if (!ship.alive) continue
    const f = front.get(ship.col)
    if (!f || ship.row > f.row) front.set(ship.col, ship)
  }
  return [...front.values()]
}

/** How far across the fleet will have marched `t` seconds from now at `pace`, turning at the wall. */
function marched(s: GameState, pace: number, t: number): number {
  // It holds still until the last of a new wave is in its slot.
  const go = pace * Math.max(0, t - Math.max(0, introTime(s.layout) - s.waveT))
  if (go <= 0) return 0
  let first = Infinity
  let last = -Infinity
  for (const ship of s.ships) {
    if (!ship.alive) continue
    first = Math.min(first, ship.col)
    last = Math.max(last, ship.col)
  }
  if (first > last) return 0
  const { colStep, shipW } = s.layout
  const room =
    s.formDir > 0 ? 1 - WALL - (s.formX + last * colStep + shipW) : s.formX + first * colStep - WALL
  return s.formDir * (go <= room ? go : 2 * Math.max(0, room) - go)
}

/** Where a round leaves the barrel. */
function launchY(s: GameState) {
  return s.layout.cannonY - shotSize(false).h
}

/** Whether a round fired up at `x` now would get past every ship on its way. */
function openAbove(s: GameState, x: number, pace: number): boolean {
  const L = s.layout
  const half = shotSize(false).w / 2 + 0.01
  for (const ship of s.ships) {
    if (!ship.alive) continue
    const t = Math.max(0, (launchY(s) - shipY(s, ship) - L.shipH) / RISE)
    const left = shipX(s, ship) + marched(s, pace, t)
    if (x + half > left && x - half < left + L.shipW) return false
  }
  return true
}

/** Where the supply runner will be when a round fired now gets up to it. */
function carrierAhead(s: GameState): number | null {
  const k = s.carrier
  if (!k) return null
  const t = Math.max(0, (launchY(s) - k.y - carrierRadius() * 1.3) / RISE)
  return k.x + k.vx * t
}

/**
 * Whether a round fired now would meet something: a ship at the front of its
 * column, or the runner through a gap. `slop` is how fussy the pilot is about
 * it this time: above zero it wants the round well inside the hull, below zero
 * it will take one that only might land.
 */
function linedUp(s: GameState, pace: number, slop: number): boolean {
  const L = s.layout
  const half = shotSize(false).w / 2
  const x = s.cannonX
  for (const f of fronts(s)) {
    const t = Math.max(0, (launchY(s) - shipY(s, f) - L.shipH) / RISE)
    const left = shipX(s, f) + marched(s, pace, t)
    if (x + half > left + slop && x - half < left + L.shipW - slop) return true
  }
  const kx = carrierAhead(s)
  return kx !== null && Math.abs(kx - x) < carrierRadius() - slop && openAbove(s, x, pace)
}

/** Something the pilot could go for: where to stand for it and how much it wants it. */
type Aim = {
  x: number
  value: number
  key: string
  col: number
  /** A lit ship it means to stop before it fires. */
  defuse: boolean
  /** A capsule to stand under, where there is nothing to lead. */
  exact: boolean
}

/**
 * A round that will come down through the cannon's row: where it reaches the
 * top of the turret, how many seconds from now, how it drifts while it passes,
 * and how long that takes.
 */
type Threat = { x: number; t: number; vx: number; pass: number }

/** How the pilot is reading the volley now charging or falling. */
type Reading = {
  pace: number
  fall: number
  /** How far off it has the whole volley, across the field. */
  misread: number
  /** How much of the lean it misses: none at 0, all of it at 1, too much below 0. */
  bias: number
  /** It did not see this volley coming, and carries on as if it were not there. */
  blind: boolean
  /** A lit lane it is standing in on purpose, betting to stop the ship first. */
  bet: number
}

/** Every round the pilot expects through the cannon's row, as it reads them: falling, still to fall, and lit lanes. */
function threats(s: GameState, r: Reading): Threat[] {
  const out: Threat[] = []
  if (r.blind) return out
  const c = cannonRect(s)
  const top = c.y - c.h * 0.1
  const size = shotSize(true)
  const rate = s.buffSlow > 0 ? 0.5 : 1
  const lean = s.volleySpread * (1 - r.bias)

  for (const shot of s.shots) {
    if (!shot.hostile) continue
    const vy = shot.vy * rate
    const t = (top - shot.y - size.h) / vy
    if (t < -0.25) continue
    const vx = shot.vx * (1 - r.bias) * rate
    out.push({ x: shot.x + r.misread + vx * Math.max(0, t), t, vx, pass: (c.h * 1.1) / vy })
  }

  // Rounds still to leave a nozzle, `after` seconds from now, from `x` and `y`.
  const vy = r.fall * rate
  const coming = (x: number, y: number, after: number) => {
    const drop = top - y - size.h * 0.5
    out.push({
      x: x + r.misread + lean * drop,
      t: after + drop / vy,
      vx: lean * vy,
      pass: (c.h * 1.1) / vy,
    })
  }
  for (const b of s.bursts) {
    const ship = s.ships.find((sh) => sh.alive && sh.col === b.col && sh.row === b.row)
    if (!ship) continue
    const e = emitterOf(s, ship)
    for (let k = 0; k < b.left; k++) {
      const after = Math.max(0, b.next) + k * ROUND_GAP
      coming(e.x + marched(s, r.pace, after), e.y, after)
    }
  }
  // A jammed volley fizzles, so its lanes are nothing to stand clear of.
  if (s.chargeLeft > 0 && !s.jamArmed) {
    for (const ship of s.ships) {
      if (!ship.alive || !ship.charging || ship.col === r.bet) continue
      const e = emitterOf(s, ship)
      for (let k = 0; k < 3; k++) {
        const after = s.chargeLeft + k * ROUND_GAP
        coming(e.x + marched(s, r.pace, after), e.y, after)
      }
    }
  }
  return out
}

/** Would the cannon, running from `from` to `goal` and waiting there, be hit by this round? */
function struck(from: number, goal: number, th: Threat, reach: number): boolean {
  for (const k of [0, 0.5, 1]) {
    const t = Math.max(0, th.t + th.pass * k)
    const at = from + Math.max(-RUN * t, Math.min(RUN * t, goal - from))
    if (Math.abs(at - (th.x + th.vx * (t - th.t))) < reach) return true
  }
  return false
}

/** How likely the pilot is to miss a volley coming: now and then at first, more as the waves get harder. */
function lapse(s: GameState) {
  return Math.min(0.5, 0.12 + (s.wave - 1) * 0.06)
}

export function makeSim(): Sim<GameState> {
  // Where the pilot is steering, when it next looks the field over, and whether it is in play.
  let goal = 0.5
  let thinkIn = 0
  let playing = false
  // What it is shooting at, and how far off its aim is for that target.
  let targetKey = ''
  let aimOff = 0
  // Its thumb: when it can next fire, and how fussy it is being about that shot.
  let fireIn = 0
  let slop = 0
  // The fleet's pace and the volley's speed, as it has seen them.
  let pace = 0.1
  let fall = 0.5
  let lastFormX = 0
  let lastFormY = -1
  // The volley in hand, and how the pilot is reading it.
  let lastCharge = 0
  let blind = false
  let misread = 0
  let bias = 0
  // A shot taken without waiting to line it up.
  let hasty = false

  const pickAim = (s: GameState): Aim | null => {
    const L = s.layout
    const c = cannonRect(s)
    const lo = c.w / 2 + 0.01
    const hi = 1 - lo
    const from = s.cannonX
    const aims: Aim[] = []

    for (const f of fronts(s)) {
      if (enterProgress(s, f) < 0.8) continue
      const bottom = shipY(s, f) + L.shipH
      const t = Math.max(0, (launchY(s) - bottom) / RISE)
      const x = shipX(s, f) + L.shipW / 2 + marched(s, pace, t)
      const gap = Math.abs(x - from)
      // Near ones first, and the lowest, which reach the line first.
      let value = 1 + bottom * 2 - gap * 1.4 - (f.hp - 1) * 0.2
      let defuse = false
      if (f.charging && !blind) {
        // Worth standing in its lane only if there is time to get there and break it before it fires.
        if (gap / RUN + t + (f.hp - 1) * 0.26 + 0.1 < s.chargeLeft) {
          value += 2.2
          defuse = true
        } else {
          value -= 0.6
        }
      }
      aims.push({
        x: Math.max(lo, Math.min(hi, x)),
        value,
        key: `${f.col}:${f.row}`,
        col: f.col,
        defuse,
        exact: false,
      })
    }

    // The runner, worth a detour when a round has a way up to it.
    const kx = carrierAhead(s)
    if (kx !== null && kx > lo && kx < hi && openAbove(s, kx, pace)) {
      aims.push({
        x: kx,
        value: 2 - Math.abs(kx - from) * 1.4,
        key: 'carrier',
        col: -1,
        defuse: false,
        exact: false,
      })
    }

    // A capsule, worth more than most things, if the cannon can get under it before it lands.
    for (const d of s.drops) {
      const t = (c.y + c.h * 0.5 - d.y - dropRadius()) / FALL
      const gap = Math.abs(d.x - from)
      if (t <= 0 || gap / RUN > t - 0.05) continue
      aims.push({
        x: Math.max(lo, Math.min(hi, d.x)),
        value: 2.8 - gap,
        key: 'drop',
        col: -1,
        defuse: false,
        exact: true,
      })
    }

    let best: Aim | null = null
    for (const aim of aims) {
      // Sticking with a target beats dithering between two.
      if (aim.key === targetKey) aim.value += 0.35
      if (!best || aim.value > best.value) best = aim
    }
    return best
  }

  // Where to stand: as near where it wants to be as it can get without being
  // hit on the way there or once it has arrived.
  const chooseGoal = (s: GameState, want: number, seen: Threat[]): number => {
    const c = cannonRect(s)
    const lo = c.w / 2 + 0.01
    const hi = 1 - lo
    const reach = c.w / 2 + shotSize(true).w / 2 + CLEARANCE
    const from = s.cannonX
    let best = from
    let bestCost = Infinity
    const consider = (g: number) => {
      let cost = Math.abs(g - want)
      for (const th of seen) if (struck(from, g, th, reach)) cost += th.t < 1 ? 4 : 1.5
      if (cost < bestCost) {
        bestCost = cost
        best = g
      }
    }
    consider(Math.max(lo, Math.min(hi, want)))
    consider(from)
    for (let i = 0; i <= 60; i++) consider(lo + ((hi - lo) * i) / 60)
    return best
  }

  const drive = (s: GameState, dt: number): GameState => {
    if (!playing) {
      // A new cannon, or a new wave: a moment to take it in before moving.
      playing = true
      goal = s.cannonX
      thinkIn = rand(0.25, 0.45)
    }
    // Read the fleet's pace off its march, and the volley's speed off its rounds.
    if (s.formY === lastFormY && s.formX !== lastFormX && dt > 0) {
      pace += (Math.abs(s.formX - lastFormX) / dt - pace) * 0.5
    }
    lastFormX = s.formX
    lastFormY = s.formY
    const round = s.shots.find((shot) => shot.hostile)
    if (round) fall = round.vy
    // A volley starting to charge: whether the pilot notices, and how well it reads the lean.
    if (s.chargeLeft > 0 && lastCharge <= 0) {
      blind = Math.random() < lapse(s)
      misread = wobble() * (0.02 + s.wave * 0.01)
      bias = rand(-0.15, 0.5)
    }
    lastCharge = s.chargeLeft

    thinkIn -= dt
    if (thinkIn <= 0) {
      thinkIn = rand(0.12, 0.24)
      const aim = pickAim(s)
      if (!aim || aim.key !== targetKey) aimOff = aim && !aim.exact ? wobble() * 0.012 : 0
      targetKey = aim ? aim.key : ''
      const want = aim ? aim.x + aimOff : s.cannonX
      const bet = aim && aim.defuse ? aim.col : -1
      goal = chooseGoal(s, want, threats(s, { pace, fall, misread, bias, blind, bet }))
    }

    let next = setSteer(s, goal)
    fireIn -= dt
    if (fireIn <= 0 && roundsReady(s) > 0 && (hasty || linedUp(s, pace, slop))) {
      // A tap: pressed and let go, which the engine keeps until its next tick.
      next = setFiring(setFiring(next, true), false)
      fireIn = rand(0.34, 0.58)
      slop = rand(-0.012, 0.01)
      hasty = Math.random() < 0.15
    }
    return next
  }

  const begin = (w: number, h: number): GameState => {
    goal = 0.5
    thinkIn = 0
    playing = false
    targetKey = ''
    aimOff = 0
    fireIn = 0
    slop = 0
    pace = 0.1
    fall = 0.5
    lastFormX = 0
    lastFormY = -1
    lastCharge = 0
    blind = false
    misread = 0
    bias = 0
    hasty = false
    // The board takes the screen's shape, as the game's own page does: on its side on a cabinet.
    const portrait = h > w
    return startGame(createInitialState(portrait), portrait)
  }

  return {
    start: begin,
    step: (s, dt) => {
      if (s.phase === 'playing') return tick(drive(s, dt), dt)
      // Hands off between lives and waves.
      playing = false
      return tick(s.steerX === null ? s : setSteer(s, null), dt)
    },
    over: (s) => s.phase === 'gameover',
    render: (ctx, s, w, h) => renderGame(ctx, screen(s), w, h),
    // The field is in its own units, so a new size only matters if it turns the board.
    resize: (s, w, h) => (s.layout.fieldH > 1 === h > w ? s : begin(w, h)),
    // The still: three lanes charging over the fleet, a shot on its way up, the supply ship crossing.
    poster: { seed: 5, at: 8 },
    // The engine has already played the last cannon going up, or the line giving way.
    hold: 0.8,
  }
}

/**
 * The field as the game draws it, minus what is written over it for a player:
 * the wave's name and its how-to line, the clear banner and its bonus, the
 * line's obituary, and the score and chain calls that come off the fleet.
 */
function screen(s: GameState): GameState {
  return {
    ...s,
    // The wave's name is drawn only in play; the fleet flying in draws the same
    // in the pause after a clear, which has nothing written once its bonus is gone.
    phase: s.phase === 'playing' && s.waveT < WAVE_BANNER ? 'clearing' : s.phase,
    clearBonus: null,
    // "The line broke" fades in over the pause; held at the pause's first moment
    // it stays unseen, and what is left of the line keeps flickering.
    dyingFor: s.endCause === 'line' && s.phase === 'dying' ? LINE_PAUSE : s.dyingFor,
    floaters: [],
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
