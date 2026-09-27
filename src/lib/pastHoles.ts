import { useEffect, useState } from 'react'
import type { PathPoint, Shot } from '../games/acechase/game'
import { AUTH_EVENT, getSessionToken } from './auth'
import { dayProgress, type DailySolved } from './dailyHole'
import { detectDeviceType } from './device'
import { api, getClaimToken, getLastPlayerName, normalizePlayerName } from './leaderboard'
import { noteTicketsPaid } from './tickets'

/*
 * Ace Chase's past holes (/games/acechase/play?hole=day:YYYY-MM-DD, from the archive). Every hole keeps a
 * board of its own for good (the API's holes.ts). On its day a hole is Today's Hole (dailyHole.ts); after
 * it, a player with no result on it yet can play it for one, as on its day: every try counts, whenever it's
 * played, and the first bullseye is the result. This device keeps the tries, so leaving and coming back
 * carries on the count, and tries from the hole's own day carry on too. Signed in, the result goes on the
 * hole's board under the device's tag; signed out, it's kept here until a sign-in sends it. A player with a
 * result on the hole already, from its day or since, plays it again as practice.
 */

const SLUG = 'acechase'
const STORE_KEY = 'skermix-acechase-holes'
export const PAST_HOLE_EVENT = 'skermix-acechase-holes'
/** Holes kept on this device, the most lately played. */
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

type Store = { v: 1; holes: Record<string, PastProgress> }

let store: Store | null = null

function current(): Store {
  if (store) return store
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Store> | null
    if (parsed?.v === 1 && parsed.holes && typeof parsed.holes === 'object') store = { v: 1, holes: parsed.holes }
  } catch {
    // A private window or full storage: the tries are kept for this visit.
  }
  store ??= { v: 1, holes: {} }
  return store
}

function writeStore(next: Store) {
  store = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    // Kept in memory for this visit.
  }
  window.dispatchEvent(new Event(PAST_HOLE_EVENT))
}

/**
 * A past hole's play on this device: what's been played since its day, or else the tries from its own day,
 * which carry on. Null if it hasn't been played here.
 */
export function pastProgress(day: string): PastProgress | null {
  const kept = current().holes[day]
  if (kept) return kept
  const onItsDay = dayProgress(day)
  if (!onItsDay || onItsDay.tries <= 0 || onItsDay.solved) return null
  return { tries: onItsDay.tries, shots: onItsDay.shots, ghosts: [], power: onItsDay.power, angle: onItsDay.angle, touched: 0 }
}

/** Whether this device has a result on a hole: from its day, or since. */
export function solvedHere(day: string): DailySolved | null {
  return dayProgress(day)?.solved ?? current().holes[day]?.solved ?? null
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Keep where a past hole's play stands: the latest KEEP holes, and only the last few paths, to the centimetre. */
export function savePastProgress(day: string, progress: Omit<PastProgress, 'touched'>) {
  const holes = { ...current().holes, [day]: { ...progress, touched: Date.now() } }
  const keep = Object.entries(holes)
    .sort((a, b) => b[1].touched - a[1].touched)
    .slice(0, KEEP)
  const next: Record<string, PastProgress> = {}
  for (const [d, p] of keep) {
    next[d] = {
      ...p,
      shots: p.shots.slice(-30),
      ghosts: p.ghosts.slice(-3).map((g) => g.map(([x, y, z]) => [round2(x), round2(y), round2(z)] as PathPoint)),
    }
  }
  writeStore({ v: 1, holes: next })
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

/** What the API said about each hole's result this visit, for its card. */
const answers = new Map<string, PastHoleResult>()

export function pastHoleAnswer(day: string): PastHoleResult | null {
  return answers.get(day) ?? null
}

/** Results on their way, so asking twice sends once. */
const sending = new Map<string, Promise<PastHoleResult | null>>()

/** Send a past hole's result, under the tag this device plays as. Null when there's no tag or no sign-in yet. */
export function sendPastResult(day: string, solved: DailySolved): Promise<PastHoleResult | null> {
  const going = sending.get(day)
  if (going) return going
  const name = normalizePlayerName(getLastPlayerName())
  if (!name || !getSessionToken()) return Promise.resolve(null)
  const token = getClaimToken(name)
  const send = api<PastHoleResult>(`/holes/${SLUG}/${day}/results`, {
    method: 'POST',
    body: JSON.stringify({ name, tries: solved.tries, pattern: solved.pattern, device: detectDeviceType(), ...(token ? { token } : {}) }),
  })
    .then((reply) => {
      answers.set(day, reply)
      held.clear()
      noteTicketsPaid(reply.tickets)
      const p = current().holes[day]
      if (p) savePastProgress(day, { ...p, sent: true })
      else window.dispatchEvent(new Event(PAST_HOLE_EVENT))
      return reply
    })
    .finally(() => sending.delete(day))
  sending.set(day, send)
  return send
}

/** A past hole's first bullseye, kept here for its card to send: the first one only, and none after one on its day. */
export function markPastSolved(day: string, solved: DailySolved): void {
  const p = current().holes[day]
  if (!p || p.solved || dayProgress(day)?.solved) return
  savePastProgress(day, { ...p, solved, sent: false })
}

/** Send any past hole's result this device has and the API hasn't: after a sign-in, or on coming back. */
export async function syncPastHoles(): Promise<void> {
  if (!getSessionToken()) return
  for (const [day, p] of Object.entries(current().holes)) {
    if (!p.solved || p.sent) continue
    try {
      await sendPastResult(day, p.solved)
    } catch {
      // It catches up next time.
    }
  }
}

/** Listen for changes here or in another tab, and for signing in (which sends what's waiting). */
export function subscribePastHoles(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE_KEY) return
    store = null
    onChange()
  }
  const onAuth = () => {
    onChange()
    void syncPastHoles().then(onChange)
  }
  window.addEventListener(PAST_HOLE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  window.addEventListener(AUTH_EVENT, onAuth)
  return () => {
    window.removeEventListener(PAST_HOLE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(AUTH_EVENT, onAuth)
  }
}
