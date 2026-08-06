export type Dir = 'up' | 'down' | 'left' | 'right'
export type Phase = 'menu' | 'playing' | 'gameover'

export type Cell = { x: number; y: number }

export type Floater = {
  x: number
  y: number
  text: string
  life: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  length: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  cols: number
  rows: number
  snake: Cell[]
  prevSnake: Cell[]
  dir: Dir
  /** Next turn to take at the upcoming step. */
  pendingDir: Dir | null
  /** One extra buffered turn after pendingDir. */
  bufferedDir: Dir | null
  food: Cell
  stepAcc: number
  stepInterval: number
  flash: number
  floaters: Floater[]
}

const BEST_KEY = 'snake-best'
export const COLS = 21
export const ROWS = 15
const START_INTERVAL = 0.16
const MIN_INTERVAL = 0.07
const SCORE_FOOD = 10

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
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

function same(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y
}

function randomEmpty(cols: number, rows: number, occupied: Cell[]): Cell {
  const free: Cell[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied.some((c) => c.x === x && c.y === y)) free.push({ x, y })
    }
  }
  if (free.length === 0) return { x: 0, y: 0 }
  return free[Math.floor(Math.random() * free.length)]
}

function freshSnake(cols: number, rows: number): Cell[] {
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ]
}

export function createInitialState(cols = COLS, rows = ROWS): GameState {
  const snake = freshSnake(cols, rows)
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    cols,
    rows,
    snake,
    prevSnake: snake.map((c) => ({ ...c })),
    dir: 'right',
    pendingDir: null,
    bufferedDir: null,
    food: randomEmpty(cols, rows, snake),
    stepAcc: 0,
    stepInterval: START_INTERVAL,
    flash: 0,
    floaters: [],
  }
}

export function startGame(prev: GameState): GameState {
  const next = createInitialState(prev.cols, prev.rows)
  return {
    ...next,
    best: Math.max(prev.best, loadBest()),
    phase: 'playing',
  }
}

export function queueDir(state: GameState, next: Dir): GameState {
  if (state.phase !== 'playing' && state.phase !== 'menu') return state

  // First queued turn: must be perpendicular to the move currently in progress
  if (!state.pendingDir) {
    if (next === state.dir || next === OPPOSITE[state.dir]) return state
    return {
      ...state,
      pendingDir: next,
      // Finish the current cell ASAP so the turn isn't stuck waiting
      stepAcc:
        state.phase === 'playing'
          ? Math.max(state.stepAcc, state.stepInterval * 0.92)
          : state.stepAcc,
    }
  }

  // Second buffered turn: relative to the pending turn
  if (next === state.pendingDir || next === OPPOSITE[state.pendingDir]) return state
  if (next === state.bufferedDir) return state
  return {
    ...state,
    bufferedDir: next,
  }
}

function step(state: GameState): GameState {
  const dir = state.pendingDir ?? state.dir
  const head = state.snake[0]
  const nextHead: Cell = {
    x: head.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0),
    y: head.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0),
  }

  const promoteBuffer = (): Pick<GameState, 'pendingDir' | 'bufferedDir'> => ({
    pendingDir: state.bufferedDir,
    bufferedDir: null,
  })

  // Wall hit
  if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.cols ||
    nextHead.y >= state.rows
  ) {
    const best = Math.max(state.best, state.score)
    saveBest(best)
    return {
      ...state,
      phase: 'gameover',
      best,
      dir,
      pendingDir: null,
      bufferedDir: null,
      flash: 0.4,
      stepAcc: state.stepInterval,
    }
  }

  const eating = same(nextHead, state.food)
  const body = eating ? state.snake : state.snake.slice(0, -1)

  // Self hit
  if (body.some((c) => same(c, nextHead))) {
    const best = Math.max(state.best, state.score)
    saveBest(best)
    return {
      ...state,
      phase: 'gameover',
      best,
      dir,
      pendingDir: null,
      bufferedDir: null,
      flash: 0.4,
      stepAcc: state.stepInterval,
    }
  }

  const snake = [nextHead, ...body]
  const tail = state.snake[state.snake.length - 1]
  const prevSnake = eating
    ? [...state.snake.map((c) => ({ ...c })), { ...tail }]
    : state.snake.map((c) => ({ ...c }))
  const dirs = promoteBuffer()

  if (!eating) {
    return {
      ...state,
      snake,
      prevSnake,
      dir,
      ...dirs,
    }
  }

  const score = state.score + SCORE_FOOD
  const best = Math.max(state.best, score)
  if (best !== state.best) saveBest(best)

  const grown = Math.max(0, snake.length - 3)
  const stepInterval = Math.max(
    MIN_INTERVAL,
    START_INTERVAL - grown * 0.004,
  )

  return {
    ...state,
    snake,
    prevSnake,
    dir,
    ...dirs,
    food: randomEmpty(state.cols, state.rows, snake),
    score,
    best,
    stepInterval,
    flash: 0.28,
    floaters: [
      ...state.floaters,
      {
        x: nextHead.x + 0.5,
        y: nextHead.y + 0.2,
        text: `+${SCORE_FOOD}`,
        life: 0.9,
      },
    ],
  }
}

/** 0 → just stepped, 1 → about to step (visual lerp factor). */
export function moveProgress(state: GameState) {
  if (state.phase !== 'playing') return 1
  return Math.min(1, state.stepAcc / state.stepInterval)
}

/** Interpolated segment centers in grid units for smooth drawing. */
export function visualSegments(state: GameState): Cell[] {
  const t = moveProgress(state)
  const from = state.prevSnake
  const to = state.snake
  return to.map((cell, i) => {
    const prev = from[i] ?? from[from.length - 1] ?? cell
    return {
      x: prev.x + (cell.x - prev.x) * t,
      y: prev.y + (cell.y - prev.y) * t,
    }
  })
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y - 0.7 * dt,
      life: f.life - dt * 1.2,
    }))
    .filter((f) => f.life > 0)

  if (s.phase !== 'playing') return s

  s.stepAcc += dt
  while (s.stepAcc >= s.stepInterval) {
    s.stepAcc -= s.stepInterval
    s = step(s)
    if (s.phase !== 'playing') break
  }
  return s
}

export function toSnapshot(s: GameState): Snapshot {
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    length: s.snake.length,
  }
}
