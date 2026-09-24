import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useScoreboard } from '../hooks/useScoreboard'
import { gameBoardHref, gamePlayHref, globalRankingsHref, leaderboardHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import {
  headline,
  lastStats,
  lede,
  moves,
  ordinal,
  periodCopy,
  phoneLine,
  pointsChart,
  youCell,
  youStats,
  type BoardLine,
  type BoardTop,
  type PeriodCopy,
  type Stat,
  type YouStanding,
} from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'

/*
 * The boards page: one scoreboard for the period instead of two tabs. The
 * race comes first, with who leads and by how much beside the top ten; then
 * where you stand and where your next points are; then every board's top
 * three, one player per place, with your place and the score that takes the
 * next one; then the boards nobody has played yet; then how the points add up.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

function accentOf(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function nameOf(slug: string) {
  return getGame(slug)?.name ?? slug
}

function TrophyIcon() {
  return (
    <svg className="sb-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3" />
    </svg>
  )
}

function CrownIcon() {
  return (
    <svg className="sb-icon sb-icon--crown" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
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

/* ---------- the race ---------- */

function PeriodTabs({ period }: { period: LeaderboardPeriod }) {
  return (
    <div
      className="seg sb-periods"
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
          href={leaderboardHref(p)}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </div>
  )
}

type RowData = { rank: number; name: string; score: number; games: number; avatarId?: string }

function StandingRow({
  row,
  leaderScore,
  you,
  period,
  deep = false,
}: {
  row: RowData
  leaderScore: number
  you: string
  period: LeaderboardPeriod
  /** Past the fifth: a phone shows the top five and your own row, not the rest. */
  deep?: boolean
}) {
  const mine = Boolean(you) && row.name === you
  const medal = MEDALS[row.rank - 1]
  const width = leaderScore > 0 ? Math.max(2, (row.score / leaderScore) * 100) : 0
  const cls = [
    'sb-row',
    medal ? `sb-row--${medal}` : '',
    mine ? 'sb-row--you' : '',
    deep && !mine ? 'sb-row--deep' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={cls}>
      <a className="sb-row__link" href={rankHref(row.name, period)}>
        <span className="sb-row__ord">{ordinal(row.rank).toUpperCase()}</span>
        <PlayerMark name={row.name} avatarId={row.avatarId} className="sb-row__mark" />
        <span className="sb-row__who">
          <span className="sb-row__name">{row.name}</span>
          <span className="sb-row__boards">
            {row.games} {row.games === 1 ? 'board' : 'boards'}
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
        </span>
        <span className="sb-row__bar" aria-hidden="true">
          <span style={{ width: `${width}%` }} />
        </span>
        <span className="sb-row__pts">
          {row.score.toLocaleString()}
          <small> pts</small>
        </span>
      </a>
    </li>
  )
}

function OpenRow({ rank }: { rank: number }) {
  return (
    <li className="sb-row sb-row--open">
      <span className="sb-row__link">
        <span className="sb-row__ord">{ordinal(rank).toUpperCase()}</span>
        <span className="sb-row__mark sb-row__mark--open" aria-hidden="true" />
        <span className="sb-row__who">
          <span className="sb-row__name">Open</span>
          <span className="sb-row__boards">One run gets you here</span>
        </span>
        <span className="sb-row__bar sb-row__bar--open" aria-hidden="true" />
        <span className="sb-row__pts">–</span>
      </span>
    </li>
  )
}

function Standings({
  period,
  copy,
  data,
  you,
}: {
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useScoreboard>
  you: string
}) {
  const { standings, totalPlayers, last, loading } = data
  const leaderScore = standings[0]?.score ?? 0
  const standing = data.you
  const below =
    standing && standing.rank != null && standing.rank > standings.length ? standing : null
  const lastTop = last?.[0]?.score ?? 0
  return (
    <div className="sb-card sb-standings">
      <div className="sb-standings__head">
        <h2 className="sb-card__title">Standings</h2>
        {!loading ? (
          <span className="sb-standings__count">
            {totalPlayers.toLocaleString()} {totalPlayers === 1 ? 'player' : 'players'}
          </span>
        ) : null}
        <a className="sb-link" href={globalRankingsHref(period)}>
          All players <ChevronIcon />
        </a>
      </div>
      {loading ? (
        <ol className="sb-rows" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="sb-row sb-row--skel">
              <span className="sb-row__link">
                <span className="skel-line" style={{ '--skel-w': '2rem' } as CSSProperties} />
                <span className="sb-row__mark sb-row__mark--open" />
                <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
                <span className="sb-row__bar" />
                <span className="skel-line" style={{ '--skel-w': '2.5rem' } as CSSProperties} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="sb-rows">
          {standings.map((row) => (
            <StandingRow
              key={row.name}
              row={row}
              leaderScore={leaderScore}
              you={you}
              period={period}
              deep={row.rank > 5}
            />
          ))}
          {Array.from({ length: Math.max(0, 3 - standings.length) }, (_, i) => (
            <OpenRow key={`open-${i}`} rank={standings.length + i + 1} />
          ))}
          {below ? (
            <>
              <li className="sb-row sb-row--gap" aria-hidden="true">
                ⋯
              </li>
              <StandingRow
                row={{
                  rank: below.rank ?? 0,
                  name: below.name,
                  score: below.score,
                  games: Object.keys(below.byGame).length,
                  avatarId: below.avatarId,
                }}
                leaderScore={leaderScore}
                you={you}
                period={period}
              />
            </>
          ) : null}
        </ol>
      )}
      {last && copy.last ? (
        <div className="sb-last">
          <div className="sb-last__head">
            <h3 className="sb-last__title">{copy.last.title}</h3>
            <span className="sb-last__note">{copy.last.note}</span>
          </div>
          <ol className="sb-rows sb-rows--last">
            {last.slice(0, 5).map((row) => (
              <StandingRow
                key={row.name}
                row={row}
                leaderScore={lastTop}
                you={you}
                period={copy.last?.period ?? period}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- you ---------- */

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

function YouCard({
  copy,
  standing,
  data,
  boardsTotal,
}: {
  copy: PeriodCopy
  standing: YouStanding
  data: ReturnType<typeof useScoreboard>
  boardsTotal: number
}) {
  const ranked = standing.rank != null
  const stats = ranked ? youStats(standing, data.standings) : lastStats(copy, data.last, standing.name)
  const played = Object.keys(standing.byGame).length
  return (
    <div className="sb-card sb-you__card">
      <div className="sb-you__top">
        <PlayerMark name={standing.name} avatarId={standing.avatarId} className="sb-you__mark" />
        <span className="sb-you__kicker">
          {standing.name} · {copy.phrase}
        </span>
      </div>
      {ranked ? (
        <>
          <p className="sb-you__big">
            <b>#{standing.rank}</b>
            <span>of {standing.totalPlayers.toLocaleString()}</span>
          </p>
          <p className="sb-you__line">
            {standing.score.toLocaleString()} points · on {played} of {boardsTotal} boards
          </p>
        </>
      ) : (
        <>
          <p className="sb-you__big">
            <b>0</b>
            <span>points so far</span>
          </p>
          <p className="sb-you__line">No runs yet {copy.noun ? copy.phrase : 'on the boards'}.</p>
        </>
      )}
      {stats.length ? (
        <div className="sb-you__foot">
          <Stats stats={stats} />
        </div>
      ) : !ranked ? (
        <div className="sb-you__foot sb-you__foot--acts">
          <a className="sb-cta" href="/">
            Pick a game
          </a>
        </div>
      ) : null}
    </div>
  )
}

function FirstVisitCard({ copy }: { copy: PeriodCopy }) {
  const toward = copy.noun ? `this ${copy.noun}’s standings` : 'the all-time standings'
  return (
    <div className="sb-card sb-you__card sb-first">
      <p className="sb-kicker">Get on the board</p>
      <h2 className="sb-first__title">Your first run puts you on it.</h2>
      <p className="sb-first__text">
        Finish a run and sign in to save it, and you’re on that game’s board. Every board you place on
        pays up to 100 points toward {toward}.
      </p>
      <div className="sb-you__foot sb-you__foot--acts">
        <a className="sb-cta" href="/">
          Pick a game
        </a>
        <a className="sb-ghost" href="#points">
          How points work
        </a>
      </div>
    </div>
  )
}

function Moves({
  copy,
  data,
}: {
  copy: PeriodCopy
  data: ReturnType<typeof useScoreboard>
}) {
  const { rows, foot } = moves(copy, data.boards, data.standings, data.you)
  return (
    <div className="sb-card sb-moves">
      <h2 className="sb-card__title">{data.you ? 'Where your next points are' : 'Easiest points right now'}</h2>
      <ul className="sb-moves__list">
        {rows.map((m) => (
          <li key={m.amount + m.what} className="sb-move">
            <span className="sb-move__amount">{m.amount}</span>
            <span className="sb-move__body">
              <span className="sb-move__what">{m.what}</span>
              <span className="sb-move__why">{m.why}</span>
            </span>
          </li>
        ))}
      </ul>
      {foot ? (
        <p className="sb-moves__foot">
          <ArrowIcon />
          <span>{foot}</span>
        </p>
      ) : null}
    </div>
  )
}

/* ---------- every board ---------- */

function Place({ line, top, place, you }: { line: BoardLine; top: BoardTop | undefined; place: number; you: string }) {
  if (!top) {
    return (
      <span className={`sb-board__place sb-board__place--${place} sb-board__place--open`}>
        <span className="sb-board__who">–</span>
        <span className="sb-board__score">Open</span>
      </span>
    )
  }
  const mine = Boolean(you) && top.name === you
  return (
    <span className={`sb-board__place sb-board__place--${place}`}>
      <span className={`sb-board__who${mine ? ' sb-board__who--you' : ''}`}>
        {place === 1 ? <CrownIcon /> : null}
        <span>{top.name}</span>
      </span>
      <span className="sb-board__score">{formatLeaderboardScore(line.slug, top.score)}</span>
    </span>
  )
}

function BoardRow({
  line,
  period,
  you,
  standing,
  best,
  next,
}: {
  line: BoardLine
  period: LeaderboardPeriod
  you: string
  standing: YouStanding | null
  best: number | undefined
  next: BoardTop | null | undefined
}) {
  const accent = accentOf(line.slug)
  const name = nameOf(line.slug)
  const cell = standing ? youCell(line, standing, best, next) : null
  const players = line.players == null ? '' : `${line.players.toLocaleString()} ${line.players === 1 ? 'player' : 'players'}`
  const podium = line.top
    .map((t, i) => `${ordinal(i + 1)} ${t.name} ${formatLeaderboardScore(line.slug, t.score)}`)
    .join(', ')
  const label = [
    `${name} board`,
    players,
    podium,
    cell ? (cell.tone === 'on' ? `You: ${cell.a.replace('#', 'number ')}. ${cell.b}` : cell.b) : '',
  ]
    .filter(Boolean)
    .join('. ')
  return (
    <li className="sb-board">
      <a className="sb-board__link" href={gameBoardHref(line.slug, period)} aria-label={label}>
        <GameThumbArt slug={line.slug} accent={accent} className="sb-board__thumb" />
        <span className="sb-board__name">
          <span className="sb-board__title">{name}</span>
          {players ? <span className="sb-board__players">{players}</span> : null}
        </span>
        {[0, 1, 2].map((i) => (
          <Place key={i} line={line} top={line.top[i]} place={i + 1} you={you} />
        ))}
        {cell ? (
          <span className={`sb-board__you sb-board__you--${cell.tone}`}>
            <span className="sb-board__you-a">{cell.a}</span>
            <span className="sb-board__you-b">{cell.b}</span>
          </span>
        ) : null}
        <span className={`sb-board__line${cell?.tone === 'on' ? ' sb-board__line--on' : ''}`}>
          {phoneLine(line, standing, cell)}
        </span>
        <span className="sb-board__go" aria-hidden="true">
          <ChevronIcon />
        </span>
      </a>
    </li>
  )
}

function EveryBoard({
  period,
  copy,
  data,
  you,
}: {
  period: LeaderboardPeriod
  copy: PeriodCopy
  data: ReturnType<typeof useScoreboard>
  you: string
}) {
  const played = data.boards.filter((b) => b.top.length > 0)
  const withYou = Boolean(data.you)
  const when = copy.noun ? ` ${copy.phrase}` : ''
  return (
    <section className="sb-section" aria-labelledby="sb-boards-title">
      <div className="sb-head">
        <div>
          <h2 id="sb-boards-title" className="sb-h2">
            Every board
          </h2>
          <p className="sb-sub">
            Best run per player{copy.noun ? ` ${copy.phrase}` : ', all time'}. Pick a board for the full list.
          </p>
        </div>
        {!data.loading ? (
          <span className="sb-count">
            {played.length} of {data.boards.length} boards {played.length === 1 ? 'has' : 'have'} runs{when}
          </span>
        ) : null}
      </div>
      <div className={`sb-table${withYou ? ' sb-table--you' : ''}`}>
        <div className="sb-table__head" aria-hidden="true">
          <span className="sb-table__board">Board</span>
          <span className="sb-table__place sb-table__place--1">1st</span>
          <span className="sb-table__place sb-table__place--2">2nd</span>
          <span className="sb-table__place sb-table__place--3">3rd</span>
          {withYou ? <span className="sb-table__you">You</span> : null}
        </div>
        {data.loading ? (
          <ul className="sb-table__rows" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="sb-board sb-board--skel">
                <span className="sb-board__link">
                  <span className="sb-board__thumb sb-board__thumb--skel" />
                  <span className="sb-board__name">
                    <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : played.length ? (
          <ul className="sb-table__rows">
            {played.map((line) => (
              <BoardRow
                key={line.slug}
                line={line}
                period={period}
                you={you}
                standing={data.you}
                best={data.bests[line.slug]}
                next={data.nexts[line.slug]}
              />
            ))}
          </ul>
        ) : (
          <p className="sb-table__none">No board has a run{when} yet. Every one of them is up for grabs.</p>
        )}
      </div>
    </section>
  )
}

/* ---------- up for grabs ---------- */

function UpForGrabs({ copy, boards }: { copy: PeriodCopy; boards: BoardLine[] }) {
  const empty = boards.filter((b) => b.top.length === 0)
  if (!empty.length) return null
  const nobody = copy.noun ? `Nobody’s played these ${copy.phrase}.` : 'Nobody’s played these yet.'
  const line = copy.noun ? `No runs ${copy.phrase}` : 'No runs yet'
  return (
    <section className="sb-section" aria-labelledby="sb-grabs-title">
      <div className="sb-head">
        <div>
          <h2 id="sb-grabs-title" className="sb-h2">
            Up for grabs
          </h2>
          <p className="sb-sub">{nobody} The first run on each takes all 100 points.</p>
        </div>
        <span className="sb-count">
          {empty.length} {empty.length === 1 ? 'board' : 'boards'}
        </span>
      </div>
      <ul className="sb-grabs">
        {empty.map((b) => {
          const accent = accentOf(b.slug)
          const name = nameOf(b.slug)
          return (
            <li
              key={b.slug}
              className="sb-grab"
              style={{ '--grab-accent': accent, '--grab-ink': inkOn(accent) } as CSSProperties}
            >
              <div className="sb-grab__top">
                <GameThumbArt slug={b.slug} accent={accent} className="sb-grab__thumb" />
                <span className="sb-grab__pts">+100</span>
              </div>
              <h3 className="sb-grab__name">{name}</h3>
              <p className="sb-grab__line">{line}</p>
              <a className="sb-grab__play" href={gamePlayHref(b.slug)} aria-label={`Play ${name}`}>
                Play
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------- points ---------- */

function Points({ copy, data }: { copy: PeriodCopy; data: ReturnType<typeof useScoreboard> }) {
  const chart = pointsChart(copy, data.boards, data.standings, data.you)
  return (
    <section id="points" className="sb-section sb-points" aria-labelledby="sb-points-title">
      <div className="sb-points__text">
        <h2 id="sb-points-title" className="sb-h2">
          How the points work
        </h2>
        <ol className="sb-rules">
          <li className="sb-rule">
            <span className="sb-rule__n" aria-hidden="true">
              01
            </span>
            <span>
              <span className="sb-rule__title">Each board pays up to 100.</span>
              <span className="sb-rule__text">
                Your best run sets your place, and your place pays by how much of the field you beat:
                first gets 100, halfway up about 50, last a point or two.
              </span>
            </span>
          </li>
          <li className="sb-rule">
            <span className="sb-rule__n" aria-hidden="true">
              02
            </span>
            <span>
              <span className="sb-rule__title">Your boards add up.</span>
              <span className="sb-rule__text">
                Your total is all your boards added together, so a board you haven’t played is the
                biggest gain there is.
              </span>
            </span>
          </li>
          <li className="sb-rule">
            <span className="sb-rule__n" aria-hidden="true">
              03
            </span>
            <span>
              <span className="sb-rule__title">The top ten take trophies.</span>
              <span className="sb-rule__text">
                When a week or a month closes, the top ten overall each take a trophy for it.
              </span>
            </span>
          </li>
        </ol>
      </div>
      {!data.loading ? (
        <div className="sb-card sb-chart">
          <div className="sb-chart__head">
            <h3 className="sb-card__title">{chart.title}</h3>
            <span className="sb-chart__sub">{chart.sub}</span>
          </div>
          <ul className="sb-chart__cols">
            {chart.columns.map((c) => {
              const accent = accentOf(c.slug)
              return (
                <li
                  key={c.slug}
                  className={`sb-col${c.points == null ? ' sb-col--empty' : ''}`}
                  style={{ '--col-accent': accent } as CSSProperties}
                >
                  <span className="visually-hidden">
                    {nameOf(c.slug)}: {c.points == null ? 'not played' : `${c.points} points`}
                  </span>
                  <span className="sb-col__value" aria-hidden="true">
                    {c.points ?? '–'}
                  </span>
                  <span className="sb-col__track" aria-hidden="true">
                    <span className="sb-col__fill" style={{ height: `${c.points ?? 0}%` }} />
                  </span>
                  <GameThumbArt slug={c.slug} accent={accent} className="sb-col__thumb" />
                </li>
              )
            })}
          </ul>
          {chart.legend ? (
            <p className="sb-chart__legend" aria-hidden="true">
              {chart.legend}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/* ---------- the page ---------- */

export function BoardsScoreboard({ period }: { period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useScoreboard(period, you, groupId)
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const head = headline(copy, data.standings, data.totalPlayers)

  if (data.error) {
    return (
      <div className="sb">
        <BoardEmpty title="Couldn’t load the boards" detail="Check your connection and try again." />
      </div>
    )
  }

  return (
    <div className="sb">
      <section className="sb-hero" aria-labelledby="sb-title">
        <div className="sb-hero__text">
          <p className="sb-kicker">
            {copy.live ? <span className="sb-kicker__dot" aria-hidden="true" /> : null}
            {copy.kicker}
            {group ? ` · ${group}` : ''}
          </p>
          <h1 id="sb-title" className="sb-title">
            {data.loading ? (
              <span className="skel-line sb-title__skel" style={{ '--skel-w': '14ch' } as CSSProperties} />
            ) : (
              <>
                {head.name ? <span className="sb-title__lead">{head.name}</span> : null}
                {head.rest}
              </>
            )}
          </h1>
          <p className="sb-lede">
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '22rem' } as CSSProperties} />
            ) : (
              lede(copy, period, data.standings, data.totalPlayers, data.boards)
            )}
          </p>
          <PeriodTabs period={period} />
          <p className="sb-closes">
            <TrophyIcon />
            <span>{copy.closes}</span>
          </p>
        </div>
        <Standings period={period} copy={copy} data={data} you={you} />
      </section>

      {!data.loading ? (
        <section className="sb-you" aria-label="Your standing">
          {data.you ? (
            <YouCard copy={copy} standing={data.you} data={data} boardsTotal={data.boards.length} />
          ) : (
            <FirstVisitCard copy={copy} />
          )}
          <Moves copy={copy} data={data} />
        </section>
      ) : null}

      <EveryBoard period={period} copy={copy} data={data} you={you} />
      {!data.loading ? <UpForGrabs copy={copy} boards={data.boards} /> : null}
      <Points copy={copy} data={data} />
    </div>
  )
}
