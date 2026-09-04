import {
  ApiError,
  detectDeviceType,
  getClaimToken,
  LEADERBOARD_PERIODS,
  normalizePlayerName,
  rememberClaimToken,
  setPlayerNameLocal,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from './leaderboard'

export const ASTEROIDS_WAVE_RECORD_MAX = 20
export const SNAKE_LENGTH_MILESTONE_MIN = 20
export const SNAKE_LENGTH_MILESTONE_MAX = 100
export const SNAKE_LENGTH_MILESTONE_STEP = 10
export const STRIDE_ROW_MILESTONE_MIN = 25
export const STRIDE_ROW_MILESTONE_MAX = 200
export const STRIDE_ROW_MILESTONE_STEP = 25

export type RecordDirection = 'lower' | 'higher'

export type RecordDef = {
  id: string
  game: LeaderboardGame | string
  label: string
  direction: RecordDirection
  unit: 'ms' | 'count'
}

export type RecordSummary = RecordDef & {
  top: LeaderboardEntry | null
}

export type RecordBoardResult = {
  game: string
  record: RecordDef
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  you: YouEntry | null
}

function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8787`
    }
  }
  return fromEnv || 'http://localhost:8787'
}

const API_BASE = resolveApiBase()

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let sessionHeader: Record<string, string> = {}
  try {
    const session = localStorage.getItem('arcade-session')
    if (session) sessionHeader = { Authorization: `Bearer ${session}` }
  } catch {
    /* ignore */
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...sessionHeader,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `API error ${res.status}`
    let code: string | undefined
    try {
      const body = (await res.json()) as { error?: string; code?: string }
      if (body.error) message = body.error
      code = body.code
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code)
  }
  return res.json() as Promise<T>
}

export function asteroidsWaveTimeRecordId(wave: number): string | null {
  if (!Number.isInteger(wave) || wave < 1 || wave > ASTEROIDS_WAVE_RECORD_MAX) {
    return null
  }
  return `wave-time-${wave}`
}

export function parseAsteroidsWaveFromRecordId(recordId: string): number | null {
  const match = /^wave-time-(\d+)$/.exec(recordId)
  if (!match) return null
  const wave = Number(match[1])
  if (!Number.isInteger(wave) || wave < 1 || wave > ASTEROIDS_WAVE_RECORD_MAX) {
    return null
  }
  return wave
}

export function snakeFastestLengthRecordId(length: number): string | null {
  if (
    !Number.isInteger(length) ||
    length < SNAKE_LENGTH_MILESTONE_MIN ||
    length > SNAKE_LENGTH_MILESTONE_MAX ||
    length % SNAKE_LENGTH_MILESTONE_STEP !== 0
  ) {
    return null
  }
  return `fastest-length-${length}`
}

export function parseSnakeLengthFromRecordId(recordId: string): number | null {
  const match = /^fastest-length-(\d+)$/.exec(recordId)
  if (!match) return null
  const length = Number(match[1])
  if (
    !Number.isInteger(length) ||
    length < SNAKE_LENGTH_MILESTONE_MIN ||
    length > SNAKE_LENGTH_MILESTONE_MAX ||
    length % SNAKE_LENGTH_MILESTONE_STEP !== 0
  ) {
    return null
  }
  return length
}

export function strideFastestRowRecordId(rows: number): string | null {
  if (
    !Number.isInteger(rows) ||
    rows < STRIDE_ROW_MILESTONE_MIN ||
    rows > STRIDE_ROW_MILESTONE_MAX ||
    rows % STRIDE_ROW_MILESTONE_STEP !== 0
  ) {
    return null
  }
  return `fastest-row-${rows}`
}

export function parseStrideRowFromRecordId(recordId: string): number | null {
  const match = /^fastest-row-(\d+)$/.exec(recordId)
  if (!match) return null
  const rows = Number(match[1])
  if (
    !Number.isInteger(rows) ||
    rows < STRIDE_ROW_MILESTONE_MIN ||
    rows > STRIDE_ROW_MILESTONE_MAX ||
    rows % STRIDE_ROW_MILESTONE_STEP !== 0
  ) {
    return null
  }
  return rows
}

export function recordNavShortLabel(row: { id: string; label: string }): string {
  if (row.id === ASTEROIDS_HIGHEST_COMBO_ID) return 'Combo'
  if (row.id === PATRIOT_DIRECT_STREAK_ID) return 'Direct'
  if (row.id === STRIDE_MOST_COINS_ID) return 'Coins'
  if (row.id === POP_CENTER_STREAK_ID) return 'Center'
  if (row.id === STACKER_PERFECT_STREAK_ID) return 'Perfect'
  const wave = parseAsteroidsWaveFromRecordId(row.id)
  if (wave != null) return `W${wave}`
  const length = parseSnakeLengthFromRecordId(row.id)
  if (length != null) return `L${length}`
  const strideRow = parseStrideRowFromRecordId(row.id)
  if (strideRow != null) return `${strideRow}`
  return row.label
}

/** Format stored ms as seconds with one decimal. */
export function formatRecordMs(ms: number): string {
  const secs = Math.max(0, ms) / 1000
  return `${secs.toFixed(1)}s`
}

export function formatRecordValue(entryScore: number, unit: RecordDef['unit']): string {
  if (unit === 'ms') return formatRecordMs(entryScore)
  return String(entryScore)
}

/** Score column display (combo gets a × prefix). */
export function formatRecordScore(entryScore: number, unit: RecordDef['unit']): string {
  if (unit === 'ms') return formatRecordMs(entryScore)
  return `×${entryScore}`
}

export const ASTEROIDS_HIGHEST_COMBO_ID = 'highest-combo'
export const PATRIOT_DIRECT_STREAK_ID = 'direct-streak'
export const STRIDE_MOST_COINS_ID = 'most-coins'
export const POP_CENTER_STREAK_ID = 'center-streak'
export const STACKER_PERFECT_STREAK_ID = 'perfect-streak'

export type RecordSubmitOutcome = {
  improved: boolean
  rank: number | null
  totalEntries: number | null
}

/** Whether a record-book win deserves an in-game celebration card. */
export function shouldCelebrateRecordBook(
  rank: number | null | undefined,
  totalEntries: number | null | undefined,
): boolean {
  if (rank == null || !(rank >= 1)) return false
  if (rank <= 10) return true
  const total = totalEntries ?? 0
  if (rank <= 20) return total >= 50
  if (rank <= 50) return total >= 100
  if (rank <= 100) return total >= 200
  return false
}

export function shouldCelebrateRecordSubmit(
  result: RecordSubmitOutcome | null | undefined,
): result is RecordSubmitOutcome {
  if (!result?.improved) return false
  return shouldCelebrateRecordBook(result.rank, result.totalEntries)
}

function toRecordSubmitOutcome(result: {
  improved: boolean
  rank: number | null
  totalEntries?: number | null
}): RecordSubmitOutcome {
  return {
    improved: result.improved,
    rank: result.rank,
    totalEntries:
      typeof result.totalEntries === 'number' ? result.totalEntries : null,
  }
}

/** Best-effort Patriot perfect-hit streak submit (run peak). */
export async function submitPatriotDirectStreak(
  streak: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const value = Math.floor(streak)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord(
      'patriot',
      PATRIOT_DIRECT_STREAK_ID,
      name,
      value,
    )
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

export async function fetchGameRecords(
  game: string,
  period: LeaderboardPeriod = 'all',
): Promise<{ game: string; records: RecordSummary[] }> {
  const params = new URLSearchParams({ period })
  const data = await api<{ game: string; records?: RecordSummary[] }>(
    `/records/${encodeURIComponent(game)}?${params.toString()}`,
  )
  return { game: data.game, records: data.records ?? [] }
}

export async function fetchRecordBoard(
  game: string,
  recordId: string,
  period: LeaderboardPeriod = 'all',
  name?: string,
): Promise<RecordBoardResult> {
  const params = new URLSearchParams({ period })
  const cleaned = normalizePlayerName(name ?? '')
  if (cleaned) params.set('name', cleaned)
  const data = await api<RecordBoardResult>(
    `/records/${encodeURIComponent(game)}/${encodeURIComponent(recordId)}?${params.toString()}`,
  )
  return {
    game: data.game,
    record: data.record,
    period: (LEADERBOARD_PERIODS as readonly string[]).includes(data.period)
      ? data.period
      : period,
    entries: data.entries ?? [],
    you: data.you ?? null,
  }
}

export async function submitRecord(
  game: string,
  recordId: string,
  name: string,
  score: number,
): Promise<{
  improved: boolean
  rank: number | null
  ranks?: Partial<Record<LeaderboardPeriod, number>>
  entry: LeaderboardEntry | null
  totalEntries: number | null
}> {
  const cleaned = normalizePlayerName(name) || 'PLAYER'
  const token = getClaimToken(cleaned)
  const data = await api<{
    improved?: boolean
    rank: number | null
    ranks?: Partial<Record<LeaderboardPeriod, number>>
    entry?: LeaderboardEntry | null
    totalEntries?: number
    name?: string
    token?: string
  }>(`/records/${encodeURIComponent(game)}/${encodeURIComponent(recordId)}`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      score: Math.floor(score),
      device: detectDeviceType(),
      ...(token ? { token } : {}),
    }),
  })

  const finalName = (data.name ?? cleaned).toUpperCase()
  if (data.token) rememberClaimToken(finalName, data.token)
  setPlayerNameLocal(finalName)

  return {
    improved: Boolean(data.improved),
    rank: data.rank,
    ranks: data.ranks,
    entry: data.entry ?? null,
    totalEntries:
      typeof data.totalEntries === 'number' ? data.totalEntries : null,
  }
}

/** Best-effort wave clear submit; ignores errors so play is never blocked. */
export async function submitAsteroidsWaveTime(
  wave: number,
  seconds: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const recordId = asteroidsWaveTimeRecordId(wave)
  if (!recordId || !(seconds > 0) || !Number.isFinite(seconds)) return null
  const ms = Math.max(1, Math.round(seconds * 1000))
  try {
    const result = await submitRecord('asteroids', recordId, name, ms)
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

/** Best-effort highest combo submit (run peak). */
export async function submitAsteroidsHighestCombo(
  combo: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const value = Math.floor(combo)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord(
      'asteroids',
      ASTEROIDS_HIGHEST_COMBO_ID,
      name,
      value,
    )
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

export type RecordBookHit = {
  id?: string
  label: string
  value?: string
  rank: number | null
}

/**
 * Submit wave + combo book entries once per clear.
 * Dedupes across React Strict Mode remounts so the first `improved: true`
 * is not lost when a second identical POST returns `improved: false`.
 */
const waveClearBookInflight = new Map<string, Promise<RecordBookHit[]>>()
const waveClearBookDone = new Map<string, RecordBookHit[]>()

export function submitAsteroidsWaveClearBooks(input: {
  wave: number
  seconds: number
  combo: number
  name: string
}): Promise<RecordBookHit[]> {
  const name = normalizePlayerName(input.name) || 'PLAYER'
  const key = `${name}:w${input.wave}:t${input.seconds.toFixed(3)}:c${Math.floor(input.combo)}`
  const done = waveClearBookDone.get(key)
  if (done) return Promise.resolve(done)
  const inflight = waveClearBookInflight.get(key)
  if (inflight) return inflight

  const promise = (async (): Promise<RecordBookHit[]> => {
    const hits: RecordBookHit[] = []
    const waveResult = await submitAsteroidsWaveTime(
      input.wave,
      input.seconds,
      name,
    )
    if (shouldCelebrateRecordSubmit(waveResult)) {
      hits.push({
        id: `asteroids:wave-time-${input.wave}`,
        label: `Fastest wave ${input.wave}`,
        value: formatRecordMs(Math.max(1, Math.round(input.seconds * 1000))),
        rank: waveResult.rank,
      })
    }
    const combo = Math.floor(input.combo)
    if (combo >= 2) {
      const comboResult = await submitAsteroidsHighestCombo(combo, name)
      if (shouldCelebrateRecordSubmit(comboResult)) {
        hits.push({
          id: 'asteroids:highest-combo',
          label: 'Highest combo',
          value: `×${combo}`,
          rank: comboResult.rank,
        })
      }
    }
    waveClearBookInflight.delete(key)
    // Only cache wins — empty results may be a failed request and should retry.
    if (hits.length > 0) {
      waveClearBookDone.set(key, hits)
    }
    return hits
  })()

  waveClearBookInflight.set(key, promise)
  return promise
}

/** Best-effort fastest-to-length submit (elapsed ms from run start). */
export async function submitSnakeFastestLength(
  length: number,
  elapsedMs: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const recordId = snakeFastestLengthRecordId(length)
  const cleaned = normalizePlayerName(name)
  if (!recordId || !cleaned || !(elapsedMs > 0)) return null
  const ms = Math.max(1, Math.round(elapsedMs))
  try {
    const result = await submitRecord('snake', recordId, cleaned, ms)
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

/** Best-effort fastest-to-row submit (elapsed ms from run start). */
export async function submitStrideFastestRow(
  rows: number,
  elapsedMs: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const recordId = strideFastestRowRecordId(rows)
  const cleaned = normalizePlayerName(name)
  if (!recordId || !cleaned || !(elapsedMs > 0)) return null
  const ms = Math.max(1, Math.round(elapsedMs))
  try {
    const result = await submitRecord('stride', recordId, cleaned, ms)
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

/** Best-effort most-coins submit (run total). */
export async function submitStrideMostCoins(
  coins: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const value = Math.floor(coins)
  const cleaned = normalizePlayerName(name)
  if (!cleaned || !(value >= 1)) return null
  try {
    const result = await submitRecord('stride', STRIDE_MOST_COINS_ID, cleaned, value)
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

/** Best-effort Pop perfect-center streak submit (run peak). */
export async function submitPopCenterStreak(
  streak: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const value = Math.floor(streak)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord('pop', POP_CENTER_STREAK_ID, name, value)
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

/** Best-effort Stacker perfect-drop streak submit (run peak). */
export async function submitStackerPerfectStreak(
  streak: number,
  name: string,
): Promise<RecordSubmitOutcome | null> {
  const value = Math.floor(streak)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord(
      'stacker',
      STACKER_PERFECT_STREAK_ID,
      name,
      value,
    )
    return toRecordSubmitOutcome(result)
  } catch {
    return null
  }
}

export const GAMES_WITH_RECORDS = [
  'asteroids',
  'snake',
  'patriot',
  'stride',
  'pop',
  'stacker',
] as const
export type RecordGame = (typeof GAMES_WITH_RECORDS)[number]

export function gameHasRecords(game: string): game is RecordGame {
  return (GAMES_WITH_RECORDS as readonly string[]).includes(game)
}
