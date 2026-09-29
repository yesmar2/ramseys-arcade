import { useEffect, useState } from 'react'
import type { PathPoint, Shot } from '../games/acechase/game'
import { currentAccountId, getSessionToken } from './auth'
import { dayProgress, type DailySolved } from './dailyHole'
import { claimableRun, ownerAccount, ownRun, SIGNED_OUT, subscribeViewer, type OwnedRuns, type Viewer } from './deviceRuns'
import { detectDeviceType } from './device'
import { api, getClaimToken, getLastPlayerName, normalizePlayerName } from './leaderboard'
import { noteTicketsPaid } from './tickets'

/*
 * Ace Chase's past holes (/games/acechase/play?hole=day:YYYY-MM-DD, from the archive). Every hole keeps a
 * board of its own for good (the API's holes.ts). On its day a hole is Today's Hole (dailyHole.ts); after
 * it, a player with no result on it yet can play it for one, as on its day: every try counts, whenever it's
 * played, and the first bullseye is the result. This device keeps the tries, so leaving and coming back
 * carries on the count, and tries from the hole's own day carry on too. Signed in, the result goes on the
 * hole's board under the device's tag; signed out, it's kept here, and whoever signs in can put it on the
 * board from the hole. A player with a result on the hole already, from its day or since, plays it again
 * as practice.
 *
 * As on Today's Hole, each run here is its player's (lib/deviceRuns.ts), one a hole for each: another
 * player on the same device never sees, carries on or sends one that isn't theirs.
 */

const SLUG = 'acechase'
const STORE_KEY = 'skermix-acechase-past-holes'
export const PAST_HOLE_EVENT = 'skermix-acechase-holes'
/** Runs kept on this device, the most lately played. */
const KEEP = 40

/** Where a past hole's play stands on this device. */
export type PastProgress = {
  tries: number
  shots: Shot[]
  /** The last few paths, so they're still on the green when the player comes back. */
  ghosts: PathPoint[][]
  power: number
  angle: number
  solved?: DailySolved
  /** The API has the result, or had one on this hole already. */
  sent?: boolean
  /** When it was last played here, for keeping the latest. */
  touched: number
}

/** Each hole's runs, by owner (lib/deviceRuns.ts). */
type Store = { v: 1; holes: Record<string, OwnedRuns<PastProgress>> }

/** Null when storage can't be read at all, so this visit's own copy stands in. */
function readStore(): Store | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Store> | null
    if (parsed?.v === 1 && parsed.holes && typeof parsed.holes === 'object') return { v: 1, holes: parsed.holes }
    return { v: 1, holes: {} }
  } catch {
    // A private window or full storage: the tries are kept for this visit.
    return null
  }
}

let store: Store | null = null
/** Storage didn't take the last write, so this visit's copy is the one to build on. */
let unkept = false

function current(): Store {
  store ??= readStore() ?? { v: 1, holes: {} }
  return store
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
  window.dispatchEvent(new Event(PAST_HOLE_EVENT))
}

/** The run a hole keeps under one stamp, exactly: an account's id, or SIGNED_OUT. */
function keptRun(day: string, owner: string): PastProgress | null {
  return current().holes[day]?.[owner] ?? null
}

/**
 * The viewer's own play at a past hole on this device (lib/deviceRuns.ts): what they've played since its
 * day, or else their tries from its own day, which carry on. Null if they haven't played it here, and
 * while the account signed in isn't known yet.
 */
export function pastProgress(day: string, viewer: Viewer): PastProgress | null {
  const kept = ownRun(current().holes[day], viewer)
  if (kept) return kept
  const onItsDay = dayProgress(day, viewer)
  if (!onItsDay || onItsDay.tries <= 0 || onItsDay.solved) return null
  return { tries: onItsDay.tries, shots: onItsDay.shots, ghosts: [], power: onItsDay.power, angle: onItsDay.angle, touched: 0 }
}

/** A past hole's play from signed out on this device, which the account signed in may take up at the hole. */
export function claimablePast(day: string, viewer: Viewer): PastProgress | null {
  return claimableRun(current().holes[day], viewer)
}

