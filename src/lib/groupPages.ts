import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { inkOn } from './color'
import {
  api,
  normalizePlayerName,
  VISIBLE_LEADERBOARD_GAMES,
  type GlobalBoardEntry,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from './leaderboard'
import { applyBoardScope, type GroupPublic } from './groups'

/*
 * The groups pages, worked out: a group's table for a period, the record it
 * holds on every game, who holds how many, the newest of them, and the lines
 * the pages say about them. Always for the group named, whatever the site's
 * boards are set to show, so a group's page is that group's even while the
 * boards show everyone.
 */

const GROUP_ACCENTS = ['#2eb8a0', '#e85d4c', '#5b7cfa', '#e2a12b', '#9b6bff'] as const

/** A group's colour, fixed by its id so it is the same on every page. */
export function groupAccent(id: string): string {
  let n = 0
  for (const ch of id) n = (n + ch.charCodeAt(0)) % GROUP_ACCENTS.length
  return GROUP_ACCENTS[n] ?? GROUP_ACCENTS[0]
}

/** A group's colour and the ink that reads on it, for a page or a card in it. */
export function groupStyle(id: string): CSSProperties {
  const accent = groupAccent(id)
  return { '--g': accent, '--g-ink': inkOn(accent, '#06201a') } as CSSProperties
}

/** The group and code in an invite link, however it was pasted. */
export function parseGroupLink(text: string): { id: string; invite: string | null } | null {
  const match = /\/groups\/([^/?#\s]+)/.exec(text.trim())
  if (!match) return null
  const invite = /[?&]invite=([A-Za-z0-9]+)/.exec(text)
  return { id: decodeURIComponent(match[1]!), invite: invite ? invite[1]!.toUpperCase() : null }
}

export const GROUP_LIMIT = 5
export const MEMBER_LIMIT = 20

export type GroupPeriod = Extract<LeaderboardPeriod, 'weekly' | 'monthly' | 'all'>

export const GROUP_PERIODS: { id: GroupPeriod; label: string }[] = [
  { id: 'monthly', label: 'This month' },
  { id: 'weekly', label: 'This week' },
  { id: 'all', label: 'All time' },
]

/* ---------- fetching, for one group ---------- */

function scoped(groupId: string, params: Record<string, string>) {
  return applyBoardScope(new URLSearchParams(params), groupId)
}

export type GroupTable = { period: GroupPeriod; totalPlayers: number; entries: GlobalBoardEntry[] }

/** The group's standings for a period: every member who has played, by points. */
export async function fetchGroupTable(groupId: string, period: GroupPeriod): Promise<GroupTable> {
  const qs = scoped(groupId, { limit: String(MEMBER_LIMIT + 5) })
  if (period !== 'all') qs.set('period', period)
  const data = await api<{ totalPlayers?: number; entries?: GlobalBoardEntry[] }>(`/leaderboards/rank?${qs}`)
  return { period, totalPlayers: data.totalPlayers ?? 0, entries: data.entries ?? [] }
}

export type GroupRecord = { slug: string; best: LeaderboardEntry | null }

/** The best run anyone in the group has on each game the boards show, all time. */
export async function fetchGroupRecords(groupId: string): Promise<GroupRecord[]> {
  const qs = scoped(groupId, { period: 'all', limit: '1' })
  const data = await api<{ games?: { slug: string; entries?: LeaderboardEntry[] }[] }>(`/leaderboards/summary?${qs}`)
  const bySlug = new Map((data.games ?? []).map((g) => [g.slug, g.entries?.[0] ?? null]))
  return VISIBLE_LEADERBOARD_GAMES.map((slug) => ({ slug, best: bySlug.get(slug) ?? null }))
}

/* ---------- what the numbers say ---------- */

export function periodWords(period: GroupPeriod, now = new Date()): string {
  if (period === 'weekly') return 'this week'
  if (period === 'all') return 'all time'
  return now.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/New_York' })
}

/**
 * "OWEN leads September by 127 over FRAN." Said to someone at the top, it is
 * about them: "You lead…", or "…over you." from second, so the line under it
 * need not say the same gap again.
 */
export function leadLine(entries: GlobalBoardEntry[], period: GroupPeriod, me = ''): string | null {
  const [first, second] = entries
  if (!first) return null
  const you = normalizePlayerName(me)
  const isMe = (e: GlobalBoardEntry) => Boolean(you) && normalizePlayerName(e.name) === you
  const when = period === 'all' ? 'all time' : periodWords(period)
  if (!second) {
    const where = period === 'all' ? 'so far' : when === 'this week' ? 'this week' : `in ${when}`
    return isMe(first) ? `You’re the only one on the table ${where}.` : `${first.name} is the only one on the table ${where}.`
  }
  const gap = first.score - second.score
  if (isMe(first)) return gap === 0 ? `You lead ${when}, tied with ${second.name}.` : `You lead ${when} by ${gap} over ${second.name}.`
  const over = isMe(second) ? 'you' : second.name
  return gap === 0 ? `${first.name} leads ${when}, tied with ${over}.` : `${first.name} leads ${when} by ${gap} over ${over}.`
}

/**
 * "You're 5th, 18 behind DEX." — or how to get onto the table. Beside the
 * lead line (afterLead), first and second have been told already.
 */
export function youLine(entries: GlobalBoardEntry[], me: string, period: GroupPeriod, afterLead = false): string | null {
  const name = normalizePlayerName(me)
  if (!name) return null
  const i = entries.findIndex((e) => normalizePlayerName(e.name) === name)
  if (i < 0) {
    return period === 'all' ? 'One run on any game puts you on the table.' : `You’re not on the table ${periodWords(period) === 'this week' ? 'this week' : `for ${periodWords(period)}`} yet: one run puts you on it.`
  }
  if (afterLead && i <= 1) return null
  const mine = entries[i]!
  if (i === 0) {
    const next = entries[1]
    return next ? `You lead, ${mine.score - next.score} clear of ${next.name}.` : 'You lead.'
  }
  const above = entries[i - 1]!
  const gap = above.score - mine.score
  return gap === 0 ? `You’re ${ordinal(mine.rank)}, tied with ${above.name}.` : `You’re ${ordinal(mine.rank)}, ${gap} behind ${above.name}.`
}

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** Games a player is first on in the group, for the table's little marks. */
export function gamesLed(entry: GlobalBoardEntry): string[] {
  return Object.entries(entry.byGame ?? {})
    .filter(([slug, place]) => place?.place === 1 && !getGame(slug)?.hidden)
    .map(([slug]) => slug)
}

/** Who holds how many of the group's records, most first. */
export function recordHolders(records: GroupRecord[]): { name: string; count: number; avatarId?: string }[] {
  const counts = new Map<string, { name: string; count: number; avatarId?: string }>()
  for (const r of records) {
    if (!r.best) continue
    const name = normalizePlayerName(r.best.name)
    const row = counts.get(name) ?? { name, count: 0, avatarId: r.best.avatarId }
    row.count += 1
    counts.set(name, row)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function openRecords(records: GroupRecord[]): string[] {
  return records.filter((r) => !r.best).map((r) => r.slug)
}

/** The records set most lately. */
export function newestRecords(records: GroupRecord[], n = 5): (GroupRecord & { best: LeaderboardEntry })[] {
  return records
    .filter((r): r is GroupRecord & { best: LeaderboardEntry } => Boolean(r.best))
    .sort((a, b) => b.best.at - a.best.at)
    .slice(0, n)
}

/** "Sep 16", "today", "yesterday". */
export function whenSet(at: number, now = Date.now()): string {
  const zone = 'America/New_York'
  const day = (t: number) => new Date(t).toLocaleDateString('en-US', { timeZone: zone })
  if (day(at) === day(now)) return 'today'
  if (day(at) === day(now - 86_400_000)) return 'yesterday'
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone })
}

export function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The host first, then everyone in the order they joined. */
export function membersInOrder(group: GroupPublic): GroupPublic['members'] {
  const host = normalizePlayerName(group.ownerName ?? '')
  return [...group.members].sort(
    (a, b) =>
      Number(normalizePlayerName(b.name) === host) - Number(normalizePlayerName(a.name) === host) ||
      a.joinedAt - b.joinedAt,
  )
}
