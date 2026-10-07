import { applyBoardScope, storedActiveGroup, withGroupFallback } from './groups'
import { announceSecrets, type SecretFound } from './secrets'
import type { RunTickets } from './tickets'
import type { SeasonRun } from './season'
import { runIdFor } from './runSession'
import type { DeviceType } from './device'
import { isDailyGame, isGameListed, isRankedGame } from '../data/games'
import type { ChallengeRunResult } from './challenges'
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
  /** On a daily's board for longer than a day, where the score is day points: the days they came from. */
  days?: number
  /** The season skin the run was played in (lib/skins.ts), shown beside the name. */
  skin?: string
}

export const LEADERBOARD_GAMES = [
  'asteroids',
  'patriot',
  'snake',
  'crosswalk',
  'stacker',
  'centroid',
  'pop',
  'simon',
  'spotter',
  'pellets',
  'findbug',
  'barrage',
  'crumbtrail',
  'bop',
  'putt',
  'frenzy',
  'fireflies',
  'acechase',
  'hotlap',
  'halffull',
  'marblerun',
  'lander',
  'pileup',
  'swoop',
] as const
export type LeaderboardGame = (typeof LEADERBOARD_GAMES)[number]

/** Leaderboard games shown in boards UI (not hidden or on deck; their boards still take scores). */
export const VISIBLE_LEADERBOARD_GAMES = LEADERBOARD_GAMES.filter((slug) => isGameListed(slug))

/** The boards that place players: every listed game but the dailies just for fun (data/games.ts isRankedGame). */
export const RANKED_LEADERBOARD_GAMES = VISIBLE_LEADERBOARD_GAMES.filter((slug) => isRankedGame(slug))

export const LEADERBOARD_PERIODS = ['daily', 'weekly', 'monthly', 'all'] as const
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number]

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  all: 'All time',
}

/**
 * Flip on when daily boards have enough traffic.
 * Keep `daily` in {@link LEADERBOARD_PERIODS} / API; just hide it from UI.
 */
export const DAILY_PERIOD_ENABLED = false

/** Periods shown in switchers, dropdowns, and celebrations. */
export const VISIBLE_LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] =
  DAILY_PERIOD_ENABLED
    ? LEADERBOARD_PERIODS
    : LEADERBOARD_PERIODS.filter((p) => p !== 'daily')

/** Map a stored/routed period onto one that is currently offered in the UI. */
export function coerceVisiblePeriod(period: LeaderboardPeriod): LeaderboardPeriod {
  if (!DAILY_PERIOD_ENABLED && period === 'daily') return 'weekly'
  return period
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

const inflightGets = new Map<string, Promise<unknown>>()

function dedupeGet<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inflightGets.get(key)
  if (pending) return pending as Promise<T>
  const promise = run().finally(() => {
    if (inflightGets.get(key) === promise) inflightGets.delete(key)
  })
  inflightGets.set(key, promise)
  return promise
}

export class ApiError extends Error {
  status: number
  code?: string
  /** Set on a 402 PLAN_LIMIT: which allowance, and what it is. */
  limit?: string
  plan?: string
  allowed?: number | boolean

  constructor(
    message: string,
    status: number,
    code?: string,
    detail?: { limit?: string; plan?: string; allowed?: number | boolean },
  ) {
    super(message)
    this.status = status
    this.code = code
    this.limit = detail?.limit
    this.plan = detail?.plan
    this.allowed = detail?.allowed
  }
}