/** Whether the viewer has a result on a hole on this device: from its day, or since. */
export function solvedHere(day: string, viewer: Viewer): DailySolved | null {
  return dayProgress(day, viewer)?.solved ?? ownRun(current().holes[day], viewer)?.solved ?? null
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Change a hole's runs, and keep the latest KEEP runs: only the last few paths of each, to the centimetre. */
function keepRuns(day: string, change: (runs: OwnedRuns<PastProgress>) => OwnedRuns<PastProgress>) {
  // Read afresh: another tab may have kept another player's run since this one last looked.
  if (!unkept) store = readStore() ?? store
  const holes = { ...current().holes, [day]: change({ ...current().holes[day] }) }
  const runs: [string, string, PastProgress][] = []
  for (const [d, byOwner] of Object.entries(holes)) {
    for (const [owner, p] of Object.entries(byOwner)) if (p) runs.push([d, owner, p])
  }
  runs.sort((a, b) => b[2].touched - a[2].touched)
  const next: Store['holes'] = {}
  for (const [d, owner, p] of runs.slice(0, KEEP)) {
    next[d] = {
      ...next[d],
      [owner]: {
        ...p,
        shots: p.shots.slice(-30),
        ghosts: p.ghosts.slice(-3).map((g) => g.map(([x, y, z]) => [round2(x), round2(y), round2(z)] as PathPoint)),
      },
    }
  }
  writeStore({ v: 1, holes: next })
}

/** Keep where a past hole's play stands, under the stamp its run began with (lib/deviceRuns.ts). */
export function savePastProgress(day: string, owner: string, progress: Omit<PastProgress, 'touched'>) {
  keepRuns(day, (runs) => ({ ...runs, [owner]: { ...progress, touched: Date.now() } }))
}

/** Stamp a hole's run with another owner: the account that took it up. Whatever that account had there, it's this now. */
function restamp(day: string, from: string, to: string, run: PastProgress) {
  keepRuns(day, (runs) => {
    const next = { ...runs, [to]: run }
    if (from !== to) delete next[from]
    return next
  })
}

/**
 * Carry on a half-played past hole from signed out as the account signed in (its Carry on, at the hole):
 * it's theirs from here on. Only while they have no play of their own there.
 */
export function takeUpPast(day: string): boolean {
  const account = currentAccountId()
  const run = keptRun(day, SIGNED_OUT)
  if (typeof account !== 'string' || !run || run.solved || pastProgress(day, account)) return false
  restamp(day, SIGNED_OUT, account, run)
  return true
}

/* ------------------------------------------------------------ the API --- */

export type HoleFigure = { name: string; tries: number; avatarId?: string }

/** A hole's board, as the API has it. */
export type HoleBoard = {
  day: string
  n: number
  /** Past: a first result on it counts here. Today: it's Today's Hole. Ahead: only a trial. */
  state: 'past' | 'today' | 'ahead'
  players: number
  entries: HoleFigure[]
  you: { tries: number; place: number } | null
}

/** A hole that has had its day, for the archive: its record, how many have played it, and your result and place. */
export type HoleRecordRow = {
  n: number
  day: string
  players: number
  record: HoleFigure | null
  you: { tries: number; place: number } | null
}

/** What came of sending a result on a past hole. */
export type PastHoleResult = {
  day: string
  n: number
  name: string
  tries: number
  /** It went on the board: false when the player had a result on the hole already, which stands. */
  kept: boolean
  you: { tries: number; place: number } | null
  players: number
  record: { name: string; tries: number } | null
  tookRecord: boolean
  /** What taking the record paid, the first time this hole's was taken: the API's RECORD_TICKETS. */
  tickets?: { earned: number; balance: number }
}

/** The API lets a browser keep these a few seconds; asked again after a result is sent, they have to be fresh. */
const FRESH: RequestInit = { cache: 'no-cache' }

/** A hole's board, with `name`'s place on it. */
export function fetchHoleBoard(day: string, name: string): Promise<HoleBoard> {
  const who = normalizePlayerName(name)
  return api<HoleBoard>(`/holes/${SLUG}/${day}/board${who ? `?name=${encodeURIComponent(who)}` : ''}`, FRESH)
}

/** A hole's board, asked again when `version` changes. Null until it comes, or for no hole. */
export function useHoleBoard(day: string | null, name: string, version = 0): HoleBoard | null {
  const [board, setBoard] = useState<HoleBoard | null>(null)
  useEffect(() => {
    if (!day) return
    let live = true
    fetchHoleBoard(day, name)
      .then((b) => {
        if (live) setBoard(b)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [day, name, version])
  return day ? board : null
}

const HOLD_MS = 60_000
const held = new Map<string, { at: number; rows: HoleRecordRow[] }>()

/** Every hole that has had its day, the latest first, with `name`'s results: kept a minute. Null while it's asked. */
export function useHoleRecords(name: string): HoleRecordRow[] | null {
  const who = normalizePlayerName(name)
  const [answer, setAnswer] = useState<{ who: string; rows: HoleRecordRow[] } | null>(() => {
    const hit = held.get(who)
    return hit ? { who, rows: hit.rows } : null
  })
  useEffect(() => {
    const hit = held.get(who)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    api<{ holes: HoleRecordRow[] }>(`/holes/${SLUG}/records${who ? `?name=${encodeURIComponent(who)}` : ''}`, FRESH)
      .then((reply) => {
        held.set(who, { at: Date.now(), rows: reply.holes })
        if (live) setAnswer({ who, rows: reply.holes })
      })
      .catch(() => {
        if (live) setAnswer({ who, rows: [] })
      })
    return () => {
      live = false
    }
  }, [who])
  if (answer?.who === who) return answer.rows
  return held.get(who)?.rows ?? null
}

/** What the API said about each hole's result this visit, for its card: by the account it was sent as, and the hole. */
const answers = new Map<string, PastHoleResult>()

/** What the API said this visit about the viewer's result on a hole. */
export function pastHoleAnswer(day: string, viewer: Viewer): PastHoleResult | null {
  return typeof viewer === 'string' ? (answers.get(`${viewer}:${day}`) ?? null) : null
}

/** Results on their way, so asking twice sends once. */
const sending = new Map<string, Promise<PastHoleResult | null>>()

/**
 * Send a past hole's result as the account signed in, under the tag this device plays as: its own run
 * (stamped `owner`), or one played signed out that it's taking up (the hole's result card, up as they
 * sign in, or its "Put it on the hole's board"), which is stamped as theirs once it's on the board.
 * Another account's run waits for that account. Null when there's no tag, no sign-in yet, or the run
 * isn't this account's to send.
 */
export function sendPastResult(day: string, owner: string, solved: DailySolved): Promise<PastHoleResult | null> {
  const account = currentAccountId()
  if (typeof account !== 'string' || (owner !== account && owner !== SIGNED_OUT)) return Promise.resolve(null)
  const key = `${account}:${day}`
  const going = sending.get(key)
  if (going) return going
  const name = normalizePlayerName(getLastPlayerName())
  if (!name || !getSessionToken()) return Promise.resolve(null)
  const token = getClaimToken(name)
  const send = api<PastHoleResult>(`/holes/${SLUG}/${day}/results`, {
    method: 'POST',
    body: JSON.stringify({ name, tries: solved.tries, pattern: solved.pattern, device: detectDeviceType(), ...(token ? { token } : {}) }),
  })
    .then((reply) => {
      answers.set(key, reply)
      held.clear()
      noteTicketsPaid(reply.tickets)
      const p = keptRun(day, owner)
      // Only the same run. One taken up is theirs once it's on the board: with a result there already,
      // it stays as it was played.
      if (p?.solved?.at === solved.at && (owner === account || reply.kept)) restamp(day, owner, account, { ...p, sent: true })
      else window.dispatchEvent(new Event(PAST_HOLE_EVENT))
      return reply
    })
    .finally(() => sending.delete(key))
  sending.set(key, send)
  return send
}

/**
 * A past hole's first bullseye, kept on its run's owner's play for its card to send: the first one only,
 * and none after one of theirs on its day.
 */
export function markPastSolved(day: string, owner: string, solved: DailySolved): void {
  const p = keptRun(day, owner)
  if (!p || p.solved || dayProgress(day, ownerAccount(owner))?.solved) return
  savePastProgress(day, owner, { ...p, solved, sent: false })
}

/**
 * Send any past hole's result of the account signed in that this device has and the API hasn't: after a
 * sign-in, or on coming back. Only its own runs: one played signed out goes only from its hole.
 */
export async function syncPastHoles(): Promise<void> {
  const account = currentAccountId()
  if (typeof account !== 'string' || !getSessionToken()) return
  for (const [day, runs] of Object.entries(current().holes)) {
    const p = runs[account]
    if (!p?.solved || p.sent || currentAccountId() !== account) continue
    try {
      await sendPastResult(day, account, p.solved)
    } catch {
      // It catches up next time.
    }
  }
}

/** Listen for changes here or in another tab, and for signing in, out, or as someone else (which sends what's theirs). */
export function subscribePastHoles(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // A storage cleared all at once names no key.
    if (e.key != null && e.key !== STORE_KEY) return
    store = null
    onChange()
  }
  const onViewer = () => {
    onChange()
    void syncPastHoles().then(onChange)
  }
  window.addEventListener(PAST_HOLE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  const stopViewer = subscribeViewer(onViewer)
  return () => {
    window.removeEventListener(PAST_HOLE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    stopViewer()
  }
}
