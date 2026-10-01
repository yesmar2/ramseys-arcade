import type { CSSProperties } from 'react'
import { getGame, isGameListed } from '../data/games'
import { dayNumber as wantedNumber, dayWanted, wantedNames } from '../games/findbug/daily'
import { dayTag as pourTag } from '../games/halffull/daily'
import { dayPlan } from '../games/halffull/plan'
import { glassNames } from '../games/halffull/planSvg'
import { dailyTrack, trackNumber } from '../games/hotlap/daily'
import { dailyCave } from '../games/lander/daily'
import { dailyCourse } from '../games/marblerun/daily'
import { dayBoardHref, gamePlayHref } from '../hooks/useHashRoute'
import { useDailyDays, type ArchiveDay, type DailyDays } from '../lib/archive'
import { todaysHole } from '../lib/dailyHole'
import { verbDone } from '../lib/dailyPast'
import { dailyWords } from '../lib/dailyWords'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { andList, ordinal } from '../lib/profileMath'
import { doneOf, markOf } from '../lib/pastDays'
import { liveDailies, TODAY_DAILIES, TODAY_KEEP, type TodayDaily, type TodayKey, type TodayServerDay } from '../lib/today'
import { PlayIcon } from './chromeIcons'
import { GameArt } from './GameArt'
import { CheckIcon } from './TodayCard'
import { StarIcon } from './TodayChip'
import { capital, dayParts, shortDate, WEEKDAY_NAMES } from './todayPunches'
import '../styles/today.css'
import '../styles/pastDay.css'

/*
 * A past day's ticket on the Dailies page (/dailies/YYYY-MM-DD), in place of today's: the dailies on that
 * day's card, each with its course that day, how you did (your place and result, from the day's board,
 * when the game has places), who was 1st, the way to play it again and its Ranked board; and on the stub,
 * whether the day was kept. A game without places that day (no 1st on its board) shows your result only.
 * Playing a past course again never changes the day.
 */

/** The day's own course of a daily: its number, its name, and where it's played again. */
function courseOf(key: TodayKey, day: string): { kicker: string; title: string; play: string } {
  if (key === 'hole') {
    const hole = todaysHole(day)
    return { kicker: `Hole #${hole.n}`, title: hole.def.name, play: `${gamePlayHref('acechase')}?hole=day:${day}` }
  }
  if (key === 'track') {
    const track = dailyTrack(day)
    return { kicker: `Track #${track.n}`, title: track.name, play: `${gamePlayHref('hotlap')}?track=${trackNumber(day)}` }
  }
  if (key === 'wanted') {
    return { kicker: `Wanted #${wantedNumber(day)}`, title: wantedNames(dayWanted(day)), play: `${gamePlayHref('findbug')}?day=${day}` }
  }
  if (key === 'pour') {
    return { kicker: `Pour ${pourTag(day)}`, title: glassNames(dayPlan(day)), play: `${gamePlayHref('halffull')}?day=${day}` }
  }
  if (key === 'cave') {
    const cave = dailyCave(day)
    return { kicker: `Cave #${cave.n}`, title: cave.name, play: `${gamePlayHref('lander')}?day=${day}` }
  }
  const course = dailyCourse(day)
  return { kicker: `Course #${course.n}`, title: course.name, play: `${gamePlayHref('marblerun')}?day=${day}` }
}

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z" />
  </svg>
)

/** One daily on the day's ticket, worked out once for both layouts. */
type Slot = {
  daily: TodayDaily
  game: string
  kicker: string
  title: string
  play: string
  done: boolean
  /** "38th of 65", or the result alone where there were no places; null when not played (or not known yet). */
  you: { place: string | null; result: string } | null
  /** "Not raced", once the day's known not to have been played; null signed out. */
  not: string | null
  /** The day's 1st and its field, where the day had places. */
  first: { name: string; result: string; field: string } | null
  /** The day's Ranked board, where it has one. */
  board: string | null
  verb: string
}