function isImpersonatingNow() {
  try {
    const raw = localStorage.getItem('arcade-impersonate')
    if (!raw) return false
    const parsed = JSON.parse(raw) as { name?: unknown }
    return typeof parsed?.name === 'string' && Boolean(parsed.name.trim())
  } catch {
    return false
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let sessionHeader: Record<string, string> = {}
  try {
    const session = localStorage.getItem('arcade-session')
    if (session) {
      sessionHeader = { Authorization: `Bearer ${session}` }
    }
  } catch {
    /* ignore */
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...sessionHeader,
      // The player's clock, for the time-of-day secrets (lib/secrets.ts): minutes behind UTC.
      ...(init?.method === 'POST' ? { 'X-TZ-Offset': String(new Date().getTimezoneOffset()) } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `API error ${res.status}`
    let code: string | undefined
    let detail: { limit?: string; plan?: string; allowed?: number | boolean } | undefined
    try {
      const body = (await res.json()) as {
        error?: string
        code?: string
        limit?: string
        plan?: string
        allowed?: number | boolean
      }
      if (body.error) message = body.error
      code = body.code
      if (body.limit) detail = { limit: body.limit, plan: body.plan, allowed: body.allowed }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code, detail)
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

/** Wipe every local claim token (logout / account switch). */
export function clearAllClaimTokens() {
  try {
    localStorage.removeItem(CLAIMS_KEY)
  } catch {
    /* ignore */
  }
}

/** Drop guest claim tokens that are not the active tag or an account-owned name. */
export function pruneOrphanClaims(ownedNames: string[] = []) {
  const active = normalizePlayerName(getLastPlayerName())
  const keep = new Set(ownedNames.map((n) => normalizePlayerName(n)).filter(Boolean))
  if (active) keep.add(active)
  if (keep.size === 0) return

  const claims = readClaims()
  let dirty = false
  for (const key of Object.keys(claims)) {
    if (!keep.has(key)) {
      delete claims[key]
      dirty = true
    }
  }
  if (dirty) writeClaims(claims)
}

/** Move scores from every locally proven old tag onto the active gamer tag. */
export async function migrateLocalScoresToName(
  activeName: string,
  activeToken: string,
): Promise<void> {
  const cleaned = normalizePlayerName(activeName)
  if (!cleaned || !activeToken) return

  const stale = Object.entries(readClaims()).filter(
    ([name, token]) => name !== cleaned && Boolean(token),
  )
  if (stale.length === 0) return

  for (const [name, token] of stale) {
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
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 400 || err.status === 403 || err.status === 404 || err.status === 409)
      ) {
        forgetClaimToken(name)
      }
    }
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
  let changed = false
  try {
    const prev = normalizePlayerName(localStorage.getItem(LAST_NAME_KEY) || '')
    if (prev === cleaned) return
    localStorage.setItem(LAST_NAME_KEY, cleaned)
    changed = true
  } catch {
    /* ignore */
  }
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PLAYER_NAME_EVENT))
  }
}

/** Persist display name locally and notify listeners (no server claim). */
export function setPlayerNameLocal(cleaned: string) {
  const name = normalizePlayerName(cleaned)
  if (!name) return
  setLocalPlayerName(name)
}

/** Forget the locally cached tag — e.g. a different account just signed in. */
export function clearPlayerNameLocal() {
  setLocalPlayerName('')
}

