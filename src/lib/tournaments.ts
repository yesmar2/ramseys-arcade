import { isImpersonating } from './impersonate'
import { getClaimToken, getLastPlayerName, normalizePlayerName, rememberClaimToken, ApiError } from './leaderboard'

export type TournamentStatus = 'upcoming' | 'active' | 'ended'
export type TournamentCadence = 'daily' | 'weekly'
export type TournamentFormat =
  | 'open'
  | 'place-points'
  | 'attempt-limited'
  | 'single-run'
  | 'cumulative'
export type TournamentKind = 'scores' | 'bracket'

export const BRACKET_PLAYERS_MIN = 2
export const BRACKET_PLAYERS_MAX = 64

export function bracketDrawSize(n: number): number {
  const capped = Math.max(
    BRACKET_PLAYERS_MIN,
    Math.min(BRACKET_PLAYERS_MAX, Math.floor(n)),
  )
  return 2 ** Math.ceil(Math.log2(capped))
}

export type TournamentRules = {
  maxAttempts?: number
  maxPlayers?: number
  scoring?: 'best' | 'sum'
  unlimitedDuration?: boolean
  /** Bracket only: hours each open match may be played. */
  roundPlayHours?: number
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
  kind?: TournamentKind
  rules: TournamentRules
  private: boolean
  createdBy?: { accountId: string } | null
  visibility?: 'public' | 'private'
  status: TournamentStatus
  playerCount: number
  /** Bracket: soonest open-match play deadline. */
  nextDeadlineAt?: number | null
}

