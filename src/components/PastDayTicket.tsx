import { getGame, isGameListed } from '../data/games'
import { dailyNumber as holeNumber } from '../games/acechase/daily'
import { dayNumber as wantedNumber, dayWanted, wantedNames } from '../games/findbug/daily'
import { dayTag as pourTag } from '../games/halffull/daily'
import { dayPlan } from '../games/halffull/plan'
import { glassNames } from '../games/halffull/planSvg'
import { dailyTrack, trackNumber } from '../games/hotlap/daily'
import { dailyCave } from '../games/lander/daily'
import { dailyCourse } from '../games/marblerun/daily'
import { dailyTabHref, gamePlayHref } from '../hooks/useHashRoute'
import { inArchive, useArchiveOpen, useDailyDays, type ArchiveDay, type DailyDays } from '../lib/archive'
import { archiveTip } from '../lib/dailyPast'
import { todaysHole } from '../lib/dailyHole'
import { dailyWords } from '../lib/dailyWords'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { andList, ordinal } from '../lib/profileMath'
import { medalFor, paceMsOf, type Medal } from '../lib/raceMedals'
import { doneOf, markOf, type DayMark } from '../lib/pastDays'
import { liveDailies, TODAY_DAILIES, type TodayDaily, type TodayKey, type TodayServerDay } from '../lib/today'
import { DayTicket, DoneCount, type TicketTile } from './DayTicket'
import { capital, dayParts, shortDate, WEEKDAY_NAMES } from './todayPunches'

/*
 * A past day's ticket on the Dailies page (/dailies/YYYY-MM-DD), in place of today's and in the same frame
 * (DayTicket.tsx): the dailies on that day's card as tiles, each with how you did (your result, and your
 * place under it where the game had places that day), or the way to play that day's course again, which
 * never changes the day. A tile's picture and name open the course's card on its game's Past tab, with
 * the day's boards. On the stub, whether the day was kept, and the streak as it stood that night.
 */

/**
 * The day's own course of a daily: its number, its name, where it's played again, and its card on the game's
 * Past tab (`page`, by the anchor the tab gives it: archive/*Archive.tsx).
 */
function courseOf(key: TodayKey, day: string): { kicker: string; title: string; play: string; page: string } {
  if (key === 'hole') {
    const hole = todaysHole(day)
    return { kicker: `Hole #${hole.n}`, title: hole.def.name, play: `${gamePlayHref('acechase')}?hole=day:${day}`, page: dailyTabHref('acechase', 'past', holeNumber(day)) }
  }
  if (key === 'track') {
    const track = dailyTrack(day)
    return { kicker: `Track #${track.n}`, title: track.name, play: `${gamePlayHref('hotlap')}?track=${trackNumber(day)}`, page: dailyTabHref('hotlap', 'past', trackNumber(day)) }
  }
  if (key === 'wanted') {
    return { kicker: `Wanted #${wantedNumber(day)}`, title: wantedNames(dayWanted(day)), play: `${gamePlayHref('findbug')}?day=${day}`, page: dailyTabHref('findbug', 'past', day) }
  }
  if (key === 'pour') {
    return { kicker: `Pour ${pourTag(day)}`, title: glassNames(dayPlan(day)), play: `${gamePlayHref('halffull')}?day=${day}`, page: dailyTabHref('halffull', 'past', day) }
  }
  if (key === 'cave') {
    const cave = dailyCave(day)
    return { kicker: `Cave #${cave.n}`, title: cave.name, play: `${gamePlayHref('lander')}?day=${day}`, page: dailyTabHref('lander', 'past', day) }
  }
  const course = dailyCourse(day)
  return { kicker: `Course #${course.n}`, title: course.name, play: `${gamePlayHref('marblerun')}?day=${day}`, page: dailyTabHref('marblerun', 'past', day) }
}

/** A racing daily's medal that day (lib/raceMedals.ts): your best then, against the day's blue. */
function medalOf(key: TodayKey, day: string, score: number): Medal | null {
  const pace = key === 'track' ? dailyTrack(day).pace : key === 'course' ? dailyCourse(day).pace : key === 'cave' ? dailyCave(day).pace : null
  // The racing dailies keep a million less the ms (their score.ts).
  return pace == null ? null : medalFor(paceMsOf(pace), 1_000_000 - score)
}

