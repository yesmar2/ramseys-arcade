import { useEffect, useState, type CSSProperties } from 'react'
import { useHeldShape } from '../lib/heldShape'
import { getGame } from '../data/games'
import { useScoreboard } from '../hooks/useScoreboard'
import { boardPlaceHref, gamePlayHref, leaderboardHref, rankHowHref, rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn, readableFill, readableText } from '../lib/color'
import { useActiveGroup, useScope } from '../lib/groups'
import {
  fetchGlobalBoard,
  findInStandings,
  normalizePlayerName,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  lineScore,
  ordinal,
  periodCopy,
  youCell,
  type BoardLine,
  type BoardTop,
  type PeriodCopy,
  type YouStanding,
} from '../lib/scoreboard'
import { useSeason } from '../lib/season'
import { periodTabs, prizeLines, useSeasonTab } from '../lib/seasonStandings'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { GameThumbArt } from './GameThumbArt'
import { PeriodLabel } from './PeriodLabel'
import { SkinMark } from './season/SkinMark'
import { StandingsList, TrophyIcon, type StandingsFeed } from './StandingsList'
import { BoardsAmong } from './BoardsAmong'
import { boardPodium } from './PodiumPrize'

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

function ChevronIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/* ---------- the race ---------- */

/**
 * The periods, and while a season has standings, the Season tab after them. Each is a link to the boards at that
 * period, so they're a nav with the one you're on marked, not tabs (lib/choiceKeys.ts).
 */