/** Games eligible for private hosted events (matches API). */
export const EVENT_GAMES = [
  'asteroids',
  'patriot',
  'snake',
  'pop',
  'stacker',
  'centroid',
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

export function eventKind(t: Pick<TournamentSummary, 'kind'>): TournamentKind {
  return t.kind === 'bracket' ? 'bracket' : 'scores'
}

export function formatRulesSummary(
  t: Pick<TournamentSummary, 'format' | 'rules' | 'games' | 'kind'>,
): string {
  if (eventKind(t) === 'bracket') {
    const n = t.rules.maxAttempts ?? 1
    const cap = t.rules.maxPlayers ?? 0
    const tries = n === 1 ? '1 attempt' : `${n} attempts`
    const roundH = t.rules.roundPlayHours
    const round =
      roundH == null
        ? null
        : roundH === 1
          ? '1h per round'
          : roundH < 24
            ? `${roundH}h per round`
            : roundH === 24
              ? '1 day per round'
              : `${roundH / 24} days per round`
    return `Single-elim bracket · ${cap || 'set'} players · ${tries} per match${round ? ` · ${round}` : ''}.`
  }
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

function remainingParts(endsAt: number, now: number) {
  const ms = endsAt - now
  if (ms <= 0) return null
  const totalSec = Math.floor(ms / 1000)
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    mins: Math.floor((totalSec % 3600) / 60),
    secs: totalSec % 60,
  }
}

/** Human countdown until endsAt (or "Ended"). */
export function formatEventCountdown(
  endsAt: number,
  now = Date.now(),
  unlimitedDuration = false,
): string {
  if (unlimitedDuration) return 'Until everyone finishes'
  const parts = remainingParts(endsAt, now)
  if (!parts) return 'Ended'
  const { days, hours, mins } = parts
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  if (mins > 0) return `${mins}m left`
  return 'Moments left'
}

/** Live ticker with seconds, e.g. `2d 04:12:33`. */
export function formatEventTicker(
  endsAt: number,
  now = Date.now(),
  unlimitedDuration = false,
): string {
  if (unlimitedDuration) return 'Open'
  const parts = remainingParts(endsAt, now)
  if (!parts) return 'Ended'
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(parts.hours)}:${pad(parts.mins)}:${pad(parts.secs)}`
  return parts.days > 0 ? `${parts.days}d ${clock}` : clock
}

export function eventDurationLabel(
  t: Pick<
    TournamentSummary,
    'rules' | 'startsAt' | 'endsAt' | 'status' | 'kind' | 'format' | 'nextDeadlineAt' | 'playerCount'
  >,
): string {
  if (eventKind(t) === 'bracket') {
    if (t.status === 'ended') return 'Ended'
    if (t.status === 'upcoming') return 'When full'
    const deadline = t.nextDeadlineAt
    if (deadline != null && deadline > 0) {
      return `Round ${formatEventCountdown(deadline)}`
    }
    return 'Round clocks arm when matches fill'
  }
  if (t.rules.unlimitedDuration) {
    return t.status === 'ended' ? 'Ended' : 'Until everyone finishes'
  }
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

export function maxPlayersLabel(rules: TournamentRules | undefined): string | null {
  const n = rules?.maxPlayers
  if (n == null || n <= 0) return null
  return `${n} player${n === 1 ? '' : 's'} max`
}

export function playerCountLabel(count: number): string {
  return String(count)
}

export function rosterLimitLabel(rules: TournamentRules | undefined): string {
  const n = rules?.maxPlayers
  if (n == null || n <= 0) return 'Open'
  return `${n} max`
}

/** Finite attempts per game, or null when the event is unlimited. */
export function attemptsPerGameMax(
  t: Pick<TournamentSummary, 'format' | 'rules' | 'kind'>,
): number | null {
  const n = t.rules.maxAttempts
  if (eventKind(t) === 'bracket') {
    if (n == null || n <= 0) return 1
    return n
  }
  if (t.format === 'open' || n == null || n <= 0) return null
  if (t.format === 'single-run' || n === 1) return 1
  return n
}

export function attemptsPerGameLabel(
  t: Pick<TournamentSummary, 'format' | 'rules' | 'kind'>,
): string {
  const n = attemptsPerGameMax(t)
  if (n == null) return 'Unlimited'
  if (eventKind(t) === 'bracket') return n === 1 ? '1 / match' : `${n} / match`
  return n === 1 ? '1 / game' : `${n} / game`
}

export function joinedRosterLabel(
  t: Pick<TournamentSummary, 'playerCount' | 'rules'>,
): string {
  const cap = t.rules.maxPlayers
  if (cap != null && cap > 0) return `${t.playerCount} of ${cap}`
  return playerCountLabel(t.playerCount)
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

export type PublicBracketSide = {
  id: string
  name: string
  score: number | null
  attemptsUsed: number
}

export type PublicBracketMatch = {
  id: string
  round: number
  slot: number
  winnerId: string | null
  playEndsAt?: number | null
  players: [PublicBracketSide | null, PublicBracketSide | null]
}

export type PublicBracket = {
  lockedAt: number
  matches: PublicBracketMatch[]
}

export type TournamentDetail = TournamentSummary & {
  players: { id: string; name: string; joinedAt: number }[]
  standings: StandingRow[]
  placePoints: Record<string, number>
  bracket?: PublicBracket | null
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
  /** 0 = unlimited roster size */
  maxPlayers: number
  /** Scores: overall length (0 = until finished). Bracket: ignored. */
  durationHours: number
  /** Bracket: hours to play each open match. */
  roundPlayHours?: number
  kind?: TournamentKind
}

export function seatsLeft(t: Pick<TournamentSummary, 'playerCount' | 'rules'>): number | null {
  const cap = t.rules.maxPlayers
  if (cap == null || cap <= 0) return null
  return Math.max(0, cap - t.playerCount)
}

export function yourOpenMatch(
  detail: TournamentDetail,
  displayName: string,
): PublicBracketMatch | null {
  const you = normalizePlayerName(displayName)
  if (!you || !detail.bracket) return null
  return (
    detail.bracket.matches.find((m) => {
      if (m.winnerId) return false
      return m.players.some((p) => p && normalizePlayerName(p.name) === you)
    }) ?? null
  )
}

export function matchOpponent(
  match: PublicBracketMatch,
  displayName: string,
): PublicBracketSide | null {
  const you = normalizePlayerName(displayName)
  const other = match.players.find((p) => p && normalizePlayerName(p.name) !== you)
  return other ?? null
}

export function bracketRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound) return 'Final'
  if (round === maxRound - 1) return 'Semifinals'
  if (round === maxRound - 2 && maxRound >= 3) return 'Quarterfinals'
  const remaining = 2 ** (maxRound - round + 1)
  return `Round of ${remaining}`
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

/** Drop local join state for an ended, inaccessible, or unknown event. */
export function forgetTournamentMembership(tournamentId: string) {
  if (!tournamentId) return
  try {
    const joined = getJoinedTournamentIds().filter((id) => id !== tournamentId)
    localStorage.setItem(JOINED_KEY, JSON.stringify(joined))
  } catch {
    /* ignore */
  }
  const playerIds = readPlayerIds()
  if (playerIds[tournamentId]) {
    delete playerIds[tournamentId]
    writePlayerIds(playerIds)
  }
  const invites = readInvites()
  if (invites[tournamentId]) {
    delete invites[tournamentId]
    writeInvites(invites)
  }
}

/** Remove player-id keys that are not in the joined list (no network). */
export function pruneOrphanTournamentIds() {
  const joined = new Set(getJoinedTournamentIds())
  const map = readPlayerIds()
  let dirty = false
  for (const id of Object.keys(map)) {
    if (!joined.has(id)) {
      delete map[id]
      dirty = true
    }
  }
  if (dirty) writePlayerIds(map)
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
  const playerId = isImpersonating() ? undefined : getTournamentPlayerId(id) ?? undefined
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
  if (result.token) rememberClaimToken(cleaned, result.token)
  return result
}

/**
 * After a gamer-tag change, rebind every locally joined tournament seat to the
 * current name so you don't have to join again.
 */
let lastRosterSyncAt = 0
let lastRosterSyncName = ''

export async function syncJoinedTournamentRosters(force = false): Promise<void> {
  const name = getLastPlayerName()
  if (!name) return

  pruneOrphanTournamentIds()

  const now = Date.now()
  if (!force && name === lastRosterSyncName && now - lastRosterSyncAt < 60_000) {
    return
  }
  lastRosterSyncAt = now
  lastRosterSyncName = name

  const cleaned = normalizePlayerName(name)
  for (const id of getJoinedTournamentIds()) {
    const invite = getTournamentInvite(id) ?? undefined
    try {
      const detail = await getTournament(id, { playerName: cleaned, invite })
      const byName = detail.players.find(
        (p) => normalizePlayerName(p.name) === cleaned,
      )
      if (byName) {
        rememberTournamentPlayer(id, byName.id)
        continue
      }

      // Acting as another tag must not rebind this device's stored seat.
      try {
        const raw = localStorage.getItem('arcade-impersonate')
        if (raw) {
          const parsed = JSON.parse(raw) as { name?: unknown }
          if (typeof parsed?.name === 'string' && parsed.name.trim()) continue
        }
      } catch {
        /* ignore */
      }

      const playerId = getTournamentPlayerId(id)
      const seat = playerId
        ? detail.players.find((p) => p.id === playerId)
        : undefined
      if (seat) {
        await joinTournament(id, cleaned)
        continue
      }

      if (detail.private && !invite) {
        forgetTournamentMembership(id)
        continue
      }

      if (detail.status === 'ended') {
        forgetTournamentMembership(id)
        continue
      }

      await joinTournament(id, cleaned)
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 404 || status === 403 || status === 410) {
        forgetTournamentMembership(id)
      }
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
    token?: string
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
  if (data.token) rememberClaimToken(cleaned, data.token)
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
