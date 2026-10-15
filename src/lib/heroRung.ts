import { useEffect, useMemo, useState } from 'react'
import { isDailyGame } from '../data/games'
import { useActiveGroup } from './groups'
import { getPlayerBoard, type LeaderboardPeriod } from './leaderboard'

/*
 * Your rung on a game's board, for the home page's chase (HomeUpNext.tsx): your place, the player just above you,
 * and the ones behind, as the API counts them (getPlayerBoard). One small ask, however deep you are.
 */

/** One player on a game's board: their best, and their place among its players. */
export type Place = { name: string; score: number; place: number }

/**
 * Your best on the game, all time, with the player just above you and the one just behind; on top of the board,
 * also the player after that, so there are still three to draw.
 */
export type Rung = { you: Place; above: Place | null; below: Place | null; third?: Place | null }

/*
 * Passing the player above you passes anyone tied with them too, so the place you're after is the first of those
 * (its nextPlace).
 */
export async function fetchRung(slug: string, name: string): Promise<Rung | null> {
  // A daily's all time is its day points (leaderboardFormat isDayPointsBoard): its next place up is today's.
  const board: LeaderboardPeriod = isDailyGame(slug) ? 'daily' : 'all'
  const b = await getPlayerBoard(slug, board, name, { limit: 1, around: 2 })
  if (!b.you) return null
  const at = (place: number) => b.around.find((p) => p.place === place)
  const place = (p: { name: string; score: number; place: number } | undefined): Place | null =>
    p ? { name: p.name, score: p.score, place: p.place } : null
  const over = at(b.you.place - 1)
  return {
    you: place(b.you)!,
    above: over ? { name: over.name, score: over.score, place: b.nextPlace ?? over.place } : null,
    below: place(at(b.you.place + 1)),
    third: place(at(b.you.place + 2)),
  }
}

/*
 * The last rungs this device saw, one per player, game and group, so a returning player's chase opens on theirs
 * instead of a shimmer while the board is asked again. One kept before places were counted as players carries a
 * run's rank instead, and is passed over.
 */
const RUNGS_KEY = 'skermix-hero-rungs'
const RUNGS_KEPT = 12

function isRung(value: unknown): value is Rung {
  const you = (value as Rung | null)?.you
  return typeof you?.score === 'number' && typeof you.place === 'number'
}

function readRungs(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNGS_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rememberedRung(key: string): Rung | null {
  const rung = readRungs()[key]
  return isRung(rung) ? rung : null
}

function rememberRung(key: string, rung: Rung | null) {
  try {
    const rungs = readRungs()
    // Re-adding moves the key to the end, so the oldest fall off first.
    delete rungs[key]
    if (rung) rungs[key] = rung
    const kept = Object.keys(rungs).slice(-RUNGS_KEPT)
    localStorage.setItem(RUNGS_KEY, JSON.stringify(Object.fromEntries(kept.map((k) => [k, rungs[k]]))))
  } catch {
    /* ignore */
  }
}

/**
 * Your rung on a game's board, for the active group: what the device remembered at once, then the board's own.
 * `loading` while there's neither yet; `rung` null once the board says you're not on it (or there's no player).
 */
export function useRung(slug: string | null, name: string): { rung: Rung | null; loading: boolean } {
  const groupId = useActiveGroup()
  const key = name && slug ? `${groupId ?? ''}|${name}|${slug}` : ''
  const [fetched, setFetched] = useState<{ key: string; rung: Rung | null } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const remembered = useMemo(() => (key ? rememberedRung(key) : null), [key])

  useEffect(() => {
    if (!key || !slug) return
    let cancelled = false
    fetchRung(slug, name)
      .then((next) => {
        if (cancelled) return
        setFetched({ key, rung: next })
        rememberRung(key, next)
      })
      .catch(() => {
        // Keep what the device remembered; with nothing, stop waiting.
        if (!cancelled) setFailed(key)
      })
    return () => {
      cancelled = true
    }
  }, [key, slug, name])

  if (!key) return { rung: null, loading: false }
  if (fetched?.key === key) return { rung: fetched.rung, loading: false }
  return { rung: remembered, loading: !remembered && failed !== key }
}

/*
 * The three to draw, in score order: the top on the right, the middle, and whoever is furthest back on the left.
 * Chasing, you're the middle, between the place you're after and the player behind you. On top of the board,
 * you're the top, with second and third behind you.
 */
export type Slots = { hi: Place; mid: Place; lo: Place | null }

export function slots({ you, above, below, third }: Rung): Slots | null {
  if (above) return { hi: above, mid: you, lo: below }
  // Alone on the board, there is nobody to draw you against.
  return below ? { hi: you, mid: below, lo: third ?? null } : null
}
