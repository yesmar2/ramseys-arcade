import { getGame } from '../data/games'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
  type GlobalGamePlace,
  type GlobalRankNearby,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from './leaderboard'
import { formatDayPoints, formatLeaderboardScore } from './leaderboardFormat'
import { currentSeason } from './season'
import type { TrophyAward } from './trophies'

/*
 * The boards page's arithmetic and its words: who leads, who is either side of
 * a player, and where they could climb next. The page and the hook that loads
 * it only carry numbers about; everything worked out from them is here, so the
 * page says the right thing however the numbers fall, on an empty Monday as
 * much as at the end of a busy month.
 *
 * A board pays by place: first gets 100, last a point or two, and a board with
 * nobody on it pays its first run all 100. A player's total is their ten best
 * boards added together (see placePoints and STANDINGS_BEST in the API's store). The page says places
 * and names; what each place pays, and a player's points game by game, are on
 * How your rank works (lib/rankHow).
 */

/** One player's best run on a board, or on a daily's board for longer than a day, their day points. */
export type BoardTop = {
  name: string
  score: number
  avatarId?: string
  /** The season skin the run was played in (lib/skins.ts), shown beside the name (SkinMark). */
  skin?: string
  /**
   * For the player just above you (nextUp): the best place a run that beats their score takes. It is
   * higher than their own place when they are tied with the players above them.
   */
  reach?: number
  /** For nextUp: the places above you a run can land in, best first — the first place held at each score above you. */
  places?: number[]
}

/** One game's board for the period: its top three players and how many are on it. */
export type BoardLine = {
  slug: LeaderboardGame
  top: BoardTop[]
  /** Players on the board; null when nothing on hand says. */
  players: number | null
  /** A daily's board for longer than a day, whose scores are day points (leaderboardFormat isDayPointsBoard). */
  points?: boolean
}

/** A score on a line's board: a run's, or a daily's day points. */
export function lineScore(line: BoardLine, score: number): string {
  return line.points ? formatDayPoints(score) : formatLeaderboardScore(line.slug, score)
}

/** A row of the overall standings, with the places behind its points. */
export type Standing = GlobalBoardEntry

/** The viewer this period. `rank` is null while they have no runs in it. */
export type YouStanding = {
  name: string
  rank: number | null
  score: number
  totalPlayers: number
  byGame: Partial<Record<string, GlobalGamePlace>>
  nearby: GlobalRankNearby[]
  avatarId?: string
}

/** How the period before this one finished, from the trophies it handed out. */
export type LastFinal = { rank: number; name: string; score: number; games: number }[]

export type Stat = { value: string; label: string }

/* ---------- the period ---------- */

const BOARD_TZ = 'America/New_York'
const DAY_MS = 86_400_000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

let zoneDate: Intl.DateTimeFormat | null = null

