import type { DeviceType } from './device'
import { detectDeviceType, DEVICE_LABELS, isDeviceType } from './device'

export type { DeviceType }
export { detectDeviceType, DEVICE_LABELS, isDeviceType }

export type LeaderboardEntry = {
  id: string
  name: string
  score: number
  at: number
  device?: DeviceType
  avatarId?: string
}

export const LEADERBOARD_GAMES = [
  'asteroids',
  'patriot',
  'snake',
  'pop',
  'stacker',
  'dead-center',
  'simon',
] as const
export type LeaderboardGame = (typeof LEADERBOARD_GAMES)[number]

export const LEADERBOARD_PERIODS = ['daily', 'weekly', 'monthly', 'all'] as const
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number]

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  all: 'All time',
}

/** Hard cap for player names (API + UI). */
export const PLAYER_NAME_MAX = 12

/** Trim, uppercase, and clamp to {@link PLAYER_NAME_MAX}. */
export function normalizePlayerName(name: string) {
  return name.trim().slice(0, PLAYER_NAME_MAX).toUpperCase()
}

const LAST_NAME_KEY = 'arcade-last-name'
const CLAIMS_KEY = 'arcade-name-claims'

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

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

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

function readClaims(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLAIMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k.toUpperCase()] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeClaims(claims: Record<string, string>) {
  try {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims))
  } catch {
    /* ignore */
  }
}

export function getClaimToken(name: string): string | null {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return null
  return readClaims()[cleaned] ?? null
}

export function rememberClaimToken(name: string, token: string) {
  const cleaned = normalizePlayerName(name)
  if (!cleaned || !token) return
  const claims = readClaims()
  claims[cleaned] = token
  writeClaims(claims)
}

export function forgetClaimToken(name: string) {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return
  const claims = readClaims()
  if (!(cleaned in claims)) return
  delete claims[cleaned]
  writeClaims(claims)
}

/** Move scores from every locally proven old tag onto the active gamer tag. */
export async function migrateLocalScoresToName(
  activeName: string,
  activeToken: string,
): Promise<void> {
  const cleaned = normalizePlayerName(activeName)
  if (!cleaned || !activeToken) return

  const claims = readClaims()
  for (const [name, token] of Object.entries(claims)) {
    if (name === cleaned || !token) continue
    try {
      await api<{ name: string }>('/names/rename', {
        method: 'POST',
        body: JSON.stringify({
          from: name,
          to: cleaned,
          fromToken: token,
          toToken: activeToken,
        }),
      })
      forgetClaimToken(name)
    } catch {
      /* not owned anymore / already migrated */
    }
  }

  try {
    const { syncJoinedTournamentRosters } = await import('./tournaments')
    await syncJoinedTournamentRosters()
  } catch {
    /* tournaments optional */
  }
}

export function getLastPlayerName(): string {
  try {
    return normalizePlayerName(localStorage.getItem(LAST_NAME_KEY) || '')
  } catch {
    return ''
  }
}

const PLAYER_NAME_EVENT = 'arcade-player-name'
export { PLAYER_NAME_EVENT }

function setLocalPlayerName(cleaned: string) {
  try {
    localStorage.setItem(LAST_NAME_KEY, cleaned)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PLAYER_NAME_EVENT))
  }
}

/** Persist display name locally and notify listeners (no server claim). */
export function setPlayerNameLocal(cleaned: string) {
  const name = normalizePlayerName(cleaned)
  if (!name) return
  setLocalPlayerName(name)
}

/** Persist name locally and claim it on the server (unique across players). */
export async function rememberPlayerName(name: string): Promise<string> {
  const cleaned = normalizePlayerName(name) || 'YOU'
  const previous = getLastPlayerName()
  const previousToken = previous ? getClaimToken(previous) : null
  const existingToken = getClaimToken(cleaned)

  const claim = await api<{ name: string; token: string }>('/names/claim', {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      ...(existingToken ? { token: existingToken } : {}),
    }),
  })

  rememberClaimToken(claim.name, claim.token)
  setLocalPlayerName(claim.name)

  if (previous && previous !== claim.name && previousToken) {
    try {
      await api('/names/rename', {
        method: 'POST',
        body: JSON.stringify({
          from: previous,
          to: claim.name,
          fromToken: previousToken,
          toToken: claim.token,
        }),
      })
      forgetClaimToken(previous)
    } catch {
      /* claim/rename race — heal below may still recover */
    }
  }

  await migrateLocalScoresToName(claim.name, claim.token)
  return claim.name
}

export function clearPlayerName() {
  try {
    localStorage.removeItem(LAST_NAME_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PLAYER_NAME_EVENT))
  }
}

export async function checkNameAvailable(name: string): Promise<boolean> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return false
  const token = getClaimToken(cleaned)
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  const data = await api<{ available: boolean }>(
    `/names/${encodeURIComponent(cleaned)}${q}`,
  )
  return data.available
}

