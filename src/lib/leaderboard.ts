export type LeaderboardEntry = {
  id: string
  name: string
  score: number
  at: number
}

export const LEADERBOARD_GAMES = ['stacker', 'patriot', 'snake'] as const
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

function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  // On phones / LAN, hit the API on the same host the page was loaded from
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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `API error ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export function getLastPlayerName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) || ''
  } catch {
    return ''
  }
}

const PLAYER_NAME_EVENT = 'arcade-player-name'

export function rememberPlayerName(name: string) {
  const cleaned = name.trim().slice(0, 12).toUpperCase() || 'YOU'
  const previous = getLastPlayerName()
  try {
    localStorage.setItem(LAST_NAME_KEY, cleaned)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PLAYER_NAME_EVENT))
  }

  // Keep tournament identity in sync when the guest renames
  if (previous && previous !== cleaned) {
    void import('./tournaments')
      .then((m) => m.renameTournamentPlayer(previous, cleaned))
      .catch(() => {
        /* offline / API down — local name still updates */
      })
  }
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

function rememberName(name: string) {
  rememberPlayerName(name)
}

export async function getLeaderboard(
  slug: string,
  period: LeaderboardPeriod = 'all',
): Promise<LeaderboardEntry[]> {
  const data = await api<{ entries: LeaderboardEntry[] }>(
    `/leaderboards/${slug}?period=${encodeURIComponent(period)}`,
  )
  return data.entries ?? []
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
  const cleaned = name.trim().slice(0, 12) || 'Player'
  rememberName(cleaned)
  const data = await api<{
    entries: LeaderboardEntry[]
    rank: number | null
    ranks?: Partial<Record<LeaderboardPeriod, number>>
  }>(`/leaderboards/${slug}`, {
    method: 'POST',
    body: JSON.stringify({ name: cleaned, score }),
  })
  return { entries: data.entries, rank: data.rank, ranks: data.ranks }
}
