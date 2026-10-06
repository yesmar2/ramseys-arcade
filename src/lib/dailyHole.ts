import { dailyHoleDef, dailyNumber, plannedPick, type DailyPick } from '../games/acechase/daily'
import { announceSecrets, type SecretFound } from './secrets'
import { DAILY_PLAN } from '../games/acechase/dailyPlan'
import type { PathPoint, Shot, ShotEnd } from '../games/acechase/game'
import type { HoleDef, Style } from '../games/acechase/physics'
import { currentAccountId, sessionFingerprint } from './auth'
import { claimableRun, ownRun, SIGNED_OUT, subscribeViewer, type OwnedRuns, type Viewer } from './deviceRuns'
import { detectDeviceType } from './device'
import { api } from './leaderboard'
import { noteTicketsPaid } from './tickets'
import { noteSeasonRun, type SeasonRun } from './season'

/*
 * Ace Chase's Today's Hole, for the site: which hole it is, what this device has done at it, and what the
 * API says about everyone's.
 *
 * Everyone gets the same hole, picked from the date on the boards' clock, and a new one comes at midnight
 * there. Every try counts, whenever it's played that day: the device keeps them, so closing the page and
 * coming back carries on the count. The first bullseye is the day's result. Signed in, it goes to the API,
 * which keeps one result a day for each account, first one kept, and puts it on Ace Chase's board under
 * the account's tag, paying its tickets (with no tag yet, as soon as there is one); signed out, the device
 * keeps it, and whoever signs in can put it on the board from Ace Chase that day.
 *
 * Each run on the device is its player's (lib/deviceRuns.ts): stamped with the account it began under, or
 * as played signed out. A day keeps one run for each, so another player on the same device never sees,
 * carries on or sends one that isn't theirs.
 */

const TZ = 'America/New_York'
const STORE_KEY = 'skermix-acechase-days'
/** Where the device kept its days before runs had owners: read, never written, so an older page still open can't upset either. */
const LEGACY_KEY = 'skermix-acechase-daily'
export const DAILY_EVENT = 'skermix-acechase-daily'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function dailyDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next hole comes. */
export function msUntilNextHole(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

export const PLACE_NAME: Record<Style, string> = { garden: 'a garden', ice: 'an ice rink', moon: 'the Moon' }
export const PLACE_EMOJI: Record<Style, string> = { garden: '⛳', ice: '🥌', moon: '🌙' }

export type TodaysHole = { day: string; n: number; pick: DailyPick; def: HoleDef }

/**
 * A day's hole. From the checked plan; past the end of the plan (it runs months ahead, so only if nobody
 * wrote more), an earlier day's hole comes round again rather than one nobody checked.
 */
export function todaysHole(day = dailyDay()): TodaysHole {
  const n = Math.max(1, dailyNumber(day))
  const pick = DAILY_PLAN[n - 1] ?? DAILY_PLAN[(n - 1) % DAILY_PLAN.length] ?? { ...plannedPick(n), k: 0 }
  return { day, n, pick, def: dailyHoleDef(pick, day) }
}

/* ------------------------------------------------------ this device --- */

export type DailySolved = { tries: number; at: number; pattern: string }

/** Where a day's play stands on this device. */
export type DayProgress = {
  tries: number
  shots: Shot[]
  /** Today's last few paths, so they're still on the green when the player comes back. */
  ghosts: PathPoint[][]
  power: number
  angle: number
  solved?: DailySolved
  /** The API has the result. */
  sent?: boolean
  /** What the result paid in tickets as it went on the board. */
  tickets?: number
}

/** Each day's runs, by owner (lib/deviceRuns.ts). */
type Store = { v: 1; days: Record<string, OwnedRuns<DayProgress>> }

/** Null when storage can't be read at all, so this visit's own copy stands in. */
function readStore(): Store | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Store>) : null
    if (parsed?.v === 1 && parsed.days && typeof parsed.days === 'object') return { v: 1, days: parsed.days }
    return { v: 1, days: {} }
  } catch {
    // A private window or full storage: today's tries are kept for this visit.
    return null
  }
}

/** The days as the device kept them before runs had owners: one run a day, whoever played it. */
function readLegacy(): Record<string, DayProgress> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    const parsed = raw ? (JSON.parse(raw) as { v?: number; days?: Record<string, DayProgress> }) : null
    if (parsed?.v === 1 && parsed.days && typeof parsed.days === 'object') return parsed.days
  } catch {
    // Nothing kept from before, then.
  }
  return {}
}

let store: Store | null = null
let legacy: Record<string, DayProgress> | null = null
/** Storage didn't take the last write, so this visit's copy is the one to build on. */
let unkept = false

function current(): Store {
  store ??= readStore() ?? { v: 1, days: {} }
  return store
}