export async function fetchNameAvatar(name: string): Promise<string | null> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return null
  try {
    const data = await api<{ avatarId?: string }>(
      `/names/${encodeURIComponent(cleaned)}`,
    )
    return data.avatarId ?? null
  } catch {
    return null
  }
}

export async function setPlayerAvatar(
  name: string,
  avatarId: string,
): Promise<string> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) throw new Error('Name required')
  const token = getClaimToken(cleaned)
  const data = await api<{ avatarId: string; token?: string }>(
    `/names/${encodeURIComponent(cleaned)}/avatar`,
    {
      method: 'PUT',
      body: JSON.stringify({
        avatarId,
        ...(token ? { token } : {}),
      }),
    },
  )
  if (data.token) rememberClaimToken(cleaned, data.token)
  return data.avatarId
}

export type YouEntry = LeaderboardEntry & { rank: number }

export async function getLeaderboard(
  slug: string,
  period: LeaderboardPeriod = 'all',
  name?: string,
): Promise<{ entries: LeaderboardEntry[]; you: YouEntry | null }> {
  const params = new URLSearchParams({ period })
  const cleaned = normalizePlayerName(name ?? '')
  if (cleaned) params.set('name', cleaned)
  const data = await api<{ entries: LeaderboardEntry[]; you?: YouEntry | null }>(
    `/leaderboards/${slug}?${params.toString()}`,
  )
  return { entries: data.entries ?? [], you: data.you ?? null }
}

export async function fetchTopScore(slug: string): Promise<number> {
  const { entries } = await getLeaderboard(slug, 'all')
  return entries[0]?.score ?? 0
}

export async function fetchPlayerBests(
  name: string,
): Promise<Record<string, number>> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return {}
  const data = await api<{ bests?: Record<string, number> }>(
    `/leaderboards/bests?name=${encodeURIComponent(cleaned)}`,
  )
  return data.bests ?? {}
}

export type GlobalGamePlace = {
  place: number
  points: number
}

export type GlobalRankNearby = {
  name: string
  rank: number
  score: number
  avatarId?: string
}

export type GlobalRankResult = {
  rank: number | null
  score: number
  totalPlayers: number
  byGame: Partial<Record<string, GlobalGamePlace>>
  nearby?: GlobalRankNearby[]
  avatarId?: string
}

export async function fetchGlobalRank(name: string): Promise<GlobalRankResult> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) {
    return { rank: null, score: 0, totalPlayers: 0, byGame: {}, nearby: [] }
  }
  return api<GlobalRankResult>(
    `/leaderboards/rank?name=${encodeURIComponent(cleaned)}`,
  )
}

export type GlobalBoardEntry = {
  name: string
  rank: number
  score: number
  games: number
  avatarId?: string
}

export type GlobalBoardResult = {
  totalPlayers: number
  entries: GlobalBoardEntry[]
}

/** All-time global points board (top 100). */
export async function fetchGlobalBoard(
  limit = 100,
): Promise<GlobalBoardResult> {
  const capped = Math.min(100, Math.max(1, Math.floor(limit)))
  const data = await api<GlobalBoardResult>(
    `/leaderboards/rank?limit=${encodeURIComponent(String(capped))}`,
  )
  return {
    totalPlayers: data.totalPlayers ?? 0,
    entries: data.entries ?? [],
  }
}

export type QualifiesResult = {
  qualifies: boolean
  rank: number | null
  ranks?: Partial<Record<LeaderboardPeriod, number>>
}

export async function checkQualifies(
  slug: string,
  score: number,
): Promise<QualifiesResult> {
  if (score <= 0) return { qualifies: false, rank: null }
  return api(`/leaderboards/${slug}/qualifies?score=${encodeURIComponent(String(score))}`)
}

export async function addLeaderboardScore(
  slug: string,
  name: string,
  score: number,
): Promise<{
  entries: LeaderboardEntry[]
  rank: number | null
  ranks?: Partial<Record<LeaderboardPeriod, number>>
}> {
  const cleaned = normalizePlayerName(name) || 'PLAYER'
  const token = getClaimToken(cleaned)
  const data = await api<{
    entries: LeaderboardEntry[]
    rank: number | null
    ranks?: Partial<Record<LeaderboardPeriod, number>>
    name?: string
    token?: string
  }>(`/leaderboards/${slug}`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      score,
      device: detectDeviceType(),
      ...(token ? { token } : {}),
    }),
  })

  const finalName = (data.name ?? cleaned).toUpperCase()
  if (data.token) rememberClaimToken(finalName, data.token)
  setLocalPlayerName(finalName)

  return { entries: data.entries, rank: data.rank, ranks: data.ranks }
}
