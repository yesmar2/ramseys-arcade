import { fetchPlayerBests, getLastPlayerName } from './leaderboard'

export type PersonalBestKind = 'first' | 'new' | 'tie' | 'short'

export type PersonalBestResult = {
  kind: PersonalBestKind
  headline: string | null
  detail: string | null
  gain: number | null
}

let cachedName = ''
let cachedBests: Record<string, number> = {}
let inflightRefresh: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribePersonalBests(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getPersonalBest(slug: string): number {
  const name = getLastPlayerName().trim().toUpperCase()
  if (!name || name !== cachedName) return 0
  return cachedBests[slug] ?? 0
}

export function rememberPersonalBest(slug: string, score: number) {
  const name = getLastPlayerName().trim().toUpperCase()
  if (!name || score <= 0) return
  if (cachedName !== name) {
    cachedName = name
    cachedBests = {}
  }
  cachedBests[slug] = Math.max(cachedBests[slug] ?? 0, score)
  emit()
}

export async function refreshPersonalBests() {
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    const name = getLastPlayerName().trim().toUpperCase()
    if (!name) {
      cachedName = ''
      cachedBests = {}
      emit()
      return
    }
    try {
      const bests = await fetchPlayerBests(name)
      cachedName = name
      cachedBests = bests
      emit()
    } catch {
      if (cachedName !== name) {
        cachedName = name
        cachedBests = {}
        emit()
      }
    }
  })().finally(() => {
    inflightRefresh = null
  })

  return inflightRefresh
}

export function describePersonalBest(
  score: number,
  previousBest: number,
): PersonalBestResult {
  if (previousBest <= 0) {
    if (score <= 0) {
      return { kind: 'first', headline: null, detail: 'Set a personal best', gain: null }
    }
    return { kind: 'first', headline: 'Personal best', detail: null, gain: null }
  }
  if (score > previousBest) {
    return {
      kind: 'new',
      headline: 'New personal best',
      detail: null,
      gain: score - previousBest,
    }
  }
  if (score === previousBest) {
    return { kind: 'tie', headline: null, detail: 'Tied your record', gain: null }
  }
  const gap = previousBest - score
  return {
    kind: 'short',
    headline: null,
    detail: `${gap} from your record`,
    gain: null,
  }
}

export function menuBestLine(best: number): string {
  return best > 0 ? `Break your record of ${best}` : 'Set a personal best'
}
