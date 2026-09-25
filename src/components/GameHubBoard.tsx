import { applySitePeriod, gameBoardHref, gameHubHref, rankHref, useRoute } from '../hooks/useHashRoute'
import type { HubBoard } from '../hooks/useGameHub'
import type { BoardPlayer } from '../lib/gameBoard'
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
import { HiddenBug } from './BugHunt'

/** Rows at the top of the board before it skips down to you, and the rows it shows when it doesn't. */
const TOP_ROWS = 5
const ALL_ROWS = 8

/** An empty board's words, by period. */
const OPEN_WORDS: Record<LeaderboardPeriod, { title: string; when: string; toward: string }> = {
  daily: { title: 'Today is open', when: 'today', toward: 'the day' },
  weekly: { title: 'The week is open', when: 'this week', toward: 'the week' },
  monthly: { title: 'The month is open', when: 'this month', toward: 'the month' },
  all: { title: 'The board is open', when: 'yet', toward: 'the all-time standings' },
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
  const periodLabel = PERIOD_LABELS[period]
  const open = OPEN_WORDS[period]

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
    <section className="gh-card gh-board" aria-labelledby="gh-board-title">
      <div className="gh-board__head">
        <h2 id="gh-board-title" className="gh-card__title">
          {periodLabel}
          {!loading && !error ? (
            <span className="gh-board__count">
              {players.length === 0 ? 'no players yet' : `${players.length} ${players.length === 1 ? 'player' : 'players'}`}
              <HiddenBug spot={`count-${slug}`} pose="peek" />
            </span>
          ) : null}
        </h2>
        <a className="gh-more" href={gameBoardHref(slug, period)}>
          Full board
          <ChevronRightIcon />
        </a>
      </div>

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
              Nobody has played {gameName} {open.when}. The first run takes 1st, and 100 points toward {open.toward}.
            </p>
          </div>
          {aimAt ? (
            <div className="gh-open__aim">
              <p className="gh-cap">To aim at: {AIM_WORDS[aimAt.period]}</p>
              <ol className="gh-rows">
                {aimAt.players.map((p) => (
                  <BoardRow key={p.name} slug={slug} player={p} me={me} showPays={false} />
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
              Your {board.allTimeBest ? 'next' : 'first'} run goes here
            </li>
          ) : null}
        </ol>
      )}
    </section>
  )
}

function BoardRow({
  slug,
  player,
  me,
  showPays = true,
}: {
  slug: LeaderboardGame
  player: BoardPlayer
  me: string
  showPays?: boolean
}) {
  const you = Boolean(me) && player.name === me
  const medal = player.place <= 3 ? ` gh-row--p${player.place}` : ''
  return (
    <li className={`gh-row${you ? ' gh-row--you' : ''}${medal}`}>
      <span className="gh-row__place">{player.place}</span>
      <PlayerAvatar avatarId={player.best.avatarId} name={player.name} size="md" className="gh-row__avatar" />
      <a className="gh-row__name" href={rankHref(player.name)}>
        <span>{player.name}</span>
        {you ? <span className="gh-row__you">You</span> : null}
      </a>
      <span className="gh-row__score">
        {formatLeaderboardScore(slug, player.best.score)}
        <small>
          {player.runs} {player.runs === 1 ? 'run' : 'runs'}
        </small>
      </span>
      {showPays ? <span className="gh-row__pays">{player.pays} pts</span> : null}
    </li>
  )
}
