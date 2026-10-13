import { SkinMark } from './season/SkinMark'
import { useHeldHeight } from '../lib/heldShape'
import { Suspense, useState, type CSSProperties, type ReactNode } from 'react'
import { gamePlayableOn, getGame, isDailyGame } from '../data/games'
import { useGameBoard } from '../hooks/useGameBoard'
import { gameBoardHref, gamePlayHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn, readableFill } from '../lib/color'
import { useDeviceType } from '../lib/device'
import { boardShare, gapFigure, playersNote, type BoardPlayer } from '../lib/gameBoard'
import { lazyPage } from '../lib/lazyPage'
import { useActiveGroup, useScope } from '../lib/groups'
import {
  normalizePlayerName,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatDayPoints, formatLeaderboardScore, isDayPointsBoard } from '../lib/leaderboardFormat'
import { ordinal, periodCopy, type PeriodCopy } from '../lib/scoreboard'
import { useSeason } from '../lib/season'
import { periodTabs, seasonHasStandings } from '../lib/seasonStandings'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { PeriodLabel } from './PeriodLabel'
import { BoardPlayers, BoardRuns } from './BoardPlayers'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'
import { RaceGhostButton } from './RaceGhostButton'
import { useAuth } from '../hooks/useAuth'
import { RACE_GHOST_GAMES } from '../lib/raceGhost'

/*
 * One game's board, on its page (GameHubPage: a game's Board tab, a daily's Today tab). Ramsey picked B of the
 * "Game page: board and records" canvas (2026-10-11): a game has one page, with its board and its records under
 * tabs, in place of a board page and a record book of their own. The board's top row is its periods; then one
 * row per player at their best run, and every run a tap away.
 *
 * Since the "Board and records, new looks" canvas it's C (Ramsey, 2026-10-13: "i don't really like the podium
 * anymore. i think i like the gap bars"): a row a player, with a bar of their score against 1st's, the top three
 * in their medals' colours and yours in the site's, and on yours how far behind the place above you are. Find a
 * player is on the top row, and there are no column heads.
 *
 * A daily's board opens on today's. Its week and month are its day points (leaderboardFormat
 * isDayPointsBoard): the points each day's board paid its players by place, added up, drawn as a plain
 * table of players, their days and their points. It has none for all time (lib/allTime.ts).
 *
 * A daily's board on a past day is a page of its own still (DayBoard.tsx), as it finished.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

/** Rows a loading board holds room for: the players it opens on (useGameBoard FIRST_PLAYERS). */
const FIRST_ROWS = 10

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

/** A daily's boards: today's runs, then its day points for the week and the month. It has none for all time (lib/allTime.ts). */
const DAILY_PERIODS: readonly LeaderboardPeriod[] = ['daily', 'weekly', 'monthly']

/**
 * The board's periods, as links, and while a season has standings, its Season tab after them. With no
 * `period` none is on, and they're plain links, not tabs: a daily's board on a past day, whose Today is today's.
 */
export function PeriodTabs({ slug, period }: { slug: LeaderboardGame; period?: LeaderboardPeriod }) {
  const season = seasonHasStandings(useSeason().season) || period === 'season'
  const periods = periodTabs(isDailyGame(slug) ? DAILY_PERIODS : VISIBLE_LEADERBOARD_PERIODS, season)
  const four = periods.length > 3
  const tabs = period != null
  return (
    <div
      className={`seg sb-periods gb-periods${four ? ' seg--four' : ''}`}
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
          <PeriodLabel period={p} four={four} />
        </a>
      ))}
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

/** "Closes tonight at 11:59 pm ET.": when the period's board closes, said after what it counts; all time never does. */
function closesWords(period: LeaderboardPeriod): string {
  return period === 'all' ? '' : ` ${periodCopy(period, Date.now(), true).closes}`
}

/**
 * The board's top row: its periods, how many are on it, and the switch between players and every run. A board
 * under a tab named for it needs no title; on a daily's Today tab, under today's card, it's "The board".
 */
