import { useEffect, useState } from 'react'
import { applyBoardScope, withGroupFallback } from '../lib/groups'
import { api, fetchGlobalBoard, type LeaderboardPeriod } from '../lib/leaderboard'
import type { RankDay, Standing } from '../lib/rankHow'

/*
 * What How your rank works (pages/RankHowPage.tsx) loads beyond the boards page's feed (useScoreboard):
 * each daily's days with the player's place and points on each, and the standings just above them,
 * which the ways up are measured against.
 */

/** How far up the standings the ways up look: a run is worth at most 100, so this is plenty. */
const ABOVE = 100

/** The standings above a place, best first, from place `offset + 1`: null until they land; `failed` when they couldn't be loaded. */
export function useStandingsAbove(
  period: LeaderboardPeriod,
  rank: number | null,
  groupId: string | null,
): { entries: Standing[]; offset: number; failed: boolean } | null {
  const offset = rank != null ? Math.max(0, rank - 1 - ABOVE) : 0
  const limit = rank != null ? rank - 1 - offset : 0
  const key = `${groupId ?? ''}|${period}|${offset}|${limit}`
  // entries is null when the request failed, so a failure never reads as "nobody above".
  const [state, setState] = useState<{ key: string; entries: Standing[] | null } | null>(null)

  useEffect(() => {
    if (limit < 1) return
    let cancelled = false
    fetchGlobalBoard(limit, period, offset)
      .then((board): Standing[] | null => board.entries)
      .catch(() => null)
      .then((entries) => {
        if (!cancelled) setState({ key, entries })
      })
    return () => {
      cancelled = true
    }
  }, [key, limit, offset, period])

  if (rank == null) return null
  if (limit < 1) return { entries: [], offset: 0, failed: false }
  if (state?.key !== key) return null
  return { entries: state.entries ?? [], offset, failed: state.entries == null }
}

/**
 * Each daily's days with `name`'s result, place and day points, in the header's group. Null until
 * they've all landed; a daily whose days didn't load is null in the map.
 */
export function useDailyDays(slugs: string[], name: string, groupId: string | null): Record<string, RankDay[] | null> | null {
  const games = [...slugs].sort().join(',')
  const key = `${groupId ?? ''}|${name}|${games}`
  const [state, setState] = useState<{ key: string; days: Record<string, RankDay[] | null> } | null>(null)

  useEffect(() => {
    if (!name || !games) return
    let cancelled = false
    void Promise.all(
      games.split(',').map(async (slug) => {
        try {
          const reply = await withGroupFallback(() => {
            const params = applyBoardScope(new URLSearchParams({ name }), groupId)
            return api<{ days?: RankDay[] }>(`/leaderboards/${encodeURIComponent(slug)}/days?${params}`)
          })
          return [slug, reply.days ?? []] as const
        } catch {
          return [slug, null] as const
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setState({ key, days: Object.fromEntries(pairs) })
    })
    return () => {
      cancelled = true
    }
  }, [key, name, games, groupId])

  if (!name || !games) return {}
  return state?.key === key ? state.days : null
}
