import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useAdminState } from './admin'
import { dayBefore } from './archive'
import { boardDay } from './rankHow'

/*
 * Early access (Ramsey's picks, 2026-10-04: Plus as the Dailies + Seasons membership, and "7 days early for
 * the new games"). A new game with a Game.launchDay is everyone's from that day. In the week before it, Plus
 * members play it early, as practice; before that week, only admins. Its boards open to everyone together on
 * launch day: the API refuses its runs till then too (earlyAccess.ts there).
 */

/** How many days before launch Plus members play a new game: a week. */
export const EARLY_DAYS = 7

/** A new game's launch day, while it's still to come: null for any other game. */
export function launchDayOf(slug: string, today = boardDay()): string | null {
  const day = getGame(slug)?.launchDay
  return day && today < day ? day : null
}

/** The first day Plus members play a new game: a week before its launch day. */
export function earlyFrom(launch: string): string {
  let day = launch
  for (let i = 0; i < EARLY_DAYS; i++) day = dayBefore(day)
  return day
}

/**
 * Where a game stands before its launch: 'early' in the week before it (Plus members play it), 'soon' before
 * that week (admins only), null once it's launched, or for a game with no launch day.
 */
export function earlyStage(slug: string, today = boardDay()): 'soon' | 'early' | null {
  const launch = launchDayOf(slug, today)
  if (!launch) return null
  return today >= earlyFrom(launch) ? 'early' : 'soon'
}

/** Whether a game hasn't launched yet: its runs are practice, and nothing goes on its boards. */
export function beforeLaunch(slug: string, today = boardDay()): boolean {
  return launchDayOf(slug, today) !== null
}

/**
 * Whether this viewer may play a game before its launch: an admin any time; a Plus member in its early week.
 * Undefined until that's known.
 */
export function useEarlyOpen(stage: 'soon' | 'early' | null): boolean | undefined {
  const { isPlus, loading } = useAuth()
  const admin = useAdminState()
  if (admin === true || (isPlus && stage === 'early')) return true
  return loading || admin === undefined ? undefined : false
}
