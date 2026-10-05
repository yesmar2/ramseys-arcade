import { SkinMark } from './season/SkinMark'
import { getPersonalBest } from '../lib/personalBest'
import { useHeldHeight } from '../lib/heldShape'
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
  oneRunBoard,
  playersNote,
  runsChart,
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
import { BoardPlayers, BoardRuns } from './BoardPlayers'
import { PlayerMark } from './PlayerMark'
import { ShareBoardButton } from './ShareBoardButton'
import { PlayerName } from './PlayerName'

/*
 * One game's own board. The banner is the game at the scale of the page, its
 * demo playing on the screen, with who leads it and by how much. Then where
 * you stand on it and your runs (nothing, until you're on it), and the board
 * itself: one row per player at their best run, and every run a tap away.
 * Beside it, the way on to the other boards. What a place pays toward the standings is
 * left to How your rank works.
 *
 * A daily's board opens on today's. Its week, month and all time are its day points (leaderboardFormat
 * isDayPointsBoard): the points each day's board paid its players by place, added up, drawn as a plain
 * table of players, their days and their points.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

/** Rows a loading board holds room for: the players it opens on (useGameBoard FIRST_PLAYERS). */
const FIRST_ROWS = 10

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
  field,
  runs,
  loading,
  group,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  /** The board's first players: its leaders. */
  players: BoardPlayer[]
  /** How many players are on it. */
  field: number
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
  // They wrap with the names and numbers in them: held at last time's height while those load (lib/heldShape.ts).
  const titleHeld = useHeldHeight<HTMLHeadingElement>(`gb-title-${period}`, loading)
  const ledeHeld = useHeldHeight<HTMLParagraphElement>(`gb-lede-${period}`, loading)
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
        <h1 id="gb-title" className="gb-title" ref={titleHeld.ref} style={titleHeld.style}>
          {loading && points ? (
            <span className="skel-line" style={{ '--skel-w': '12ch' } as CSSProperties} />
          ) : loading ? (
            // The sentence it nearly always is (lib/gameBoard.ts boardHeadline), the leader and the gap shimmering,
            // so it wraps where the real one will, even the first time.
            <>
              <span className="skel-line" style={{ '--skel-w': '3.6em' } as CSSProperties} /> leads {game.name} by{' '}
              <span className="skel-line" style={{ '--skel-w': '3.4em' } as CSSProperties} />.
            </>
          ) : (
            <>
              {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
              {head.rest}
            </>
          )}
        </h1>
        <p className="home-banner__blurb gb-lede" ref={ledeHeld.ref} style={ledeHeld.style}>
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />
          ) : points ? (
            POINTS_LEDE
          ) : (
            boardLede(slug, copy, players, field, runs)
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

function RunsCard({ slug, copy, you, leader }: { slug: string; copy: PeriodCopy; you: BoardYou; leader: BoardPlayer | undefined }) {
  const chart = runsChart(slug, you, leader)
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
  you,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  you: string
}) {
  const [view, setView] = useState<'players' | 'runs'>('players')
  const byPlayer = view === 'players'
  const game = getGame(slug)!
  return (
    <section className="sb-card gb-board gb-board--five" aria-labelledby="gb-board-title" data-hunt={`b-board-${slug}`}>
      <div className="gb-board__head">
        <h2 id="gb-board-title" className="gb-board__title">
          The board
        </h2>
        {!data.loading && data.field ? (
          <span className="gb-board__count">
            {data.field.toLocaleString()} {data.field === 1 ? 'player' : 'players'} ·{' '}
            {data.runCount.toLocaleString()} {data.runCount === 1 ? 'run' : 'runs'}
          </span>
        ) : null}
        <div className="gb-tog" role="group" aria-label="Show">
          {(['players', 'runs'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={`gb-tog__b${view === v ? ' gb-tog__b--on' : ''}`}
              onClick={() => setView(v)}
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
      ) : !data.field ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">{groupBoardEmptyTitle(`Nobody’s on this board ${copy.noun ? copy.phrase : 'yet'}.`)}</p>
          <p className="gb-board__empty-text">Any run takes first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : byPlayer ? (
        <>
          <BoardPlayers
            cols={
              <div className="gb-board__cols" aria-hidden="true">
                <span>Place</span>
                <span />
                <span>Player</span>
                {/* A first-result daily's today board keeps each player's first result, which needn't be their best. */}
                <span className="gb-board__num">{oneRunBoard(slug, period) ? 'Result' : 'Best'}</span>
                <span className="gb-board__set">Set</span>
              </div>
            }
            slug={slug}
            period={period}
            top={data.top}
            around={data.around}
            field={data.field}
            you={data.you ? you : ''}
            bandLine={data.bandLine}
            row={(p) => <PlayerRow key={p.name} slug={slug} player={p} you={you} period={period} />}
          />
        </>
      ) : (
        <BoardRuns
          slug={slug}
          period={period}
          you={you}
          accent={resolveGameAccent(slug, game.accent)}
          formatScore={(score) => formatLeaderboardScore(slug, score)}
        />
      )}
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

function PointsYou({ slug, copy, you }: { slug: LeaderboardGame; copy: PeriodCopy; you: BoardYou | null }) {
  const mine = you?.player
  if (!you || !mine) {
    // Across its row, the words and the button side by side (a past day's card wears the same parts).
    return (
      <div className="sb-card sb-you__card sb-first gb-first">
        <div>
          <p className="sb-kicker">Get on it</p>
          <h2 className="sb-first__title">Play today and you’re on it.</h2>
          <p className="sb-first__text">
            Every day you play adds to your {copy.noun ? `total ${copy.phrase}` : 'all-time total'}.
          </p>
        </div>
        <div className="sb-you__foot sb-you__foot--acts">
          <PlayLink slug={slug} />
        </div>
      </div>
    )
  }
  const { above, below } = you
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
        <span>of {you.field.toLocaleString()}</span>
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
            : ` · ${formatDayPoints(above.best.score - mine.best.score)} off ${ordinal(you.nextPlace)}`}
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
  you,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  you: string
}) {
  return (
    <section className="sb-card gb-board gb-board--five" aria-labelledby="gb-board-title" data-hunt={`b-board-${slug}`}>
      <div className="gb-board__head">
        <h2 id="gb-board-title" className="gb-board__title">
          The board
        </h2>
        {!data.loading && data.field ? (
          <span className="gb-board__count">
            {data.field.toLocaleString()} {data.field === 1 ? 'player' : 'players'}
          </span>
        ) : null}
      </div>
      <p className="gb-board__note">Points from every day played.</p>
      {data.loading ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : !data.field ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">{groupBoardEmptyTitle(`Nobody’s played ${copy.noun ? `${copy.phrase} ` : ''}yet.`)}</p>
          <p className="gb-board__empty-text">Play today to be first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : (
        <>
          <BoardPlayers
            cols={
              <div className="gb-board__cols" aria-hidden="true">
                <span>Place</span>
                <span />
                <span>Player</span>
                <span className="gb-board__num">Points</span>
                <span className="gb-board__set">Last day</span>
              </div>
            }
            slug={slug}
            period={period}
            top={data.top}
            around={data.around}
            field={data.field}
            you={data.you ? you : ''}
            bandLine={null}
            row={(p) => <PointsRow key={p.name} player={p} you={you} period={period} />}
          />
        </>
      )}
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

/**
 * Your place on a board while it loads: its two cards' shapes, held at the height they had last time, so the
 * board under them doesn't move when they come.
 */
function YouWaiting({
  held,
  solo = false,
  likely = true,
}: {
  held: ReturnType<typeof useHeldHeight<HTMLElement>>
  solo?: boolean
  /** A first look, with nothing kept: whether you're likely on it, so worth holding room for. */
  likely?: boolean
}) {
  // Last time this board had no row for you (you weren't on it): hold no room for one now.
  if (held.known && !held.style) return null
  // A first look at this board: room only if you've a score in the game, as off the board there's no row.
  if (!held.known && !likely) return null
  const line = (w: string) => <span className="skel-line" style={{ '--skel-w': w } as CSSProperties} />
  return (
    <section className={`sb-you gb-you${solo ? ' sb-you--solo' : ''}`} aria-hidden="true" ref={held.ref} style={held.style}>
      {(solo ? [0] : [0, 1]).map((i) => (
        <div key={i} className="sb-card sb-you__card">
          <div className="sb-you__top">
            <span className="sb-you__kicker">{line('7rem')}</span>
          </div>
          <p className="sb-you__big">{line('5rem')}</p>
          <p className="sb-you__line">{line('14rem')}</p>
        </div>
      ))}
    </section>
  )
}

function PeriodBoard({ slug, period }: { slug: LeaderboardGame; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useGameBoard(slug, period, you, groupId)
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const players = data.top
  const standing = data.you
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  const style = { '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties
  const youHeld = useHeldHeight<HTMLElement>(`gb-you-${slug}-${period}`, data.loading)
  const mainHeld = useHeldHeight<HTMLDivElement>(`gb-main-${period}`, data.loading)

  if (data.error) {
    return (
      <div className="sb gb" style={style}>
        <Banner slug={slug} period={period} copy={copy} players={[]} field={0} runs={0} loading={false} group={group} />
        <BoardEmpty title="Couldn’t load scores" detail="Check your connection and try again." />
      </div>
    )
  }

  // A daily's week, month or all time: its day points, one row a player.
  if (isDayPointsBoard(slug, period)) {
    // One card across the row: your place, or the way onto a board that has players. An empty board says
    // "Play today to be first" itself, so the row stays (empty) only to tell the next wait to hold no room.
    const pointsCard = data.field > 0
    return (
      <div className="sb gb" style={style}>
        <Banner slug={slug} period={period} copy={copy} players={players} field={data.field} runs={data.runCount} loading={data.loading} group={group} />
        {data.loading ? <YouWaiting held={youHeld} solo /> : null}
        {!data.loading ? (
          <section
            className={`sb-you gb-you sb-you--solo${pointsCard ? '' : ' gb-you--none'}`}
            aria-label={pointsCard ? 'Your place on this board' : undefined}
            ref={youHeld.ref}
          >
            {pointsCard ? <PointsYou slug={slug} copy={copy} you={standing} /> : null}
          </section>
        ) : null}
        <div className="gb-main" ref={mainHeld.ref} style={mainHeld.style}>
          <PointsBoard key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} you={you} />
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
        field={data.field}
        runs={data.runCount}
        loading={data.loading}
        group={group}
      />

      {/* Signed out, nobody is on the board, so nothing waits for a place to show. */}
      {data.loading && you ? <YouWaiting held={youHeld} likely={getPersonalBest(slug) > 0} /> : null}
      {!data.loading ? (
        // Off the board, the row isn't drawn, but it's kept (empty) so the next visit's wait holds no room for it.
        <section
          className={`sb-you gb-you${standing ? '' : ' gb-you--none'}`}
          aria-label={standing ? 'Your place on this board' : undefined}
          ref={youHeld.ref}
        >
          {standing ? (
            <>
              <YouOnBoard slug={slug} period={period} copy={copy} you={standing} avatarId={data.youRun?.avatarId} />
              <RunsCard slug={slug} copy={copy} you={standing} leader={players[0]} />
            </>
          ) : null}
        </section>
      ) : null}

      <div className="gb-main" ref={mainHeld.ref} style={mainHeld.style}>
        <Board key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} you={you} />
        {!data.loading ? (
          <aside className="gb-side" aria-label="More about this board">
            <OtherBoards others={data.others} period={period} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
