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
import { formatLeaderboardScore } from './leaderboardFormat'
import { numberWord } from './numberWord'
import type { TrophyAward } from './trophies'

/*
 * The boards page's arithmetic and its words: who leads and by how much, what
 * each board is worth, and where a player's next points are. The page and the
 * hook that loads it only carry numbers about; everything worked out from them
 * is here, so the page says the right thing however the numbers fall, on an
 * empty Monday as much as at the end of a busy month.
 *
 * A board pays by place: first gets 100, last a point or two, and a board with
 * nobody on it pays its first run all 100. A player's total is their boards
 * added together (see placePoints in the API's store).
 */

/** One player's best run on a board. */
export type BoardTop = { name: string; score: number; avatarId?: string }

/** One game's board for the period: its top three players and how many are on it. */
export type BoardLine = {
  slug: LeaderboardGame
  top: BoardTop[]
  /** Players on the board; null when nothing on hand says. */
  players: number | null
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
export type Move = { amount: string; what: string; why: string }

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

/** Sun, Sep 27 */
function dayLabel(day: number): string {
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

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Three first runs, One first run */
function firstRuns(n: number): string {
  return `${capital(numberWord(n))} first run${n === 1 ? '' : 's'}`
}

/** 1st, 2nd, 3rd, 11th, 22nd */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/** Barrage, Bop, Frenzy; past `max` of them, a count. */
function gameList(slugs: string[], max = 4): string {
  if (slugs.length > max) return count(slugs.length, 'board')
  return slugs.map(gameName).join(', ')
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
    out.push({ name, score: entry.score, avatarId: entry.avatarId })
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
 * last new name before `me` is the next place up.
 */
export function nextUp(runsAbove: LeaderboardEntry[], me: string): BoardTop | null {
  const seen = new Set<string>()
  let last: BoardTop | null = null
  for (const entry of runsAbove) {
    const name = normalizePlayerName(entry.name ?? '')
    if (!name || name === me || seen.has(name)) continue
    seen.add(name)
    last = { name, score: entry.score, avatarId: entry.avatarId }
  }
  return last
}

/* ---------- the race ---------- */

/** The headline, with the leader's name apart so it can wear the gold. */
export function headline(
  copy: PeriodCopy,
  standings: Standing[],
  totalPlayers: number,
): { name: string; rest: string } {
  const [first, second] = standings
  if (totalPlayers < 2 || !first || !second) {
    return { name: '', rest: copy.noun ? `The ${copy.noun} is wide open.` : 'The boards are wide open.' }
  }
  const gap = first.score - second.score
  if (gap <= 0) {
    const where = copy.noun ? ` of the ${copy.noun}` : ''
    return { name: '', rest: `${first.name} and ${second.name} are level at the top${where}.` }
  }
  return {
    name: first.name,
    rest: ` leads ${copy.noun ? `the ${copy.noun}` : 'all time'} by ${count(gap, 'point')}.`,
  }
}

/** The line under the headline: how many are playing, and what the boards pay. */
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
    return `Nobody has a run on the boards ${copy.noun ? copy.phrase : 'yet'}. The first run on each board pays all 100 points.`
  }
  if (totalPlayers === 1) {
    const leader = standings[0]
    const where =
      played.length === 1 ? `with one ${gameName(played[0].slug)} run` : `on ${count(played.length, 'board')}`
    const start =
      period === 'weekly' ? 'It started Monday, and ' : period === 'monthly' ? 'It started on the 1st, and ' : ''
    const rest =
      open > 0
        ? ` The other ${count(open, 'board')} ${open === 1 ? 'has' : 'have'} no runs, and the first run on ${open === 1 ? 'it' : 'each'} pays all 100 points.`
        : ''
    return `${start}${leader.name}’s the only name up so far, ${where}.${rest}`
  }
  const who = `${count(totalPlayers, 'player')} on ${count(played.length, 'board')}.`
  if (!copy.noun) return `${who} Your best run on each board counts, and each board pays up to 100 points.`
  return `${who} Every board you place on pays up to 100 points, and the most points takes the ${copy.noun}.`
}

/* ---------- you ---------- */

/** Where you stand against the players either side of you. */
export function youStats(you: YouStanding, standings: Standing[]): Stat[] {
  if (you.rank == null) return []
  const rank = you.rank
  const around: { rank: number; name: string; score: number }[] = [...you.nearby, ...standings]
  const at = (r: number) => around.find((e) => e.rank === r && e.name !== you.name)
  const versus = (other: { name: string; score: number }, gap: number, side: string): Stat =>
    gap > 0 ? { value: gap.toLocaleString(), label: `${side} ${other.name}` } : { value: 'Level', label: `with ${other.name}` }
  const stats: Stat[] = []
  const above = rank > 1 ? at(rank - 1) : undefined
  const below = at(rank + 1)
  if (above) stats.push(versus(above, above.score - you.score, 'behind'))
  if (below) stats.push(versus(below, you.score - below.score, 'ahead of'))
  if (rank === 1) {
    const led = Object.values(you.byGame).filter((p) => p?.place === 1).length
    stats.push({ value: led.toLocaleString(), label: led === 1 ? 'board you lead' : 'boards you lead' })
  }
  return stats.slice(0, 2)
}

/** For a player with no runs yet: how they finished the period before, if they made its top ten. */
export function lastStats(copy: PeriodCopy, last: LastFinal | null, me: string): Stat[] {
  if (!last || !copy.noun || !me) return []
  const mine = last.find((row) => row.name === me)
  if (!mine) return []
  const stats: Stat[] = [
    { value: ordinal(mine.rank), label: `last ${copy.noun}, with ${mine.score.toLocaleString()}` },
  ]
  const third = last.find((row) => row.rank === 3)
  if (mine.rank > 3 && third) {
    stats.push({ value: (third.score - mine.score).toLocaleString(), label: `points off last ${copy.noun}’s podium` })
  } else if (mine.rank <= 3) {
    stats.push({ value: 'Podium', label: `last ${copy.noun}, and a trophy for it` })
  }
  return stats
}

/** A board with one player on it pays any run 50, and a run that beats theirs 100. */
function loneBoard(line: BoardLine): Move {
  const holder = line.top[0]
  const score = formatLeaderboardScore(line.slug, holder.score)
  return {
    amount: '50 to 100',
    what: gameName(line.slug),
    why: `${holder.name}’s alone on it with ${score}. Any run pays 50; beat ${score} and it pays 100.`,
  }
}

/**
 * Where the next points are, biggest first: boards nobody has played, boards
 * you have not played, and the places you could climb on your own. The foot
 * line says what that adds up to against the player ahead of you.
 */
export function moves(
  copy: PeriodCopy,
  boards: BoardLine[],
  standings: Standing[],
  you: YouStanding | null,
): { rows: Move[]; foot: string } {
  const named = Boolean(you)
  const ranked = you?.rank != null
  const mine = you?.byGame ?? {}
  const empties = boards.filter((b) => b.top.length === 0)
  const others = boards.filter((b) => b.top.length > 0 && !mine[b.slug])
  const lonely = others.filter((b) => b.players === 1)
  const crowded = others.filter((b) => b.players !== 1)
  const rows: Move[] = []

  if (empties.length) {
    const one = empties.length === 1
    rows.push({
      amount: one ? '+100' : '+100 each',
      what: gameList(empties.map((b) => b.slug)),
      why: `Nobody’s played ${one ? 'it' : 'them'} ${copy.noun ? copy.phrase : 'yet'}. The first run on ${one ? 'it' : 'each'} takes all 100.`,
    })
  }

  if (ranked) {
    if (others.length === 1 && lonely.length === 1) {
      rows.push(loneBoard(lonely[0]))
    } else if (others.length) {
      rows.push({
        amount: 'up to +100',
        what: gameList(
          others.map((b) => b.slug),
          5,
        ),
        why: `Boards you haven’t played${copy.noun ? ` ${copy.phrase}` : ''}. Halfway up one pays about 50.`,
      })
    }
    // A place is worth about 100 over the board's field, so a small board's places are worth
    // more. Only boards with a place left to climb count; when they differ, say so as a range.
    const placed = Object.values(mine).filter((p): p is GlobalGamePlace => Boolean(p))
    const steps = placed
      .filter((p) => p.place > 1)
      .map((p) => Math.max(1, Math.round(100 / Math.max(1, p.total ?? 50))))
      .sort((a, b) => a - b)
    if (steps.length) {
      const low = steps[0]
      const high = steps[steps.length - 1]
      const middle = steps[Math.floor(steps.length / 2)]
      rows.push({
        amount: high - low <= 1 ? `about +${middle}` : `+${low} to +${high}`,
        what: `Your ${count(placed.length, 'board')}`,
        why: 'What each place you climb on one of them is worth.',
      })
    }
  } else {
    if (lonely.length === 1) rows.push(loneBoard(lonely[0]))
    else if (lonely.length > 1) {
      rows.push({
        amount: 'at least +50',
        what: gameList(lonely.map((b) => b.slug)),
        why: 'One player on each. Any run pays 50, and beating theirs pays 100.',
      })
    }
    if (crowded.length) {
      rows.push({
        amount: 'up to +100',
        what:
          named || crowded.length <= 2
            ? gameList(
                crowded.map((b) => b.slug),
                5,
              )
            : empties.length || lonely.length
              ? 'Every other board'
              : 'Every board',
        why: 'Halfway up a board pays about 50, and only your best run on it counts.',
      })
    }
  }

  return { rows, foot: movesFoot(copy, empties.length, standings, you) }
}

function movesFoot(copy: PeriodCopy, empties: number, standings: Standing[], you: YouStanding | null): string {
  const lead = copy.noun ? `lead the ${copy.noun}` : 'lead all time'
  if (you && you.rank != null) {
    const rank = you.rank
    const around: { rank: number; name: string; score: number }[] = [...you.nearby, ...standings]
    if (rank === 1) {
      const second = around.find((e) => e.rank === 2 && e.name !== you.name)
      if (!second) return `You’re the only one on the boards${copy.noun ? ` ${copy.phrase}` : ''}.`
      const margin = you.score - second.score
      return margin > 0 ? `You ${lead} by ${count(margin, 'point')}.` : `You’re level with ${second.name} at the top.`
    }
    const above = around.find((e) => e.rank === rank - 1 && e.name !== you.name)
    if (!above) return ''
    const gap = above.score - you.score
    if (gap <= 0) return `You’re level on points with ${above.name}.`
    // Passing means more points than theirs, so a gap of exactly 300 takes four.
    const needed = Math.floor(gap / 100) + 1
    if (empties >= needed) return `${firstRuns(needed)} would put you past ${above.name}.`
    if (empties > 0) return `${firstRuns(empties)} would bring you within ${gap - 100 * empties} of ${above.name}.`
    return `${count(gap, 'point')} behind ${above.name}.`
  }
  const leader = standings[0]
  if (!leader) return copy.noun ? `Your first run puts you top of the ${copy.noun}.` : 'Your first run puts you top of the boards.'
  const needed = Math.floor(leader.score / 100) + 1
  if (empties >= needed) return `${firstRuns(needed)} and you’d ${lead}.`
  if (you) return `Your first run puts you on ${copy.noun ? `this ${copy.noun}’s` : 'the all-time'} standings.`
  return 'No account needed to get on a board.'
}

/* ---------- every board ---------- */

export type YouCell = { a: string; b: string; tone: 'on' | 'hint' | 'off' }

/** Your place on one board and the score that takes the next one, for a player with a name. */
export function youCell(
  line: BoardLine,
  you: YouStanding,
  best: number | undefined,
  next: BoardTop | null | undefined,
): YouCell {
  const place = you.byGame[line.slug]
  if (place) {
    const a = best != null ? `#${place.place} · ${formatLeaderboardScore(line.slug, best)}` : `#${place.place}`
    const b =
      place.place === 1
        ? 'You lead it'
        : next
          ? `Beat ${formatLeaderboardScore(line.slug, next.score)} for ${ordinal(place.place - 1)}`
          : count(place.points, 'point')
    return { a, b, tone: 'on' }
  }
  if (line.players === 1 && line.top[0]) {
    return { a: '–', b: `Just ${line.top[0].name}. Any run pays 50`, tone: 'hint' }
  }
  return { a: '–', b: 'Not played yet', tone: 'off' }
}

/** The one line a board's row has room for on a phone, under its leader. */
export function phoneLine(line: BoardLine, you: YouStanding | null, cell: YouCell | null): string {
  if (you && cell) {
    if (cell.tone === 'on') {
      const place = you.byGame[line.slug]?.place ?? 0
      if (place === 1) return 'You lead it'
      return `You #${place} · ${cell.b.charAt(0).toLowerCase()}${cell.b.slice(1)}`
    }
    if (cell.tone === 'hint') return cell.b
    return 'You haven’t played it yet'
  }
  const rest = line.top
    .slice(1)
    .map((t, i) => `${ordinal(i + 2)} ${t.name} ${formatLeaderboardScore(line.slug, t.score)}`)
  if (rest.length) return rest.join(' · ')
  return line.top[0] ? `Just ${line.top[0].name} so far. Any run pays 50` : ''
}

/* ---------- points ---------- */

export type ChartColumn = { slug: LeaderboardGame; points: number | null }

/**
 * A player's points board by board: yours when you have some, else the
 * leader's, so a newcomer sees what a full set of boards adds up to.
 */
export function pointsChart(
  copy: PeriodCopy,
  boards: BoardLine[],
  standings: Standing[],
  you: YouStanding | null,
): { title: string; sub: string; columns: ChartColumn[]; legend: string } {
  const total = boards.length
  const when = copy.noun ? ` ${copy.phrase}` : ', all time'
  const columnsFor = (byGame: Partial<Record<string, GlobalGamePlace>>) =>
    boards.map((b) => ({ slug: b.slug, points: byGame[b.slug]?.points ?? null }))
  const legendFor = (byGame: Partial<Record<string, GlobalGamePlace>>) =>
    boards
      .filter((b) => byGame[b.slug])
      .sort((a, b) => (byGame[b.slug]?.points ?? 0) - (byGame[a.slug]?.points ?? 0))
      .map((b) => `${gameName(b.slug)} ${byGame[b.slug]?.points}`)
      .join(' · ')

  if (you && you.rank != null) {
    const played = Object.keys(you.byGame).length
    return {
      title: `Your ${you.score.toLocaleString()}, board by board`,
      sub: `${played} of ${total} boards${when}`,
      columns: columnsFor(you.byGame),
      legend: legendFor(you.byGame),
    }
  }
  if (you) {
    return {
      title: copy.noun ? `Your ${copy.noun} so far` : 'Your boards so far',
      sub: `Nothing on the board yet. ${capital(numberWord(total))} boards, up to 100 each.`,
      columns: columnsFor({}),
      legend: `Nothing on the board yet${copy.noun ? ` ${copy.phrase}` : ''}.`,
    }
  }
  const leader = standings[0]
  if (!leader?.byGame) {
    return {
      title: 'Board by board',
      sub: `Nothing on the boards${copy.noun ? ` ${copy.phrase}` : ' yet'}.`,
      columns: columnsFor({}),
      legend: '',
    }
  }
  const played = Object.keys(leader.byGame).length
  return {
    title: `${leader.name}’s ${leader.score.toLocaleString()}, board by board`,
    sub: played === 1 ? `One board so far${when}` : `${played} of ${total} boards${when}`,
    columns: columnsFor(leader.byGame),
    legend: legendFor(leader.byGame),
  }
}