function BoardHead({
  slug,
  period,
  title,
  count,
  findRef,
  findWait = false,
  children,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  title?: string
  count: string | null
  /** Where Find a player goes (BoardPlayers puts it there), before the switch. */
  findRef?: (el: HTMLSpanElement | null) => void
  /** While the board loads: Find a player's room, so a phone's top row doesn't grow when it comes. */
  findWait?: boolean
  children?: ReactNode
}) {
  return (
    <div className="gb-board__head gb-board__head--page" data-hunt={`b-head-${slug}`}>
      {title ? (
        <h2 id="gb-board-title" className="gb-board__title">
          {title}
        </h2>
      ) : null}
      <PeriodTabs slug={slug} period={period} />
      {count ? <span className="gb-board__count">{count}</span> : null}
      {findRef ? (
        <span className="gb-board__find" ref={findRef}>
          {findWait ? (
            <span className="gb-find" aria-hidden="true">
              <span className="gb-find__box skel-btn" />
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
    </div>
  )
}

/* ---------- the board ---------- */

/**
 * Today's board of a racing daily: its runs can be raced (race any ghost); `free` is the #1's, for anyone.
 * `known`: whether the account is, so a member's Plus is never mistaken for none while it's asked for.
 */
type RaceRows = { free: (place: number) => boolean; known: boolean; yourScore: number | null }

function RaceButton({ slug, player, mine, race }: { slug: string; player: BoardPlayer; mine: boolean; race: RaceRows }) {
  return (
    <RaceGhostButton
      playHref={gamePlayHref(slug)}
      name={player.name}
      time={formatLeaderboardScore(slug, player.best.score)}
      gap={race.yourScore != null && player.best.score > race.yourScore ? gapFigure(slug, player.best.score, race.yourScore) : null}
      needsPlus={race.free(player.place) ? false : race.known ? true : null}
      mine={mine}
    />
  )
}

/** "4 runs". */
function runsWords(runs: number): string {
  return `${runs} ${runs === 1 ? 'run' : 'runs'}`
}

/** "3 days": the days a player's day points came from. */
function daysWords(entry: LeaderboardEntry): string {
  const n = entry.days ?? 1
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** The player above yours on the rows asked for, for how far behind them you are. */
function placeAbove(data: ReturnType<typeof useGameBoard>, you: BoardPlayer | undefined): BoardPlayer | undefined {
  return you ? [...data.top, ...(data.around ?? [])].find((p) => p.place === you.place - 1) : undefined
}

/**
 * One player's row: place, mark, the player with their runs (or days), a bar of their score against 1st's
 * (`share`, lib/gameBoard boardShare), and their score. Yours says how far behind the place above you are (`sub`).
 */
function PlayerRow({
  slug,
  player,
  you,
  period,
  figure,
  sub,
  share,
  race,
}: {
  slug: string
  player: BoardPlayer
  you: string
  period: LeaderboardPeriod
  /** Their score as the board shows it: a best, or a daily's day points. */
  figure: string
  /** The line under their name. */
  sub: string
  share: number
  race?: RaceRows
}) {
  const mine = Boolean(you) && player.name === you
  const medal = MEDALS[player.place - 1]
  return (
    <li className={`gb-row gb-row--bar${medal ? ` gb-row--${medal}` : ''}${mine ? ' gb-row--you' : ''}`}>
      {/* The name is the row's link, stretched over it (boards.css); the skin beside it opens its own card. */}
      <div className="gb-row__link">
        <span className="gb-row__ord">{ordinal(player.place).toUpperCase()}</span>
        <PlayerMark name={player.name} avatarId={player.best.avatarId} className="gb-row__mark" />
        <span className="gb-row__who">
          <span className="gb-row__name">
            <a className="gb-row__go" href={rankHref(player.name, period)}>
              <PlayerName name={player.name} avatarId={player.best.avatarId} />
            </a>
            <SkinMark skin={player.best.skin} />
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
          <span className="gb-row__runs">{sub}</span>
        </span>
        <span className="gb-row__bar" aria-hidden="true">
          {share > 0 ? <span className="gb-row__fill" style={{ '--gb-share': `${(share * 100).toFixed(1)}%` } as CSSProperties} /> : null}
        </span>
        <span className="gb-row__best">{figure}</span>
        {race ? <RaceButton slug={slug} player={player} mine={mine} race={race} /> : null}
      </div>
    </li>
  )
}

/** A loading board: its first rows in their own shape, empty, so the board lands in place. */
function BarBoardSkeleton() {
  const line = (w: string) => <span className="skel-line" style={{ '--skel-w': w } as CSSProperties} />
  return (
    <div className="gb-list" aria-hidden="true">
      <ol className="gb-rows">
        {Array.from({ length: FIRST_ROWS }, (_, i) => (
          <li key={i} className="gb-row gb-row--bar">
            <div className="gb-row__link">
              <span className="gb-row__ord">{line('1.6rem')}</span>
              <span className="pmark pmark--empty gb-row__mark" />
              <span className="gb-row__who">{line('6rem')}</span>
              <span className="gb-row__bar" />
              <span className="gb-row__best">{line('3.5rem')}</span>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="gb-board__more skel-btn" disabled tabIndex={-1}>
        Show 25 more players
      </button>
    </div>
  )
}

function Board({
  slug,
  period,
  copy,
  data,
  you,
  title,
  noteHunt,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  you: string
  title?: string
  /** A bug hunt hiding place on the line over the table, on a game's page with no tabs (lib/bugHunt.ts). */
  noteHunt?: string
}) {
  const [view, setView] = useState<'players' | 'runs'>('players')
  const [findSlot, setFindSlot] = useState<HTMLSpanElement | null>(null)
  const byPlayer = view === 'players'
  const game = getGame(slug)!
  const { isPlus, signedIn, signedOut } = useAuth()
  const groupId = useActiveGroup()
  // With a group's boards the board is the group's, and says so: "5 players in OFFICE", "Nobody in OFFICE is on this board".
  const scope = useScope()
  // Today's board of a racing daily: each row's run can be raced as a ghost. A group's top needn't be the
  // course's #1, so there only Plus races.
  const yourRow = data.top.find((p) => p.name === you) ?? data.around?.find((p) => p.name === you)
  const race: RaceRows | undefined =
    period === 'daily' && RACE_GHOST_GAMES.has(slug)
      ? { free: (place: number) => isPlus || (!groupId && place === 1), known: signedIn || signedOut, yourScore: yourRow?.best.score ?? null }
      : undefined
  const count =
    !data.loading && data.field
      ? `${data.field.toLocaleString()} ${data.field === 1 ? 'player' : 'players'}${scope.id ? ` ${scope.where}` : ''} · ${data.runCount.toLocaleString()} ${data.runCount === 1 ? 'run' : 'runs'}`
      : null
  // Each bar is a score against 1st's; yours says how far behind the place above you are, tied in what the board
  // shows (two times can print the same whatever the milliseconds under them).
  const best = data.top[0]?.best.score ?? 0
  const above = placeAbove(data, yourRow)
  const yourLine =
    yourRow && above
      ? formatLeaderboardScore(slug, above.best.score) === formatLeaderboardScore(slug, yourRow.best.score)
        ? `tied with ${above.name}`
        : `${gapFigure(slug, above.best.score, yourRow.best.score)} behind ${above.name}`
      : null
  return (
    <section
      className="sb-card gb-board gb-board--bars"
      aria-labelledby={title ? 'gb-board-title' : undefined}
      aria-label={title ? undefined : `${game.name}’s board`}
      data-hunt={`b-board-${slug}`}
    >
      <BoardHead slug={slug} period={period} title={title} count={count} findRef={setFindSlot} findWait={data.loading}>
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
      </BoardHead>
      <p className="gb-board__note" data-hunt={noteHunt}>
        {byPlayer ? playersNote(slug, period) : 'Every run, best first.'}
        {closesWords(period)}
      </p>
      {data.loading ? (
        <BarBoardSkeleton />
      ) : !data.field ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">
            {scope.id ? `${scope.nobody} is` : 'Nobody’s'} on this board {copy.noun ? copy.phrase : 'yet'}.
          </p>
          <p className="gb-board__empty-text">Any run takes first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : byPlayer ? (
        <BoardPlayers
          slug={slug}
          period={period}
          top={data.top}
          around={data.around}
          field={data.field}
          you={data.you ? you : ''}
          bandLine={data.bandLine}
          findSlot={findSlot}
          row={(p) => (
            <PlayerRow
              key={p.name}
              slug={slug}
              player={p}
              you={you}
              period={period}
              figure={formatLeaderboardScore(slug, p.best.score)}
              sub={yourLine && p.name === yourRow?.name ? yourLine : runsWords(p.runs)}
              share={boardShare(slug, p.best.score, best)}
              race={race}
            />
          )}
        />
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

/** A daily's day points for the week or the month: a row a player, their days, a bar against 1st's and their points. */
function PointsBoard({
  slug,
  period,
  copy,
  data,
  you,
  title,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useGameBoard>
  you: string
  title?: string
}) {
  const game = getGame(slug)!
  const scope = useScope()
  const [findSlot, setFindSlot] = useState<HTMLSpanElement | null>(null)
  const count =
    !data.loading && data.field
      ? `${data.field.toLocaleString()} ${data.field === 1 ? 'player' : 'players'}${scope.id ? ` ${scope.where}` : ''}`
      : null
  // Points are always more is better, whatever the game's own board counts.
  const best = data.top[0]?.best.score ?? 0
  const yourRow = data.top.find((p) => p.name === you) ?? data.around?.find((p) => p.name === you)
  const above = placeAbove(data, yourRow)
  const yourLine =
    yourRow && above
      ? above.best.score === yourRow.best.score
        ? `tied with ${above.name}`
        : `${formatDayPoints(above.best.score - yourRow.best.score)} behind ${above.name}`
      : null
  return (
    <section
      className="sb-card gb-board gb-board--bars"
      aria-labelledby={title ? 'gb-board-title' : undefined}
      aria-label={title ? undefined : `${game.name}’s board`}
      data-hunt={`b-board-${slug}`}
    >
      <BoardHead slug={slug} period={period} title={title} count={count} findRef={setFindSlot} findWait={data.loading} />
      <p className="gb-board__note">
        Play every day to climb: the better you finish each day, the more points you add.
        {closesWords(period)}
      </p>
      {data.loading ? (
        <BarBoardSkeleton />
      ) : !data.field ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">
            {scope.id ? `${scope.nobody} has` : 'Nobody’s'} played {copy.noun ? `${copy.phrase} ` : ''}yet.
          </p>
          <p className="gb-board__empty-text">Play today to be first.</p>
          <PlayLink slug={slug} />
        </div>
      ) : (
        <BoardPlayers
          slug={slug}
          period={period}
          top={data.top}
          around={data.around}
          field={data.field}
          you={data.you ? you : ''}
          bandLine={null}
          findSlot={findSlot}
          row={(p) => (
            <PlayerRow
              key={p.name}
              slug={slug}
              player={p}
              you={you}
              period={period}
              figure={formatDayPoints(p.best.score)}
              sub={yourLine && p.name === yourRow?.name ? yourLine : daysWords(p.best)}
              share={best > 0 ? Math.min(1, Math.max(0, p.best.score / best)) : 0}
            />
          )}
        />
      )}
    </section>
  )
}

/* ---------- on a game's page ---------- */

/**
 * A game's board for a period, on its page: a game's Board tab, or the board under a daily's Today card (`title`
 * there, as no tab names it). A daily's week and month are its day points.
 */
export function GamePageBoard({
  slug,
  period,
  title,
  noteHunt,
  place,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  title?: string
  /** A bug hunt hiding place on the line over the table (lib/bugHunt.ts). */
  noteHunt?: string
  /** Its id, where a link to the board lands (BOARD_PLACE), when no tabs over it are that place. */
  place?: string
}) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useGameBoard(slug, period, you, groupId)
  // The Season tab's words name the season (lib/scoreboard.ts periodCopy): drawn again when it comes.
  useSeason()
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  const style = { '--gb-accent': accent, '--gb-accent-ink': inkOn(accent), '--gb-fill': readableFill(accent) } as CSSProperties
  // While it loads it holds the height it had last time on this device, so nothing under it jumps (lib/heldShape.ts).
  const held = useHeldHeight<HTMLDivElement>(`gb-page-${slug}-${period}`, data.loading)

  // sb-scope: the boards' colours (boards.css), the medals' inks and the lines, as the records tab has them from .sb.
  if (data.error) {
    return (
      <div id={place} className="gb gb--page sb-scope" style={style}>
        <BoardEmpty title="Couldn’t load scores" detail="Check your connection and try again." />
      </div>
    )
  }
  return (
    <div id={place} className="gb gb--page sb-scope" style={{ ...style, ...held.style }} ref={held.ref}>
      {isDayPointsBoard(slug, period) ? (
        <PointsBoard key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} you={you} title={title} />
      ) : (
        <Board key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} you={you} title={title} noteHunt={noteHunt} />
      )}
    </div>
  )
}

/* ---------- a daily's past day ---------- */

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

/** A daily's board on one past day, as it finished. A new day is a new page: nothing carries over from the day before. */
export function GameBoard({ slug, day }: { slug: LeaderboardGame; day: string }) {
  return (
    <Suspense fallback={<DayBoardWaiting />}>
      <DayBoard key={day} slug={slug} day={day} />
    </Suspense>
  )
}
