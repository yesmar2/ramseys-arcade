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

/** Why tickets came in or went out, as the API names it. */
export type TicketReason = 'run' | 'best' | 'pickup' | 'first' | 'streak' | 'daily' | 'hunt' | 'grant' | 'trade'

/** What a saved run paid, from the save's answer. */
export type RunTickets = {
  earned: number
  lines: { reason: TicketReason; amount: number }[]
  balance: number
  /** The share of the week's board the run beat, 1–100. */
  beat: number
  /** Where the run placed among the week's players, and how many there are, the player among them. */
  place: number
  field: number
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

/** How a count of tickets reads: 1,284 tickets, 1 ticket. */
export function ticketWords(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'ticket' : 'tickets'}`
}
