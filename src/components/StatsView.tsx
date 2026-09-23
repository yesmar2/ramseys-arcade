import { useState, type CSSProperties, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { gameHubHref, homeHref, recordHref, recordsIndexHref } from '../hooks/useHashRoute'
import { PERIOD_LABELS, type LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal, periodWord } from '../lib/profileMath'
import type { GameStat, NearRecord, StatsHeadline, StatsStreak } from '../lib/stats'
import {
  bestDay,
  boardDayKey,
  bestStreak,
  calendarWeeks,
  chartWindow,
  dayBars,
  dayLabel,
  daysBetween,
  favouriteDays,
  nearWords,
  playedWhen,
  sortGames,
  spanLabel,
  type GameSort,
} from '../lib/statsView'
import { resolveGameAccent } from '../lib/theme'
import { ChevronRightIcon, FlameIcon } from './chromeIcons'
import { GameThumbArt } from './GameThumbArt'

/** Weeks the calendar shows on a wide screen, and the last of them a phone keeps. */
const CALENDAR_WEEKS = 18
const PHONE_WEEKS = 12

/** What each game counts, where it is not points. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
  fireflies: ['note', 'notes'],
}

function scoreText(slug: string, score: number): string {
  const unit = UNITS[slug]
  const n = formatLeaderboardScore(slug, score)
  return unit ? `${n} ${score === 1 ? unit[0] : unit[1]}` : n
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

function accentOf(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

/* ---------- the top: the period in numbers, and the streak ---------- */

const PERIOD_CAPS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'Your week so far',
  monthly: 'Your month so far',
  all: 'All time',
}

export function StatsHero({
  art,
  period,
  headline,
  streak,
  today,
}: {
  art: ReactNode
  period: LeaderboardPeriod
  headline: StatsHeadline
  streak: StatsStreak
  today: number
}) {
  const when = periodWord(period)
  const first = streak.days.length ? Math.min(...streak.days) : null
  const title =
    headline.runs > 0
      ? `${count(headline.runs, 'run')} on ${count(headline.days, 'day')}`
      : period === 'all'
        ? 'No runs yet'
        : `No runs ${when} yet`
  const since =
    first != null
      ? period === 'all'
        ? `Since you started on ${dayLabel(first)}.`
        : `Since you started on ${dayLabel(first)}, you’ve played on ${count(streak.days.length, 'day')}.`
      : ''
  const sub =
    headline.runs > 0
      ? `${count(headline.games, 'game')} ${period === 'all' ? 'played' : when}. ${since}`
      : `Play any game and it shows up here. ${since}`

  return (
    <section className="sv-hero" aria-labelledby="sv-title">
      <div className="sv-hero__main">
        <span className="sv-hero__art" aria-hidden="true">
          {art}
        </span>
        <div className="sv-hero__text">
          <p className="sv-cap sv-cap--you">{PERIOD_CAPS[period]}</p>
          <h1 id="sv-title" className="sv-hero__title">
            {title}
          </h1>
          <p className="sv-hero__sub">{sub.trim()}</p>
        </div>
      </div>
      <StreakPanel streak={streak} today={today} />
    </section>
  )
}

function StreakPanel({ streak, today }: { streak: StatsStreak; today: number }) {
  const best = bestStreak(streak.days)
  const playedToday = streak.days.includes(today)
  const { current } = streak
  const now = playedToday
    ? `You played today. Come back tomorrow to make it ${current + 1}.`
    : current > 0
      ? `Play today to make it ${current + 1}.`
      : 'Play any game today to start one.'
  return (
    <div className="sv-streak">
      <div className="sv-streak__head">
        <span className="sv-streak__mark" aria-hidden="true">
          <FlameIcon />
        </span>
        <div>
          <p className="sv-streak__big">{current > 0 ? `${current}-day streak` : 'No streak yet'}</p>
          {best && best.length > 1 ? (
            <p className="sv-streak__best">
              Best: {best.length} days, {spanLabel(best.start, best.end)}
            </p>
          ) : null}
        </div>
      </div>
      <p className={`sv-streak__now${playedToday ? ' sv-streak__now--done' : ''}`}>{now}</p>
    </div>
  )
}

/* ---------- every day you played ---------- */