function slotOf(daily: TodayDaily, day: string, days: DailyDays, said: TodayServerDay | undefined, signedIn: boolean): Slot {
  const slug = daily.slug
  const own = courseOf(daily.key, day)
  const entry: ArchiveDay | undefined = days.days?.find((d) => d.day === day)
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const you = entry?.you ?? null
  // The account's word first (it counts every tag it owns); the board's, for the tag on show, besides.
  const done = Boolean(said?.done?.includes(daily.key)) || you != null
  const top = entry?.top ?? null
  return {
    daily,
    game: getGame(slug)?.name ?? daily.label,
    ...own,
    done,
    you: you ? { place: you.place != null && entry ? `${ordinal(you.place)} of ${entry.players}` : null, result: fmt(you.score) } : null,
    not: signedIn && !done && (said || days.days) ? `Not ${verbDone(slug)}` : null,
    first: top && entry ? { name: top.name, result: fmt(top.score), field: `${entry.players.toLocaleString()} ${verbDone(slug)}` } : null,
    board: top ? dayBoardHref(slug, day) : null,
    verb: dailyWords(slug).verb,
  }
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
  const slots = card.map((d) => slotOf(d, day, asked[d.key], said, signedIn))
  const count = said ? doneOf(said) : null
  const done = count?.done ?? slots.filter((s) => s.done).length
  const total = count?.of ?? slots.length
  const mark = said ? markOf(said) : null
  const weekday = WEEKDAY_NAMES[dayParts(day).weekday]
  const more = total > TODAY_KEEP
  // The dailies listed now that joined after the day.
  const later = TODAY_DAILIES.filter((d) => d.from != null && d.from > day && isGameListed(d.slug)).map((d) => getGame(d.slug)?.name ?? d.label)

  return (
    <section className="today pdt" aria-labelledby="pdt-title">
      <div className="today-card">
        <div className="today-card__stub">
          <span className="today-card__notch today-card__notch--a" aria-hidden="true" />
          <span className="today-card__notch today-card__notch--b" aria-hidden="true" />
          <div className="today-card__stub-top">
            <span className="today-card__label">{shortDate(day)}</span>
          </div>
          {signedIn && mark ? (
            <>
              <p className={`pdt-status pdt-status--${mark}`}>
                <span className="pdt-status__mark" aria-hidden="true">
                  {mark === 'full' ? <StarIcon /> : mark === 'kept' ? <CheckIcon /> : null}
                </span>
                {mark === 'full' ? 'Full ticket' : mark === 'kept' ? 'Kept' : mark === 'played' ? 'Not kept' : 'Missed'}
              </p>
              <p className="pdt-status__line">
                {capital(numberWord(done))} of {numberWord(total)} punched
                {(mark === 'kept' || mark === 'full') && streak > 0 ? `: day ${streak} of your streak.` : '.'}
              </p>
            </>
          ) : signedIn ? null : (
            <p className="today-card__signin">Sign in, and each day you play is marked here, with your places.</p>
          )}
          <p className="today-card__rule">
            {more ? `Any three punched kept a day. All ${numberWord(total)} was a Full ticket.` : `A day counted once all ${numberWord(total)} were punched.`}
          </p>
        </div>

        <div className="today-card__body">
          <div className="today-card__head">
            <div>
              <h2 id="pdt-title" className="today-card__title">
                {weekday}’s ticket
              </h2>
              <p className="today-card__date">{signedIn ? `${done} of ${total} done` : `${capital(numberWord(total))} dailies that day`}</p>
            </div>
          </div>

          {/* A desktop's row, as today's ticket has it. */}
          <ul
            className={`today-row${slots.length > 3 ? ' today-row--wide' : ''}${slots.length > 4 ? ' today-row--many' : ''} pdt-row`}
            style={{ '--n': slots.length } as CSSProperties}
          >
            {slots.map((s) => (
              <li key={s.daily.key} className={`today-slot${s.done ? ' today-slot--done' : ''}`}>
                <a className="today-slot__art" href={s.play} tabIndex={-1} aria-hidden="true">
                  <GameArt slug={s.daily.slug} className="today-slot__scene" />
                  {s.done ? <span className="today-slot__stamp">Punched</span> : null}
                </a>
                <div className="today-slot__text">
                  <span className="today-slot__kicker">{s.kicker}</span>
                  <b className="today-slot__game">{s.game}</b>
                  <span className="today-slot__title">{s.title}</span>
                  {s.you ? (
                    <span className="today-slot__mine">You: {s.you.place ?? s.you.result}</span>
                  ) : s.done ? (
                    <span className="today-slot__mine">You: done</span>
                  ) : s.not ? (
                    <span className="pdt-not">{s.not}</span>
                  ) : null}
                  {s.you?.place ? <span className="pdt-result">{s.you.result}</span> : null}
                  {s.first ? (
                    <span className="pdt-first">
                      <CrownIcon />
                      {s.first.name}, {s.first.result} · {s.first.field}
                    </span>
                  ) : null}
                </div>
                <a className={s.done ? 'pdt-again' : 'today-slot__go'} href={s.play}>
                  <PlayIcon />
                  {s.verb} {s.done ? 'again' : 'it'}
                </a>
                {s.board ? (
                  <a className="today-past today-slot__past" href={s.board}>
                    Ranked board ›
                  </a>
                ) : null}
              </li>
            ))}
          </ul>

          {/* A phone's list: one row a daily. */}
          <ul className="pdt-list">
            {slots.map((s) => (
              <li key={s.daily.key} className={`pdt-item${s.done ? ' pdt-item--done' : ''}`}>
                <span className="pdt-item__art" aria-hidden="true">
                  <GameArt slug={s.daily.slug} className="pdt-item__scene" />
                  {s.done ? (
                    <span className="pdt-item__check">
                      <CheckIcon />
                    </span>
                  ) : null}
                </span>
                <span className="pdt-item__text">
                  <b>{s.game}</b>
                  <span>
                    {s.kicker} · {s.title}
                  </span>
                </span>
                <span className="pdt-item__you">
                  {s.you ? (
                    <>
                      <b>{s.you.place ?? s.you.result}</b>
                      {s.you.place ? <span>{s.you.result}</span> : null}
                    </>
                  ) : s.done ? (
                    <b>Done</b>
                  ) : s.not ? (
                    <b className="pdt-item__no">{s.not}</b>
                  ) : null}
                  {s.first && !s.you ? (
                    <span>
                      1st {s.first.name}, {s.first.result}
                    </span>
                  ) : null}
                </span>
                <span className="pdt-item__go">
                  <a className={s.done ? 'pdt-again' : 'today-slot__go'} href={s.play}>
                    <PlayIcon />
                    {s.verb} {s.done ? 'again' : 'it'}
                  </a>
                  {s.board ? (
                    <a className="today-past" href={s.board}>
                      Ranked board ›
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {later.length ? <p className="pdt-later">{andList(later)} joined the Dailies later.</p> : null}
        </div>
      </div>
    </section>
  )
}