function legacyDays(): Record<string, DayProgress> {
  legacy ??= readLegacy()
  return legacy
}

function writeStore(next: Store) {
  store = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    unkept = false
  } catch {
    // Kept in memory for this visit.
    unkept = true
  }
  window.dispatchEvent(new Event(DAILY_EVENT))
}

/**
 * The viewer's own run at a day's hole on this device (lib/deviceRuns.ts): the one stamped with their
 * account, or signed out, the one played signed out. Never another account's, nor one kept from before
 * runs had owners (adopt takes that up only when it's exactly the account's result on the board), nor,
 * signed in, one played signed out, which only Ace Chase itself offers to take up (claimableDay). Null
 * for none, and while the account signed in isn't known yet.
 */
export function dayProgress(day: string, viewer: Viewer): DayProgress | null {
  return ownRun(current().days[day], viewer)
}

/** A run at a day's hole played signed out on this device, which the account signed in may take up in Ace Chase. */
export function claimableDay(day: string, viewer: Viewer): DayProgress | null {
  return claimableRun(current().days[day], viewer)
}

/** The run a day keeps under one stamp, exactly: an account's id, or SIGNED_OUT. */
function keptRun(day: string, owner: string): DayProgress | null {
  return current().days[day]?.[owner] ?? null
}

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Change a day's runs, and keep the last fortnight: each run's last 30 shots, and only that day's paths,
 * rounded to the centimetre.
 */
function keepRuns(day: string, change: (runs: OwnedRuns<DayProgress>) => OwnedRuns<DayProgress>) {
  // Read afresh: another tab may have kept another player's run since this one last looked.
  if (!unkept) store = readStore() ?? store
  const days = { ...current().days, [day]: change({ ...current().days[day] }) }
  const next: Store['days'] = {}
  for (const d of Object.keys(days).sort().slice(-14)) {
    const runs: OwnedRuns<DayProgress> = {}
    for (const [owner, p] of Object.entries(days[d]!)) {
      if (!p) continue
      runs[owner] = {
        ...p,
        shots: p.shots.slice(-30),
        ghosts: d === day ? p.ghosts.slice(-3).map((g) => g.map(([x, y, z]) => [round2(x), round2(y), round2(z)] as PathPoint)) : [],
      }
    }
    next[d] = runs
  }
  writeStore({ v: 1, days: next })
}

/** Keep where a run's play at a day's hole stands, under the stamp it began with (lib/deviceRuns.ts). */
export function saveProgress(day: string, owner: string, progress: DayProgress) {
  keepRuns(day, (runs) => ({ ...runs, [owner]: progress }))
}

/** Stamp a day's run with another owner: the account that took it up. Whatever that account had there, it's this now. */
function restamp(day: string, from: string, to: string, run: DayProgress) {
  keepRuns(day, (runs) => {
    const next = { ...runs, [to]: run }
    if (from !== to) delete next[from]
    return next
  })
}

/**
 * Carry on a half-played run from signed out as the account signed in (its Carry on, in Ace Chase): it's
 * theirs from here on. Only while they have no run of their own that day, and no result on the board.
 */
export function takeUpDay(day: string): boolean {
  const account = currentAccountId()
  const run = keptRun(day, SIGNED_OUT)
  if (typeof account !== 'string' || !run || run.solved || keptRun(day, account)) return false
  const told = dailyServer()
  if (told?.day === day && told.you?.tries != null) return false
  restamp(day, SIGNED_OUT, account, run)
  return true
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10)
}

/* ---------------------------------------------------------- sharing --- */

const END_CODE: Record<ShotEnd, string> = { bull: 'b', inner: 'i', outer: 'o', near: 'n', off: 'x', lost: 'l' }
/**
 * Cold to hot, the way the tries closed in (Ramsey, 2026-10-06): far off red, near orange, the outer ring
 * yellow, the inner green, then the bullseye. A share tells the chase without the settings that won it.
 */
const CODE_EMOJI: Record<string, string> = { b: '🎯', i: '🟩', o: '🟨', n: '🟧', x: '🟥', l: '💧' }

/** A day's medal by its tries, as the racing dailies give theirs by time: gold in 1–2, silver in 3–4, bronze in 5–7. */
export type HoleMedal = 'gold' | 'silver' | 'bronze'
export const HOLE_MEDALS: readonly { medal: HoleMedal; most: number; emoji: string; name: string }[] = [
  { medal: 'gold', most: 2, emoji: '🥇', name: 'Gold' },
  { medal: 'silver', most: 4, emoji: '🥈', name: 'Silver' },
  { medal: 'bronze', most: 7, emoji: '🥉', name: 'Bronze' },
]

export function holeMedal(tries: number): (typeof HOLE_MEDALS)[number] | null {
  return tries > 0 ? (HOLE_MEDALS.find((m) => tries <= m.most) ?? null) : null
}

