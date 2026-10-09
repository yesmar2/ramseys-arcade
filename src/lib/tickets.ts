import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from './leaderboard'

/*
 * Tickets: what the arcade pays out for playing (a saved run, the Daily, a
 * streak, the bug hunt), spent at the prize counter on looks. The API keeps
 * them by account and decides every payout; this is one shared copy of the
 * player's, for the header's chip, the counter and the studio, fetched once
 * and nudged along by what a save or a trade answers.
 */

/** Why tickets came in or went out, as the API names it: a record is a past Hot Lap track's or Ace Chase hole's, taken. */
/** Why tickets came or went (the API's tickets.ts). 'today': a Today streak's milestone (lib/today.ts); 'season': a pass level's (lib/season.ts); 'poll': Blip's question answered (lib/poll.ts). */
export type TicketReason = 'run' | 'best' | 'pickup' | 'first' | 'streak' | 'daily' | 'hunt' | 'top' | 'record' | 'grant' | 'trade' | 'today' | 'season' | 'poll'

/** A step on a game's ticket ladder: the board score that reaches it, what it pays, and how a daily says it. */
export type LadderStep = { at: number; tickets: number; label?: string }

/** What a run of a game pays below the first step, and the steps, lowest first (the API's ticketLadders.ts). */
export type TicketLadder = { base: number; baseLabel?: string; steps: LadderStep[] }

/** What a saved run paid, from the save's answer. */
export type RunTickets = {
  earned: number
  lines: { reason: TicketReason; amount: number }[]
  balance: number
  /** The step of its game's ladder the run reached, or null below the first, and the next one up. */
  reached: LadderStep | null
  next: LadderStep | null
  /** What a run below the first step pays, and how a daily says it. */
  base: number
  baseLabel?: string
  /** What the run's step is worth. A daily pays it once a day: what its runs already had today goes off it. */
  step: number
  paidBefore: number
  /** Tickets the day's cap held back. */
  capped: number
  /** Run tickets left today before the cap. */
  todayLeft: number
}

export type TicketsSummary = {
  balance: number
  earned: number
  today: { earned: number; runs: number; cap: number }
  goal: string | null
  owned: string[]
  recent: { amount: number; reason: TicketReason; game: string | null; at: number }[]
}

type Store = TicketsSummary & { loaded: boolean; loading: boolean; error: string | null }

const empty: Store = {
  balance: 0,
  earned: 0,
  today: { earned: 0, runs: 0, cap: 200 },
  goal: null,
  owned: [],
  recent: [],
  loaded: false,
  loading: false,
  error: null,
}

const EVENT = 'arcade-tickets'
const STALE_MS = 30_000

let snapshot: Store = empty
let fetchedAt = 0
let inFlight: Promise<void> | null = null

