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

export function recordNavShortLabel(row: { id: string; label: string }): string {
  if (row.id === ASTEROIDS_HIGHEST_COMBO_ID) return 'Combo'
  if (row.id === PATRIOT_DIRECT_STREAK_ID) return 'Direct'
  const wave = parseAsteroidsWaveFromRecordId(row.id)
  if (wave != null) return `W${wave}`
  const length = parseSnakeLengthFromRecordId(row.id)
  if (length != null) return `L${length}`
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

/** Best-effort Patriot perfect-hit streak submit (run peak). */
export async function submitPatriotDirectStreak(
  streak: number,
  name: string,
): Promise<{ improved: boolean; rank: number | null } | null> {
  const value = Math.floor(streak)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord(
      'patriot',
      PATRIOT_DIRECT_STREAK_ID,
      name,
      value,
    )
    return { improved: result.improved, rank: result.rank }
  } catch {
    return null
  }
}

export async function fetchGameRecords(
  game: string,
): Promise<{ game: string; records: RecordSummary[] }> {
  const data = await api<{ game: string; records?: RecordSummary[] }>(
    `/records/${encodeURIComponent(game)}`,
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
}> {
  const cleaned = normalizePlayerName(name) || 'PLAYER'
  const token = getClaimToken(cleaned)
  const data = await api<{
    improved?: boolean
    rank: number | null
    ranks?: Partial<Record<LeaderboardPeriod, number>>
    entry?: LeaderboardEntry | null
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
  }
}

/** Best-effort wave clear submit; ignores errors so play is never blocked. */
export async function submitAsteroidsWaveTime(
  wave: number,
  seconds: number,
  name: string,
): Promise<{ improved: boolean; rank: number | null } | null> {
  const recordId = asteroidsWaveTimeRecordId(wave)
  if (!recordId || !(seconds > 0) || !Number.isFinite(seconds)) return null
  const ms = Math.max(1, Math.round(seconds * 1000))
  try {
    const result = await submitRecord('asteroids', recordId, name, ms)
    return { improved: result.improved, rank: result.rank }
  } catch {
    return null
  }
}

/** Best-effort highest combo submit (run peak). */
export async function submitAsteroidsHighestCombo(
  combo: number,
  name: string,
): Promise<{ improved: boolean; rank: number | null } | null> {
  const value = Math.floor(combo)
  if (!(value >= 2)) return null
  try {
    const result = await submitRecord(
      'asteroids',
      ASTEROIDS_HIGHEST_COMBO_ID,
      name,
      value,
    )
    return { improved: result.improved, rank: result.rank }
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
    if (waveResult?.improved) {
      hits.push({
        id: `asteroids:wave-time-${input.wave}`,
        label: `Wave ${input.wave} clear`,
        rank: waveResult.rank,
      })
    }
    const combo = Math.floor(input.combo)
    if (combo >= 2) {
      const comboResult = await submitAsteroidsHighestCombo(combo, name)
      if (comboResult?.improved) {
        hits.push({
          id: 'asteroids:highest-combo',
          label: 'Highest combo',
          value: `×${combo}`,
          rank: comboResult.rank,
        })
      }
    }
    waveClearBookDone.set(key, hits)
    waveClearBookInflight.delete(key)
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
): Promise<{ improved: boolean; rank: number | null } | null> {
  const recordId = snakeFastestLengthRecordId(length)
  const cleaned = normalizePlayerName(name)
  if (!recordId || !cleaned || !(elapsedMs > 0)) return null
  const ms = Math.max(1, Math.round(elapsedMs))
  try {
    const result = await submitRecord('snake', recordId, cleaned, ms)
    return { improved: result.improved, rank: result.rank }
  } catch {
    return null
  }
}

export const GAMES_WITH_RECORDS = ['asteroids', 'snake', 'patriot'] as const
export type RecordGame = (typeof GAMES_WITH_RECORDS)[number]

export function gameHasRecords(game: string): game is RecordGame {
  return (GAMES_WITH_RECORDS as readonly string[]).includes(game)
}
