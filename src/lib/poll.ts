import { useEffect, useSyncExternalStore } from 'react'
import { api } from './leaderboard'
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
}

type State = { view: PollView | null; status: 'idle' | 'loading' | 'ready' | 'error'; who: string | null; earned: number }

let state: State = { view: null, status: 'idle', who: null, earned: 0 }
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
  set({ status: 'loading', who, earned: 0 })
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
  const view = await api<PollView & { earned: number }>('/poll', { method: 'POST', body: JSON.stringify({ pick }) })
  set({ view, status: 'ready', earned: view.earned })
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

/** "38%": a share of the answers, rounded. */
export function share(count: number, total: number): string {
  return `${total ? Math.round((count * 100) / total) : 0}%`
}
