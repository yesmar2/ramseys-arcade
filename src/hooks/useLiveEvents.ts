import { useEffect, useState } from 'react'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'

export type LiveEvents = {
  /** Running daily/weekly events you have not joined. */
  official: TournamentSummary[]
  /** Running events you are in, soonest deadline first. */
  mine: TournamentSummary[]
  loading: boolean
}

const EMPTY: LiveEvents = { official: [], mine: [], loading: true }

/*
 * The official line and your own events sit at opposite ends of the home page
 * but describe the same fetch, so it is shared rather than run twice. Short
 * TTL: this only needs to survive one render pass, not act as a real cache.
 */
const TTL = 15_000
let cached: { key: string; at: number; promise: Promise<Omit<LiveEvents, 'loading'>> } | null = null

function load(playerName: string): Promise<Omit<LiveEvents, 'loading'>> {
  const now = Date.now()
  if (cached && cached.key === playerName && now - cached.at < TTL) return cached.promise

  const promise = Promise.all([
    listTournaments().catch(() => [] as TournamentSummary[]),
    playerName
      ? listTournaments('joined', playerName).catch(() => [] as TournamentSummary[])
      : Promise.resolve([] as TournamentSummary[]),
  ]).then(([all, joined]) => {
    const active = all.filter((t) => t.status === 'active')
    const joinedIds = new Set(joined.map((t) => t.id))
    return {
      mine: active.filter((t) => joinedIds.has(t.id)).sort((a, b) => a.endsAt - b.endsAt),
      official: active
        .filter((t) => t.official && !joinedIds.has(t.id))
        // Daily first: it is the one that will be gone tomorrow.
        .sort((a, b) => {
          const rank = (t: TournamentSummary) => (t.cadence === 'daily' ? 0 : 1)
          return rank(a) - rank(b) || a.endsAt - b.endsAt
        }),
    }
  })

  cached = { key: playerName, at: now, promise }
  return promise
}

export function useLiveEvents(playerName: string): LiveEvents {
  const [state, setState] = useState<LiveEvents>(EMPTY)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    load(playerName)
      .then((next) => {
        if (!cancelled) setState({ ...next, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ official: [], mine: [], loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [playerName])

  return state
}
