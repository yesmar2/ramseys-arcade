export type TrophyPeriod = 'weekly' | 'monthly'

export type TrophyAward = {
  id: string
  period: TrophyPeriod
  periodKey: number
  name: string
  rank: number
  score: number
  games: number
  accountId?: string
  awardedAt: number
}

function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8787`
    }
  }
  return fromEnv || 'http://localhost:8787'
}

const API_BASE = resolveApiBase()

export function formatTrophyPeriod(period: TrophyPeriod, periodKey: number) {
  if (period === 'weekly') {
    const y = Math.floor(periodKey / 10_000)
    const m = Math.floor((periodKey % 10_000) / 100)
    const d = periodKey % 100
    const dt = new Date(y, m - 1, d)
    return `Week of ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  const y = Math.floor(periodKey / 100)
  const m = periodKey % 100
  const dt = new Date(y, m - 1, 1)
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function trophyRankLabel(rank: number) {
  if (rank === 1) return '#1 global'
  if (rank <= 3) return `#${rank} global`
  return `Top 10 · #${rank}`
}

export function summarizeTrophies(trophies: TrophyAward[]) {
  let podium = 0
  let topTen = 0
  for (const trophy of trophies) {
    if (trophy.rank <= 3) podium++
    else topTen++
  }
  return { total: trophies.length, podium, topTen }
}

export function sortTrophies(trophies: TrophyAward[]) {
  return [...trophies].sort(
    (a, b) => b.periodKey - a.periodKey || a.rank - b.rank,
  )
}

export async function fetchTrophies(name: string): Promise<TrophyAward[]> {
  const params = new URLSearchParams({ name })
  const res = await fetch(`${API_BASE}/trophies?${params}`)
  if (!res.ok) return []
  const body = (await res.json()) as { trophies?: TrophyAward[] }
  return Array.isArray(body.trophies) ? body.trophies : []
}