/** The day a moment falls on where the boards keep time, as a UTC midnight to count calendar days from. */
export function boardToday(now: number): number {
  zoneDate ??= new Intl.DateTimeFormat('en-US', {
    timeZone: BOARD_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = zoneDate.formatToParts(new Date(now))
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(part('year'), part('month') - 1, part('day'))
}

/** Sun, Sep 27, from a day as boardToday gives it. */
export function dayLabel(day: number): string {
  const d = new Date(day)
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** Sep 21 */
function shortDate(day: number): string {
  const d = new Date(day)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export type PeriodCopy = {
  /** The period as a noun (week, month), or null for all time. */
  noun: string | null
  /** this week, this month, all time */
  phrase: string
  /** The chip over the headline. */
  kicker: string
  /** Whether the period is running, and so gets a live dot. */
  live: boolean
  /** When it closes and what that hands out. */
  closes: string
  /** The period before, whose final standings its trophies keep. */
  last: { period: 'weekly' | 'monthly'; key: number; title: string; note: string } | null
  /** A season's own name (Space Race), said in the headline in place of "the season". */
  title?: string
  /** A season that's over: whoever leads it won it. */
  over?: boolean
}

/**
 * What to call the period and when it closes. Weeks run Monday to Sunday in
 * the boards' time zone. Inside a group there are no trophies to mention:
 * they go to the top ten of everyone.
 */
export function periodCopy(period: LeaderboardPeriod, now = Date.now(), group = false): PeriodCopy {
  const today = boardToday(now)
  const trophy = group ? '' : ' The top ten each take a trophy.'
  if (period === 'weekly') {
    const start = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS
    const prev = new Date(start - 7 * DAY_MS)
    return {
      noun: 'week',
      phrase: 'this week',
      kicker: `Live · week of ${shortDate(start)}`,
      live: true,
      closes: `Closes ${dayLabel(start + 6 * DAY_MS)} at 11:59 pm ET.${trophy}`,
      last: {
        period: 'weekly',
        key: prev.getUTCFullYear() * 10_000 + (prev.getUTCMonth() + 1) * 100 + prev.getUTCDate(),
        title: 'Last week, final',
        note: `Week of ${shortDate(prev.getTime())} · the top ten took trophies`,
      },
    }
  }
  if (period === 'monthly') {
    const d = new Date(today)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const prevYear = month === 0 ? year - 1 : year
    const prevMonth = month === 0 ? 11 : month - 1
    return {
      noun: 'month',
      phrase: 'this month',
      kicker: `Live · ${MONTH_NAMES[month]}`,
      live: true,
      closes: `Closes ${dayLabel(Date.UTC(year, month + 1, 0))} at 11:59 pm ET.${trophy}`,
      last: {
        period: 'monthly',
        key: prevYear * 100 + prevMonth + 1,
        title: 'Last month, final',
        note: `${MONTH_NAMES[prevMonth]} · the top ten took trophies`,
      },
    }
  }
  if (period === 'daily') {
    return {
      noun: 'day',
      phrase: 'today',
      kicker: 'Live · today',
      live: true,
      closes: 'Closes tonight at 11:59 pm ET.',
      last: null,
    }
  }
  if (period === 'season') {
    // The season the site has fetched (lib/season.ts); what its places win is the API's seasons.ts SEASON_PRIZES.
    const season = currentSeason()
    if (!season) return { noun: 'season', phrase: 'this season', kicker: 'Season', live: false, closes: '', last: null }
    const over = season.status === 'over'
    const lastDay = dayLabel(boardToday(season.endsAt - 1))
    const prizes = group ? '' : over ? ' Its cups and trophies are on their shelves.' : ` The top 3 take the Season ${season.id} cup, the top 10 a trophy.`
    return {
      noun: 'season',
      phrase: 'this season',
      kicker: over ? `Season ${season.id} · ${season.name} · Final` : `Live · Season ${season.id} · ${season.name}`,
      live: !over,
      closes: over ? `Ended ${lastDay}.${prizes}` : `Ends ${lastDay} at 11:59 pm ET.${prizes}`,
      last: null,
      title: season.name,
      ...(over ? { over: true } : {}),
    }
  }
  return {
    noun: null,
    phrase: 'all time',
    kicker: 'All time',
    live: false,
    closes: group
      ? 'All time never closes.'
      : 'All time never closes. Trophies go to the top ten of every week and month.',
    last: null,
  }
}

/**
 * The final top ten of a closed period, from its trophies. A period is
 * awarded once, but if it ever holds two awards for one place, the first one
 * given stands. The awards on hand are only the latest few, so a period can
 * come back with places missing; only the unbroken run down from first is
 * kept, so the list never skips a place.
 */
export function lastFinal(awards: TrophyAward[], period: 'weekly' | 'monthly', key: number): LastFinal {
  const byPlace = new Map<number, TrophyAward>()
  const names = new Set<string>()
  const theirs = awards
    .filter((a) => a.period === period && a.periodKey === key)
    .sort((a, b) => a.rank - b.rank || a.awardedAt - b.awardedAt)
  for (const award of theirs) {
    const name = normalizePlayerName(award.name)
    if (byPlace.has(award.rank) || names.has(name)) continue
    byPlace.set(award.rank, award)
    names.add(name)
  }
  const rows: LastFinal = []
  for (let place = 1; byPlace.has(place); place++) {
    const award = byPlace.get(place)!
    rows.push({ rank: place, name: normalizePlayerName(award.name), score: award.score, games: award.games })
  }
  return rows
}

/* ---------- words ---------- */

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/** 1st, 2nd, 3rd, 11th, 22nd */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/* ---------- boards ---------- */

/** The first `n` different players down a board's runs, each at their best. */
export function distinctTop(entries: LeaderboardEntry[], n = 3): BoardTop[] {
  const seen = new Set<string>()
  const out: BoardTop[] = []
  for (const entry of entries) {
    const name = normalizePlayerName(entry.name ?? '')
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ name, score: entry.score, avatarId: entry.avatarId, ...(entry.skin ? { skin: entry.skin } : {}) })
    if (out.length === n) break
  }
  return out
}

/**
 * How many players are on each board. Every place a player holds is out of
 * its board's whole field, so any one player on a board says how big it is.
 */
export function fieldSizes(
  sources: (Partial<Record<string, GlobalGamePlace>> | undefined)[],
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {}
  for (const byGame of sources) {
    for (const [slug, place] of Object.entries(byGame ?? {})) {
      if (place?.total) out[slug] = Math.max(out[slug] ?? 0, place.total)
    }
  }
  return out
}

/**
 * The player directly above `me`, from a board's runs down to `me`'s best.
 * Runs come best first, so each player's first run is their best, and the
 * last new name before `me` is the next place up. A tie goes to whoever got
 * there first, so players on the same score sit one under another: beating
 * that score passes them all, and `reach` is the first place held at it.
 */
export function nextUp(runsAbove: LeaderboardEntry[], me: string): BoardTop | null {
  const seen = new Set<string>()
  const firstAt = new Map<number, number>()
  let last: BoardTop | null = null
  for (const entry of runsAbove) {
    const name = normalizePlayerName(entry.name ?? '')
    if (!name || name === me || seen.has(name)) continue
    seen.add(name)
    if (!firstAt.has(entry.score)) firstAt.set(entry.score, seen.size)
    last = { name, score: entry.score, avatarId: entry.avatarId }
  }
  return last && { ...last, reach: firstAt.get(last.score), places: [...firstAt.values()] }
}

/* ---------- the race ---------- */

/**
 * The headline, with the leader's name apart so it can wear the gold. It says
 * who leads, not by how many points: those are on How your rank works.
 */
export function headline(
  copy: PeriodCopy,
  standings: Standing[],
  totalPlayers: number,
): { name: string; rest: string } {
  const [first, second] = standings
  // A season goes by its own name: "GHOSTRUN leads Space Race."
  const it = copy.title ?? (copy.noun ? `the ${copy.noun}` : null)
  if (totalPlayers < 2 || !first || !second) {
    if (copy.title) return { name: '', rest: `${copy.title} is ${copy.over ? 'over' : 'wide open'}.` }
    return { name: '', rest: copy.noun ? `The ${copy.noun} is wide open.` : 'The boards are wide open.' }
  }
  if (first.score - second.score <= 0) {
    const where = it ? ` of ${it}` : ''
    return { name: '', rest: `${first.name} and ${second.name} ${copy.over ? 'tied' : 'are tied'} at the top${where}.` }
  }
  return { name: first.name, rest: ` ${copy.over ? 'won' : 'leads'} ${it ?? 'all time'}.` }
}

/** The line under the headline: how many are playing, and how to climb. */
export function lede(
  copy: PeriodCopy,
  period: LeaderboardPeriod,
  standings: Standing[],
  totalPlayers: number,
  boards: BoardLine[],
): string {
  const played = boards.filter((b) => b.top.length > 0)
  const open = boards.length - played.length
  if (totalPlayers === 0 || !standings[0]) {
    return `Nobody has played ${copy.noun ? `${copy.phrase} ` : ''}yet. Your first run puts you on top.`
  }
  if (totalPlayers === 1) {
    const leader = standings[0]
    const where =
      played.length === 1 ? `with one ${gameName(played[0].slug)} run` : `on ${count(played.length, 'game')}`
    const start =
      period === 'weekly' ? 'It started Monday, and ' : period === 'monthly' ? 'It started on the 1st, and ' : ''
    const rest = open > 0 ? ` Nobody has played the other ${open === 1 ? 'one' : open.toLocaleString()} yet.` : ''
    return `${start}${leader.name}’s the only name up so far, ${where}.${rest}`
  }
  const who = `${count(totalPlayers, 'player')} on ${count(played.length, 'game')}`
  if (!copy.noun) return `${who}. Your best run on each game counts.`
  return `${who} ${copy.phrase}. Play more games and finish higher to climb.`
}

/* ---------- every board ---------- */

export type YouCell = { a: string; b: string; tone: 'on' | 'hint' | 'off' }

/**
 * The best place a run that beats `next` takes. Players tied on a score sit one under another,
 * whoever got there first on top, so beating the one just above you can pass the ones above them
 * too: it takes the first place held at that score. nextUp works that out from every run above
 * you; without it, the board's top three still catch a tie up there.
 */
function reachFor(line: BoardLine, own: number, next: BoardTop): number {
  if (next.reach) return Math.min(next.reach, own - 1)
  const first = line.top.findIndex((t) => t.score === next.score)
  return first >= 0 ? Math.min(first + 1, own - 1) : own - 1
}

/** Your place on one board and the score that takes a place higher, for a player with a name. */
export function youCell(
  line: BoardLine,
  you: YouStanding,
  best: number | undefined,
  next: BoardTop | null | undefined,
): YouCell {
  const place = you.byGame[line.slug]
  if (place) {
    // A daily's week is its days added up, so it climbs a day at a time: there's no one score to beat.
    if (line.points) {
      return { a: `#${place.place}`, b: place.place === 1 ? 'You lead it' : 'Play every day to climb', tone: 'on' }
    }
    const a = best != null ? `#${place.place} · ${lineScore(line, best)}` : `#${place.place}`
    const b =
      place.place === 1
        ? 'You lead it'
        : next
          ? `Beat ${lineScore(line, next.score)} for ${ordinal(reachFor(line, place.place, next))}`
          : ''
    return { a, b, tone: 'on' }
  }
  if (line.players === 1 && line.top[0]) {
    return { a: '–', b: `Just ${line.top[0].name} so far`, tone: 'hint' }
  }
  return { a: '–', b: 'Not played yet', tone: 'off' }
}

/** The one line a board's row has room for on a phone, under its leader. */
export function phoneLine(line: BoardLine, you: YouStanding | null, cell: YouCell | null): string {
  if (you && cell) {
    if (cell.tone === 'on') {
      const place = you.byGame[line.slug]?.place ?? 0
      if (place === 1) return 'You lead it'
      if (!cell.b) return `You #${place}`
      return `You #${place} · ${cell.b.charAt(0).toLowerCase()}${cell.b.slice(1)}`
    }
    if (cell.tone === 'hint') return cell.b
    return 'You haven’t played it yet'
  }
  // A daily's week is in points, which stay on its own board: here it is names.
  const rest = line.top
    .slice(1)
    .map((t, i) => `${ordinal(i + 2)} ${t.name}${line.points ? '' : ` ${lineScore(line, t.score)}`}`)
  if (rest.length) return rest.join(' · ')
  return line.top[0] ? `Just ${line.top[0].name} so far` : ''
}