/** Persist name locally and claim it on the server (unique across players). */
export async function rememberPlayerName(name: string): Promise<string> {
  if (isImpersonatingNow()) {
    const current = normalizePlayerName(name) || getLastPlayerName()
    return current || 'YOU'
  }
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
  pruneOrphanClaims([claim.name])
  try {
    const { syncJoinedTournamentRosters } = await import('./tournaments')
    await syncJoinedTournamentRosters(true)
  } catch {
    /* tournaments optional */
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

/**
 * Your best on a board: `rank` is its place among the board's runs, `place`
 * yours among its players. An API from before places were sent leaves `place`
 * out, since the site and the API go live separately.
 */
export type YouEntry = LeaderboardEntry & { rank: number; place?: number }

export type GameBoardPreview = {
  slug: LeaderboardGame
  entries: LeaderboardEntry[]
}

/** @deprecated Use GameBoardPreview — summary is single-period now. */
export type GamePeriodSummary = {
  slug: LeaderboardGame
  byPeriod: Record<LeaderboardPeriod, { entries: LeaderboardEntry[] }>
}

export async function fetchLeaderboardsSummary(
  period: LeaderboardPeriod = 'all',
  limit = 3,
): Promise<GameBoardPreview[]> {
  const capped = Math.min(10, Math.max(1, Math.floor(limit)))
  const params = applyBoardScope(
    new URLSearchParams({
      limit: String(capped),
      period,
    }),
  )
  return dedupeGet(`summary:${params.toString()}`, () =>
    withGroupFallback(async () => {
      const scoped = applyBoardScope(
        new URLSearchParams({
          limit: String(capped),
          period,
        }),
      )
      const data = await api<{ games: GameBoardPreview[] }>(
        `/leaderboards/summary?${scoped.toString()}`,
      )
      return data.games ?? []
    }),
  )
}

export async function getLeaderboard(
  slug: string,
  period: LeaderboardPeriod = 'all',
  name?: string,
  page?: { offset?: number; limit?: number },
): Promise<{ entries: LeaderboardEntry[]; you: YouEntry | null; total: number }> {
  return withGroupFallback(async () => {
    const params = applyBoardScope(new URLSearchParams({ period }))
    const cleaned = normalizePlayerName(name ?? '')
    if (cleaned) params.set('name', cleaned)
    if (page?.offset) params.set('offset', String(Math.max(0, Math.floor(page.offset))))
    if (page?.limit) params.set('limit', String(Math.max(1, Math.floor(page.limit))))
    const data = await api<{
      entries: LeaderboardEntry[]
      you?: YouEntry | null
      total?: number
    }>(`/leaderboards/${slug}?${params.toString()}`)
    const entries = data.entries ?? []
    return {
      entries,
      you: data.you ?? null,
      // An API that predates paging sends no total: what came back is all of it.
      total: data.total ?? (page?.offset ?? 0) + entries.length,
    }
  })
}

/** One player on a board, as the API counts them: their best run, its place among the players, and their runs on it. */
export type PlayerBoardRow = LeaderboardEntry & { place: number; runs: number }

/**
 * A board as players, a page at a time (GET /leaderboards/:game?players=1): the API works out every
 * place, so a page shows any part of a board of any size. With `name`: their row, the players either side
 * (`around`), the place a run just better than the one above takes (`nextPlace`), the next band up (the
 * top 10, 100, 1,000 or half) with the score that gets in, and their runs on it. With `find`: up to ten
 * players whose tag holds it.
 */
export type PlayerBoard = {
  /** Players on the board. */
  total: number
  /** Runs on the board. */
  runs: number
  entries: PlayerBoardRow[]
  you: PlayerBoardRow | null
  around: PlayerBoardRow[]
  nextPlace: number | null
  band: { place: number; half: boolean; score: number } | null
  yourRuns: LeaderboardEntry[]
  found: PlayerBoardRow[]
  /** The rows at the places asked for (`marks`), each with the place a run just better than it takes. */
  marked: (PlayerBoardRow & { beatPlace: number })[]
  /** Where a run of the score asked for (`would`) would land now. */
  wouldPlace: number | null
}

export async function getPlayerBoard(
  slug: string,
  period: LeaderboardPeriod,
  name?: string,
  page?: { offset?: number; limit?: number; find?: string; around?: number; marks?: number[]; would?: number | null },
): Promise<PlayerBoard> {
  return withGroupFallback(async () => {
    const params = applyBoardScope(new URLSearchParams({ period, players: '1' }))
    const cleaned = normalizePlayerName(name ?? '')
    if (cleaned) params.set('name', cleaned)
    if (page?.offset) params.set('offset', String(Math.max(0, Math.floor(page.offset))))
    if (page?.limit) params.set('limit', String(Math.max(1, Math.floor(page.limit))))
    if (page?.find) params.set('find', page.find.trim().slice(0, 12))
    if (page?.around != null) params.set('around', String(page.around))
    if (page?.marks?.length) params.set('marks', page.marks.join(','))
    if (page?.would != null) params.set('would', String(page.would))
    const data = await api<Partial<PlayerBoard> & { entries?: PlayerBoardRow[] }>(`/leaderboards/${slug}?${params.toString()}`)
    return {
      total: data.total ?? 0,
      runs: data.runs ?? 0,
      entries: data.entries ?? [],
      you: data.you ?? null,
      around: data.around ?? [],
      nextPlace: data.nextPlace ?? null,
      band: data.band ?? null,
      yourRuns: data.yourRuns ?? [],
      found: data.found ?? [],
      marked: data.marked ?? [],
      wouldPlace: data.wouldPlace ?? null,
    }
  })
}

/** A player on a daily's board on one day: their run that counted, and their place among that day's players. */
export type DayBoardEntry = LeaderboardEntry & { place: number }

/**
 * A daily's board on one day (GET /leaderboards/:game?period=daily&day=): one row a player, in the order
 * the day's board had them. `counted` is false for a day before the daily's days counted toward rank;
 * `final` once the day is over. `total` is how many played it (in a group's view, how many of its members).
 */
export type DayBoard = {
  day: string
  counted: boolean
  final: boolean
  offset: number
  total: number
  entries: DayBoardEntry[]
  you: { score: number; place: number } | null
}

/**
 * A page of a daily's board on one day, with `name`'s place on it, in the group the boards are looking
 * at. Throws the API's error for a day it has no board for (DAY_AHEAD, BEFORE_FIRST_DAY, NOT_DAILY).
 */
export async function getDayBoard(
  slug: string,
  day: string,
  name?: string,
  page?: { offset?: number; limit?: number },
): Promise<DayBoard> {
  return withGroupFallback(async () => {
    const params = applyBoardScope(new URLSearchParams({ period: 'daily', day }))
    const cleaned = normalizePlayerName(name ?? '')
    if (cleaned) params.set('name', cleaned)
    if (page?.offset) params.set('offset', String(Math.max(0, Math.floor(page.offset))))
    if (page?.limit) params.set('limit', String(Math.max(1, Math.floor(page.limit))))
    const data = await api<Partial<DayBoard>>(`/leaderboards/${encodeURIComponent(slug)}?${params.toString()}`)
    // An API from before day boards answers with today's board, which isn't that day's.
    if (data.day !== day) throw new ApiError('No board for that day', 404, 'NO_DAY_BOARD')
    const entries = data.entries ?? []
    return {
      day,
      counted: data.counted !== false,
      final: data.final === true,
      offset: data.offset ?? page?.offset ?? 0,
      total: data.total ?? entries.length,
      entries,
      you: data.you ?? null,
    }
  })
}

export async function fetchTopScore(slug: string): Promise<number> {
  // A daily's best run is today's: its all-time board is day points, not a run (leaderboardFormat isDayPointsBoard).
  const { entries } = await getLeaderboard(slug, isDailyGame(slug) ? 'daily' : 'all')
  return entries[0]?.score ?? 0
}

export async function fetchPlayerBests(
  name: string,
  period: LeaderboardPeriod = 'all',
): Promise<Record<string, number>> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return {}
  return dedupeGet(
    `bests:${cleaned}:${period}:${storedActiveGroup() ?? 'everyone'}`,
    () =>
      withGroupFallback(async () => {
        const params = applyBoardScope(new URLSearchParams({ name: cleaned, period }))
        const data = await api<{ bests?: Record<string, number> }>(
          `/leaderboards/bests?${params}`,
        )
        return data.bests ?? {}
      }),
  )
}

export type GlobalGamePlace = {
  place: number
  points: number
  /** How many players are on that board for the period; older API builds leave it out. */
  total?: number
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

export async function fetchGlobalRank(
  name: string,
  period: LeaderboardPeriod = 'all',
): Promise<GlobalRankResult> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) {
    return { rank: null, score: 0, totalPlayers: 0, byGame: {}, nearby: [] }
  }
  return dedupeGet(`rank:${cleaned}:${period}:${storedActiveGroup() ?? 'everyone'}`, () =>
    withGroupFallback(async () => {
      const qs = applyBoardScope(new URLSearchParams({ name: cleaned }))
      if (period !== 'all') qs.set('period', period)
      return api<GlobalRankResult>(`/leaderboards/rank?${qs}`)
    }),
  )
}

