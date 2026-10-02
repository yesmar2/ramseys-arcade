import { SkinMark } from './season/SkinMark'
import { Suspense, useState, type CSSProperties } from 'react'
import { deviceRequirementLabel, gamePlayableOn, getGame, isDailyGame } from '../data/games'
import { useDayCourse } from '../hooks/useDayBoard'
import { useGameBoard } from '../hooks/useGameBoard'
import { dailyTabHref, dayBoardHref, gameBoardHref, gamePlayHref, leaderboardHref, rankHref, recordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { dayBefore } from '../lib/archive'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { BOARD_NAMES } from '../lib/dailyWords'
import { useDeviceType } from '../lib/device'
import {
  boardCallout,
  boardHeadline,
  boardLede,
  boardYouStats,
  firstResultWord,
  firstRunWord,
  offBoardLines,
  oneRunBoard,
  placeBeating,
  playersFromRuns,
  playersNote,
  priceList,
  runsChart,
  youOnBoard,
  type BoardPlayer,
  type BoardYou,
} from '../lib/gameBoard'
import { hasGamePreview } from '../lib/gamePreviews'
import { lazyPage } from '../lib/lazyPage'
import { cachedMyGroups, groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatBoardScore, formatDayPoints, formatLeaderboardScore, isDayPointsBoard } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { gameHasRecords } from '../lib/records'
import { ordinal, periodCopy, type PeriodCopy, type Stat } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { DeviceIcon } from './DeviceIcon'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { LeaderboardList } from './LeaderboardList'
import { PlayerMark } from './PlayerMark'
import { ShareBoardButton } from './ShareBoardButton'
import { PlayerName } from './PlayerName'

/*
 * One game's own board. The banner is the game at the scale of the page, its
 * demo playing on the screen, with who leads it and by how much. Then where
 * you stand on it and your runs, and the board itself: one row per player at
 * their best run, and every run a tap away. Beside it, the scores to beat and
 * the way on to the other boards. What a place pays toward the standings is
 * left to How your rank works.
 *
 * A daily's board opens on today's. Its week, month and all time are its day points (leaderboardFormat
 * isDayPointsBoard): the points each day's board paid its players by place, added up, drawn as a plain
 * table of players, their days and their points.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

/** Rows before "show more", and how many more each press shows. */
const FIRST_ROWS = 10
const MORE_ROWS = 25

function dayOf(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function ChevronIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

export function ArrowIcon() {
  return (
    <svg className="sb-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}

export function TrophyIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3" />
    </svg>
  )
}

function Stats({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null
  return (
    <dl className="sb-stats">
      {stats.map((s) => (
        <div key={s.label} className="sb-stat">
          <dt className="visually-hidden">{s.label}</dt>
          <dd>
            <b>{s.value}</b>
            <span aria-hidden="true">{s.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------- the banner ---------- */

/** A daily's boards: today's runs, then its day points for the week, the month and all time. */
const DAILY_PERIODS: readonly LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all']

/**
 * The board's periods, as links. With no `period` none is on, and they're plain links, not tabs: a daily's
 * board on a past day, whose Today is today's.
 */
export function PeriodTabs({ slug, period }: { slug: LeaderboardGame; period?: LeaderboardPeriod }) {
  const periods = isDailyGame(slug) ? DAILY_PERIODS : VISIBLE_LEADERBOARD_PERIODS
  const tabs = period != null
  return (
    <div
      className="seg sb-periods gb-periods"
      role={tabs ? 'tablist' : 'group'}
      aria-label={tabs ? 'Period' : 'Today’s boards'}
      style={{ '--seg-count': periods.length } as CSSProperties}
    >
      {periods.map((p) => (
        <a
          key={p}
          role={tabs ? 'tab' : undefined}
          aria-selected={tabs ? p === period : undefined}
          className={`seg__item${p === period ? ' seg__item--active' : ''}`}
          href={gameBoardHref(slug, p)}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </div>
  )
}

function Banner({
  slug,
  period,
  copy,
  players,
  runs,
  loading,
  group,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  players: BoardPlayer[]
  runs: number
  loading: boolean
  group?: string
}) {
  const device = useDeviceType()
  const game = getGame(slug)!
  const accent = resolveGameAccent(slug, game.accent)
  const canPlay = gamePlayableOn(game, device)
  const points = isDayPointsBoard(slug, period)
  const head = points ? pointsHeadline(copy, players) : boardHeadline(slug, copy, players)
  const leader = players[0]
  // When it closes, without the trophies: those go to the standings across every board, not one game's.
  const closes = periodCopy(period, Date.now(), true).closes
  // A daily's today board steps back to yesterday's Ranked board, as that day's page steps on to today's; not on its first day.
  const { course } = useDayCourse(slug)
  const yesterday = course && period === 'daily' ? dayBefore(course.today()) : null
  const stepBack = course && yesterday && yesterday >= course.first ? yesterday : null
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  return (
    <section className="home-banner gb-banner" style={style} aria-labelledby="gb-title" data-hunt={`b-head-${slug}`}>
      <div className="home-banner__text gb-banner__text">
        <nav className="gb-crumb" aria-label="Breadcrumb">
          <a href={leaderboardHref(period)}>
            <BackIcon />
            Boards
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{game.name}</span>
        </nav>
        <p className="home-banner__kicker">
          {copy.kicker}
          {group ? ` · ${group}` : ''}
        </p>
        <h1 id="gb-title" className="gb-title">
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '12ch' } as CSSProperties} />
          ) : (
            <>
              {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
              {head.rest}
            </>
          )}
        </h1>
        <p className="home-banner__blurb gb-lede">
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />
          ) : points ? (
            POINTS_LEDE
          ) : (
            boardLede(slug, copy, players, runs)
          )}
        </p>
        <PeriodTabs slug={slug} period={period} />
        <div className="home-banner__acts">
          {canPlay ? (
            <a className="home-banner__cta" href={gamePlayHref(slug)}>
              Play {game.name}
            </a>
          ) : (
            <p className="gb-device" role="note">
              {deviceRequirementLabel(game)}
            </p>
          )}
          {/* A daily's records aren't in the record books: its page keeps them, on its Records tab. */}
          {isDailyGame(slug) ? (
            <a className="home-banner__ghost" href={dailyTabHref(slug, 'records')}>
              Records
            </a>
          ) : gameHasRecords(slug) ? (
            <a className="home-banner__ghost" href={recordsHref(slug, period)}>
              Record books
            </a>
          ) : null}
          {stepBack ? (
            <a className="home-banner__ghost" href={dayBoardHref(slug, stepBack)}>
              ‹ Yesterday’s {BOARD_NAMES.ranked} board
            </a>
          ) : null}
          <ShareBoardButton
            className="home-banner__ghost"
            text="Share"
            label={`${game.name} ${points ? 'leaders' : 'high scores'} on ${APP_NAME} (${PERIOD_LABELS[period]}). Your move.`}
            url={gameBoardHref(slug, period)}
          />
        </div>
        <p className="gb-closes">
          <TrophyIcon />
          <span>{closes}</span>
        </p>
      </div>
      {/* The game on its screen, playing itself the way a cabinet runs its demo; its thumb until it's ready. */}
      <a className="home-banner__art gb-banner__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
        {hasGamePreview(slug) ? (
          <>
            <GamePreview slug={slug} className="home-banner__screen" autoplay />
            <span className="home-banner__fade" />
            <span className="home-banner__start">Press start</span>
          </>
        ) : null}
        {leader ? (
          <span className="gb-marquee">
            {/* A daily's today board is led by whoever's 1st today: a record is a course's best across all time. */}
            <span>{points ? 'Most points' : isDailyGame(slug) && period === 'daily' ? '1st today' : 'Hi-score'}</span>
            <b>{formatBoardScore(slug, leader.best.score, period)}</b>
            <span>{leader.name}</span>
          </span>
        ) : null}
      </a>
    </section>
  )
}

/* ---------- you ---------- */

function YouOnBoard({
  slug,
  period,
  copy,
  you,
  avatarId,
}: {
  slug: string
  period: LeaderboardPeriod
  copy: PeriodCopy
  you: BoardYou
  avatarId?: string
}) {
  const count = you.runs.length
  return (
    <div className="sb-card sb-you__card">
      <div className="sb-you__top">
        <PlayerMark name={you.player.name} avatarId={avatarId} className="sb-you__mark" />
        <span className="sb-you__kicker">
          {you.player.name} · {copy.phrase}
        </span>
      </div>
      <p className="sb-you__big">
        <b>#{you.player.place}</b>
        <span>of {you.field.toLocaleString()}</span>
      </p>
      <p className="sb-you__line">
        {/* On a board that keeps one result a player, that one is yours whether or not it's your best. */}
        {oneRunBoard(slug, period)
          ? `Your first ${firstResultWord(slug)} today: ${formatLeaderboardScore(slug, you.player.best.score)}`
          : `Best ${formatLeaderboardScore(slug, you.player.best.score)} · ${count} ${count === 1 ? 'run' : 'runs'}`}
      </p>
      <div className="sb-you__foot">
        <Stats stats={boardYouStats(slug, you)} />
        <p className="gb-callout">
          <ArrowIcon />
          <span>{boardCallout(slug, you, period)}</span>
        </p>
      </div>
    </div>
  )
}

function YouOffBoard({
  slug,
  copy,
  name,
  players,
  allTimeBest,
}: {
  slug: LeaderboardGame
  copy: PeriodCopy
  name: string
  players: BoardPlayer[]
  allTimeBest: number | null
}) {
  const { line, callout } = offBoardLines(slug, copy, players, allTimeBest)
  return (
    <div className="sb-card sb-you__card">
      <div className="sb-you__top">
        <PlayerMark name={name} className="sb-you__mark" />
        <span className="sb-you__kicker">
          {name} · {copy.phrase}
        </span>
      </div>
      <h2 className="gb-you__title">Not on it yet</h2>
      <p className="sb-you__line">{line}</p>
      <p className="gb-callout gb-callout--quiet">
        <ArrowIcon />
        <span>{callout}</span>
      </p>
      <div className="sb-you__foot sb-you__foot--acts">
        <PlayLink slug={slug} />
      </div>
    </div>
  )
}

function FirstVisit({ slug, period }: { slug: LeaderboardGame; period: LeaderboardPeriod }) {
  // Today's board on a first-run daily keeps the day's first result, not the best.
  const counts = oneRunBoard(slug, period) ? `your first ${firstRunWord(slug)} of the day` : 'your best run'
  return (
    <div className="sb-card sb-you__card sb-first">
      <p className="sb-kicker">Get on the board</p>
      <h2 className="sb-first__title">Any run puts you on it.</h2>
      <p className="sb-first__text">Sign in to save your runs. Only {counts} counts.</p>
      <div className="sb-you__foot sb-you__foot--acts">
        <PlayLink slug={slug} />
      </div>
    </div>
  )
}

function PlayLink({ slug }: { slug: LeaderboardGame }) {
  const device = useDeviceType()
  const game = getGame(slug)
  if (!game || !gamePlayableOn(game, device)) return null
  return (
    <a className="gb-cta" href={gamePlayHref(slug)}>
      Play {game.name}
    </a>
  )
}

function RunsCard({ slug, copy, you, players }: { slug: string; copy: PeriodCopy; you: BoardYou; players: BoardPlayer[] }) {
  const chart = runsChart(slug, you, players)
  const best = you.player.best
  const runs = numberWord(chart.count)
  const sub =
    chart.count > 1
      ? `${runs.charAt(0).toUpperCase()}${runs.slice(1)} runs. Your best, ${formatLeaderboardScore(slug, best.score)}, came on ${dayOf(best.at)}.`
      : `One run, ${formatLeaderboardScore(slug, best.score)}, on ${dayOf(best.at)}.`
  return (
    <div className="sb-card gb-runs">
      <h2 className="sb-card__title">Your runs{copy.noun ? ` ${copy.phrase}` : ''}</h2>
      <p className="gb-card__sub">
        {sub}
        {chart.count > chart.bars.length ? ` The latest ${chart.bars.length} are here.` : ''}
      </p>
      <div className="gb-runs__plot" aria-hidden="true">
        {chart.lines.map((l) => (
          <span key={l.label} className="gb-runs__line" style={{ bottom: `${l.bottom}%` }}>
            <span>{l.label}</span>
          </span>
        ))}
        <ul className="gb-runs__bars">
          {chart.bars.map((b) => (
            <li key={b.id} className={`gb-runs__bar${b.best ? ' gb-runs__bar--best' : ''}`}>
              <span className="gb-runs__value">{b.score}</span>
              <span className="gb-runs__fill" style={{ height: `${b.height}%` }} />
            </li>
          ))}
        </ul>
      </div>
      <ul className="gb-runs__dates" aria-hidden="true">
        {chart.bars.map((b) => (
          <li key={b.id}>{dayOf(b.at)}</li>
        ))}
      </ul>
      <p className="visually-hidden">
        Your runs, oldest first: {chart.bars.map((b) => `${b.score} on ${dayOf(b.at)}`).join(', ')}.
      </p>
    </div>
  )
}

/** The scores that take each step up the board, best first: the score on the left, the step on the right. */
function ScoresCard({ slug, period, players }: { slug: string; period: LeaderboardPeriod; players: BoardPlayer[] }) {
  const rows = priceList(slug, players)
  const board = period === 'all' ? 'The all-time board' : `${PERIOD_LABELS[period]}’s board`
  return (
    <div className="sb-card gb-price">
      <h2 className="sb-card__title">Scores to beat</h2>
      <p className="gb-card__sub">
        {players.length ? `${board}, place by place.` : 'Nobody’s on it yet, so any run takes first.'}
      </p>
      <ul className="gb-price__rows">
        {rows.map((r) => (
          <li key={r.what} className="gb-price__row">
            <span className="gb-price__beat">
              <b>{r.beat}</b>
            </span>
            <span className="gb-price__step">{r.what}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OtherBoards({ others, period }: { others: ReturnType<typeof useGameBoard>['others']; period: LeaderboardPeriod }) {
  if (!others.length) return null
  // Yours first, by place; then the ones with runs; then the rest, in the catalog's order.
  const sorted = [...others]
    .map((o, i) => ({ ...o, i }))
    .sort(
      (a, b) =>
        (a.place == null ? 1 : 0) - (b.place == null ? 1 : 0) ||
        (a.place ?? 0) - (b.place ?? 0) ||
        (a.leader ? 0 : 1) - (b.leader ? 0 : 1) ||
        a.i - b.i,
    )
    .slice(0, 6)
  return (
    <div className="sb-card gb-more">
      <h2 className="sb-card__title">More boards</h2>
      <ul className="gb-more__rows">
        {sorted.map((o) => {
          const game = getGame(o.slug)
          if (!game) return null
          const accent = resolveGameAccent(o.slug, game.accent)
          return (
            <li key={o.slug}>
              <a className="gb-more__link" href={gameBoardHref(o.slug, period)}>
                <GameThumbArt slug={o.slug} accent={accent} className="gb-more__thumb" />
                <span className="gb-more__text">
                  <span className="gb-more__name">{game.name}</span>
                  <span className="gb-more__lead">
                    {/* A daily's week, month or all time leads on day points, which aren't a score: just the name. */}
                    {o.leader
                      ? isDayPointsBoard(o.slug, period)
                        ? o.leader.name
                        : `${o.leader.name} · ${formatBoardScore(o.slug, o.leader.score, period)}`
                      : 'No runs yet'}
                  </span>
                </span>
                {o.place ? <span className="gb-more__you">You #{o.place}</span> : <span />}
                <span className="gb-more__go" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- the board ---------- */

function PlayerRow({ slug, player, you, period }: { slug: string; player: BoardPlayer; you: string; period: LeaderboardPeriod }) {
  const mine = Boolean(you) && player.name === you
  const medal = MEDALS[player.place - 1]
  return (
    <li className={`gb-row${medal ? ` gb-row--${medal}` : ''}${mine ? ' gb-row--you' : ''}`}>
      <a className="gb-row__link" href={rankHref(player.name, period)}>
        <span className="gb-row__ord">{ordinal(player.place).toUpperCase()}</span>
        <PlayerMark name={player.name} avatarId={player.best.avatarId} className="gb-row__mark" />
        <span className="gb-row__who">
          <span className="gb-row__name">
            <PlayerName name={player.name} avatarId={player.best.avatarId} />
            <SkinMark skin={player.best.skin} />
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
          <span className="gb-row__runs">
            {player.runs} {player.runs === 1 ? 'run' : 'runs'}
          </span>
        </span>
        <span className="gb-row__best">{formatLeaderboardScore(slug, player.best.score)}</span>
        <span className="gb-row__set">
          <DeviceIcon device={player.best.device} />
          {dayOf(player.best.at)}
        </span>
      </a>
    </li>
  )
}

function Board({
  slug,
  period,
  copy,
  data,
  players,
  you,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  players: BoardPlayer[]
  you: string
}) {
  const [view, setView] = useState<'players' | 'runs'>('players')
  const [shown, setShown] = useState(FIRST_ROWS)
  const byPlayer = view === 'players'
  const length = byPlayer ? players.length : data.runs.length
  const left = length - shown
  const game = getGame(slug)!
  return (
    <section className="sb-card gb-board gb-board--five" aria-labelledby="gb-board-title" data-hunt={`b-board-${slug}`}>
      <div className="gb-board__head">
        <h2 id="gb-board-title" className="gb-board__title">
          The board
        </h2>
        {!data.loading && players.length ? (
          <span className="gb-board__count">
            {players.length.toLocaleString()} {players.length === 1 ? 'player' : 'players'} ·{' '}
            {data.total.toLocaleString()} {data.total === 1 ? 'run' : 'runs'}
          </span>
        ) : null}
        <div className="gb-tog" role="group" aria-label="Show">
          {(['players', 'runs'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={`gb-tog__b${view === v ? ' gb-tog__b--on' : ''}`}
              onClick={() => {
                setView(v)
                setShown(FIRST_ROWS)
              }}
            >
              {v === 'players' ? 'Players' : 'Every run'}
            </button>
          ))}
        </div>
      </div>
      <p className="gb-board__note">
        {byPlayer ? playersNote(slug, period) : 'Every run, best first.'}
      </p>
      {data.loading ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : !players.length ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">{groupBoardEmptyTitle(`Nobody’s on this board ${copy.noun ? copy.phrase : 'yet'}.`)}</p>
          <p className="gb-board__empty-text">Any run takes first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : byPlayer ? (
        <>
          <div className="gb-board__cols" aria-hidden="true">
            <span>Place</span>
            <span />
            <span>Player</span>
            {/* A first-result daily's today board keeps each player's first result, which needn't be their best. */}
            <span className="gb-board__num">{oneRunBoard(slug, period) ? 'Result' : 'Best'}</span>
            <span className="gb-board__set">Set</span>
          </div>
          <ol className="gb-rows">
            {players.slice(0, shown).map((p) => (
              <PlayerRow key={p.name} slug={slug} player={p} you={you} period={period} />
            ))}
          </ol>
        </>
      ) : (
        <LeaderboardList
          entries={data.runs}
          you={data.youRun}
          playerName={you}
          accent={resolveGameAccent(slug, game.accent)}
          shown={shown}
          period={period}
          formatScore={(score) => formatLeaderboardScore(slug, score)}
        />
      )}
      {!data.loading && left > 0 ? (
        <button type="button" className="gb-board__more" onClick={() => setShown((n) => n + MORE_ROWS)}>
          Show {Math.min(left, MORE_ROWS).toLocaleString()} more {byPlayer ? 'players' : 'runs'}
          <span> · {left.toLocaleString()} to go</span>
        </button>
      ) : null}
      {!data.loading && data.total > data.runs.length ? (
        <p className="gb-board__note">The first {data.runs.length.toLocaleString()} runs are shown.</p>
      ) : null}
    </section>
  )
}

/* ---------- a daily's day points ---------- */

const POINTS_LEDE = 'Play every day to climb: the better you finish each day, the more you add.'

/** Who leads a daily's day points, with the name apart so it can wear the gold. */
function pointsHeadline(copy: PeriodCopy, players: BoardPlayer[]): { name: string; rest: string } {
  const [first, second] = players
  if (!first) return { name: '', rest: `Nobody’s on it ${copy.noun ? copy.phrase : 'yet'}.` }
  // The same points is a tie, not a lead "0 pts clear".
  if (second && second.best.score === first.best.score) {
    return { name: '', rest: `${first.name} and ${second.name} are tied at the top, on ${formatDayPoints(first.best.score)}.` }
  }
  const lead = second ? `, ${formatDayPoints(first.best.score - second.best.score)} clear of ${second.name}` : ''
  return { name: first.name, rest: ` leads with ${formatDayPoints(first.best.score)}${lead}.` }
}

/** "3 days": the days a player's day points came from. */
function daysWords(entry: LeaderboardEntry): string {
  const n = entry.days ?? 1
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function PointsYou({ slug, copy, players, you }: { slug: LeaderboardGame; copy: PeriodCopy; players: BoardPlayer[]; you: string }) {
  const mine = you ? players.find((p) => p.name === you) : undefined
  if (!mine) {
    return (
      <div className="sb-card sb-first">
        <p className="sb-kicker">Get on it</p>
        <h2 className="sb-first__title">Play today and you’re on it.</h2>
        <p className="sb-first__text">
          Every day you play adds to your {copy.noun ? `total ${copy.phrase}` : 'all-time total'}.
        </p>
        <PlayLink slug={slug} />
      </div>
    )
  }
  const above = players[mine.place - 2]
  const below = players[mine.place]
  return (
    <div className="sb-card sb-you__card">
      <div className="sb-you__top">
        <PlayerMark name={mine.name} avatarId={mine.best.avatarId} className="sb-you__mark" />
        <span className="sb-you__kicker">
          {mine.name} · {copy.phrase}
        </span>
      </div>
      <p className="sb-you__big">
        <b>#{mine.place}</b>
        <span>of {players.length.toLocaleString()}</span>
      </p>
      <p className="sb-you__line">
        {formatDayPoints(mine.best.score)} from {daysWords(mine.best)}
        {/* Out-pointing the one above passes anyone tied with them too, so the place named is where that lands. */}
        {!above
          ? below && below.best.score === mine.best.score
            ? ` · tied with ${below.name}: you got there first`
            : ' · you lead it'
          : above.best.score === mine.best.score
            ? ` · tied with ${above.name}`
            : ` · ${formatDayPoints(above.best.score - mine.best.score)} off ${ordinal(placeBeating(players, above.best.score, mine.name))}`}
      </p>
    </div>
  )
}

function PointsRow({ player, you, period }: { player: BoardPlayer; you: string; period: LeaderboardPeriod }) {
  const mine = Boolean(you) && player.name === you
  const medal = MEDALS[player.place - 1]
  return (
    <li className={`gb-row${medal ? ` gb-row--${medal}` : ''}${mine ? ' gb-row--you' : ''}`}>
      <a className="gb-row__link" href={rankHref(player.name, period)}>
        <span className="gb-row__ord">{ordinal(player.place).toUpperCase()}</span>
        <PlayerMark name={player.name} avatarId={player.best.avatarId} className="gb-row__mark" />
        <span className="gb-row__who">
          <span className="gb-row__name">
            <PlayerName name={player.name} avatarId={player.best.avatarId} />
            <SkinMark skin={player.best.skin} />
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
          <span className="gb-row__runs">{daysWords(player.best)}</span>
        </span>
        <span className="gb-row__best">{formatDayPoints(player.best.score)}</span>
        <span className="gb-row__set">
          <DeviceIcon device={player.best.device} />
          {dayOf(player.best.at)}
        </span>
      </a>
    </li>
  )
}

/** A daily's day points for the week, the month or all time: a row a player, their days and their points. */
function PointsBoard({
  slug,
  period,
  copy,
  data,
  players,
  you,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  players: BoardPlayer[]
  you: string
}) {
  const [shown, setShown] = useState(FIRST_ROWS)
  const left = players.length - shown
  return (
    <section className="sb-card gb-board gb-board--five" aria-labelledby="gb-board-title" data-hunt={`b-board-${slug}`}>
      <div className="gb-board__head">
        <h2 id="gb-board-title" className="gb-board__title">
          The board
        </h2>
        {!data.loading && players.length ? (
          <span className="gb-board__count">
            {players.length.toLocaleString()} {players.length === 1 ? 'player' : 'players'}
          </span>
        ) : null}
      </div>
      <p className="gb-board__note">Points from every day played.</p>
      {data.loading ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : !players.length ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">{groupBoardEmptyTitle(`Nobody’s played ${copy.noun ? `${copy.phrase} ` : ''}yet.`)}</p>
          <p className="gb-board__empty-text">Play today to be first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : (
        <>
          <div className="gb-board__cols" aria-hidden="true">
            <span>Place</span>
            <span />
            <span>Player</span>
            <span className="gb-board__num">Points</span>
            <span className="gb-board__set">Last day</span>
          </div>
          <ol className="gb-rows">
            {players.slice(0, shown).map((p) => (
              <PointsRow key={p.name} player={p} you={you} period={period} />
            ))}
          </ol>
        </>
      )}
      {!data.loading && left > 0 ? (
        <button type="button" className="gb-board__more" onClick={() => setShown((n) => n + MORE_ROWS)}>
          Show {Math.min(left, MORE_ROWS).toLocaleString()} more players
          <span> · {left.toLocaleString()} to go</span>
        </button>
      ) : null}
    </section>
  )
}

/* ---------- the page ---------- */

/** A daily's board on a past day (components/DayBoard.tsx): its own chunk, as few visitors open one. */
const DayBoard = lazyPage(() => import('./DayBoard').then((m) => m.DayBoard))

/** While a past day's page is on its way: the banner's room and the board's rows, so nothing jumps. */
function DayBoardWaiting() {
  return (
    <div className="sb gb" aria-busy="true">
      <div className="home-banner gb-banner" />
      <div className="sb-card gb-board">
        <BoardSkeleton rows={FIRST_ROWS} />
      </div>
    </div>
  )
}

/**
 * One game's board for a period; with `day`, a daily's board on that past day, as it finished. A new day
 * is a new page: nothing carries over from the day before.
 */
export function GameBoard({ slug, period, day }: { slug: LeaderboardGame; period: LeaderboardPeriod; day?: string }) {
  if (day) {
    return (
      <Suspense fallback={<DayBoardWaiting />}>
        <DayBoard key={day} slug={slug} day={day} />
      </Suspense>
    )
  }
  return <PeriodBoard slug={slug} period={period} />
}

function PeriodBoard({ slug, period }: { slug: LeaderboardGame; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useGameBoard(slug, period, you, groupId)
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const players = playersFromRuns(data.runs)
  const standing = youOnBoard(players, data.runs, you)
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  const style = { '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties

  if (data.error) {
    return (
      <div className="sb gb" style={style}>
        <Banner slug={slug} period={period} copy={copy} players={[]} runs={0} loading={false} group={group} />
        <BoardEmpty title="Couldn’t load scores" detail="Check your connection and try again." />
      </div>
    )
  }

  // A daily's week, month or all time: its day points, one row a player.
  if (isDayPointsBoard(slug, period)) {
    return (
      <div className="sb gb" style={style}>
        <Banner slug={slug} period={period} copy={copy} players={players} runs={data.total} loading={data.loading} group={group} />
        {!data.loading ? (
          <section className="sb-you gb-you" aria-label="Your place on this board">
            <PointsYou slug={slug} copy={copy} players={players} you={you} />
          </section>
        ) : null}
        <div className="gb-main">
          <PointsBoard key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} players={players} you={you} />
          {!data.loading ? (
            <aside className="gb-side" aria-label="More about this board">
              <OtherBoards others={data.others} period={period} />
            </aside>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="sb gb" style={style}>
      <Banner
        slug={slug}
        period={period}
        copy={copy}
        players={players}
        runs={data.total}
        loading={data.loading}
        group={group}
      />

      {!data.loading ? (
        <section className="sb-you gb-you" aria-label="Your place on this board">
          {standing ? (
            <>
              <YouOnBoard slug={slug} period={period} copy={copy} you={standing} avatarId={data.youRun?.avatarId} />
              <RunsCard slug={slug} copy={copy} you={standing} players={players} />
            </>
          ) : (
            <>
              {you ? (
                <YouOffBoard slug={slug} copy={copy} name={you} players={players} allTimeBest={data.allTimeBest} />
              ) : (
                <FirstVisit slug={slug} period={period} />
              )}
              <ScoresCard slug={slug} period={period} players={players} />
            </>
          )}
        </section>
      ) : null}

      <div className="gb-main">
        <Board key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} players={players} you={you} />
        {!data.loading ? (
          <aside className="gb-side" aria-label="More about this board">
            {/* Once your run is on a board that takes one a player, no score on it is yours to beat. */}
            {standing && !oneRunBoard(slug, period) ? <ScoresCard slug={slug} period={period} players={players} /> : null}
            <OtherBoards others={data.others} period={period} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
