import { useEffect, useSyncExternalStore } from 'react'
import { api } from './leaderboard'
import { BLIP_SKINS, type Skin } from './skins'
import { refreshTickets } from './tickets'

/*
 * Blip's question of the day (the API's poll.ts): one store for the home page's card (BlipPoll.tsx) and Blip's
 * hello (BlipHello.tsx), asked for once per session token, so signing in or out asks again.
 */

export type PollQuestion = { n: number; day: string; q: string; options: string[]; edited: boolean }
export type PollCounts = { counts: number[]; total: number }
export type PollToday = PollQuestion & { pick: number | null } & Partial<PollCounts>
export type PollView = {
  today: PollToday | null
  yesterday: (PollQuestion & PollCounts) | null
  tomorrow: string | null
  tickets: number
  /** How many of his questions the player has answered, ever, toward Blip's set; null for a visitor. */
  answers?: number | null
}

type State = {
  view: PollView | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  who: string | null
  earned: number
  /** The skin of Blip's set the last answer here won (lib/skins.ts BLIP_SKINS), to show it off. */
  won: string | null
}

let state: State = { view: null, status: 'idle', who: null, earned: 0, won: null }
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function session(): string {
  try {
    return localStorage.getItem('arcade-session') ?? ''
  } catch {
    return ''
  }
}

/** Ask for today's question, unless it's already here for this session. */
export function loadPoll(force = false) {
  const who = session()
  if (!force && state.who === who && (state.status === 'loading' || state.status === 'ready')) return
  set({ status: 'loading', who, earned: 0, won: null })
  api<PollView>('/poll')
    .then((view) => {
      if (state.who === who) set({ view, status: 'ready' })
    })
    .catch(() => {
      if (state.who === who) set({ status: 'error' })
    })
}

/** Answer today's question: what it paid (0 if it was answered already). Throws the API's error. */
export async function answerPoll(pick: number): Promise<number> {
  const view = await api<PollView & { earned: number; won?: string | null }>('/poll', { method: 'POST', body: JSON.stringify({ pick }) })
  set({ view, status: 'ready', earned: view.earned, won: view.won ?? null })
  if (view.earned > 0) void refreshTickets(true)
  return view.earned
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Today's question, for this session; `signedIn` asks again when it changes. */
export function usePoll(signedIn: boolean): State {
  const now = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    loadPoll()
  }, [signedIn])
  return now
}

/**
 * Blip's set from a player's answers: how many of its skins they've won (one every 7, lib/skins.ts BLIP_SKINS),
 * the next one, and how many answers more it takes.
 */
export function blipSet(answers: number): { won: number; next: Skin | null; more: number } {
  const next = BLIP_SKINS.find((s) => (s.poll ?? 0) > answers) ?? null
  return { won: BLIP_SKINS.filter((s) => (s.poll ?? 0) <= answers).length, next, more: next ? (next.poll ?? 0) - answers : 0 }
}

/** Opens Blip's question where the player is (BlipHello.tsx listens): from a skin of his set still to win. */
export const OPEN_BLIP_EVENT = 'arcade-open-blip'

export function openBlipPoll() {
  window.dispatchEvent(new Event(OPEN_BLIP_EVENT))
}

/** "38%": a share of the answers, rounded. */
export function share(count: number, total: number): string {
  return `${total ? Math.round((count * 100) / total) : 0}%`
}
