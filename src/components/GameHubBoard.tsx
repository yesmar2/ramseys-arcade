import { SkinMark } from './season/SkinMark'
import { isDailyGame } from '../data/games'
import { applySitePeriod, gameBoardHref, gameHubHref, rankHref, useRoute } from '../hooks/useHashRoute'
import type { HubBoard } from '../hooks/useGameHub'
import { firstRunWord, type BoardPlayer } from '../lib/gameBoard'
import { dailyHistory, type DailyHistory } from '../lib/gameHub'
import { groupBoardEmptyTitle } from '../lib/groups'
import {
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { BoardEmpty } from './BoardChrome'
import { ChevronRightIcon, PlusIcon, SparkleIcon } from './chromeIcons'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerName } from './PlayerName'

/** Rows at the top of the board before it skips down to you, and the rows it shows when it doesn't. */
const TOP_ROWS = 5
const ALL_ROWS = 8

/** An empty board's words, by period. */
const OPEN_WORDS: Record<LeaderboardPeriod, { title: string; when: string }> = {
  daily: { title: 'Today is open', when: 'today' },
  weekly: { title: 'The week is open', when: 'this week' },
  monthly: { title: 'The month is open', when: 'this month' },
  all: { title: 'The board is open', when: 'yet' },
}

/** Whose best an empty board points at instead. */
const AIM_WORDS: Record<LeaderboardPeriod, string> = {
  daily: 'today’s best',
  weekly: 'this week’s best',
  monthly: 'this month’s best',
  all: 'the best of all time',
}

/** The board beside the banner: the leaders, and you among your neighbours when you are further down. */
export function GameHubBoard({
  slug,
  gameName,
  period,
  board,
  me,
}: {
  slug: LeaderboardGame
  gameName: string
  period: LeaderboardPeriod
  board: HubBoard
  me: string
}) {
  const route = useRoute()
  const { players, loading, error, aimAt } = board
  const mine = me ? players.find((p) => p.name === me) : undefined
  // A daily's board is the day's whatever the period, so it's called today's and has no periods to pick.
  const daily = isDailyGame(slug)
  const periodLabel = PERIOD_LABELS[daily ? 'daily' : period]
  const open = OPEN_WORDS[daily ? 'daily' : period]

  // The top five, then, when you are further down, a gap and you between the players either side of you.
  // Otherwise the top eight, and you among them.
  let top = players.slice(0, ALL_ROWS)
  let around: BoardPlayer[] = []
  if (mine && mine.place > ALL_ROWS) {
    top = players.slice(0, TOP_ROWS)
    around = players.slice(mine.place - 2, mine.place + 1)
  } else if (mine) {
    top = players.slice(0, Math.max(ALL_ROWS, mine.place + 1))
  }
  const skipped = around.length ? around[0].place - top.length - 1 : players.length - top.length

  return (
    <section className="gh-card gh-board" aria-labelledby="gh-board-title" data-hunt={`g-board-${slug}`}>
      <div className="gh-board__head">
        <h2 id="gh-board-title" className="gh-card__title">
          {periodLabel}
          {!loading && !error ? (
            <span className="gh-board__count">
              {players.length === 0 ? 'no players yet' : `${players.length} ${players.length === 1 ? 'player' : 'players'}`}
            </span>
          ) : null}
        </h2>
        <a className="gh-more" href={gameBoardHref(slug, period)}>
          Full board
          <ChevronRightIcon />
        </a>
      </div>

      {daily ? null : (
        <nav className="gh-seg" aria-label="Period">
          {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
            <a
              key={p}
              href={gameHubHref(slug, p)}
              aria-current={p === period ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault()
                applySitePeriod(p, route)
              }}
            >
              {PERIOD_LABELS[p]}
            </a>
          ))}
        </nav>
      )}

      {loading ? (
        <ol className="gh-rows gh-rows--skel" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="gh-row">
              <span className="skel-line gh-row__skel" />
            </li>
          ))}
        </ol>
      ) : error ? (
        <BoardEmpty title="Couldn’t load the board" detail="Check your connection and try again." />
      ) : players.length === 0 ? (
        <div className="gh-open">
          <div className="gh-open__note">
            <span className="gh-open__mark" aria-hidden="true">
              <SparkleIcon />
            </span>
            <p className="gh-open__title">{groupBoardEmptyTitle(open.title)}</p>
            <p className="gh-open__copy">
              Nobody has played {gameName} {open.when}. The first run takes 1st.
            </p>
          </div>
          {aimAt ? (
            <div className="gh-open__aim">
              <p className="gh-cap">To aim at: {AIM_WORDS[aimAt.period]}</p>
              <ol className="gh-rows">
                {aimAt.players.map((p) => (
                  <BoardRow key={p.name} slug={slug} player={p} me={me} />
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : (
        <ol className="gh-rows">
          {top.map((p) => (
            <BoardRow key={p.name} slug={slug} player={p} me={me} />
          ))}
          {skipped > 0 ? (
            <li className="gh-gap" aria-hidden="true">
              <span>{skipped} more</span>
            </li>
          ) : null}
          {around.map((p) => (
            <BoardRow key={p.name} slug={slug} player={p} me={me} />
          ))}
          {!mine ? (
            <li className="gh-row gh-row--ghost">
              <PlusIcon />
              {daily ? (
                <DailyGhost slug={slug} leader={players[0]} history={dailyHistory(board.days, me)} />
              ) : (
                <>Your {board.allTimeBest ? 'next' : 'first'} run goes here</>
              )}
            </li>
          ) : null}
        </ol>
      )}
    </section>
  )
}

/**
 * Where a daily's player not on today's board would go, and what takes 1st today. Only someone new to
 * the game hears about their first run; someone back has played it before.
 */
function DailyGhost({ slug, leader, history }: { slug: LeaderboardGame; leader: BoardPlayer | undefined; history: DailyHistory }) {
  const run = firstRunWord(slug)
  return (
    <span>
      {history === 'new' ? `Your first ${run} goes here.` : `Your ${run} today goes here.`}
      {leader ? ` Beat ${formatLeaderboardScore(slug, leader.best.score)} for 1st today.` : ''}
    </span>
  )
}

function BoardRow({ slug, player, me }: { slug: LeaderboardGame; player: BoardPlayer; me: string }) {
  const you = Boolean(me) && player.name === me
  const medal = player.place <= 3 ? ` gh-row--p${player.place}` : ''
  // Today's #1 on a daily is 1st today: a course's record is its best of all time, a thing apart.
  const firstToday = player.place === 1 && isDailyGame(slug)
  return (
    <li className={`gh-row${you ? ' gh-row--you' : ''}${medal}`}>
      <span className="gh-row__place">{player.place}</span>
      <PlayerAvatar avatarId={player.best.avatarId} name={player.name} size="md" className="gh-row__avatar" />
      <a className="gh-row__name" href={rankHref(player.name)}>
        <PlayerName name={player.name} avatarId={player.best.avatarId} />
        <SkinMark skin={player.best.skin} />
        {you ? <span className="gh-row__you">You</span> : null}
        {firstToday ? <span className="gh-row__first">1st today</span> : null}
      </a>
      <span className="gh-row__score">
        {formatLeaderboardScore(slug, player.best.score)}
        <small>
          {player.runs} {player.runs === 1 ? 'run' : 'runs'}
        </small>
      </span>
    </li>
  )
}