/** A day's tries as letters, one a try: the API keeps them, and the share line draws them. */
export function patternOf(shots: readonly Shot[]): string {
  return shots.map((s) => END_CODE[s.end] ?? 'x').join('')
}

/** What goes out when a player shares their day: no numbers, so it gives nothing away. */
export function shareText(hole: TodaysHole, tries: number, pattern: string): string {
  const marks = [...pattern].map((c) => CODE_EMOJI[c] ?? '⚪')
  const shown = marks.length > 24 ? [...marks.slice(0, 23), '…', marks[marks.length - 1]!] : marks
  return [
    `Ace Chase · Today's Hole #${hole.n} ${PLACE_EMOJI[hole.pick.style]}`,
    `${hole.def.name}: ${holeMedal(tries) ? `${holeMedal(tries)!.emoji} ` : ''}bullseye in ${tries} ${tries === 1 ? 'try' : 'tries'}`,
    shown.join(''),
  ].join('\n')
}

/* ------------------------------------------------------------ the API --- */

export type DailyEntry = { name: string; tries: number; at: number; avatarId?: string }

/** What the API says about a day: how everyone did, and, signed in, how you did. */
export type DailyServer = {
  day: string
  /** Players with a bullseye today. */
  solved: number
  /** Their tries on average, once there are some. */
  average: number | null
  /** How many took 1, 2 … 9 tries, and 10 or more. */
  spread: number[]
  /** Fewest tries, and first to it. */
  top: DailyEntry[]
  you?: {
    tries: number | null
    place: number | null
    streak: number
    /** The tag today's result is under on Ace Chase's board; null until the account has one. */
    tag?: string | null
    /** Today's result is on the board. */
    board?: boolean
    /** Today's result's tries, 'o' a miss and 'b' the bullseye (left out by an older API). */
    pattern?: string | null
  }
  /** What today's result paid as it went on the board, said once, by the reply that put it there. */
  tickets?: { earned: number; balance: number }
  /** What it did on the season's pass, said with the tickets (lib/season.ts). */
  season?: SeasonRun
}

let server: DailyServer | null = null
/** The session `server` was asked for (auth.ts's sessionFingerprint): its "you" is that session's, and no one else's. */
let serverFor: number | null = null

/** What the API says about today: how everyone did, and how you did only when it was asked as you. */
export function dailyServer(): DailyServer | null {
  if (!server || serverFor === sessionFingerprint()) return server
  return { ...server, you: undefined, tickets: undefined, season: undefined }
}

/** The API's word on today, asked as `session` and, as far as this device knew then, as `account`. */
function apply(reply: DailyServer, session: number | null, account: Viewer) {
  const mine = session === sessionFingerprint()
  // One asked for another session (signed in, out, or as someone else since) still says how everyone
  // did, but it never takes the place of this session's own.
  if (mine || serverFor !== sessionFingerprint()) {
    server = reply
    serverFor = session
  }
  // The tickets are said once: the header's count, and the day's cards (on the run of the account they
  // were paid to), keep them.
  if (mine && reply.season) noteSeasonRun(reply.season)
  if (mine && reply.tickets?.earned) {
    noteTicketsPaid(reply.tickets)
    const p = typeof account === 'string' ? keptRun(reply.day, account) : null
    if (p) saveProgress(reply.day, account!, { ...p, tickets: (p.tickets ?? 0) + reply.tickets.earned })
  }
  window.dispatchEvent(new Event(DAILY_EVENT))
}

/**
 * A run kept before runs had owners, taken as the account's own when it's exactly their result on today's
 * board, tries and every miss in order (the pattern; a count of tries alone is too often someone else's).
 * Never over a run of their own, and never before the API says the pattern.
 */
function adopt(reply: DailyServer, account: string) {
  const tries = reply.you?.tries
  const pattern = reply.you?.pattern
  const kept = legacyDays()[reply.day]
  if (tries == null || !pattern || !kept?.solved || kept.solved.tries !== tries || kept.solved.pattern !== pattern) return
  if (keptRun(reply.day, account)) return
  // What it paid went to whoever sent it, which this can't say.
  saveProgress(reply.day, account, { ...kept, sent: true, tickets: undefined })
}

const SYNC_EVERY_MS = 60_000
/** The last sync, and who it was for: another session, or the same one's account coming to be known, asks again at once. */
let synced: { for: number | null; as: Viewer; at: number } | null = null
let syncing: { for: number | null; as: Viewer; done: Promise<void> } | null = null

/**
 * Ask the API how today stands, and signed in, send up the account's own result this device has and the
 * API doesn't: today's, or yesterday's if it came in just before midnight. Only ever the account's own
 * run: never another account's, one kept before runs had owners, or one played signed out, which only
 * Ace Chase offers to take up (claimDay). Pages call this freely: once a minute at most.
 */
