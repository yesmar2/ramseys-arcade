import { useState, type CSSProperties } from 'react'
import { deviceRequirementLabel, gamePlayableOn, getGame } from '../data/games'
import { useGameBoard } from '../hooks/useGameBoard'
import { gameBoardHref, gamePlayHref, leaderboardHref, rankHref, recordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { useDeviceType } from '../lib/device'
import {
  boardCallout,
  boardHeadline,
  boardLede,
  boardYouStats,
  fieldStrip,
  offBoardLines,
  playersFromRuns,
  priceList,
  runsChart,
  youOnBoard,
  type BoardPlayer,
  type BoardYou,
} from '../lib/gameBoard'
import { hasGamePreview } from '../lib/gamePreviews'
import { cachedMyGroups, groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
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

/*
 * One game's own board. The banner is the game at the scale of the page, its
 * demo playing on the screen, with who leads it and by how much. Then where
 * you stand on it and your runs, and the board itself: one row per player at
 * their best run, with what their place pays, and every run a tap away. Beside
 * it, what a run is worth here, where everyone's best lands, and the way on to
 * the other boards.
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

function BackIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="sb-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}

function TrophyIcon() {
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

function PeriodTabs({ slug, period }: { slug: LeaderboardGame; period: LeaderboardPeriod }) {
  return (
    <div
      className="seg sb-periods gb-periods"
      role="tablist"
      aria-label="Period"
      style={{ '--seg-count': VISIBLE_LEADERBOARD_PERIODS.length } as CSSProperties}
    >
      {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
        <a
          key={p}
          role="tab"
          aria-selected={p === period}
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
  const head = boardHeadline(slug, copy, players)
  const leader = players[0]
  // When it closes, without the trophies: those go to the standings across every board, not one game's.
  const closes = periodCopy(period, Date.now(), true).closes
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  return (
    <section className="home-banner gb-banner" style={style} aria-labelledby="gb-title">
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
          {loading ? <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} /> : boardLede(slug, copy, players, runs)}
        </p>
        <PeriodTabs slug={slug} period={period} />
        <div className="home-banner__acts">
          {canPlay ? (
            <a className="home-banner__cta" href={gamePlayHref(slug)}>
              Play {game.name}
            </a>
          ) : (
            <p className="gb-device" role="note">
              {deviceRequirementLabel(game)} Scores still count toward global rank.
            </p>
          )}
          {gameHasRecords(slug) ? (
            <a className="home-banner__ghost" href={recordsHref(slug, period)}>
              Record books
            </a>
          ) : null}
          <ShareBoardButton
            className="home-banner__ghost"
            text="Share"
            label={`${game.name} high scores on ${APP_NAME} (${PERIOD_LABELS[period]}). Your move.`}
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
            <span>Hi-score</span>
            <b>{formatLeaderboardScore(slug, leader.best.score)}</b>
            <span>{leader.name}</span>
          </span>
        ) : null}
      </a>
    </section>
  )
}

/* ---------- you ---------- */

function YouOnBoard({ slug, copy, you, avatarId }: { slug: string; copy: PeriodCopy; you: BoardYou; avatarId?: string }) {
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
        Best {formatLeaderboardScore(slug, you.player.best.score)} · {count} {count === 1 ? 'run' : 'runs'} · pays{' '}
        {you.player.pays} points
      </p>
      <div className="sb-you__foot">
        <Stats stats={boardYouStats(slug, you)} />
        <p className="gb-callout">
          <ArrowIcon />
          <span>{boardCallout(slug, you)}</span>
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

function FirstVisit({ slug, copy }: { slug: LeaderboardGame; copy: PeriodCopy }) {
  const toward = copy.noun ? `this ${copy.noun}’s standings` : 'the all-time standings'
  return (
    <div className="sb-card sb-you__card sb-first">
      <p className="sb-kicker">Get on the board</p>
      <h2 className="sb-first__title">Any run puts you on it.</h2>
      <p className="sb-first__text">
        Sign in to save your runs. Only your best counts, and first place pays 100 points toward {toward}.
      </p>
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

function PriceCard({ slug, copy, players }: { slug: string; copy: PeriodCopy; players: BoardPlayer[] }) {
  const rows = priceList(slug, players)
  const toward = copy.noun ? `the ${copy.noun}` : 'the all-time standings'
  return (
    <div className="sb-card gb-price">
      <h2 className="sb-card__title">What a run is worth here</h2>
      <p className="gb-card__sub">
        {players.length
          ? `${players.length.toLocaleString()} ${players.length === 1 ? 'player' : 'players'} on it${copy.noun ? ` ${copy.phrase}` : ', all time'}. Pays is what the place is worth toward ${toward}.`
          : 'Nobody’s on it yet, so any run takes first.'}
      </p>
      <ul className="gb-price__rows">
        {rows.map((r) => (
          <li key={r.what} className="gb-price__row">
            <span className="gb-price__beat">
              <b>{r.beat}</b>
              <span>{r.what}</span>
            </span>
            <span className="gb-price__pays">
              <b>{r.pays}</b> pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FieldCard({ slug, players, you }: { slug: string; players: BoardPlayer[]; you: string }) {
  const strip = fieldStrip(players, you)
  return (
    <div className="sb-card gb-field">
      <h2 className="sb-card__title">Where everyone’s best lands</h2>
      <p className="gb-card__sub">
        {players.length.toLocaleString()} players, from {formatLeaderboardScore(slug, strip.low.best.score)} to{' '}
        {formatLeaderboardScore(slug, strip.high.best.score)}
      </p>
      <div className="gb-field__plot" aria-hidden="true">
        <span className="gb-field__axis" />
        {strip.marks.map((m) => (
          <span key={m.label} className="gb-field__mark" style={{ left: `${m.left}%` }}>
            <span>{m.label}</span>
          </span>
        ))}
        {strip.dots.map((d) => (
          <span
            key={d.name}
            className={`gb-field__dot${d.mine ? ' gb-field__dot--you' : ''}`}
            style={{ left: `${d.left}%`, top: `${0.5 + d.row * 0.45}rem` }}
          />
        ))}
      </div>
      <div className="gb-field__ends" aria-hidden="true">
        <span>{formatLeaderboardScore(slug, strip.low.best.score)}</span>
        <span>{formatLeaderboardScore(slug, strip.high.best.score)}</span>
      </div>
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
                    {o.leader ? `${o.leader.name} · ${formatLeaderboardScore(o.slug, o.leader.score)}` : 'No runs yet'}
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
            <span>{player.name}</span>
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
        <span className="gb-row__pays">
          {player.pays}
          <small> pts</small>
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
    <section className="sb-card gb-board" aria-labelledby="gb-board-title">
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
        {byPlayer
          ? 'One row per player, at their best run. Their place is what pays.'
          : 'Every run on the board, best first. A player can hold several of these.'}
      </p>
      {data.loading ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : !players.length ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">{groupBoardEmptyTitle(`Nobody’s on this board ${copy.noun ? copy.phrase : 'yet'}.`)}</p>
          <p className="gb-board__empty-text">Any run takes first, and all 100 points.</p>
          <PlayLink slug={slug} />
        </div>
      ) : byPlayer ? (
        <>
          <div className="gb-board__cols" aria-hidden="true">
            <span>Place</span>
            <span />
            <span>Player</span>
            <span className="gb-board__num">Best</span>
            <span className="gb-board__set">Set</span>
            <span className="gb-board__num">Pays</span>
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

/* ---------- the page ---------- */

export function GameBoard({ slug, period }: { slug: LeaderboardGame; period: LeaderboardPeriod }) {
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
              <YouOnBoard slug={slug} copy={copy} you={standing} avatarId={data.youRun?.avatarId} />
              <RunsCard slug={slug} copy={copy} you={standing} players={players} />
            </>
          ) : (
            <>
              {you ? (
                <YouOffBoard slug={slug} copy={copy} name={you} players={players} allTimeBest={data.allTimeBest} />
              ) : (
                <FirstVisit slug={slug} copy={copy} />
              )}
              <PriceCard slug={slug} copy={copy} players={players} />
            </>
          )}
        </section>
      ) : null}

      <div className="gb-main">
        <Board key={`${slug}-${period}`} slug={slug} period={period} copy={copy} data={data} players={players} you={you} />
        {!data.loading ? (
          <aside className="gb-side" aria-label="More about this board">
            {standing ? <PriceCard slug={slug} copy={copy} players={players} /> : null}
            {players.length >= 3 ? <FieldCard slug={slug} players={players} you={you} /> : null}
            <OtherBoards others={data.others} period={period} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