export function StatsCalendar({ streak, today }: { streak: StatsStreak; today: number }) {
  const weeks = calendarWeeks(streak.days, today, CALENDAR_WEEKS)
  const first = streak.days.length ? Math.min(...streak.days) : null
  const best = bestStreak(streak.days)
  const favourite = favouriteDays(streak.days)
  const played = streak.days.length

  return (
    <section className="sv-card sv-cal" aria-labelledby="sv-cal-title">
      <div className="sv-card__head">
        <h2 id="sv-cal-title" className="sv-card__title">
          Every day you played
        </h2>
        <span className="sv-note">
          <span className="sv-cal__span--wide">last 18 weeks</span>
          <span className="sv-cal__span--narrow">last 12 weeks</span>
        </span>
      </div>
      <div
        className="sv-cal__grid"
        role="img"
        aria-label={`${count(played, 'day')} played${first ? ` since ${dayLabel(first)}` : ''}${streak.current > 0 ? `, ${streak.current} in a row up to today` : ''}`}
      >
        {/* One grid, filled a column at a time: the day names, then each week under its month. A phone drops the oldest six weeks. */}
        <span aria-hidden="true" />
        {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
          <span key={`label-${i}`} className="sv-cal__label" aria-hidden="true">
            {d}
          </span>
        ))}
        {weeks.map((w, i) => {
          const old = i < CALENDAR_WEEKS - PHONE_WEEKS ? ' sv-cal__old' : ''
          return [
            <span key={`m-${w.first}`} className={`sv-cal__month${old}`} aria-hidden="true">
              {w.month}
            </span>,
            ...w.days.map((d) => (
              <span
                key={d.key}
                className={`sv-cal__day${d.played ? ' sv-cal__day--on' : ''}${d.future ? ' sv-cal__day--future' : ''}${d.today ? ' sv-cal__day--today' : ''}${old}`}
                title={`${dayLabel(d.key)}${d.played ? ', played' : ''}`}
              />
            )),
          ]
        })}
      </div>
      <ul className="sv-facts">
        <li>
          <b>{count(played, 'day')}</b>
          <span>{first ? `played since ${dayLabel(first)}` : 'played'}</span>
        </li>
        <li>
          <b>{count(best?.length ?? 0, 'day')}</b>
          <span>your best streak</span>
        </li>
        {favourite ? (
          <li>
            <b title={favourite.long}>{favourite.short}</b>
            <span>the days you play most</span>
          </li>
        ) : null}
      </ul>
    </section>
  )
}

/* ---------- records within reach ---------- */

