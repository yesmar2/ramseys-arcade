import { getLastPlayerName } from '../../lib/leaderboard'

/*
 * The fewest strokes a player has taken on each hole, kept on this device
 * under the name they last played as: the thing to beat next round. A round
 * that skipped ahead does not count, and neither does one with no name yet
 * — those go under a guest key so they still show, but never mix with a
 * named player's.
 */

const KEY = 'putt:hole-bests'

type Store = Record<string, Record<string, number>>

function who() {
  return getLastPlayerName().trim().toUpperCase() || 'guest'
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

/** Every hole's best for the current player, by hole name. */
export function loadHoleBests(): Record<string, number> {
  const mine = readStore()[who()]
  return mine && typeof mine === 'object' ? { ...mine } : {}
}

/** Keep `strokes` as the best on `hole` if it is one. Returns whether it was. */
export function recordHoleBest(hole: string, strokes: number): boolean {
  const store = readStore()
  const name = who()
  const mine = store[name] ?? {}
  const prev = mine[hole]
  if (prev !== undefined && strokes >= prev) return false
  mine[hole] = strokes
  store[name] = mine
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage that is full or blocked: the best still counts for this round.
  }
  return true
}
