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
const PLAYER_IDS_KEY = 'arcade-tournaments-player-ids'

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

function readPlayerIds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PLAYER_IDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function writePlayerIds(map: Record<string, string>) {
  try {
    localStorage.setItem(PLAYER_IDS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function getTournamentPlayerId(tournamentId: string): string | null {
  return readPlayerIds()[tournamentId] ?? null
}

export function rememberTournamentPlayer(tournamentId: string, playerId: string) {
  if (!tournamentId || !playerId) return
  const map = readPlayerIds()
  map[tournamentId] = playerId
  writePlayerIds(map)
  rememberJoinedTournament(tournamentId)
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

export function isPlayerInTournament(
  detail: Pick<TournamentDetail, 'players'>,
  name: string,
  tournamentId?: string,
): boolean {
  const cleaned = normalizePlayerName(name)
  if (cleaned && detail.players.some((p) => normalizePlayerName(p.name) === cleaned)) {
    return true
  }
  if (!tournamentId) return false
  const playerId = getTournamentPlayerId(tournamentId)
  return Boolean(playerId && detail.players.some((p) => p.id === playerId))
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
  const playerId = getTournamentPlayerId(id) ?? undefined
  const result = await api<{
    tournament: TournamentDetail
    player: { id: string; name: string }
    token?: string
  }>(`/tournaments/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      ...(token ? { token } : {}),
      ...(playerId ? { playerId } : {}),
    }),
  })
  rememberTournamentPlayer(id, result.player.id)
  return result
}

/**
 * After a gamer-tag change, rebind every locally joined tournament seat to the
 * current name so you don't have to join again.
 */
export async function syncJoinedTournamentRosters(): Promise<void> {
  const name = getLastPlayerName()
  if (!name) return
  const ids = new Set([
    ...getJoinedTournamentIds(),
    ...Object.keys(readPlayerIds()),
  ])
  for (const id of ids) {
    try {
      const detail = await getTournament(id)
      const byName = detail.players.find((p) => normalizePlayerName(p.name) === name)
      if (byName) {
        rememberTournamentPlayer(id, byName.id)
        continue
      }
      const playerId = getTournamentPlayerId(id)
      if (!playerId && !getJoinedTournamentIds().includes(id)) continue
      // Rebind existing seat (or no-op join if somehow missing).
      await joinTournament(id, name)
    } catch {
      /* offline / ended / not found */
    }
  }
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
