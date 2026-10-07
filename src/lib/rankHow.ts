import { getGame, isDailyGame, isGameListed } from '../data/games'
import type { GlobalGamePlace, LeaderboardPeriod } from './leaderboard'
import { formatLeaderboardScore } from './leaderboardFormat'
import { numberWord } from './numberWord'
import { ordinal, placePoints, shareLines, type ShareLine } from './profileMath'
import { resolveGameAccent } from './theme'

/*
 * The arithmetic behind How your rank works (pages/RankHowPage.tsx): the one page that shows a rank
 * worked out, so every other page can say places and names. Every figure it prints is the API's: a
 * game's place, field and points come from /leaderboards/rank, a daily's day from /:game/days. What's
 * worked out here is only what those figures already say (how many a place is ahead of, what the days
 * add up to), and the "what if" of the ways up, which are told as the boards stand right now.
 *
 * A place pays 100 × (players − place + 1) ÷ players, rounded, never below 1 (placePoints, as the
 * API's store.ts has it), and a rank adds up what every game paid. A daily pays each day that way, and
 * its days add up to its week, which is then ranked like any other game's board.
 */

export type ByGame = Partial<Record<string, GlobalGamePlace>>

/** A player on the standings, with the places behind their points when the API sent them. */
export type Standing = {
  name: string
  rank: number
  score: number
  games?: number
  byGame?: ByGame
  avatarId?: string
}

export function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