function PeriodTabs({ active, season }: { active: LeaderboardPeriod; season: boolean }) {
  const periods = periodTabs(VISIBLE_LEADERBOARD_PERIODS, season || active === 'season')
  const four = periods.length > 3
  return (
    <nav
      className={`seg sb-periods${four ? ' seg--four' : ''}`}
      aria-label="Period"
      style={{ '--seg-count': periods.length } as CSSProperties}
    >
      {periods.map((p) => (
        <a
          key={p}
          aria-current={p === active ? 'page' : undefined}
          className={`seg__item${p === active ? ' seg__item--active' : ''}`}
          href={leaderboardHref(p)}
        >
          <PeriodLabel period={p} four={four} />
        </a>
      ))}
    </nav>
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

/*
 * A card a game (Ramsey, 2026-11-05: the table was "kinda confusing to read", then "let's see C" of three tried:
 * each game's leader and you, the top three as medal chips, a card a game). Each card is a little board: the
 * game, its top three on discs of their metal, and you under them, your place and the score that takes a higher
 * one. The game's name is the card's link, stretched over it (everyBoard.css); a skin beside a name opens its own
 * card over it.
 */

const METAL = ['gold', 'silver', 'bronze'] as const

function BoardCard({
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
  const place = standing?.byGame[line.slug]?.place ?? null
  const players = line.players == null ? '' : `${line.players.toLocaleString()} ${line.players === 1 ? 'player' : 'players'}`
  // You on it, in words, and what's next under them: the score that takes a higher place.
  const mine = !standing ? null : place === 1 ? 'You lead it' : place ? `You’re ${ordinal(place)}` : cell?.tone === 'hint' ? cell.b : 'Not played yet'
  const then = place && place > 1 ? (cell?.b ?? '') : ''
  const tone = place ? 'on' : 'off'
  // A daily's week is in points, which its own board shows: here it is names.
  const score = (n: number) => (line.points ? '' : lineScore(line, n))
  const podium = line.top.map((t, i) => `${ordinal(i + 1)} ${t.name}${score(t.score) ? ` ${score(t.score)}` : ''}`).join(', ')
  const label = [`${name} board`, players, podium, mine ? [mine, then].filter(Boolean).join('. ') : ''].filter(Boolean).join('. ')
  return (
    <li className="eb-card">
      <div className="eb-card__head">
        <GameThumbArt slug={line.slug} accent={accent} className="eb-card__thumb" />
        <a className="eb-card__name" href={boardPlaceHref(line.slug, period)} aria-label={label}>
          <b>{name}</b>
          {players ? <small>{players}</small> : null}
        </a>
        <span className="eb-card__go" aria-hidden="true">
          <ChevronIcon />
        </span>
      </div>
      <ol className="eb-card__top" aria-hidden="true">
        {line.top.slice(0, 3).map((t, i) => (
          <li key={t.name} className={`eb-card__row eb-card__row--${METAL[i]}${you && t.name === you ? ' eb-card__row--you' : ''}`}>
            <i>{i + 1}</i>
            <span className="eb-card__who">
              <b>{t.name}</b>
              {/* The skin the run was played in, as every game's own board shows it. */}
              <SkinMark skin={t.skin} />
            </span>
            {score(t.score) ? <small>{score(t.score)}</small> : null}
          </li>
        ))}
      </ol>
      {mine ? (
        <p className={`eb-card__you eb-card__you--${tone}`} aria-hidden="true">
          <b>{mine}</b>
          {then ? <small>{then}</small> : null}
        </p>
      ) : null}
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
      {data.loading ? (
        <ul className="eb-cards" aria-busy="true">
          {Array.from({ length: Math.max(1, heldBoards) }, (_, i) => (
            <li key={i} className="eb-card eb-card--skel">
              <span className="eb-card__head">
                <span className="eb-card__thumb eb-card__thumb--skel" />
                <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
              </span>
              <span className="eb-card__top">
                {[0, 1, 2].map((k) => (
                  <span key={k} className="skel-line" style={{ '--skel-w': `${9 - k}rem` } as CSSProperties} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : played.length ? (
        <ul className="eb-cards">
          {played.map((line) => (
            <BoardCard
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
              style={
                {
                  '--grab-accent': accent,
                  '--grab-ink': inkOn(accent),
                  '--grab-fill': readableFill(accent),
                  '--grab-text': readableText(accent, '#ffffff'),
                } as CSSProperties
              }
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

/** The tip beside the Standings' title: the period (live, while it is), when it closes and what that hands out. */
function PeriodTip({ copy, group }: { copy: PeriodCopy; group: string | null | undefined }) {
  const name = copy.kicker.replace(/^Live · /, '')
  return (
    <>
      <span className="sb-tip__name">
        {copy.live ? <span className="sb-kicker__dot" aria-hidden="true" /> : null}
        {copy.live ? 'Live · ' : ''}
        {name.charAt(0).toUpperCase() + name.slice(1)}
        {group ? ` · ${group}` : ''}
      </span>
      {copy.closes ? (
        <span className="sb-tip__line">
          <TrophyIcon />
          <span>{copy.closes}</span>
        </span>
      ) : null}
    </>
  )
}

export function BoardsScoreboard({ period }: { period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useScoreboard(period, you, groupId)
  const season = useSeason().season
  const seasonTab = useSeasonTab()
  const copy = periodCopy(period, Date.now(), Boolean(groupId))
  // The season's standings draw a line under the places that win its cup, and under the ones that win a trophy.
  const lines = period === 'season' ? prizeLines(data.prizes, data.totalPlayers, season?.id ?? null, Boolean(groupId)) : null
  // The group by name, said again once the list of your groups comes with it.
  const group = useScope().name
  const closed = copy.last
  const last = closed
    ? {
        expected: true,
        rows: data.last,
        waiting: data.lastWaiting,
        title: closed.title,
        note: closed.note,
        rowHref: (name: string) => rankHref(name, closed.period),
        podium: boardPodium({ period: closed.period, final: true }),
      }
    : null
  // A first look has no shapes kept for this page (lib/heldShape.ts), and the standings may come as ten rows or
  // as three and last time's five: what's under them waits until they're in and comes in its place, as a player
  // card's page does (RankPage.tsx). It's under the fold while they load either way. Once drawn it stays, when
  // another period is picked too.
  const settled = !data.loading && !data.lastWaiting
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (settled) setDrawn(true)
  }, [settled])
  const below = drawn || settled

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
          {/*
           * No headline of who leads, no line of how many play, and no Live chip: the period, then the list. When
           * it closes and what it hands out are in the tip beside the Standings' title (Ramsey, 2026-11-05).
           */}
          <h1 id="sb-title" className="visually-hidden">
            Boards
          </h1>
          <div className="sb-hero__row">
            <div className="board-picks">
              <PeriodTabs active={period} season={seasonTab} />
              <BoardsAmong />
            </div>
          </div>
        </div>
        <StandingsList
          id="standings"
          hunt="boards-standings"
          tip={<PeriodTip copy={copy} group={group} />}
          feed={periodFeed(period, data)}
          you={you}
          how={rankHowHref(undefined, period)}
          // All time leaves the dailies out (lib/allTime.ts), so a player's games here can be fewer than this
          // month's: Ramsey saw 12 here and 17 on the month (2026-10-26).
          sub={period === 'all' ? 'The daily races count toward the week and the month, not all time.' : null}
          last={last}
          lines={lines}
          podium={groupId ? null : boardPodium({ period, seasonId: season?.id ?? null, cupPlaces: lines?.cup ?? null })}
          focusable
        />
      </section>

      {below ? (
        <>
          <EveryBoard period={period} copy={copy} data={data} you={you} />
          <UpForGrabs period={period} copy={copy} boards={data.boards} loading={data.loading} />
        </>
      ) : null}
    </div>
  )
}
