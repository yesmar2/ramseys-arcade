import { applyBoardScope, withGroupFallback } from './groups'
import { api, getLastPlayerName, normalizePlayerName } from './leaderboard'

/**
 * Records for the whole arcade rather than one cabinet.
 *
 * The game books are about playing well. These are about playing — turning up,
 * ranging around, keeping a streak alive. Nothing extra is tracked to fill
 * them: every one is read back out of the scores already on the boards.
 */

export const SITE_RECORD_IDS = [
  'day-streak',
  'games-in-a-day',
  'runs-in-a-day',
  'days-played',
  'games-played',
  'boards-topped',
] as const
export type SiteRecordId = (typeof SITE_RECORD_IDS)[number]

export type SiteRecordUnit = 'days' | 'games' | 'runs' | 'boards'

export type SiteRecordEntry = {
  name: string
  value: number
  /** Day key (YYYYMMDD) where the record is about a single day. */
  at: number | null
}

export type SiteRecordBoard = {
  id: SiteRecordId
  label: string
  blurb: string
  unit: SiteRecordUnit
  entries: SiteRecordEntry[]
}

export type SiteRecordStanding = Partial<
  Record<SiteRecordId, { value: number; rank: number | null }>
>

export type SiteRecordsResult = {
  boards: SiteRecordBoard[]
  you: SiteRecordStanding | null
}

/** Singular and plural, so a value of 1 does not read as "1 days". */
const UNIT_WORDS: Record<SiteRecordUnit, [string, string]> = {
  days: ['day', 'days'],
  games: ['game', 'games'],
  runs: ['run', 'runs'],
  boards: ['board', 'boards'],
}

/** The unit word on its own, agreeing with the number beside it. */
export function siteRecordUnitWord(value: number, unit: SiteRecordUnit): string {
  const [one, many] = UNIT_WORDS[unit]
  return value === 1 ? one : many
}

export function formatSiteRecordValue(value: number, unit: SiteRecordUnit): string {
  return `${value} ${siteRecordUnitWord(value, unit)}`
}

/** YYYYMMDD back into something a person reads. */
export function formatDayKey(key: number | null): string | null {
  if (!key) return null
  const year = Math.floor(key / 10_000)
  const month = Math.floor((key % 10_000) / 100)
  const day = key % 100
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export async function fetchSiteRecords(name?: string): Promise<SiteRecordsResult> {
  const cleaned = normalizePlayerName(name ?? getLastPlayerName())
  return withGroupFallback(async () => {
    const params = applyBoardScope(new URLSearchParams())
    if (cleaned) params.set('name', cleaned)
    const query = params.toString()
    const data = await api<SiteRecordsResult>(
      `/records/site${query ? `?${query}` : ''}`,
    )
    return { boards: data.boards ?? [], you: data.you ?? null }
  })
}
