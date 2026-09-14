import { useEffect, useState } from 'react'
import { eventKind, listTournaments, type TournamentSummary } from '../lib/tournaments'

export type LiveEvents = {
  /** Every running daily/weekly event, joined or not. */
  official: TournamentSummary[]
  /** Every running event you are in, fixtures included. */
  mine: TournamentSummary[]
  /** Ids of everything you have joined, official fixtures included. */
  joinedIds: Set<string>
  loading: boolean
}

const EMPTY: LiveEvents = { official: [], mine: [], joinedIds: new Set(), loading: true }

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
    /*
     * A bracket reads as "upcoming" until its roster fills, so matching on
     * active alone drops a draw you have joined but that is still waiting for
     * players — exactly when you want to see how close it is to starting.
     */
    const active = all.filter(
      (t) => t.status === 'active' || (t.status === 'upcoming' && eventKind(t) === 'bracket'),
    )
    const joinedIds = new Set(joined.map((t) => t.id))
    return {
      joinedIds,
      // A joined fixture appears twice on purpose: named on the line up top
      // so daily and weekly always read as a pair, and again below the grid
      // with its clock and a way back in, like any event you are playing.
      mine: active.filter((t) => joinedIds.has(t.id)).sort((a, b) => a.endsAt - b.endsAt),
      official: active
        .filter((t) => t.official)
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
        if (!cancelled)
          setState({ official: [], mine: [], joinedIds: new Set(), loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [playerName])

  return state
}
