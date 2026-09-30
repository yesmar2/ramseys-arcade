import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useScoreboard } from '../hooks/useScoreboard'
import {
  focusFromUrl,
  gameBoardHref,
  gamePlayHref,
  leaderboardHref,
  rankHowHref,
  rankHref,
  ROUTE_EVENT,
} from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import {
  fetchGlobalBoard,
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  headline,
  lede,
  lineScore,
  ordinal,
  periodCopy,
  phoneLine,
  youCell,
  type BoardLine,
  type BoardTop,
  type PeriodCopy,
  type Standing,
  type YouStanding,
} from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'

/*
 * The boards page: one scoreboard for the period instead of two tabs. The
 * race comes first: who leads, then the top ten the width of the page under
 * it (beside the words, the list left the space under them empty, Ramsey
 * found); then every board's top three, one player per place, with your
 * place and the score that takes a higher one; then the boards nobody has
 * played yet. It says places and names: how the points add up is on How your
 * rank works, linked beside the standings. The cards under the standings,
 * yours and Where to climb, went at Ramsey's word (2026-09-30).
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
          <PlayerName className="sb-row__name" name={row.name} avatarId={row.avatarId} />
          <span className="sb-row__boards">
            {row.games} {row.games === 1 ? 'game' : 'games'}
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

/** Players added to the standings each time Show more is pressed. */
const MORE_STANDINGS = 25

/**
 * The standings: the top ten, and everyone below them a press at a time, in
 * place. There used to be a Rankings page for the rest; this is it now, so a
 * link that asks for the standings (`?focus=standings`) lands here, opened.
 */
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
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState<Standing[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  // A phone shows the top five until asked for more; a link to the standings is asking.
  const [opened, setOpened] = useState(() => focusFromUrl() === 'standings')

  // A new period or group is a new list.
  useEffect(() => {
    setMore([])
  }, [standings])

  // Brought into view once they're in, and again whenever a link asks while the page is open.
  useEffect(() => {
    if (loading) return
    const focus = () => {
      if (focusFromUrl() !== 'standings') return
      setOpened(true)
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    focus()
    window.addEventListener(ROUTE_EVENT, focus)
    return () => window.removeEventListener(ROUTE_EVENT, focus)
  }, [loading])

  const rows = [...standings, ...more]
  const left = Math.max(0, totalPlayers - rows.length)
  const showMore = async () => {
    setOpened(true)
    if (loadingMore || left === 0) return
    setLoadingMore(true)
    try {
      const page = await fetchGlobalBoard(MORE_STANDINGS, period, rows.length)
      const have = new Set(rows.map((row) => row.name))
      setMore((prev) => [...prev, ...page.entries.filter((row) => !have.has(row.name))])
    } catch {
      // The button stays; another press tries again.
    } finally {
      setLoadingMore(false)
    }
  }

  const leaderScore = standings[0]?.score ?? 0
  const standing = data.you
  const below = standing && standing.rank != null && standing.rank > rows.length ? standing : null
  const lastTop = last?.[0]?.score ?? 0
  return (
    <div ref={ref} id="standings" className="sb-card sb-standings" data-hunt="boards-standings">
      <div className="sb-standings__head">
        <h2 className="sb-card__title">Standings</h2>
        {!loading ? (
          <span className="sb-standings__count">
            {totalPlayers.toLocaleString()} {totalPlayers === 1 ? 'player' : 'players'}
          </span>
        ) : null}
        {/* The points beside each name are the one figure this page keeps; what makes them is there. */}
        <a className="sb-standings__how" href={rankHowHref(undefined, period)}>
          How your rank works ›
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
          {rows.map((row) => (
            <StandingRow
              key={row.name}
              row={row}
              leaderScore={leaderScore}
              you={you}
              period={period}
              deep={!opened && row.rank > 5}
            />
          ))}
          {Array.from({ length: Math.max(0, 3 - rows.length) }, (_, i) => (
            <OpenRow key={`open-${i}`} rank={rows.length + i + 1} />
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
      {!loading && (left > 0 || (!opened && rows.length > 5)) ? (
        <div className="sb-standings__foot">
          {/* With nobody left to fetch, it is only a phone's hidden sixth to tenth still to show. */}
          <button
            type="button"
            className={`sb-ghost sb-standings__more${left > 0 ? '' : ' sb-standings__more--phone'}`}
            onClick={() => void showMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      ) : null}
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
      {/* A daily's week is in points, which its own board shows: here it is names. */}
      {line.points ? null : <span className="sb-board__score">{lineScore(line, top.score)}</span>}
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
    .map((t, i) => `${ordinal(i + 1)} ${t.name}${line.points ? '' : ` ${lineScore(line, t.score)}`}`)
    .join(', ')
  const label = [
    `${name} board`,
    players,
    podium,
    cell
      ? cell.tone === 'on'
        ? [`You: ${cell.a.replace('#', 'number ')}`, cell.b].filter(Boolean).join('. ')
        : cell.b
      : '',
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
            {cell.b ? <span className="sb-board__you-b">{cell.b}</span> : null}
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
            Best run per player{copy.noun ? ` ${copy.phrase}` : ', all time'}. Pick a game for the full list.
          </p>
        </div>
        {!data.loading ? (
          <span className="sb-count">
            {played.length} of {data.boards.length} games {played.length === 1 ? 'has' : 'have'} runs{when}
          </span>
        ) : null}
      </div>
      <div className={`sb-table${withYou ? ' sb-table--you' : ''}`}>
        <div className="sb-table__head" aria-hidden="true">
          <span className="sb-table__board">Game</span>
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
          <p className="sb-sub">{nobody} Play one and you’re 1st.</p>
        </div>
        <span className="sb-count">
          {empty.length} {empty.length === 1 ? 'game' : 'games'}
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
                <span className="sb-grab__pts">Be 1st</span>
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
          <div className="sb-hero__row">
            <PeriodTabs period={period} />
            <p className="sb-closes">
              <TrophyIcon />
              <span>{copy.closes}</span>
            </p>
          </div>
        </div>
        <Standings period={period} copy={copy} data={data} you={you} />
      </section>

      <EveryBoard period={period} copy={copy} data={data} you={you} />
      {!data.loading ? <UpForGrabs copy={copy} boards={data.boards} /> : null}
    </div>
  )
}
