export type Phase = 'menu' | 'playing' | 'waveClear' | 'gameover'

export type City = {
  id: number
  x: number
  alive: boolean
}

export type Battery = {
  id: number
  x: number
  ammo: number
  alive: boolean
}

export type Incoming = {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  x: number
  y: number
  speed: number
  targetCity: number
}

export type Shot = {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  x: number
  y: number
  speed: number
}

export type Blast = {
  id: number
  x: number
  y: number
  r: number
  maxR: number
  growing: boolean
}

export type Floater = {
  id: number
  x: number
  y: number
  text: string
  life: number
}

export type Snapshot = {
  score: number
  best: number
  wave: number
  phase: Phase
  ammoLeft: number
  citiesLeft: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  wave: number
  cities: City[]
  batteries: Battery[]
  incoming: Incoming[]
  shots: Shot[]
  blasts: Blast[]
  floaters: Floater[]
  cursor: { x: number; y: number }
  spawnTimer: number
  toSpawn: number
  wavePause: number
  flash: number
  groundY: number
  hitStreak: number
}

const BEST_KEY = 'patriot-best'
const BATTERY_AMMO = 10
const BLAST_MAX = 70
const DIRECT_HIT_RADIUS = 16
const SCORE_SPLASH = 25
const SCORE_DIRECT = 100
const STREAK_LENGTH = 4
const SCORE_STREAK = 200

let nextId = 1
function uid() {
  return nextId++
}

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* ignore */
  }
}

function layoutWorld(w: number, h: number) {
  const groundY = h * 0.88
  const margin = w * 0.08
  const usable = w - margin * 2

  // Batteries at left, center, right
  const batteryXs = [margin + usable * 0.08, w / 2, margin + usable * 0.92]
  const batteries: Battery[] = batteryXs.map((x, i) => ({
    id: i,
    x,
    ammo: BATTERY_AMMO,
    alive: true,
  }))

  // Cities between batteries
  const citySlots = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8]
  const cities: City[] = citySlots.map((t, i) => ({
    id: i,
    x: margin + usable * t,
    alive: true,
  }))

  return { groundY, cities, batteries }
}

export function createInitialState(w = 800, h = 600): GameState {
  const { groundY, cities, batteries } = layoutWorld(w, h)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    wave: 1,
    cities,
    batteries,
    incoming: [],
    shots: [],
    blasts: [],
    floaters: [],
    cursor: { x: w / 2, y: h * 0.4 },
    spawnTimer: 0,
    toSpawn: 0,
    wavePause: 0,
    flash: 0,
    groundY,
    hitStreak: 0,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  const { groundY, cities, batteries } = layoutWorld(w, h)
  return {
    ...state,
    groundY,
    cities: cities.map((c, i) => ({
      ...c,
      alive: state.cities[i]?.alive ?? true,
    })),
    batteries: batteries.map((b, i) => ({
      ...b,
      ammo: state.batteries[i]?.ammo ?? BATTERY_AMMO,
      alive: state.batteries[i]?.alive ?? true,
    })),
  }
}

function waveIncomingCount(wave: number) {
  return 6 + wave * 2
}

function waveSpeed(wave: number) {
  return 55 + wave * 8
}

export function startGame(prev: GameState, w: number, h: number): GameState {
  const base = createInitialState(w, h)
  return beginWave(
    {
      ...base,
      best: Math.max(prev.best, loadBest()),
      phase: 'playing',
      wave: 1,
    },
    1,
  )
}

function beginWave(state: GameState, wave: number): GameState {
  return {
    ...state,
    phase: 'playing',
    wave,
    batteries: state.batteries.map((b) =>
      b.alive ? { ...b, ammo: BATTERY_AMMO } : b,
    ),
    incoming: [],
    shots: [],
    blasts: [],
    floaters: [],
    toSpawn: waveIncomingCount(wave),
    spawnTimer: 0.4,
    wavePause: 0,
  }
}

export function setCursor(state: GameState, x: number, y: number): GameState {
  return {
    ...state,
    cursor: { x, y: Math.min(y, state.groundY - 24) },
  }
}

export function fire(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  const alive = state.batteries.filter((b) => b.alive && b.ammo > 0)
  if (alive.length === 0) return state

  const target = state.cursor
  // Nearest battery with ammo
  let best = alive[0]
  let bestDist = Math.abs(best.x - target.x)
  for (const b of alive) {
    const d = Math.abs(b.x - target.x)
    if (d < bestDist) {
      best = b
      bestDist = d
    }
  }

  const batteries = state.batteries.map((b) =>
    b.id === best.id ? { ...b, ammo: b.ammo - 1 } : b,
  )

  const shot: Shot = {
    id: uid(),
    x0: best.x,
    y0: state.groundY - 18,
    x1: target.x,
    y1: target.y,
    x: best.x,
    y: state.groundY - 18,
    speed: 420,
  }

  return { ...state, batteries, shots: [...state.shots, shot] }
}

