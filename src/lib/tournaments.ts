import { getClaimToken, getLastPlayerName, normalizePlayerName, ApiError } from './leaderboard'

export type TournamentStatus = 'upcoming' | 'active' | 'ended'
export type TournamentCadence = 'daily' | 'weekly'
export type TournamentFormat =
  | 'open'
  | 'place-points'
  | 'attempt-limited'
  | 'single-run'
  | 'cumulative'

export type TournamentRules = {
  maxAttempts?: number
  scoring?: 'best' | 'sum'
  unlimitedDuration?: boolean
}

export type TournamentSummary = {
  id: string
  title: string
  blurb: string
  games: string[]
  startsAt: number
  endsAt: number
  official: boolean
  cadence?: TournamentCadence | null
  format: TournamentFormat
  formatLabel: string
  rules: TournamentRules
  private: boolean
  createdBy?: { accountId: string } | null
  visibility?: 'public' | 'private'
  status: TournamentStatus
  playerCount: number
}

/** Games eligible for private hosted events (matches API). */
export const EVENT_GAMES = [
  'asteroids',
  'patriot',
  'snake',
  'pop',
  'stacker',
  'dead-center',
  'simon',
] as const
export type EventGame = (typeof EVENT_GAMES)[number]

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  open: 'Open · Best score',
  'place-points': 'Place points',
  'attempt-limited': 'Limited attempts',
  'single-run': 'One run only',
  cumulative: 'Total score',
}

export function formatRulesSummary(
  t: Pick<TournamentSummary, 'format' | 'rules' | 'games'>,
): string {
  if (t.format === 'place-points') {
    return t.games.length > 1
      ? 'Place points across games — highest total wins.'
      : 'Place points — highest total wins.'
  }
  const n = t.rules.maxAttempts
  const gameWord = t.games.length === 1 ? 'game' : 'games'
  if (t.format === 'open' || n === 0) {
    return `Unlimited attempts per ${gameWord} — best score wins.`
  }
  if (t.format === 'single-run' || n === 1) {
    return `1 attempt per ${gameWord} — best score wins.`
  }
  if (n) {
    return `${n} attempts per ${gameWord} — best score wins.`
  }
  return 'Best score wins.'
}

/** Human countdown until endsAt (or "Ended"). */
export function formatEventCountdown(
  endsAt: number,
  now = Date.now(),
  unlimitedDuration = false,
): string {
  if (unlimitedDuration) return 'No end'
  const ms = endsAt - now
  if (ms <= 0) return 'Ended'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  if (mins > 0) return `${mins}m left`
  return 'Moments left'
}

export function eventDurationLabel(
  t: Pick<TournamentSummary, 'rules' | 'startsAt' | 'endsAt' | 'status'>,
): string {
  if (t.rules.unlimitedDuration) return 'No end'
  if (t.status === 'active') return formatEventCountdown(t.endsAt)
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  try {
    return `${new Date(t.startsAt).toLocaleString(undefined, opts)} → ${new Date(t.endsAt).toLocaleString(undefined, opts)}`
  } catch {
    return ''
  }
}

export function isUnlimitedDuration(rules: TournamentRules | undefined): boolean {
  return Boolean(rules?.unlimitedDuration)
}

export function cadenceLabel(cadence: TournamentCadence | null | undefined): string | null {
  if (cadence === 'daily') return 'Daily'
  if (cadence === 'weekly') return 'Weekly'
  return null
}

export type StandingRow = {
  playerId: string
  name: string
  totalPoints: number
  gamesPlayed: number
  avatarId?: string
  byGame: Record<
    string,
    { score: number | null; place: number | null; points: number; attemptsUsed?: number }
  >
}

export type TournamentPlayerStatus = {
  attemptsUsed: number
  maxAttempts: number | null
  attemptsRemaining: number | null
  canPlay: boolean
  best: number | null
}

export type TournamentDetail = TournamentSummary & {
  players: { id: string; name: string; joinedAt: number }[]
  standings: StandingRow[]
  placePoints: Record<string, number>
  playerStatus?: TournamentPlayerStatus | null
  inviteCode?: string | null
  isHost?: boolean
}

export type CreateTournamentInput = {
  title: string
  blurb?: string
  games: EventGame[]
  /** 0 = unlimited attempts per game */
  maxAttempts: number
  /** 0 = unlimited duration */
  durationHours: number
}

const JOINED_KEY = 'arcade-tournaments-joined'
const PLAYER_IDS_KEY = 'arcade-tournaments-player-ids'
const INVITES_KEY = 'arcade-tournament-invites'

function readInvites(): Record<string, string> {
  try {
    const raw = localStorage.getItem(INVITES_KEY)
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

function writeInvites(map: Record<string, string>) {
  try {
    localStorage.setItem(INVITES_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function getTournamentInvite(tournamentId: string): string | null {
  return readInvites()[tournamentId] ?? null
}

export function rememberTournamentInvite(tournamentId: string, inviteCode: string) {
  if (!tournamentId || !inviteCode) return
  const map = readInvites()
  map[tournamentId] = inviteCode.trim().toUpperCase()
  writeInvites(map)
}

function tournamentAccessQuery(tournamentId: string, invite?: string) {
  const code = (invite ?? getTournamentInvite(tournamentId) ?? '').trim()
  return code ? { invite: code } : {}
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

export async function listTournaments(
  source: 'all' | 'official' | 'mine' | 'joined' = 'all',
  playerName?: string,
): Promise<TournamentSummary[]> {
  const params = new URLSearchParams()
  if (source !== 'all') params.set('source', source)
  if (source === 'joined' && playerName) params.set('playerName', playerName)
  const qs = params.toString()
  const data = await api<{ tournaments: TournamentSummary[] }>(
    `/tournaments${qs ? `?${qs}` : ''}`,
  )
  return data.tournaments ?? []
}

export async function getTournament(
  id: string,
  opts?: { playerName?: string; game?: string; invite?: string },
): Promise<TournamentDetail> {
  const params = new URLSearchParams()
  if (opts?.playerName) params.set('playerName', opts.playerName)
  if (opts?.game) params.set('game', opts.game)
  const invite = opts?.invite ?? getTournamentInvite(id)
  if (invite) params.set('invite', invite)
  const qs = params.toString()
  return api(`/tournaments/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`)
}

export async function createTournament(
  input: CreateTournamentInput,
): Promise<TournamentDetail> {
  const data = await api<{ tournament: TournamentDetail }>('/tournaments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.tournament
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
  const access = tournamentAccessQuery(id)
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
      ...access,
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
): Promise<{
  improved: boolean
  best: number
  attemptsUsed: number
  attemptsRemaining: number | null
  maxAttempts: number | null
}> {
  const cleaned = normalizePlayerName(name)
  const token = getClaimToken(cleaned)
  const data = await api<{
    improved: boolean
    best: number
    attemptsUsed: number
    attemptsRemaining: number | null
    maxAttempts: number | null
  }>(`/tournaments/${id}/scores`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      game,
      score,
      ...(token ? { token } : {}),
      ...tournamentAccessQuery(id),
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
