import { type CSSProperties } from 'react'
import { useHeldHeight, useHeldShape } from '../lib/heldShape'
import { getGame } from '../data/games'
import { useScoreboard } from '../hooks/useScoreboard'
import {
  gameBoardHref,
  gamePlayHref,
  leaderboardHref,
  rankHowHref,
  rankHref,
} from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { scopeName, useActiveGroup } from '../lib/groups'
import {
  fetchGlobalBoard,
  findInStandings,
  normalizePlayerName,
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
  type YouStanding,
} from '../lib/scoreboard'
import { useSeason } from '../lib/season'
import { periodTabs, prizeLines, seasonHasStandings } from '../lib/seasonStandings'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { GameThumbArt } from './GameThumbArt'
import { PeriodLabel } from './PeriodLabel'
import { SkinMark } from './season/SkinMark'
import { StandingsList, TrophyIcon, type StandingsFeed } from './StandingsList'

/*
 * The boards page: one scoreboard for the period instead of two tabs. The
 * race comes first: who leads, then the top ten the width of the page under
 * it (beside the words, the list left the space under them empty, Ramsey
 * found); then every board's top three, one player per place, with your
 * place and the score that takes a higher one; then the boards nobody has
 * played yet. It says places and names: how the points add up is on How your
 * rank works, linked beside the standings. The cards under the standings,
 * yours and Where to climb, went at Ramsey's word (2026-09-30). While a
 * season has standings, a Season tab follows the periods: the `season`
 * period, with a line under the places that win its cup and its trophies.
 */

function accentOf(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function nameOf(slug: string) {
  return getGame(slug)?.name ?? slug
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

/** The periods, and while a season has standings, the Season tab after them. */
function PeriodTabs({ active, season }: { active: LeaderboardPeriod; season: boolean }) {
  const periods = periodTabs(VISIBLE_LEADERBOARD_PERIODS, season || active === 'season')
  const four = periods.length > 3
  return (
    <div
      className={`seg sb-periods${four ? ' seg--four' : ''}`}
      role="tablist"
      aria-label="Period"
      style={{ '--seg-count': periods.length } as CSSProperties}
    >
      {periods.map((p) => (
        <a
          key={p}
          role="tab"
          aria-selected={p === active}
          className={`seg__item${p === active ? ' seg__item--active' : ''}`}
          href={leaderboardHref(p)}
        >
          <PeriodLabel period={p} four={four} />
        </a>
      ))}
    </div>
  )
}

/** The Standings list's feed of a period's standings. */
function periodFeed(period: LeaderboardPeriod, data: ReturnType<typeof useScoreboard>): StandingsFeed {
  return {
    key: period,
    loading: data.loading,
    standings: data.standings,
    totalPlayers: data.totalPlayers,
    you: data.you,
    more: async (offset, limit) => (await fetchGlobalBoard(limit, period, offset)).entries,
    find: (q) => findInStandings(q, period),
    rowHref: (name) => rankHref(name, period),
  }
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
        {/* The skin the run was played in, as every game's own board shows it. */}
        <SkinMark skin={top.skin} />
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
      {/* The game's name is the line's link, stretched over it (boards.css); a skin on it opens its own card. */}
      <div className="sb-board__link">
        <GameThumbArt slug={line.slug} accent={accent} className="sb-board__thumb" />
        <a className="sb-board__name" href={gameBoardHref(line.slug, period)} aria-label={label}>
          <span className="sb-board__title">{name}</span>
          {players ? <span className="sb-board__players">{players}</span> : null}
        </a>
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
      </div>
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
  const heldBoards = useHeldShape(`boards-played-${period}`, data.loading ? undefined : played.length, 12)
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
            {Array.from({ length: Math.max(1, heldBoards) }, (_, i) => (
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

function UpForGrabs({ period, copy, boards, loading }: { period: LeaderboardPeriod; copy: PeriodCopy; boards: BoardLine[]; loading: boolean }) {
  const empty = boards.filter((b) => b.top.length === 0)
  const held = useHeldShape(`boards-empty-${period}`, loading ? undefined : empty.length, 0)
  if (loading) {
    if (!held) return null
    return (
      <section className="sb-section" aria-hidden="true">
        <div className="sb-head">
          <div>
            <h2 className="sb-h2">Up for grabs</h2>
            <p className="sb-sub">
              <span className="skel-line" style={{ '--skel-w': '16rem' } as CSSProperties} />
            </p>
          </div>
        </div>
        <ul className="sb-grabs">
          {Array.from({ length: held }, (_, i) => (
            <li key={i} className="sb-grab sb-grab--skel">
              <div className="sb-grab__top">
                <span className="sb-grab__thumb sb-board__thumb--skel" />
              </div>
              <h3 className="sb-grab__name">
                <span className="skel-line" style={{ '--skel-w': '5rem' } as CSSProperties} />
              </h3>
              <p className="sb-grab__line">
                <span className="skel-line" style={{ '--skel-w': '4rem' } as CSSProperties} />
              </p>
              <span className="sb-grab__play skel-btn">Play</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }
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
  const season = useSeason().season
  const seasonTab = seasonHasStandings(season)
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  // The season's standings draw a line under the places that win its cup, and under the ones that win a trophy.
  const lines = period === 'season' ? prizeLines(data.prizes, data.totalPlayers, season?.id ?? null, Boolean(groupId)) : null
  const group = scopeName(groupId)
  const head = headline(copy, data.standings, data.totalPlayers)
  // The headline and its line wrap as the names in them do: held at last time's height while they load.
  const title = useHeldHeight<HTMLHeadingElement>(`boards-title-${period}`, data.loading)
  const ledeHeld = useHeldHeight<HTMLParagraphElement>(`boards-lede-${period}`, data.loading)
  const closed = copy.last
  const last = closed
    ? { expected: true, rows: data.last, title: closed.title, note: closed.note, rowHref: (name: string) => rankHref(name, closed.period) }
    : null

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
          <h1 id="sb-title" className="sb-title" ref={title.ref} style={title.style}>
            {data.loading ? (
              <span className="skel-line sb-title__skel" style={{ '--skel-w': '14ch' } as CSSProperties} />
            ) : (
              <>
                {head.name ? <span className="sb-title__lead">{head.name}</span> : null}
                {head.rest}
              </>
            )}
          </h1>
          <p className="sb-lede" ref={ledeHeld.ref} style={ledeHeld.style}>
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '22rem' } as CSSProperties} />
            ) : (
              lede(copy, period, data.standings, data.totalPlayers, data.boards)
            )}
          </p>
          <div className="sb-hero__row">
            <PeriodTabs active={period} season={seasonTab} />
            <p className="sb-closes">
              <TrophyIcon />
              <span>{copy.closes}</span>
            </p>
          </div>
        </div>
        <StandingsList
          id="standings"
          hunt="boards-standings"
          feed={periodFeed(period, data)}
          you={you}
          how={rankHowHref(undefined, period)}
          last={last}
          lines={lines}
          focusable
        />
      </section>

      <EveryBoard period={period} copy={copy} data={data} you={you} />
      <UpForGrabs period={period} copy={copy} boards={data.boards} loading={data.loading} />
    </div>
  )
}
