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

/** Format stored ms as seconds with one decimal. */
export function formatRecordMs(ms: number): string {
  const secs = Math.max(0, ms) / 1000
  return `${secs.toFixed(1)}s`
}

export function formatRecordValue(entryScore: number, unit: RecordDef['unit']): string {
  if (unit === 'ms') return formatRecordMs(entryScore)
  return String(entryScore)
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
  const cleaned = normalizePlayerName(name)
  if (!recordId || !cleaned || !(seconds > 0)) return null
  const ms = Math.max(1, Math.round(seconds * 1000))
  try {
    const result = await submitRecord('asteroids', recordId, cleaned, ms)
    return { improved: result.improved, rank: result.rank }
  } catch {
    return null
  }
}
