import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useAdminState } from './admin'
import { boardDay } from './rankHow'

/*
 * Early access (Ramsey's pick, 2026-10-04: Plus as the Dailies + Seasons membership). A new game with a
 * Game.plusFirst day opens to Plus members first: they play it as practice, and its boards open to everyone
 * together on its day. The API refuses its runs till then too (earlyAccess.ts there).
 */

/** The day an early-access game opens to everyone, while it's still to come: null for any other game. */
export function plusFirstDay(slug: string, today = boardDay()): string | null {
  const day = getGame(slug)?.plusFirst
  return day && today < day ? day : null
}

/** Whether a game is in early access today: Plus plays it first, and nothing goes on its boards yet. */
export function inEarlyAccess(slug: string, today = boardDay()): boolean {
  return plusFirstDay(slug, today) !== null
}

/** Whether this viewer may play a game in early access: Plus, or an admin. Undefined until that's known. */
export function useEarlyOpen(): boolean | undefined {
  const { isPlus, loading } = useAuth()
  const admin = useAdminState()
  if (isPlus || admin === true) return true
  return loading || admin === undefined ? undefined : false
}
