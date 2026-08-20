import { getClaimToken, getLastPlayerName, normalizePlayerName } from './leaderboard'

export type TournamentStatus = 'upcoming' | 'active' | 'ended'

export type TournamentSummary = {
  id: string
  title: string
  blurb: string
  games: string[]
  startsAt: number
  endsAt: number
  official: boolean
  status: TournamentStatus
  playerCount: number
}

export type StandingRow = {
  playerId: string
  name: string
  totalPoints: number
  gamesPlayed: number
  byGame: Record<string, { score: number | null; place: number | null; points: number }>
}

export type TournamentDetail = TournamentSummary & {
  players: { id: string; name: string; joinedAt: number }[]
  standings: StandingRow[]
  placePoints: Record<string, number>
}

const JOINED_KEY = 'arcade-tournaments-joined'

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

export function getJoinedTournamentIds(): string[] {
  try {
    const raw = localStorage.getItem(JOINED_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function rememberJoinedTournament(id: string) {
  try {
    const next = Array.from(new Set([...getJoinedTournamentIds(), id]))
    localStorage.setItem(JOINED_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  const data = await api<{ tournaments: TournamentSummary[] }>('/tournaments')
  return data.tournaments ?? []
}

export async function getTournament(id: string): Promise<TournamentDetail> {
  return api(`/tournaments/${id}`)
}

export async function renameTournamentPlayer(
  from: string,
  to: string,
  tokens: { fromToken?: string; toToken?: string } = {},
) {
  return api<{ from: string; to: string; updatedTournaments: string[] }>(
    '/tournaments/rename-player',
    {
      method: 'POST',
      body: JSON.stringify({ from, to, ...tokens }),
    },
  )
}

export async function joinTournament(
  id: string,
  name: string,
): Promise<{ tournament: TournamentDetail; player: { id: string; name: string } }> {
  const cleaned = normalizePlayerName(name)
  const token = getClaimToken(cleaned)
  const result = await api<{
    tournament: TournamentDetail
    player: { id: string; name: string }
    token?: string
  }>(`/tournaments/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      ...(token ? { token } : {}),
    }),
  })
  rememberJoinedTournament(id)
  return result
}

export async function getActiveTournamentsForGame(game: string): Promise<TournamentSummary[]> {
  const data = await api<{ tournaments: TournamentSummary[] }>(
    `/tournaments/active-for/${encodeURIComponent(game)}`,
  )
  return data.tournaments ?? []
}

export async function submitTournamentScore(
  id: string,
  name: string,
  game: string,
  score: number,
): Promise<{ improved: boolean; best: number }> {
  const cleaned = normalizePlayerName(name)
  const token = getClaimToken(cleaned)
  const data = await api<{ improved: boolean; best: number }>(`/tournaments/${id}/scores`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      game,
      score,
      ...(token ? { token } : {}),
    }),
  })
  rememberJoinedTournament(id)
  return data
}

/** Submit this score to every active tournament the local player has joined that includes the game. */
export async function submitScoreToJoinedTournaments(game: string, score: number) {
  const name = getLastPlayerName() || 'YOU'
  const joined = new Set(getJoinedTournamentIds())
  if (joined.size === 0) return []

  let active: TournamentSummary[] = []
  try {
    active = await getActiveTournamentsForGame(game)
  } catch {
    return []
  }

  const targets = active.filter((t) => joined.has(t.id))
  const results: { id: string; title: string; improved: boolean }[] = []
  for (const t of targets) {
    try {
      const r = await submitTournamentScore(t.id, name, game, score)
      results.push({ id: t.id, title: t.title, improved: r.improved })
    } catch {
      /* skip */
    }
  }
  return results
}