export type GlobalBoardEntry = {
  name: string
  rank: number
  score: number
  games: number
  avatarId?: string
  /** The places behind the points; the standings send them, a cached row may not have them. */
  byGame?: Partial<Record<string, GlobalGamePlace>>
}

export type GlobalBoardResult = {
  totalPlayers: number
  entries: GlobalBoardEntry[]
}

/** Global points board for a period (top 100). */
export async function fetchGlobalBoard(
  limit = 100,
  period: LeaderboardPeriod = 'all',
  offset = 0,
): Promise<GlobalBoardResult> {
  const capped = Math.min(500, Math.max(1, Math.floor(limit)))
  const from = Math.max(0, Math.floor(offset))
  return dedupeGet(
    `rank-board:${capped}:${from}:${period}:${storedActiveGroup() ?? 'everyone'}`,
    () =>
      withGroupFallback(async () => {
        const qs = applyBoardScope(new URLSearchParams({ limit: String(capped) }))
        if (from) qs.set('offset', String(from))
        if (period !== 'all') qs.set('period', period)
        const data = await api<GlobalBoardResult>(`/leaderboards/rank?${qs}`)
        return {
          totalPlayers: data.totalPlayers ?? 0,
          entries: data.entries ?? [],
        }
      }),
  )
}

/** Up to ten players on the Standings whose tag holds `find`, each with its place (GET /leaderboards/rank?find=). */
export async function findInStandings(find: string, period: LeaderboardPeriod = 'all'): Promise<GlobalBoardEntry[]> {
  return withGroupFallback(async () => {
    const qs = applyBoardScope(new URLSearchParams({ find: find.trim().slice(0, 12) }))
    if (period !== 'all') qs.set('period', period)
    const data = await api<{ found?: GlobalBoardEntry[] }>(`/leaderboards/rank?${qs}`)
    return data.found ?? []
  })
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

/** A Half Full day as it's saved: the API works the score out from these, never from the figure sent. */
export type SavedPours = { day: string; levels: number[]; auto: boolean[] }

/** A Centroid day as it's saved: the day and its six taps; the API works the score out from these. */
export type SavedPlates = { day: string; taps: { x: number; y: number }[] }

export async function addLeaderboardScore(
  slug: string,
  name: string,
  score: number,
  opts: {
    /** A friend's challenge the run was played against. */
    challengeId?: string
    /** The run the score came from, asked for as it ended (see runIdFor). */
    run?: Promise<string | undefined>
    /** Prize tickets the run picked up on the way (Crosswalk's), paid with it. */
    pickups?: number
    /** Hot Lap: the day's blue car, in milliseconds, which its ticket ladder goes by. */
    pace?: number
    /** Half Full: the day and its five locked levels, which the API scores the day from. */
    pours?: SavedPours
    /** Centroid: the day and its six taps, which the API scores the day from. */
    plates?: SavedPlates
    /** The season skin the run was played in, which the API keeps if the player owns it. */
    skin?: string | null
  } = {},
): Promise<{
  entries: LeaderboardEntry[]
  /** What the run paid in tickets, when it was a timed run; null when it paid none. */
  tickets?: RunTickets | null
  /** What the run did on the season's pass, while a season is live (lib/season.ts). */
  season?: SeasonRun | null
  /** The run just saved, as it now stands on the boards. */
  entry?: LeaderboardEntry
  /** What came of the challenge, when the run was played against one. */
  challenge?: ChallengeRunResult | null
  rank: number | null
  ranks?: Partial<Record<LeaderboardPeriod, number>>
  previousBestRanks?: Partial<Record<LeaderboardPeriod, number>>
  bestRanks?: Partial<Record<LeaderboardPeriod, number>>
  streakRecords?: {
    recordId: string
    label: string
    value: number
    improved: boolean
    rank: number | null
    totalEntries: number
  }[]
}> {
  const cleaned = normalizePlayerName(name) || 'PLAYER'
  const token = getClaimToken(cleaned)
  // Undefined when the run could not be opened; the score still saves.
  const runId = await (opts.run ?? runIdFor(slug))
  const data = await api<{
    entries: LeaderboardEntry[]
    entry?: LeaderboardEntry
    challenge?: ChallengeRunResult | null
    rank: number | null
    ranks?: Partial<Record<LeaderboardPeriod, number>>
    previousBestRanks?: Partial<Record<LeaderboardPeriod, number>>
    bestRanks?: Partial<Record<LeaderboardPeriod, number>>
    streakRecords?: {
      recordId: string
      label: string
      value: number
      improved: boolean
      rank: number | null
      totalEntries: number
    }[]
    name?: string
    token?: string
    tickets?: RunTickets | null
    season?: SeasonRun | null
    secrets?: SecretFound[]
  }>(`/leaderboards/${slug}`, {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      score,
      device: detectDeviceType(),
      ...(token ? { token } : {}),
      ...(runId ? { runId } : {}),
      ...(opts.challengeId ? { challengeId: opts.challengeId } : {}),
      ...(opts.pickups ? { pickups: Math.floor(opts.pickups) } : {}),
      ...(opts.pace ? { pace: Math.round(opts.pace) } : {}),
      ...(opts.pours ? { pours: opts.pours } : {}),
      ...(opts.plates ? { plates: opts.plates } : {}),
      ...(opts.skin ? { skin: opts.skin } : {}),
    }),
  })

  const finalName = (data.name ?? cleaned).toUpperCase()
  if (data.token) rememberClaimToken(finalName, data.token)
  setLocalPlayerName(finalName)
  announceSecrets(data.secrets)

  return {
    entries: data.entries,
    tickets: data.tickets ?? null,
    season: data.season ?? null,
    entry: data.entry,
    challenge: data.challenge ?? null,
    rank: data.rank,
    ranks: data.ranks,
    previousBestRanks: data.previousBestRanks,
    bestRanks: data.bestRanks,
    streakRecords: data.streakRecords,
  }
}