export function gameAccent(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "five games", "one game", "21 games". */
export function gamesWord(n: number): string {
  return `${numberWord(n)} ${n === 1 ? 'game' : 'games'}`
}

/* ---------- the period ---------- */

export type PeriodWords = {
  /** week, month; null for all time. */
  noun: 'week' | 'month' | null
  /** this week, this month, all time */
  phrase: string
  /** Its days added up, on a daily: Week so far, Month so far, All time. */
  total: string
  /** A daily's board for it, after "Your place": on the week, on the month, all time. */
  board: string
}

export function periodWords(period: LeaderboardPeriod): PeriodWords {
  if (period === 'monthly') return { noun: 'month', phrase: 'this month', total: 'Month so far', board: 'on the month' }
  if (period === 'all') return { noun: null, phrase: 'all time', total: 'All time', board: 'all time' }
  return { noun: 'week', phrase: 'this week', total: 'Week so far', board: 'on the week' }
}

const DAY_MS = 86_400_000

/** Board days, YYYY-MM-DD, on the boards' clock (New York), as the API keys them. */
const boardDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today on the boards' clock, YYYY-MM-DD. */
export function boardDay(now = Date.now()): string {
  return boardDayFormat.format(new Date(now))
}

function utcOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

export function addDays(day: string, n: number): string {
  return new Date(utcOf(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** The Monday a day's board week starts on: weeks run Monday to Sunday. */
export function weekStart(day: string): string {
  return addDays(day, -((new Date(utcOf(day)).getUTCDay() + 6) % 7))
}

const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const weekdayLong = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' })
const monthDayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** Mon */
export function weekdayWord(day: string): string {
  return weekdayFormat.format(new Date(utcOf(day)))
}

/** Monday, Sep 28: a day said in full, for a screen reader. */
export function dayInFull(day: string): string {
  return weekdayLong.format(new Date(utcOf(day)))
}

/** Sep 28 */
export function monthDay(day: string): string {
  return monthDayFormat.format(new Date(utcOf(day)))
}

/** The day of the month, 28. */
export function dateOf(day: string): number {
  return new Date(utcOf(day)).getUTCDate()
}

/**
 * The days a period draws as circles: the whole week, Monday to Sunday, or the month's days so far.
 * All time has none: too many to draw, so it's told as a count.
 */
export function periodDays(period: LeaderboardPeriod, today: string): string[] {
  if (period === 'monthly') {
    const days: string[] = []
    for (let day = `${today.slice(0, 8)}01`; day <= today; day = addDays(day, 1)) days.push(day)
    return days
  }
  if (period === 'all') return []
  const monday = weekStart(today)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Whether a day falls in the period that holds today. */
export function inPeriod(day: string, period: LeaderboardPeriod, today: string): boolean {
  if (day > today) return false
  if (period === 'monthly') return day.slice(0, 7) === today.slice(0, 7)
  if (period === 'all') return true
  return day >= weekStart(today)
}

/* ---------- a game's board ---------- */

/** One game a player is on this period: their place, its field, and what the place pays. */
export type Placed = { slug: string; place: number; total: number; points: number }

/** The games a player is on, most points first; a tie goes to the busier board, then the name. */
export function placedGames(byGame: ByGame): Placed[] {
  const out: Placed[] = []
  for (const [slug, row] of Object.entries(byGame)) {
    // An older API left out the field; a place is at least that deep.
    if (row) out.push({ slug, place: row.place, total: row.total ?? row.place, points: row.points })
  }
  return out.sort((a, b) => b.points - a.points || b.total - a.total || gameName(a.slug).localeCompare(gameName(b.slug)))
}

/** Whether a game is on the wall, rather than retired or on deck: its places still count, but it can't be played from here. */
export function onWall(slug: string): boolean {
  return isGameListed(slug)
}

/**
 * A board's players as a strip of cells, with the one the player is in. Past `most` players a cell
 * stands for a slice of the board, so a field of 300 still fits.
 */
export function fieldStrip(place: number, total: number, most = 20): { cells: number; you: number } {
  if (total <= most) return { cells: Math.max(1, total), you: Math.max(0, place - 1) }
  return { cells: most, you: Math.min(most - 1, Math.floor(((place - 1) * most) / total)) }
}

/** Whether a place's points are the rule's, so the page can show the working. An older API's rows may not be. */
export function paysByRule(p: Placed): boolean {
  return placePoints(p.place, p.total) === p.points
}

/**
 * The working on one game, from its own figures: "Your 3rd of 13 on Putt:" and "you and the 10 behind
 * you make 11 of the 13, so it pays 85." `who` is the player as a sentence names them: "Your" on your
 * own page, else their tag.
 */
export function workedExample(p: Placed, who: { self: boolean; name: string }): { lead: string; rest: string } {
  const lead = `${who.self ? 'Your' : `${who.name}’s`} ${ordinal(p.place)} of ${p.total.toLocaleString()} on ${gameName(p.slug)}:`
  const behind = p.total - p.place
  if (p.total === 1) return { lead, rest: `nobody else is on it yet, so it pays ${p.points}.` }
  if (behind === 0) return { lead, rest: `last place is 1 of the ${p.total.toLocaleString()}, so it pays ${p.points}.` }
  const share = behind + 1 === p.total ? `all ${p.total.toLocaleString()}` : `${(behind + 1).toLocaleString()} of the ${p.total.toLocaleString()}`
  const subject = who.self ? 'you and the' : `${who.name} and the`
  const them = who.self ? 'behind you' : 'behind'
  return { lead, rest: `${subject} ${behind.toLocaleString()} ${them} make ${share}, so it pays ${p.points}.` }
}

/** The game the working is shown on: the best-paid one whose points are the rule's. */
export function exampleGame(placed: Placed[]): Placed | null {
  return placed.find(paysByRule) ?? null
}

/**
 * Two of a player's games where the better place pays less, because its board is quieter: what shows
 * that it's the share of a board that pays, not the place. The widest such gap, or null.
 */
export function quietAndBusy(placed: Placed[]): { quiet: Placed; busy: Placed } | null {
  let best: { quiet: Placed; busy: Placed } | null = null
  for (const quiet of placed) {
    for (const busy of placed) {
      if (quiet.place >= busy.place || quiet.points >= busy.points) continue
      if (!best || busy.points - quiet.points > best.busy.points - best.quiet.points) best = { quiet, busy }
    }
  }
  return best
}

/** About what one place is worth on a board of this many: 100 over the field, which the rounding moves by a point. */
export function placeWorth(total: number): number {
  return Math.max(1, Math.round(100 / Math.max(1, total)))
}

/* ---------- the standings ---------- */

/** The standings' own order (the API's standingOrder): more points, then more games, then the tag first in the alphabet. */
const nameOrder = new Intl.Collator()

function goesFirst(a: { score: number; games: number; name: string }, b: { score: number; games: number; name: string }): boolean {
  if (a.score !== b.score) return a.score > b.score
  if (a.games !== b.games) return a.games > b.games
  return nameOrder.compare(a.name, b.name) < 0
}

/** How many games a player is on: the API's count, or their places counted. */
export function gamesOf(s: Standing): number {
  return s.games ?? Object.keys(s.byGame ?? {}).length
}

/**
 * Who goes first when two players are tied on points, said for the fine print: "Tie IVY on 366 and
 * you go ahead, on 5 games to 4."
 */
export function tieLine(me: Standing, other: Standing, self: boolean): string {
  const you = self ? 'you' : me.name
  const yours = self ? 'your' : `${me.name}’s`
  const mine = gamesOf(me)
  const theirs = gamesOf(other)
  const at = `Tie ${other.name} on ${other.score.toLocaleString()}`
  if (mine > theirs) return `${at} and ${you} ${self ? 'go' : 'goes'} ahead, on ${mine} games to ${theirs}.`
  if (mine < theirs) return `${at} and ${other.name} stays ahead, on ${theirs} games to ${yours} ${mine}.`
  const first = nameOrder.compare(me.name, other.name) < 0
  return first
    ? `${at} on ${mine} games each and ${you} ${self ? 'go' : 'goes'} ahead: ${me.name} comes first in the alphabet.`
    : `${at} on ${mine} games each and ${other.name} stays ahead: ${other.name} comes first in the alphabet.`
}

/**
 * A run that changes one board: a first run on a board nobody's played, a climb from one place to
 * another, or a first run on a board with players on it. `place` is where it puts the player, in a
 * field of `field` after it.
 */
export type BoardChange =
  | { kind: 'first'; slug: string; place: 1; field: 1 }
  | { kind: 'climb'; slug: string; from: number; place: number; field: number }
  | { kind: 'join'; slug: string; place: number; field: number }

/**
 * What a change does to another player's points: a climb pushes everyone it passes on that board
 * down a place, and a new player grows the field, which pays everyone above them a little more and
 * everyone below a little less. Null when their places weren't sent, so it can't be told.
 */
function pointsAfter(other: Standing, change: BoardChange): number | null {
  if (change.kind === 'first') return other.score
  if (!other.byGame) return null
  const row = other.byGame[change.slug]
  if (!row) return other.score
  if (row.total == null) return null
  let place = row.place
  if (change.kind === 'climb') {
    if (place >= change.place && place < change.from) place += 1
  } else if (place >= change.place) {
    place += 1
  }
  return other.score - row.points + placePoints(place, change.field)
}

export type Outcome = {
  /** What the change adds to the player's points. */
  gain: number
  score: number
  /** Their place in the standings after it; null when it passes everyone above that the page loaded. */
  rank: number | null
  /** Who it passes, nearest first. */
  passed: string[]
  /** False when a player above has no places on hand, so what the change does to theirs is a guess. */
  exact: boolean
}

/**
 * What one board change does to a player's rank, the boards otherwise staying as they are. `above` is
 * the standings above them, best first, starting at place `offset + 1`.
 */
export function outcome(me: Standing & { byGame: ByGame }, change: BoardChange, above: Standing[], offset: number): Outcome {
  const row = me.byGame[change.slug]
  const now = change.kind === 'climb' && row ? row.points : 0
  const gain = placePoints(change.place, change.field) - now
  const score = me.score + gain
  const games = gamesOf(me) + (change.kind === 'climb' ? 0 : 1)
  const others = above.filter((s) => s.name !== me.name)
  const passed: string[] = []
  let exact = true
  for (let i = others.length - 1; i >= 0; i--) {
    const other = others[i]!
    const theirs = pointsAfter(other, change)
    if (theirs == null) exact = false
    if (goesFirst({ score, games, name: me.name }, { score: theirs ?? other.score, games: gamesOf(other), name: other.name })) {
      passed.push(other.name)
    }
  }
  const rank = passed.length === others.length && offset > 0 ? null : offset + (others.length - passed.length) + 1
  return { gain, score, rank, passed, exact }
}

/** The best climb on one of a player's boards: the fewest places that pass whoever's above, or else the one place worth most. */
export type Climb = { slug: string; from: number; to: number; field: number; outcome: Outcome; passes: boolean }

/** Past this many places, a climb on one board isn't a quick way up. */
const CLIMB_MOST = 50

/**
 * `landings` are, per board, the places above the player a run can land in (scoreboard.ts nextUp's
 * `places`): players tied on a score sit one under another, so a place inside a tie takes no score.
 * A board with none on hand counts every place as one.
 */
export function bestClimb(
  me: Standing & { byGame: ByGame },
  above: Standing[],
  offset: number,
  landings: Partial<Record<string, number[] | undefined>> = {},
): Climb | null {
  const boards = placedGames(me.byGame).filter((p) => p.place > 1 && p.total > 1 && onWall(p.slug) && !isDailyGame(p.slug))
  let passing: Climb | null = null
  if (me.rank > 1) {
    for (const p of boards) {
      for (let places = 1; places <= Math.min(p.place - 1, CLIMB_MOST); places++) {
        const can = landings[p.slug]
        const to = p.place - places
        if (can && !can.includes(to)) continue
        const change: BoardChange = { kind: 'climb', slug: p.slug, from: p.place, place: to, field: p.total }
        const o = outcome(me, change, above, offset)
        if (o.rank == null || o.rank < me.rank) {
          const climb = { slug: p.slug, from: p.place, to, field: p.total, outcome: o, passes: true }
          const fewer = passing ? places < passing.from - passing.to : true
          const same = passing ? places === passing.from - passing.to : false
          if (fewer || (same && o.gain > passing!.outcome.gain)) passing = climb
          break
        }
      }
    }
  }
  if (passing) return passing
  // Nothing close enough to pass on one board, or already on top: the one place worth the most.
  let best: Climb | null = null
  for (const p of boards) {
    // The nearest place a run can land in: the first held at the next score up.
    const can = landings[p.slug]
    const to = can?.length ? Math.min(can[can.length - 1]!, p.place - 1) : p.place - 1
    const o = outcome(me, { kind: 'climb', slug: p.slug, from: p.place, place: to, field: p.total }, above, offset)
    if (!best || o.gain > best.outcome.gain) best = { slug: p.slug, from: p.place, to, field: p.total, outcome: o, passes: false }
  }
  return best
}

/**
 * A first run halfway up a board with `players` on it: the place it takes in the field it makes. What
 * "a run halfway up adds about 50" is worked from.
 */
export function halfwayUp(players: number): { place: number; field: number } {
  return { place: Math.floor(players / 2) + 1, field: players + 1 }
}

/** Who an outcome passes, in a few words: "past IVY", "past IVY and 2 more"; empty when nobody. */
export function passedWords(o: Outcome): string {
  const [nearest] = o.passed
  if (!nearest) return ''
  if (o.passed.length === 1) return `past ${nearest}`
  return `past ${nearest} and ${o.passed.length - 1} more`
}

/* ---------- the dailies ---------- */

/** A player's result on one day of a daily: its board score, and the place and day points it earned. */
export type DayYou = {
  score: number
  /** Null on a day before the game's days counted; missing from an API that predates them. */
  place?: number | null
  points?: number | null
}

/** One day of a daily, as GET /leaderboards/:game/days has it. */
export type RankDay = { day: string; players: number; you: DayYou | null }

/** A day counted toward a daily's board: played, and not from before its days counted. */
export type PlayedDay = RankDay & { you: DayYou }

/** The days a player's result counts on, in the period, oldest first. */
export function playedDays(days: RankDay[], period: LeaderboardPeriod, today: string): PlayedDay[] {
  return days
    .filter((d): d is PlayedDay => d.you != null && d.you.points !== null && inPeriod(d.day, period, today))
    .sort((a, b) => (a.day < b.day ? -1 : 1))
}

/** The day points of those days added up; null when the API didn't send a day's. */
export function daysTotal(days: PlayedDay[]): number | null {
  let sum = 0
  for (const d of days) {
    if (d.you.points == null) return null
    sum += d.you.points
  }
  return sum
}

/**
 * The first day each daily's days count toward its boards, as the API's DAILY_SINCE (store.ts) has it.
 * A day before it wasn't a day's board yet, so it's drawn as before the daily began, not as a day missed.
 */
const DAYS_COUNT_FROM: Partial<Record<string, string>> = {
  hotlap: '2026-09-26',
  acechase: '2026-09-27',
  findbug: '2026-09-27',
  halffull: '2026-09-28',
  centroid: '2026-10-06',
  marblerun: '2026-09-29',
  lander: '2026-09-30',
  swoop: '2026-10-06',
}

/**
 * A day on a daily's strip of days: played, today and still open, a day gone by unplayed, still to
 * come, or before the daily began.
 */
export type DayMark = { day: string; state: 'played' | 'today' | 'missed' | 'ahead' | 'before'; played?: PlayedDay }

/** The period's days for one daily: the whole week, or the month's days since the daily began. */
export function dayMarks(slug: string, played: PlayedDay[], period: LeaderboardPeriod, today: string): DayMark[] {
  const byDay = new Map(played.map((d) => [d.day, d]))
  const from = DAYS_COUNT_FROM[slug] ?? ''
  return periodDays(period, today)
    .filter((day) => period !== 'monthly' || day >= from)
    .map((day): DayMark => {
      const hit = byDay.get(day)
      if (hit) return { day, state: 'played', played: hit }
      if (day < from) return { day, state: 'before' }
      if (day === today) return { day, state: 'today' }
      return { day, state: day < today ? 'missed' : 'ahead' }
    })
}

/** What a daily's result column is headed, and each day's result. */
export const RESULT_WORD: Record<string, string> = {
  hotlap: 'Lap',
  findbug: 'Time',
  acechase: 'Tries',
  halffull: 'Pour',
  centroid: 'Day',
  marblerun: 'Run',
  lander: 'Run',
  swoop: 'Run',
}

/** A daily's today, as the site names it. */
export const TODAY_NAME: Record<string, string> = {
  hotlap: 'Today’s Track',
  findbug: 'Today’s Wanted',
  acechase: 'Today’s Hole',
  halffull: 'Today’s Pour',
  centroid: 'Today’s Plates',
  marblerun: 'Today’s Course',
  lander: 'Today’s Cave',
  swoop: 'Today’s Hills',
}

/** A day's result in the game's own terms: a lap, a time, tries, a pour. */
export function dayResult(slug: string, score: number): string {
  return formatLeaderboardScore(slug, score)
}

/* ---------- the whole board ---------- */

/**
 * The lines across the whole standings: the top half, 25%, 10% and the top ten on a big board, just
 * the top ten on one of 11 to 20, and none on a smaller one, where everyone's in the top ten.
 */
export function boardLines(field: number): ShareLine[] {
  const lines = shareLines(field)
  if (lines.length) return lines
  return field > 10 ? [{ key: 'ten', label: 'Top ten', rank: 10 }] : []
}