function spawnIncoming(state: GameState, w: number): GameState {
  const aliveCities = state.cities.filter((c) => c.alive)
  if (aliveCities.length === 0 || state.toSpawn <= 0) return state

  const city = aliveCities[Math.floor(Math.random() * aliveCities.length)]
  const x0 = w * (0.05 + Math.random() * 0.9)
  const speed = waveSpeed(state.wave) * (0.85 + Math.random() * 0.3)

  const missile: Incoming = {
    id: uid(),
    x0,
    y0: -10,
    x1: city.x,
    y1: state.groundY - 8,
    x: x0,
    y: -10,
    speed,
    targetCity: city.id,
  }

  return {
    ...state,
    incoming: [...state.incoming, missile],
    toSpawn: state.toSpawn - 1,
    spawnTimer: Math.max(0.35, 1.1 - state.wave * 0.06),
  }
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

function advanceAlong(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
  speed: number,
  dt: number,
) {
  const total = dist(x0, y0, x1, y1) || 1
  const traveled = dist(x0, y0, x, y)
  const next = Math.min(total, traveled + speed * dt)
  const t = next / total
  return {
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
    done: next >= total - 0.5,
  }
}

export function tick(state: GameState, dt: number, w: number): GameState {
  let s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y - 28 * dt,
      life: f.life - dt * 1.15,
    }))
    .filter((f) => f.life > 0)

  if (s.phase === 'menu') return s

  if (s.phase === 'waveClear') {
    s.wavePause -= dt
    if (s.wavePause <= 0) {
      s = beginWave(s, s.wave + 1)
    }
    return s
  }

  if (s.phase === 'gameover') return s

  // Spawn
  if (s.toSpawn > 0) {
    s.spawnTimer -= dt
    if (s.spawnTimer <= 0) {
      s = spawnIncoming(s, w)
    }
  }

  // Move shots → blasts
  const newShots: Shot[] = []
  const newBlasts = [...s.blasts]
  for (const shot of s.shots) {
    const step = advanceAlong(
      shot.x0, shot.y0, shot.x1, shot.y1, shot.x, shot.y, shot.speed, dt,
    )
    if (step.done) {
      newBlasts.push({
        id: uid(),
        x: shot.x1,
        y: shot.y1,
        r: 6,
        maxR: BLAST_MAX,
        growing: true,
      })
    } else {
      newShots.push({ ...shot, x: step.x, y: step.y })
    }
  }
  s.shots = newShots

  // Grow / shrink blasts
  const liveBlasts: Blast[] = []
  for (const b of newBlasts) {
    if (b.growing) {
      const r = b.r + 120 * dt
      if (r >= b.maxR) {
        liveBlasts.push({ ...b, r: b.maxR, growing: false })
      } else {
        liveBlasts.push({ ...b, r })
      }
    } else {
      const r = b.r - 70 * dt
      if (r > 2) liveBlasts.push({ ...b, r })
    }
  }
  s.blasts = liveBlasts

  // Move incoming; check blast hits and ground hits
  const liveIncoming: Incoming[] = []
  const newFloaters = [...s.floaters]
  let cities = s.cities.map((c) => ({ ...c }))
  let batteries = s.batteries.map((b) => ({ ...b }))
  let scoreAdd = 0
  let flash = s.flash
  let hitStreak = s.hitStreak

  for (const m of s.incoming) {
    let hitBlast: Blast | null = null
    for (const b of s.blasts) {
      if (dist(m.x, m.y, b.x, b.y) <= b.r + 4) {
        hitBlast = b
        break
      }
    }

    if (hitBlast) {
      const direct = dist(m.x, m.y, hitBlast.x, hitBlast.y) <= DIRECT_HIT_RADIUS
      if (direct) {
        scoreAdd += SCORE_DIRECT
        newFloaters.push({
          id: uid(),
          x: m.x,
          y: m.y - 10,
          text: 'DIRECT HIT +100',
          life: 1.15,
        })
        flash = Math.max(flash, 0.35)
      } else {
        scoreAdd += SCORE_SPLASH
      }

      hitStreak += 1
      if (hitStreak >= STREAK_LENGTH) {
        scoreAdd += SCORE_STREAK
        newFloaters.push({
          id: uid(),
          x: m.x,
          y: m.y - (direct ? 34 : 10),
          text: `4 IN A ROW +${SCORE_STREAK}`,
          life: 1.35,
        })
        flash = Math.max(flash, 0.45)
        hitStreak = 0
      }
      continue
    }

    const step = advanceAlong(
      m.x0, m.y0, m.x1, m.y1, m.x, m.y, m.speed, dt,
    )
    if (step.done) {
      // Missed intercept — streak breaks
      hitStreak = 0
      // Hit ground target
      const city = cities.find((c) => c.id === m.targetCity)
      if (city?.alive) {
        city.alive = false
        flash = 0.55
      }
      // Also destroy nearby battery if close
      for (const bat of batteries) {
        if (bat.alive && Math.abs(bat.x - m.x1) < 36) {
          bat.alive = false
          bat.ammo = 0
        }
      }
      continue
    }
    liveIncoming.push({ ...m, x: step.x, y: step.y })
  }

  s.incoming = liveIncoming
  s.cities = cities
  s.batteries = batteries
  s.floaters = newFloaters
  s.score += scoreAdd
  s.flash = Math.max(s.flash, flash)
  s.hitStreak = hitStreak

  const citiesLeft = s.cities.filter((c) => c.alive).length
  if (citiesLeft === 0) {
    const best = Math.max(s.best, s.score)
    saveBest(best)
    return { ...s, phase: 'gameover', best }
  }

  // Wave clear: nothing left to spawn / fly / explode
  if (
    s.toSpawn <= 0 &&
    s.incoming.length === 0 &&
    s.shots.length === 0 &&
    s.blasts.length === 0
  ) {
    const cityBonus = citiesLeft * 100
    const ammoBonus = s.batteries.reduce((n, b) => n + (b.alive ? b.ammo * 5 : 0), 0)
    const score = s.score + cityBonus + ammoBonus
    const best = Math.max(s.best, score)
    if (best !== s.best) saveBest(best)
    return {
      ...s,
      score,
      best,
      phase: 'waveClear',
      wavePause: 1.6,
    }
  }

  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    wave: s.wave,
    phase: s.phase,
    ammoLeft: s.batteries.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0),
    citiesLeft: s.cities.filter((c) => c.alive).length,
  }
}