export function StatsRecords({ records }: { records: NearRecord[] }) {
  const shown = records.slice(0, 4)
  return (
    <section className="sv-card sv-recs" aria-labelledby="sv-recs-title">
      <div className="sv-card__head">
        <h2 id="sv-recs-title" className="sv-card__title">
          Records within reach
        </h2>
        <a className="sv-more" href={recordsIndexHref()}>
          Record books
          <ChevronRightIcon />
        </a>
      </div>
      {shown.length === 0 ? (
        <p className="sv-empty">
          Post a run on a game with record books, and the records you’re closest to taking show up here.
        </p>
      ) : (
        <ul className="sv-recs__list">
          {shown.map((r) => {
            const words = nearWords(r)
            const accent = accentOf(r.game)
            return (
              <li key={`${r.game}-${r.recordId}`}>
                <a className="sv-rec" href={recordHref(r.game, r.recordId, 'all')} style={{ '--g': accent } as CSSProperties}>
                  <span className="sv-rec__art" aria-hidden="true">
                    <GameThumbArt slug={r.game} accent={accent} />
                  </span>
                  <span className="sv-rec__text">
                    <span className="sv-rec__head">
                      <span className="sv-rec__label">{r.label}</span>
                      <span className="sv-rec__game">{getGame(r.game)?.name ?? r.game}</span>
                    </span>
                    <span className="sv-rec__bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, r.closeness)}%` }} />
                    </span>
                    <span className="sv-rec__nums">
                      <span>
                        You <b>{words.yours}</b>
                      </span>
                      <span>{words.off}</span>
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------- your games ---------- */

const SORTS: { id: GameSort; label: string }[] = [
  { id: 'recent', label: 'Recently played' },
  { id: 'most', label: 'Most played' },
  { id: 'place', label: 'Best place' },
]

export function StatsGames({
  games,
  period,
  runs,
  today,
}: {
  games: GameStat[]
  period: LeaderboardPeriod
  runs: number
  today: number
}) {
  const [sort, setSort] = useState<GameSort>('recent')
  const axis = chartWindow(period, today)
  const sorted = sortGames(games, sort)
  const when = periodWord(period)

  return (
    <section className="sv-card sv-games" id="stats-games" aria-labelledby="sv-games-title">
      <div className="sv-games__bar">
        <div className="sv-games__title-row">
          <h2 id="sv-games-title" className="sv-card__title">
            Your games {period === 'all' ? 'all time' : when}
          </h2>
          {games.length > 0 ? (
            <span className="sv-note">
              {count(games.length, 'game')} · {count(runs, 'run')}
            </span>
          ) : null}
        </div>
        {games.length > 1 ? (
          <div className="sv-seg" role="group" aria-label="Sort your games">
            {SORTS.map((s) => (
              <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {games.length === 0 ? (
        <p className="sv-empty">
          No runs {period === 'all' ? 'yet' : when}.{' '}
          <a className="sv-more" href={homeHref()}>
            Pick a game
            <ChevronRightIcon />
          </a>
        </p>
      ) : (
        <>
          <div className="sv-games__cols" aria-hidden="true">
            <span />
            <span>Game</span>
            <span>{PERIOD_LABELS[period]}</span>
            <span>Best</span>
            {axis ? (
              <span className="sv-games__axis">
                <span>{axis.from}</span>
                <span>Each day you played</span>
                <span>{axis.to}</span>
              </span>
            ) : (
              <span />
            )}
            <span className="sv-games__num">Avg</span>
            <span className="sv-games__num">Runs</span>
          </div>
          <ul className="sv-games__list">
            {sorted.map((g) => (
              <GameRow key={g.slug} stat={g} period={period} axis={axis} today={today} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function GameRow({
  stat,
  period,
  axis,
  today,
}: {
  stat: GameStat
  period: LeaderboardPeriod
  axis: ReturnType<typeof chartWindow>
  today: number
}) {
  const game = getGame(stat.slug)
  const accent = accentOf(stat.slug)
  const day = bestDay(stat)
  const last = playedWhen(Math.min(today, boardDayKey(stat.lastPlayedAt)), today)
  const bars = axis ? dayBars(stat.trend, axis) : []
  const medal = stat.rank != null && stat.rank <= 3 ? ` sv-place--p${stat.rank}` : ''
  const todaySlot = axis ? daysBetween(axis.start, today) : -1

  return (
    <li>
      <a className="sv-game" href={gameHubHref(stat.slug, period)} style={{ '--g': accent } as CSSProperties}>
        <span className="sv-game__art" aria-hidden="true">
          <GameThumbArt slug={stat.slug} accent={accent} />
        </span>
        <span className="sv-game__name">
          <b>{game?.name ?? stat.slug}</b>
          <span>played {last}</span>
        </span>
        <span className={`sv-place${medal}`}>
          {stat.rank != null ? (
            <>
              <b>{ordinal(stat.rank)}</b> of {stat.totalPlayers.toLocaleString()}
            </>
          ) : (
            '—'
          )}
        </span>
        <span className="sv-game__best">
          <b>{scoreText(stat.slug, stat.best)}</b>
          {day ? <span>best, {dayLabel(day)}</span> : null}
        </span>
        {axis ? (
          <span className="sv-bars" role="img" aria-label={`Your best on each day you played ${game?.name ?? stat.slug} ${periodWord(period)}`}>
            {bars.map((b) => (
              <span
                key={b.slot}
                className={`sv-bars__bar${b.best ? ' sv-bars__bar--best' : ''}`}
                style={{
                  left: `${(b.slot / axis.slots) * 100}%`,
                  width: `${Math.max(0.8, 62 / axis.slots)}%`,
                  height: `${Math.max(10, b.share * 100)}%`,
                }}
              />
            ))}
            {todaySlot >= 0 && todaySlot < axis.slots ? (
              <span className="sv-bars__today" style={{ left: `${((todaySlot + 0.31) / axis.slots) * 100}%` }} />
            ) : null}
          </span>
        ) : (
          <span />
        )}
        <span className="sv-game__num">
          <b>{formatLeaderboardScore(stat.slug, stat.average)}</b>
          <span>average</span>
        </span>
        <span className="sv-game__num">
          <b>{stat.runs.toLocaleString()}</b>
          <span>{stat.runs === 1 ? 'run' : 'runs'}</span>
        </span>
      </a>
    </li>
  )
}
