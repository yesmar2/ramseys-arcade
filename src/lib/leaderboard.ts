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
}

export const LEADERBOARD_GAMES = [
  'stacker',
  'patriot',
  'snake',
  'pop',
  'dead-center',
  'asteroids',
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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
  const cleaned = name.trim().slice(0, 12).toUpperCase()
  if (!cleaned) return null
  return readClaims()[cleaned] ?? null
}

export function rememberClaimToken(name: string, token: string) {
  const cleaned = name.trim().slice(0, 12).toUpperCase()
  if (!cleaned || !token) return
  const claims = readClaims()
  claims[cleaned] = token
  writeClaims(claims)
}

export function getLastPlayerName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) || ''
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

/** Persist name locally and claim it on the server (unique across players). */
export async function rememberPlayerName(name: string): Promise<string> {
  const cleaned = name.trim().slice(0, 12).toUpperCase() || 'YOU'
  const previous = getLastPlayerName()
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

  if (previous && previous !== claim.name) {
    void import('./tournaments')
      .then((m) =>
        m.renameTournamentPlayer(previous, claim.name, {
          fromToken: getClaimToken(previous) ?? undefined,
          toToken: claim.token,
        }),
      )
      .catch(() => {
        /* offline / API down — local name still updates */
      })
  }

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
  const cleaned = name.trim().slice(0, 12).toUpperCase()
  if (!cleaned) return false
  const token = getClaimToken(cleaned)
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  const data = await api<{ available: boolean }>(
    `/names/${encodeURIComponent(cleaned)}${q}`,
  )
  return data.available
}

export type YouEntry = LeaderboardEntry & { rank: number }

export async function getLeaderboard(
  slug: string,
  period: LeaderboardPeriod = 'all',
  name?: string,
): Promise<{ entries: LeaderboardEntry[]; you: YouEntry | null }> {
  const params = new URLSearchParams({ period })
  const cleaned = name?.trim().slice(0, 12).toUpperCase()
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
  const cleaned = name.trim().slice(0, 12).toUpperCase()
  if (!cleaned) return {}
  const data = await api<{ bests?: Record<string, number> }>(
    `/leaderboards/bests?name=${encodeURIComponent(cleaned)}`,
  )
  return data.bests ?? {}
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
  const cleaned = name.trim().slice(0, 12).toUpperCase() || 'PLAYER'
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
