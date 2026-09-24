import type { AvatarPin, AvatarRing } from './avatars'
import { api, normalizePlayerName } from './leaderboard'

/*
 * What a tag has earned to wear, from the API (its `src/flair.ts` holds the
 * rules), and the words for how close it is to the rest.
 */

export type FlairState = {
  id: string
  earned: boolean
  /** A best place, a count or a number of days, depending on the item. */
  best: number | null
  record?: { game: string; label: string; rank: number } | null
}

export type Flair = { name: string; rings: FlairState[]; pins: FlairState[] }

export async function fetchFlair(name: string, fresh = false): Promise<Flair | null> {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return null
  try {
    return await api<Flair>(`/names/${encodeURIComponent(cleaned)}/flair${fresh ? '?fresh=1' : ''}`)
  } catch {
    return null
  }
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** A line under a ring or pin: what the player has, or how far off it is. */
export function flairNote(kind: 'ring' | 'pin', id: AvatarRing | AvatarPin, state: FlairState | undefined, wearing: boolean): string {
  if (!state) return ''
  if (state.earned) {
    if (id === 'welcome') return 'Yours from day one'
    return 'Yours'
  }
  if (wearing) return 'Yours from before'
  const best = state.best
  if (kind === 'ring') {
    switch (id) {
      case 'bronze':
      case 'silver':
      case 'gold':
        return best != null ? `Your best week: ${ordinal(best)}` : 'No week in the top ten yet'
      case 'record':
        return state.record ? `Your best: ${ordinal(state.record.rank)} on ${state.record.label}` : 'Not on a record book yet'
      case 'laurel':
        return 'No event won yet'
    }
  }
  switch (id) {
    case 'games':
      return `${best ?? 0} of 5 played`
    case 'streak':
      return `Your best: ${best ?? 0} ${best === 1 ? 'day' : 'days'}`
    case 'crown':
      return best != null ? `Your best month: ${ordinal(best)}` : 'No month in the top ten yet'
    case 'bugnet':
      return 'No full month of the bug hunt yet'
    default:
      return best != null ? `You're ${ordinal(best)} all time` : 'Not played yet'
  }
}
