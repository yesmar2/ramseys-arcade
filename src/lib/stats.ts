import { authHeaders } from './auth'
import type { AccountPlan } from './auth'

export type StatsHeadline = {
  runs: number
  days: number
  games: number
  firstPlayedAt: number | null
}

export type StatsStreak = {
  current: number
  best: number
  /** Day keys (YYYYMMDD) played, newest first. Empty on the free plan. */
  days: number[]
}

export type GameStat = {
  slug: string
  runs: number
  best: number
  rank: number | null
  totalPlayers: number
  /** Share of every run on this board that your best beats. */
  percentile: number
  average: number
  lastPlayedAt: number
  trend: { at: number; score: number }[]
}

export type NearRecord = {
  game: string
  recordId: string
  label: string
  unit: 'ms' | 'count'
  direction: 'higher' | 'lower'
  yourBest: number
  leader: number
  leaderName: string
  gap: number
  /** 0-100, higher is closer to taking it. */
  closeness: number
}

export type PlayerStats = {
  headline: StatsHeadline
  streak: StatsStreak
  games: GameStat[]
  nearRecords: NearRecord[]
}

export type StatsResponse = {
  plan: AccountPlan
  tag?: string
  tags: string[]
  stats: PlayerStats | null
  locked?: boolean
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

export async function fetchMyStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/stats/me`, { headers: { ...authHeaders() } })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return (await res.json()) as StatsResponse
}

/** Record values are stored either as counts or as milliseconds. */
export function formatRecordValue(value: number, unit: 'ms' | 'count'): string {
  if (unit !== 'ms') return value.toLocaleString()
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(2)}s`
}

/** Day key (YYYYMMDD) to a Date, for laying out a calendar. */
export function dayKeyToDate(key: number): Date {
  return new Date(
    Math.floor(key / 10_000),
    Math.floor((key % 10_000) / 100) - 1,
    key % 100,
  )
}

export function dateToDayKey(d: Date): number {
  return d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate()
}