export function syncDaily(force = false): Promise<void> {
  const session = sessionFingerprint()
  // Whose results go up: the account signed in as this starts, and only while it still is.
  const account = currentAccountId()
  if (syncing && syncing.for === session && syncing.as === account) return syncing.done
  if (!force && synced && synced.for === session && synced.as === account && Date.now() - synced.at < SYNC_EVERY_MS) {
    return Promise.resolve()
  }
  synced = { for: session, as: account, at: Date.now() }
  const done: Promise<void> = (async () => {
    try {
      const reply = await api<DailyServer>('/daily-hole')
      apply(reply, session, account)
      if (typeof account !== 'string') return
      if (currentAccountId() !== account || sessionFingerprint() !== session) return
      adopt(reply, account)
      const today = dailyDay()
      for (const day of [previousDay(today), today]) {
        const p = keptRun(day, account)
        if (!p?.solved || p.sent || currentAccountId() !== account) continue
        await sendResult(day, account, p.solved, account)
      }
    } catch {
      // Today's Hole plays without the API; it catches up next time.
    }
  })().finally(() => {
    if (syncing?.done === done) syncing = null
  })
  syncing = { for: session, as: account, done }
  return done
}

/**
 * Send a run's bullseye as `account`, the account signed in now: its own run, or one played signed out
 * that it's taking up, stamped as theirs once the API has it. Only the same run is marked sent: one
 * played since (after a midnight, say) isn't this result.
 */
async function sendResult(day: string, owner: string, solved: DailySolved, account: string) {
  const session = sessionFingerprint()
  const reply = await api<DailyServer & { secrets?: SecretFound[] }>('/daily-hole/results', {
    method: 'POST',
    body: JSON.stringify({ day, tries: solved.tries, pattern: solved.pattern, device: detectDeviceType() }),
  })
  // Hole in One, on the first try (lib/secrets.ts).
  announceSecrets(reply.secrets)
  const p = keptRun(day, owner)
  if (p?.solved?.at === solved.at) restamp(day, owner, account, { ...p, sent: true })
  if (reply.day === dailyDay()) apply(reply, session, account)
}

/**
 * A run's bullseye, its owner's result for the day: kept on their run, and sent to the API while they're
 * the account signed in. Another account's waits for that account to sign in here again (syncDaily); one
 * played signed out waits to be taken up (claimDay).
 */
export function recordSolved(day: string, owner: string, solved: DailySolved) {
  const p = keptRun(day, owner)
  if (!p || p.solved) return
  saveProgress(day, owner, { ...p, solved, sent: false })
  if (owner !== SIGNED_OUT && currentAccountId() === owner) void sendResult(day, owner, solved, owner).catch(() => {})
}

/**
 * Put a finished run played signed out on the day's board as the account signed in: taken up in Ace Chase
 * only, by the player's own act ("Put it on today's board", or signing in with its result card up). Sent
 * only while that account has no result that day and no bullseye of its own here; once the API has it,
 * it's stamped as theirs. Says whether it went.
 */
export async function claimDay(day: string): Promise<boolean> {
  const account = currentAccountId()
  if (typeof account !== 'string') return false
  // How the account's day stands, asked afresh: the API keeps its first result, so with one already the
  // signed-out run can't be it.
  await syncDaily(true)
  const run = keptRun(day, SIGNED_OUT)
  if (currentAccountId() !== account || !run?.solved || run.sent || keptRun(day, account)?.solved) return false
  const told = dailyServer()
  if (told?.day === day && told.you?.tries != null) return false
  await sendResult(day, SIGNED_OUT, run.solved, account)
  return true
}

/**
 * The viewer's result on a day's hole: the API's word first (it keeps an account's first result, from
 * whichever device), else the bullseye of their own run here. Its tries' pattern only when their own run
 * here is that result.
 */
export function dayResult(progress: DayProgress | null, you: DailyServer['you']): { tries: number; pattern: string | null } | null {
  const own = progress?.solved ?? null
  const told = you?.tries ?? null
  if (told == null) return own ? { tries: own.tries, pattern: own.pattern } : null
  return { tries: told, pattern: own?.tries === told ? own.pattern : null }
}

/** Listen for changes here or in another tab, for what the API says, and for signing in, out, or as someone else. */
export function subscribeDaily(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // A storage cleared all at once names no key.
    if (e.key != null && e.key !== STORE_KEY && e.key !== LEGACY_KEY) return
    store = null
    legacy = null
    onChange()
  }
  // Another viewer: their own runs show, and their day is asked for at once (and their result sent, if it's waiting).
  const onViewer = () => {
    onChange()
    void syncDaily(true)
  }
  window.addEventListener(DAILY_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  const stopViewer = subscribeViewer(onViewer)
  return () => {
    window.removeEventListener(DAILY_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    stopViewer()
  }
}