function emit(next: Store) {
  snapshot = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function getSnapshot() {
  return snapshot
}

function take(summary: TicketsSummary) {
  fetchedAt = Date.now()
  emit({ ...summary, loaded: true, loading: false, error: null })
}

export function refreshTickets(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (!force && snapshot.loaded && Date.now() - fetchedAt < STALE_MS) return Promise.resolve()
  emit({ ...snapshot, loading: true })
  inFlight = api<TicketsSummary>('/tickets')
    .then(take)
    .catch((err: unknown) => {
      emit({ ...snapshot, loaded: true, loading: false, error: err instanceof Error ? err.message : 'Could not load your tickets' })
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

let ownedFrom: string[] | null = null
let ownedSet: ReadonlySet<string> = new Set()

/** What the player owns now, prizes and skins, for code outside React (a game's skin, lib/skins.ts). */
export function ownedNow(): ReadonlySet<string> {
  if (ownedFrom !== snapshot.owned) {
    ownedFrom = snapshot.owned
    ownedSet = new Set(snapshot.owned)
  }
  return ownedSet
}

/** Hear when the player's tickets, and so what they own, change. */
export function subscribeTickets(onChange: () => void): () => void {
  return subscribe(onChange)
}

/** Forget them: on sign-out, they belong to nobody. */
export function resetTickets() {
  fetchedAt = 0
  emit({ ...empty })
}

/** A save or a find paid tickets: show the new balance now, and read the rest again soon. */
export function noteTicketsPaid(paid: { earned: number; balance: number } | null | undefined) {
  if (!paid) return
  emit({
    ...snapshot,
    balance: paid.balance,
    earned: snapshot.earned + paid.earned,
    today: { ...snapshot.today, earned: snapshot.today.earned + paid.earned },
  })
  fetchedAt = 0
}

/** Trade tickets for a prize. Throws the API's error (its code: NOT_ENOUGH_TICKETS, ALREADY_OWNED). */
export async function tradePrize(prize: string): Promise<void> {
  take(await api<TicketsSummary>('/tickets/trade', { method: 'POST', body: JSON.stringify({ prize }) }))
}

/** The prize to save for, or none. */
export async function setTicketGoal(prize: string | null): Promise<void> {
  const { goal } = await api<{ goal: string | null }>('/tickets/goal', { method: 'PUT', body: JSON.stringify({ prize }) })
  emit({ ...snapshot, goal })
}

/** The player's tickets, fetched while they're signed in. */
export function useTickets(): Store {
  const { signedIn } = useAuth()
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (!signedIn) {
      if (snapshot.loaded || snapshot.loading) resetTickets()
      return
    }
    void refreshTickets()
  }, [signedIn])
  return snap
}

/* ------------------------------------------------------------ ladders --- */

const LADDERS_KEY = 'skermix-ticket-ladders'
const LADDERS_EVENT = 'arcade-ticket-ladders'
/** The API draws them again once a day; a few hours on this device is fresh enough. */
const LADDERS_FRESH_MS = 6 * 3600_000

type LaddersCopy = { at: number; ladders: Record<string, TicketLadder> }

let ladders: LaddersCopy | null = null
let laddersRead = false
let askingLadders: Promise<void> | null = null

function laddersNow(): LaddersCopy | null {
  if (!laddersRead) {
    laddersRead = true
    try {
      const raw = localStorage.getItem(LADDERS_KEY)
      const parsed = raw ? (JSON.parse(raw) as Partial<LaddersCopy>) : null
      if (parsed && typeof parsed.at === 'number' && parsed.ladders && typeof parsed.ladders === 'object') {
        ladders = { at: parsed.at, ladders: parsed.ladders }
      }
    } catch {
      // Asked for again below.
    }
  }
  return ladders
}

function askLadders() {
  if (askingLadders) return
  askingLadders = api<{ ladders: Record<string, TicketLadder> }>('/tickets/ladders')
    .then((reply) => {
      ladders = { at: Date.now(), ladders: reply.ladders }
      try {
        localStorage.setItem(LADDERS_KEY, JSON.stringify(ladders))
      } catch {
        // Kept for this visit.
      }
      window.dispatchEvent(new Event(LADDERS_EVENT))
    })
    .catch(() => {
      // How to play goes without its tickets until the next ask.
    })
    .finally(() => {
      askingLadders = null
    })
}

function subscribeLadders(onChange: () => void) {
  window.addEventListener(LADDERS_EVENT, onChange)
  return () => window.removeEventListener(LADDERS_EVENT, onChange)
}

/** What a run of this game pays, step by step, as the API has it: kept on the device, asked for again every few hours. */
export function useTicketLadder(slug: string): TicketLadder | null {
  const copy = useSyncExternalStore(subscribeLadders, laddersNow, () => null)
  useEffect(() => {
    const now = laddersNow()
    if (!now || Date.now() - now.at > LADDERS_FRESH_MS) askLadders()
  }, [])
  return copy?.ladders[slug] ?? null
}

/** How a count of tickets reads: 1,284 tickets, 1 ticket. */
export function ticketWords(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'ticket' : 'tickets'}`
}