/** A daily on the day's ticket, as its tile shows it. */
function tileOf(daily: TodayDaily, day: string, days: DailyDays, said: TodayServerDay | undefined, locked: boolean): TicketTile {
  const slug = daily.slug
  const game = getGame(slug)?.name ?? daily.label
  const { kicker, title, play, page } = courseOf(daily.key, day)
  const entry: ArchiveDay | undefined = days.days?.find((d) => d.day === day)
  const you = entry?.you ?? null
  // The account's word first (it counts every tag it owns); the board's, for the tag on show, besides.
  const done = Boolean(said?.done?.includes(daily.key)) || you != null
  const verb = dailyWords(slug).verb
  return {
    key: daily.key,
    slug,
    game,
    course: `${kicker} · ${title}`,
    page,
    done,
    result: you ? formatLeaderboardScore(slug, you.score) : done ? 'Done' : null,
    // "38th of 65", where the game had places that day.
    note: you?.place != null && entry ? `${ordinal(you.place)} of ${entry.players}` : null,
    medal: you ? medalOf(daily.key, day, you.score) : null,
    play,
    // A day in the archive, without Plus: its play page says what the archive is.
    go: locked ? 'Plus' : verb,
    goLabel: locked ? `${game}, ${kicker}: in the archive, with Plus` : `${verb} ${game}, ${kicker}`,
    goTip: locked ? archiveTip(slug) : null,
  }
}

/** The stub's line: whether the day kept the streak, and how many were punched. */
function markLine(mark: DayMark, done: number, total: number): string {
  if (mark === 'full') return `Full ticket: all ${numberWord(total)} punched.`
  if (mark === 'kept') return `Kept: ${numberWord(done)} of ${numberWord(total)} punched.`
  if (mark === 'played') return `Not kept: ${numberWord(done)} of ${numberWord(total)} punched.`
  if (mark === 'frozen') return 'Missed, and a streak freeze covered it.'
  return 'Missed.'
}

export function PastDayTicket({
  day,
  said,
  streak,
  name,
  signedIn,
}: {
  day: string
  /** The account's word on the day, when it has one. */
  said: TodayServerDay | undefined
  /** The streak as it stood at the end of the day, kept or not. */
  streak: number
  /** The tag whose results are shown. */
  name: string
  signedIn: boolean
}) {
  // Each daily's days, every time and in the same order: a hook a game. Only the day's own show.
  const asked: Record<TodayKey, DailyDays> = {
    hole: useDailyDays('acechase', name),
    track: useDailyDays('hotlap', name),
    wanted: useDailyDays('findbug', name),
    pour: useDailyDays('halffull', name),
    course: useDailyDays('marblerun', name),
    cave: useDailyDays('lander', name),
  }
  const card = said?.live ? TODAY_DAILIES.filter((d) => said.live!.includes(d.key) && isGameListed(d.slug)) : liveDailies(day)
  const archiveOpen = useArchiveOpen()
  const locked = inArchive(day) && archiveOpen === false
  const tiles = card.map((d) => tileOf(d, day, asked[d.key], said, locked))
  const count = said ? doneOf(said) : null
  const done = count?.done ?? tiles.filter((t) => t.done).length
  const total = count?.of ?? tiles.length
  const mark = signedIn && said ? markOf(said) : null
  // The dailies listed now that joined after the day.
  const later = TODAY_DAILIES.filter((d) => d.from != null && d.from > day && isGameListed(d.slug)).map((d) => getGame(d.slug)?.name ?? d.label)

  return (
    <DayTicket
      labelId="past-ticket-title"
      title={`${WEEKDAY_NAMES[dayParts(day).weekday]}’s ticket`}
      count={signedIn ? <DoneCount done={done} total={total} /> : `${capital(numberWord(total))} dailies that day`}
      kicker={shortDate(day)}
      streak={mark ? streak : null}
      full={mark === 'full'}
      line={mark ? markLine(mark, done, total) : signedIn ? null : 'Sign in, and each day you play is marked here.'}
      punched={signedIn ? { done, total } : null}
      tiles={tiles}
    >
      {later.length ? <p className="today-card__note">{andList(later)} joined the Dailies later.</p> : null}
    </DayTicket>
  )
}
