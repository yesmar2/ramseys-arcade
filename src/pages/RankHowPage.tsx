import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { openSiteMenu } from '../components/siteNav'
import { isDailyGame, isRankedGame, PALETTE } from '../data/games'
import { gamePlayHref, rankHowHref, rankHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { useScoresAt } from '../hooks/useProfileBoards'
import { useDailyDays, useStandingsAbove } from '../hooks/useRankHow'
import { useScoreboard, type ScoreboardData } from '../hooks/useScoreboard'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import {
  coerceVisiblePeriod,
  normalizePlayerName,
  PERIOD_LABELS,
  RANKED_LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { andList, barPosition, ordinal, placePoints, toPass } from '../lib/profileMath'
import {
  bestClimb,
  boardDay,
  boardLines,
  capital,
  dateOf,
  dayInFull,
  dayMarks,
  dayResult,
  daysTotal,
  exampleGame,
  fieldStrip,
  gameAccent,
  gameName,
  gamesWord,
  halfwayUp,
  monthDay,
  onWall,
  outcome,
  passedWords,
  periodWords,
  placedGames,
  placeWorth,
  playedDays,
  quietAndBusy,
  RESULT_WORD,
  tieLine,
  TODAY_NAME,
  weekdayWord,
  weekStart,
  workedExample,
  type ByGame,
  type DayMark,
  type Outcome,
  type PeriodWords,
  type Placed,
  type PlayedDay,
  type RankDay,
  type Standing,
} from '../lib/rankHow'
import '../styles/rankHow.css'

/*
 * How your rank works (/how-ranks-work): the one page that shows a rank worked out, so every other page
 * can say places and names. It covers one player, yours or anyone's (/how-ranks-work/SAM/weekly), at the
 * header's period and group, told in four steps with pictures: the games rank their players (all but the
 * dailies just for fun), a place pays up to 100, the rank adds them up, and the dailies go day by day
 * (with every day in a table behind a fold). Then the quickest ways up, and the exact rule and the ties
 * in small print. Every figure is the API's (lib/rankHow.ts has the working); signed out, it's the same
 * four steps in general terms.
 */

/** Whose page it is, as its sentences name them. */
type Who = { self: boolean; name: string }

/** your / SAM’s */
function whose(who: Who): string {
  return who.self ? 'your' : `${who.name}’s`
}

/** you / SAM */
function youOf(who: Who): string {
  return who.self ? 'you' : who.name
}

/** The dailies that rank: the ones just for fun (data/games.ts Game.ranked) give no points. */
const ALL_DAILIES = RANKED_LEADERBOARD_GAMES.filter((slug) => isDailyGame(slug))
/** The dailies just for fun, for the line that says they give no points. */
const FUN_DAILIES = VISIBLE_LEADERBOARD_GAMES.filter((slug) => isDailyGame(slug) && !isRankedGame(slug))

/** The games that don't rank anyone, said where the page says the games rank: "Ace Chase … don't rank anyone." */
function FunDailiesLine() {
  return FUN_DAILIES.length ? (
    <p className="rh-step__p">
      {andList(FUN_DAILIES.map(gameName))} {FUN_DAILIES.length === 1 ? 'doesn’t' : 'don’t'} rank anyone:{' '}
      {FUN_DAILIES.length === 1 ? 'it’s a daily' : 'they’re dailies'} just for fun, so {FUN_DAILIES.length === 1 ? 'it adds' : 'they add'}{' '}
      nothing to a rank.
    </p>
  ) : null
}

/**
 * Why the dailies that rank aren't in all time (lib/allTime.ts): said wherever all time's games are counted, or the
 * dailies are explained.
 */
function AllTimeDailiesLine() {
  return ALL_DAILIES.length ? (
    <p className="rh-step__p">
      {andList(ALL_DAILIES.map(gameName))} {ALL_DAILIES.length === 1 ? 'counts' : 'count'} toward the week and the month,
      not all time: added up since {ALL_DAILIES.length === 1 ? 'it' : 'they'} began, {ALL_DAILIES.length === 1 ? 'its' : 'their'}{' '}
      days would mostly count how long someone has been playing.
    </p>
  ) : null
}

const STEP_IDS = { games: 'rh-games', pays: 'rh-pays', adds: 'rh-adds', dailies: 'rh-dailies', up: 'rh-up' } as const

function stepTitles(who: Who) {
  return {
    games: FUN_DAILIES.length ? 'Most games rank their players' : 'Every game ranks its players',
    pays: who.self ? 'Your place pays up to 100' : 'Each place pays up to 100',
    adds: who.self ? 'Your rank adds them up' : `${who.name}’s rank adds them up`,
    dailies: 'Dailies go day by day',
    up: who.self ? 'Your quickest ways up' : `${who.name}’s quickest ways up`,
  }
}

/* ---------- the frame ---------- */

function Crumbs({ who, period }: { who: Who; period: LeaderboardPeriod }) {
  return (
    <nav className="rh-crumbs" aria-label="Breadcrumb">
      <a href={rankHref(who.self ? undefined : who.name, period)}>{who.self ? 'Your player card' : `${who.name}’s player card`}</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{who.self ? 'How your rank works' : `How ${who.name}’s rank works`}</span>
    </nav>
  )
}

/** This week, This month, All time: each one this page at that period, as the header's control makes it. */
function PeriodTabs({ period, player }: { period: LeaderboardPeriod; player?: string }) {
  return (
    <nav className="seg rh-periods" aria-label="Period" style={{ '--seg-count': VISIBLE_LEADERBOARD_PERIODS.length } as CSSProperties}>
      {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
        <a
          key={p}
          className={`seg__item${p === period ? ' seg__item--active' : ''}`}
          href={rankHowHref(player, p)}
          aria-current={p === period ? 'page' : undefined}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </nav>
  )
}

function Hero({
  kicker,
  title,
  lede,
  tabs,
  words = false,
}: {
  kicker: string
  title: ReactNode
  lede: ReactNode
  tabs?: ReactNode
  /** A title in words rather than a place, set smaller. */
  words?: boolean
}) {
  return (
    <header className="rh-hero">
      <div className="rh-hero__text">
        <p className="rh-kicker">{kicker}</p>
        <h1 className={`rh-title${words ? ' rh-title--words' : ''}`}>{title}</h1>
        <p className="rh-lede">{lede}</p>
      </div>
      {tabs}
    </header>
  )
}

/** The steps as chips, each a way down to its step. */
function StepChips({ who }: { who: Who }) {
  const titles = stepTitles(who)
  const chips: { id: string; n: string; label: string }[] = [
    { id: STEP_IDS.games, n: '1', label: titles.games },
    { id: STEP_IDS.pays, n: '2', label: titles.pays },
    { id: STEP_IDS.adds, n: '3', label: titles.adds },
    { id: STEP_IDS.dailies, n: '4', label: titles.dailies },
    { id: STEP_IDS.up, n: '→', label: who.self ? 'Your ways up' : `${who.name}’s ways up` },
  ]
  return (
    <nav className="rh-chips" aria-label="The steps">
      {chips.map((c) => (
        <a key={c.id} className="rh-chip" href={`#${c.id}`}>
          <i aria-hidden="true">{c.n}</i>
          {c.label}
        </a>
      ))}
    </nav>
  )
}

/** One step: its number and title with the words beside the picture (under it, on a phone). */
function Step({
  id,
  n,
  title,
  children,
  show,
}: {
  id: string
  n: string
  title: string
  children: ReactNode
  show?: ReactNode
}) {
  return (
    <section className={`rh-step${show ? '' : ' rh-step--words'}`} id={id} aria-labelledby={`${id}-h`}>
      <div className="rh-step__text">
        <div className="rh-step__head">
          <span className="rh-step__n" aria-hidden="true">
            {n}
          </span>
          <h2 id={`${id}-h`} className="rh-step__title">
            {/^\d$/.test(n) ? <span className="visually-hidden">Step {n}: </span> : null}
            {title}
          </h2>
        </div>
        {children}
      </div>
      {show ? <div className="rh-step__show">{show}</div> : null}
    </section>
  )
}

function Thumb({ slug, className }: { slug: string; className?: string }) {
  return <GameThumbArt slug={slug} accent={gameAccent(slug)} className={`rh-thumb${className ? ` ${className}` : ''}`} />
}

/* ---------- step 1: the games rank their players ---------- */

function Fields({ placed, who }: { placed: Placed[]; who: Who }) {
  return (
    <ul className="rh-fields">
      {placed.map((p) => {
        const strip = fieldStrip(p.place, p.total)
        return (
          <li key={p.slug} className="rh-card rh-field" style={{ '--g': gameAccent(p.slug) } as CSSProperties}>
            <Thumb slug={p.slug} className="rh-field__thumb" />
            <h3 className="rh-field__name">
              {gameName(p.slug)}
              {isDailyGame(p.slug) ? <span className="rh-tag">Daily</span> : null}
            </h3>
            <p className="rh-field__n">
              {p.total.toLocaleString()} {p.total === 1 ? 'player' : 'players'}
            </p>
            <span className="rh-strip" aria-hidden="true">
              {Array.from({ length: strip.cells }, (_, i) => (
                <i key={i} className={i === strip.you ? 'rh-strip__you' : undefined}>
                  {i === strip.you ? <b>{who.self ? 'You' : who.name}</b> : null}
                </i>
              ))}
            </span>
            <p className="rh-field__place">
              {ordinal(p.place)} <small>of {p.total.toLocaleString()}</small>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function GamesStep({ placed, boards, who, words }: { placed: Placed[]; boards: number; who: Who; words: PeriodWords }) {
  const listed = placed.filter((p) => onWall(p.slug))
  const retired = placed.filter((p) => !onWall(p.slug)).map((p) => gameName(p.slug))
  const n = listed.length
  const on = words.noun
    ? `${capital(words.phrase)} ${who.self ? 'you’re' : `${who.name} is`} on`
    : `${who.self ? 'You’ve' : `${who.name} has`} played`
  const rest = boards - n
  return (
    <Step id={STEP_IDS.games} n="1" title={stepTitles(who).games} show={<Fields placed={placed} who={who} />}>
      <p className="rh-step__p">
        Only {whose(who)} best run on each game counts. {on}{' '}
        <b>
          {n.toLocaleString()} of the {boards.toLocaleString()} {words.noun ? 'ranked games' : 'games that rank all time'}
        </b>
        .
        {retired.length
          ? ` ${andList(retired)} still ${retired.length === 1 ? 'counts' : 'count'}, from before ${retired.length === 1 ? 'it was' : 'they were'} retired.`
          : null}
      </p>
      <p className="rh-step__p">
        {rest <= 0
          ? 'That’s every game that ranks.'
          : rest === 1
            ? `The other one doesn’t count against ${youOf(who)}. It just hasn’t added anything yet.`
            : `The other ${rest.toLocaleString()} don’t count against ${youOf(who)}. They just haven’t added anything yet.`}
      </p>
      {words.noun ? null : <AllTimeDailiesLine />}
      <FunDailiesLine />
    </Step>
  )
}

/* ---------- step 2: a place pays up to 100 ---------- */

function Pays({ placed, who }: { placed: Placed[]; who: Who }) {
  const example = exampleGame(placed)
  const worked = example ? workedExample(example, who) : null
  return (
    <div className="rh-card rh-pays">
      <ul className="rh-pays__list">
        {placed.map((p) => (
          <li key={p.slug} className="rh-pay" style={{ '--g': gameAccent(p.slug) } as CSSProperties}>
            <span className="rh-pay__game">
              <Thumb slug={p.slug} className="rh-pay__thumb" />
              <span>
                {gameName(p.slug)}
                <small>
                  {ordinal(p.place)} of {p.total.toLocaleString()}
                </small>
              </span>
            </span>
            <span className="rh-ruler" aria-hidden="true">
              <i style={{ width: `${p.points}%` }} />
              <b style={{ left: `${p.points}%` }} />
            </span>
            <span className="rh-pay__v">
              <span className="visually-hidden">pays </span>
              {p.points}
            </span>
          </li>
        ))}
      </ul>
      <p className="rh-scale" aria-hidden="true">
        <span>
          <span className="rh-scale__w">Last · </span>1
        </span>
        <span>
          <span className="rh-scale__w">Middle · </span>50
        </span>
        <span>
          <span className="rh-scale__w">1st · </span>100
        </span>
      </p>
      {worked ? (
        <p className="rh-callout">
          <b>{worked.lead}</b> {worked.rest}
        </p>
      ) : null}
    </div>
  )
}

function PaysStep({ placed, who }: { placed: Placed[]; who: Who }) {
  const pair = quietAndBusy(placed)
  return (
    <Step id={STEP_IDS.pays} n="2" title={stepTitles(who).pays} show={<Pays placed={placed} who={who} />}>
      <p className="rh-step__p">
        1st pays 100, the middle about 50, last 1. What counts is <b>how many players you finish ahead of</b>, so a
        busy board and a quiet one pay the same for the same share.
      </p>
      {pair ? (
        <p className="rh-step__p">
          That’s why {ordinal(pair.quiet.place)} of {pair.quiet.total.toLocaleString()} on {gameName(pair.quiet.slug)} pays
          less than {ordinal(pair.busy.place)} of {pair.busy.total.toLocaleString()} on {gameName(pair.busy.slug)}.
        </p>
      ) : null}
    </Step>
  )
}

/* ---------- step 3: the rank adds them up ---------- */

/** Where a player stands against the one above them, or on top, the one below: in points, since this page can. */
function standingLine(me: Standing, rows: Standing[], who: Who, words: PeriodWords, where: string): string {
  const above = rows.find((r) => r.rank === me.rank - 1)
  const below = rows.find((r) => r.rank === me.rank + 1)
  const from = (s: Standing) => (s.games != null ? ` from ${numberWord(s.games)}` : '')
  if (me.rank > 1 && above) {
    if (above.score > me.score) {
      return `${above.name} has ${above.score.toLocaleString()}${from(above)}, so ${above.name} is one place ahead.`
    }
    return `${above.name} has ${above.score.toLocaleString()} too, and goes first on the tie-break: the Ties below say how.`
  }
  if (me.rank === 1) {
    if (!below) return `Nobody else is on the boards ${where} ${words.phrase} yet.`
    if (below.score < me.score) return `Nobody has more. ${below.name} is next, with ${below.score.toLocaleString()}.`
    return `${below.name} has ${below.score.toLocaleString()} too, and ${youOf(who)} ${who.self ? 'go' : 'goes'} first on the tie-break: the Ties below say how.`
  }
  return ''
}

function Sums({ rows, me, period }: { rows: Standing[]; me: string; period: LeaderboardPeriod }) {
  const max = Math.max(1, ...rows.map((r) => r.score))
  const meRow = rows.find((r) => r.name === me)
  // Games share the ten swatches, so only the player's own games get a colour here, and never one another of theirs has.
  const colour = new Map<string, string>()
  for (const p of placedGames(meRow?.byGame ?? {})) {
    const taken = new Set(colour.values())
    const c = taken.has(gameAccent(p.slug)) ? Object.values(PALETTE).find((s) => !taken.has(s)) : gameAccent(p.slug)
    if (!c) break // past ten games the rest go with the other games
    colour.set(p.slug, c)
  }
  const others = rows.some((r) => placedGames(r.byGame ?? {}).some((p) => !colour.has(p.slug)))
  return (
    <div className="rh-card rh-sums">
      <ol className="rh-sums__list">
        {rows.map((r) => {
          const parts = placedGames(r.byGame ?? {})
          const mine = r.name === me
          return (
            <li key={r.name} className={`rh-sum${mine ? ' rh-sum--you' : ''}`}>
              <span className="rh-sum__rank">
                <span className="visually-hidden">Place </span>
                {r.rank.toLocaleString()}
              </span>
              <a className="rh-sum__who" href={rankHref(r.name, period)}>
                <span aria-hidden="true">
                  <PlayerAvatar avatarId={r.avatarId} name={r.name} size="sm" />
                </span>
                <span className="rh-sum__name">{r.name}</span>
              </a>
              <span className="rh-segs" aria-hidden="true">
                <span className="rh-segs__bar" style={{ width: `${(100 * r.score) / max}%` }}>
                  {parts.length ? (
                    parts.map((p) => {
                      // A segment's share of the widest bar says if its figure fits: a thin one only on a wide screen.
                      const share = p.points / max
                      return (
                        <i
                          key={p.slug}
                          className={[share < 0.09 ? 'rh-seg--thin' : '', colour.has(p.slug) ? '' : 'rh-seg--other'].filter(Boolean).join(' ') || undefined}
                          style={{ flexGrow: p.points, background: colour.get(p.slug) }}
                          title={`${gameName(p.slug)} ${p.points}`}
                        >
                          {share >= 0.045 ? p.points : null}
                        </i>
                      )
                    })
                  ) : (
                    <i className="rh-segs__plain" style={{ flexGrow: 1 }} />
                  )}
                </span>
              </span>
              <span className="visually-hidden">
                {`: ${r.score.toLocaleString()} points`}
                {parts.length ? `, from ${parts.map((p) => `${gameName(p.slug)} ${p.points}`).join(', ')}` : ''}
              </span>
              <span className="rh-sum__t" aria-hidden="true">
                {r.score.toLocaleString()}
              </span>
            </li>
          )
        })}
      </ol>
      {colour.size ? (
        <ul className="rh-key" aria-hidden="true">
          {[...colour].map(([slug, c]) => (
            <li key={slug}>
              <i style={{ background: c }} />
              {gameName(slug)}
            </li>
          ))}
          {others ? (
            <li>
              <i className="rh-key__other" />
              Other games
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

function AddsStep({
  me,
  rows,
  who,
  words,
  where,
  period,
}: {
  me: Standing
  rows: Standing[]
  who: Who
  words: PeriodWords
  where: string
  period: LeaderboardPeriod
}) {
  const n = Object.keys(me.byGame ?? {}).length
  return (
    <Step id={STEP_IDS.adds} n="3" title={stepTitles(who).adds} show={<Sums rows={rows} me={me.name} period={period} />}>
      <p className="rh-step__p">
        {capital(gamesWord(n))} paid {youOf(who)} <b>{me.score.toLocaleString()}</b>. {standingLine(me, rows, who, words, where)}
      </p>
      <p className="rh-step__p">
        Points can move while {who.self ? 'you’re' : `${who.name} is`} away: a new player below {youOf(who)} raises what{' '}
        {whose(who)} place pays, and one who passes {youOf(who)} lowers it.
      </p>
    </Step>
  )
}

/* ---------- step 4: dailies go day by day ---------- */

/** One daily, worked out for the period: its days, what they add up to, the place that takes on its board, and what that pays. */
type DailyWork = {
  slug: string
  /** Null while the days load, or when they didn't. */
  played: PlayedDay[] | null
  failed: boolean
  total: number | null
  place: number
  field: number
  pays: number
}

function dailyWork(slug: string, byGame: ByGame, bests: Partial<Record<string, number>>, days: Record<string, RankDay[] | null> | null, period: LeaderboardPeriod, today: string): DailyWork {
  const row = byGame[slug]!
  const all = days ? days[slug] : undefined
  const played = all ? playedDays(all, period, today) : null
  return {
    slug,
    played,
    failed: all === null,
    // The board's own total, which the days add up to; the days' sum while it isn't on hand.
    total: bests[slug] ?? (played ? daysTotal(played) : null),
    place: row.place,
    field: row.total ?? row.place,
    pays: row.points,
  }
}

function markWords(mark: DayMark, who: Who): string {
  if (mark.state === 'played' && mark.played) {
    const { place, points } = mark.played.you
    return place != null && points != null
      ? `${ordinal(place)} of ${mark.played.players.toLocaleString()}, ${points} ${points === 1 ? 'point' : 'points'}`
      : 'played'
  }
  if (mark.state === 'today') return who.self ? 'today, still open' : 'today, not played yet'
  if (mark.state === 'missed') return 'not played'
  if (mark.state === 'before') return 'before it began'
  return 'still to come'
}

/** The period's days as circles: a week's seven with place and points, a month's so far with the place. */
function DayCircles({ work, period, today, who }: { work: DailyWork; period: LeaderboardPeriod; today: string; who: Who }) {
  const marks = dayMarks(work.slug, work.played ?? [], period, today)
  const compact = period === 'monthly'
  return (
    <ol className={`rh-days${compact ? ' rh-days--month' : ''}`} aria-label={`${gameName(work.slug)}, day by day`}>
      {marks.map((m) => {
        const you = m.played?.you
        return (
          <li key={m.day} className={`rh-day rh-day--${m.state}`}>
            <span className="rh-day__c" aria-hidden="true">
              {m.state === 'played' ? (
                you?.place != null ? (
                  <>
                    {ordinal(you.place)}
                    {!compact && you.points != null ? <small>{you.points}</small> : null}
                  </>
                ) : (
                  '✓'
                )
              ) : m.state === 'today' && !compact ? (
                'Today'
              ) : null}
            </span>
            <span className="rh-day__n" aria-hidden="true">
              {compact ? dateOf(m.day) : weekdayWord(m.day)}
            </span>
            <span className="visually-hidden">{`${dayInFull(m.day)}: ${markWords(m, who)}`}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Your days added up, the place that takes on the daily's board, and what that pays toward the rank. */
function DayFlow({ work, who, words }: { work: DailyWork; who: Who; words: PeriodWords }) {
  const owner = who.self ? 'Your' : `${who.name}’s`
  return (
    <ol className="rh-flow">
      <li className="rh-box">
        <span>{words.noun ? `${owner} ${words.noun} so far` : `${owner} days added up`}</span>
        <b>{work.total != null ? work.total.toLocaleString() : '–'}</b>
      </li>
      <li className="rh-box">
        <span>{`${owner} place ${words.board}`}</span>
        <b>
          {ordinal(work.place)} <small>of {work.field.toLocaleString()}</small>
        </b>
      </li>
      <li className="rh-box rh-box--pay">
        <span>Toward {whose(who)} rank</span>
        <b>{work.pays}</b>
      </li>
    </ol>
  )
}

/** One daily's days as a table: each day's result, place, players and points, and what they add up to. */
function DayTable({
  work,
  period,
  today,
  who,
  words,
}: {
  work: DailyWork
  period: LeaderboardPeriod
  today: string
  who: Who
  words: PeriodWords
}) {
  const played = work.played ?? []
  const name = gameName(work.slug)
  // The week's every day; the month's played days and today. A daily has no all time (lib/allTime.ts).
  let rows: DayMark[]
  if (period === 'weekly') {
    rows = dayMarks(work.slug, played, period, today)
  } else {
    rows = played.map((d): DayMark => ({ day: d.day, state: 'played', played: d }))
    if (!played.some((d) => d.day === today)) rows.push({ day: today, state: 'today' })
  }
  const when =
    period === 'weekly'
      ? `week of ${monthDay(weekStart(today))}`
      : new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const dayLabel = (day: string) => (period === 'weekly' ? weekdayWord(day) : `${weekdayWord(day)}, ${monthDay(day)}`)
  const board = `${name}’s ${words.noun ?? 'month'}`
  const id = `rh-dt-${work.slug}`
  return (
    <section className="rh-daytable" aria-labelledby={id} style={{ '--g': gameAccent(work.slug) } as CSSProperties}>
      <h3 id={id} className="rh-daytable__title">
        <Thumb slug={work.slug} />
        {name}
        <small>{when}</small>
      </h3>
      <div className="rh-table-wrap">
        <table className="rh-table">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{RESULT_WORD[work.slug] ?? 'Result'}</th>
              <th scope="col">Place</th>
              <th scope="col" className="rh-num">
                Players
              </th>
              <th scope="col" className="rh-num">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const you = m.played?.you
              return (
                <tr key={m.day} className={`rh-row--${m.state}`}>
                  <th scope="row">{dayLabel(m.day)}</th>
                  {m.state === 'played' && m.played && you ? (
                    <>
                      <td>{dayResult(work.slug, you.score)}</td>
                      <td>{you.place != null ? ordinal(you.place) : '–'}</td>
                      <td className="rh-num">{m.played.players.toLocaleString()}</td>
                      <td className="rh-num">
                        <b>{you.points ?? '–'}</b>
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={3}>
                        {m.state === 'today' ? (
                          who.self ? (
                            <a className="rh-go" href={gamePlayHref(work.slug)}>
                              {TODAY_NAME[work.slug] ?? 'Today'} ›
                            </a>
                          ) : (
                            'Not played yet today'
                          )
                        ) : m.state === 'missed' ? (
                          'Not played'
                        ) : m.state === 'before' ? (
                          `Before ${name} began`
                        ) : (
                          'To come'
                        )}
                      </td>
                      <td className="rh-num">–</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>
                {words.total}
              </th>
              <td className="rh-num">{work.total != null ? work.total.toLocaleString() : '–'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {work.total != null ? (
        <p className="rh-sumline">
          <b>
            {who.self ? `Your ${work.total.toLocaleString()} puts you` : `${who.name}’s ${work.total.toLocaleString()} is`}{' '}
            {ordinal(work.place)} of {work.field.toLocaleString()} on {board}.
          </b>{' '}
          {ordinal(work.place)} of {work.field.toLocaleString()} pays {work.pays} toward {whose(who)} rank: that’s {name}’s bar in
          step 2.
        </p>
      ) : null}
    </section>
  )
}

function Dailies({
  works,
  unplayed,
  period,
  today,
  who,
  words,
}: {
  works: DailyWork[]
  unplayed: string[]
  period: LeaderboardPeriod
  today: string
  who: Who
  words: PeriodWords
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const work = works.find((w) => w.slug === pick) ?? works[0]!
  const loading = work.played == null && !work.failed
  const anyDays = works.some((w) => w.played != null)
  const name = gameName(work.slug)
  return (
    <div className="rh-card rh-daily" style={{ '--g': gameAccent(work.slug) } as CSSProperties}>
      {works.length > 1 ? (
        <div className="rh-pick" role="group" aria-label="Which daily">
          {works.map((w) => (
            <button key={w.slug} type="button" aria-pressed={w === work} onClick={() => setPick(w.slug)}>
              <Thumb slug={w.slug} />
              {gameName(w.slug)}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <span className="rh-daily__skel" aria-hidden="true" />
      ) : work.failed ? (
        <p className="rh-daily__note">{name}’s days didn’t load. Its total is still right below.</p>
      ) : (
        <DayCircles work={work} period={period} today={today} who={who} />
      )}
      <p className="rh-down">{name}’s days add up</p>
      <DayFlow work={work} who={who} words={words} />
      {unplayed.length ? (
        <p className="rh-also">
          Not played {words.noun ? words.phrase : 'yet'}: {andList(unplayed.map(gameName))}.
        </p>
      ) : null}
      {/* The fold only once some daily's days are on hand, so it never opens onto nothing. */}
      {anyDays ? (
        <>
          <button type="button" className="rh-fold" aria-expanded={open} aria-controls="rh-every-day" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide the days' : 'See every day'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div id="rh-every-day" className="rh-everyday" hidden={!open}>
            {works.map((w) =>
              w.played ? (
                <DayTable key={w.slug} work={w} period={period} today={today} who={who} words={words} />
              ) : w.failed ? (
                <p key={w.slug} className="rh-daily__note">
                  {gameName(w.slug)}’s days didn’t load.
                </p>
              ) : null,
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function DailiesStep({
  works,
  unplayed,
  period,
  today,
  who,
  words,
  group,
}: {
  works: DailyWork[]
  unplayed: string[]
  period: LeaderboardPeriod
  today: string
  who: Who
  words: PeriodWords
  /** The header's group, when there is one: each day's place is still out of everyone who played it. */
  group: string | null
}) {
  const funLine = FUN_DAILIES.length ? (
    <p className="rh-step__p">
      {andList(FUN_DAILIES.map(gameName))} go day by day too, but their answer is the same for everyone, so they
      give no points and have no boards.
    </p>
  ) : null
  // All time leaves the dailies out (lib/allTime.ts): none of their days to work out, only why.
  if (!words.noun) {
    return (
      <Step id={STEP_IDS.dailies} n="4" title={stepTitles(who).dailies}>
        <p className="rh-step__p">
          Each day’s board pays its players the same way, and the days add up to {whose(who)} week and month, each
          ranked like any other game. Only each day’s own run counts: playing a past day again never does.
        </p>
        <AllTimeDailiesLine />
        {funLine}
      </Step>
    )
  }
  const up = `${whose(who)} ${words.noun}`
  const ranked = `the ${words.noun}`
  const climb = `its ${words.noun}`
  return (
    <Step
      id={STEP_IDS.dailies}
      n="4"
      title={stepTitles(who).dailies}
      show={
        works.length ? (
          <Dailies works={works} unplayed={unplayed} period={period} today={today} who={who} words={words} />
        ) : (
          <div className="rh-card rh-daily rh-daily--none">
            <p>
              {who.self ? 'You haven’t' : `${who.name} hasn’t`} played a daily {words.noun ? words.phrase : 'yet'}.{' '}
              {andList(ALL_DAILIES.map(gameName))} are new every day.
            </p>
          </div>
        )
      }
    >
      <p className="rh-step__p">
        Each day’s board pays its players the same way. The days add up to {up}, and then{' '}
        <b>{ranked} is ranked like any other game</b>. Only each day’s own run counts: playing a past day again never does.
      </p>
      {group ? (
        <p className="rh-step__p">
          Each day’s place and players are out of everyone who played it that day, not just {group}. Then {ranked} is
          ranked in {group}.
        </p>
      ) : null}
      <p className="rh-step__p">
        So a daily still pays at most 100 toward {whose(who)} rank, however many days {youOf(who)}{' '}
        {who.self ? 'play' : 'plays'}. Playing more days is how {youOf(who)} {who.self ? 'climb' : 'climbs'} {climb}.
      </p>
      {funLine}
    </Step>
  )
}

/* ---------- the ways up ---------- */

type Way = { key: string; slug: string; big: string; small: string; title: string; text: string; href?: string }

/** What a way does to the rank, big and small: the place it moves them up to, from the one they hold, or what it adds. */
function effect(o: Outcome, rank: number, who: Who): { big: string; small: string } {
  if (o.rank == null) return { big: `+${o.gain}`, small: passedWords(o) }
  if (o.rank < rank) return { big: ordinal(o.rank), small: `up from ${ordinal(rank)}` }
  return { big: `+${o.gain}`, small: `toward ${whose(who)} rank` }
}

/** A board to try that others have played: the busiest one not played yet this period. */
function freshBoard(data: ScoreboardData, byGame: ByGame) {
  return (
    data.boards
      .filter((b) => b.top.length > 0 && !byGame[b.slug] && b.players && onWall(b.slug) && !isDailyGame(b.slug))
      .sort((a, b) => (b.players ?? 0) - (a.players ?? 0))[0] ?? null
  )
}

/**
 * The quickest ways up, from the boards as they stand: a board nobody's played, the fewest places to
 * climb on one of theirs to pass whoever's above, the dailies, and a board they haven't tried. A
 * player not on the boards yet gets the ways in instead.
 */
function waysUp({
  data,
  me,
  above,
  who,
  words,
  playedToday,
}: {
  data: ScoreboardData
  me: (Standing & { byGame: ByGame }) | null
  above: { entries: Standing[]; offset: number } | null
  who: Who
  words: PeriodWords
  playedToday: Record<string, boolean> | null
}): Way[] {
  const byGame = me?.byGame ?? {}
  const you = youOf(who)
  const when = words.noun ? words.phrase : 'yet'
  const href = (slug: string) => (who.self ? gamePlayHref(slug) : undefined)
  const ways: { first?: Way; climb?: Way; daily?: Way; fresh?: Way } = {}

  const empties = data.boards.filter((b) => b.top.length === 0 && onWall(b.slug))
  if (empties[0]) {
    const slug = empties[0].slug
    const takes = `Nobody’s played ${gameName(slug)} ${when}, so any run takes 1st, and 1st pays 100.`
    const also = empties.slice(1).map((b) => gameName(b.slug))
    const alsoLine = also.length ? ` The same goes for ${andList(also, 4)}.` : ''
    if (me && above) {
      const o = outcome(me, { kind: 'first', slug, place: 1, field: 1 }, above.entries, above.offset)
      // Who it passes, while the big figure is the place it takes (else they're under the figure).
      const passed = o.rank != null && o.rank < me.rank ? passedWords(o).replace(/^past /, '') : ''
      const total = ` ${capital(whose(who))} ${me.score.toLocaleString()} points would become ${o.score.toLocaleString()}${passed ? `, passing ${passed}` : ''}.`
      ways.first = {
        key: 'first',
        slug,
        ...effect(o, me.rank, who),
        title: `Play ${gameName(slug)}`,
        text: `${takes}${total}${alsoLine}`,
        href: href(slug),
      }
    } else if (!me) {
      ways.first = {
        key: 'first',
        slug,
        big: '1st',
        small: `on ${gameName(slug)}`,
        title: `Play ${gameName(slug)}`,
        text: `${takes}${alsoLine}`,
        href: href(slug),
      }
    }
  }

  if (me && above) {
    // The places a run can land in on each board, so the climb names one a real score reaches.
    const landings = Object.fromEntries(Object.entries(data.nexts).map(([s, n]) => [s, n?.places]))
    const climb = bestClimb(me, above.entries, above.offset, landings)
    if (climb) {
      const next = data.nexts[climb.slug]
      // Players tied on a score sit one under another, so a place inside the tie just above can't be
      // taken: beating their score takes the first place held at it (scoreboard.ts reachFor).
      const lands = next ? Math.min(next.reach ?? climb.from - 1, climb.from - 1) : null
      const to = lands != null && lands < climb.to ? lands : climb.to
      const o =
        to === climb.to
          ? climb.outcome
          : outcome(me, { kind: 'climb', slug: climb.slug, from: climb.from, place: to, field: climb.field }, above.entries, above.offset)
      const passes = o.rank == null || o.rank < me.rank
      const places = climb.from - to
      const field = climb.field
      // What this climb adds a place, so the rounding can't have "about 1" add 2.
      const each = Math.max(1, Math.round(o.gain / places))
      const worth = `${field <= 10 ? 'Only ' : ''}${field.toLocaleString()} ${field === 1 ? 'player is' : 'players are'} on it${words.noun ? ` ${words.phrase}` : ''}, so each place there is worth about ${each}.`
      const passing = passes ? passedWords(o) : ''
      const passesWords = passing ? ` and ${you} ${who.self ? 'pass' : 'passes'} ${passing.replace(/^past /, '')}` : ''
      // "Beat X for Nth" whenever N is exactly what beating the next player up takes.
      const step =
        next && to === lands
          ? ` Beat ${next.name}’s ${formatLeaderboardScore(climb.slug, next.score)} for ${ordinal(to)}${passesWords}.`
          : ` Climb ${numberWord(places)} ${places === 1 ? 'place' : 'places'} (${ordinal(climb.from)} to ${ordinal(to)})${passesWords}.`
      const adds = passes ? '' : ` That adds ${o.gain}.`
      ways.climb = {
        key: 'climb',
        slug: climb.slug,
        ...effect(o, me.rank, who),
        title: `Climb ${gameName(climb.slug)}`,
        text: `${worth}${step}${adds}`,
        href: href(climb.slug),
      }
    }
  }

  // A daily counts toward the week and the month, never all time (lib/allTime.ts): all time has no daily way up.
  const dailies = Object.keys(byGame).filter((slug) => isDailyGame(slug) && onWall(slug))
  if (words.noun && dailies.length) {
    const names = andList(dailies.map(gameName))
    const open = playedToday ? dailies.filter((slug) => !playedToday[slug]) : []
    const openLine = !playedToday
      ? ''
      : open.length === 0
        ? ` ${who.self ? 'You’ve' : `${who.name} has`} played today’s.`
        : open.length === dailies.length
          ? ` Today’s ${open.length === 1 ? 'is' : 'are'} still open.`
          : ` ${andList(open.map(gameName))} ${open.length === 1 ? 'is' : 'are'} still open today.`
    // What a place on a daily's board is worth, on the quietest one with a place left to climb: where it's most.
    const climbing = dailies
      .filter((slug) => byGame[slug]!.place > 1 && byGame[slug]!.total)
      .sort((a, b) => byGame[a]!.total! - byGame[b]!.total!)[0]
    const worthLine = climbing
      ? ` Each place on ${gameName(climbing)}’s ${words.noun} is worth about ${placeWorth(byGame[climbing]!.total!)}.`
      : ''
    ways.daily = {
      key: 'daily',
      slug: dailies[0]!,
      big: '+1 day',
      small: 'every day',
      title: 'Keep up the dailies',
      text: `Every day of ${names} adds to ${whose(who)} ${words.noun}.${openLine}${worthLine}`,
      href: who.self && open[0] ? gamePlayHref(open[0]) : undefined,
    }
  } else if (words.noun) {
    const listed = ALL_DAILIES
    if (listed[0]) {
      ways.daily = {
        key: 'daily',
        slug: listed[0],
        big: 'Today',
        small: 'new every day',
        title: 'Play a daily',
        text: me
          ? `${andList(listed.map(gameName))} are new every day, and each day ${you} ${who.self ? 'play' : 'plays'} adds to ${whose(who)} ${words.noun}.`
          : `${andList(listed.map(gameName))} are new every day. One day on any of them puts ${you} on the boards.`,
        href: href(listed[0]),
      }
    }
  }

  const fresh = freshBoard(data, byGame)
  if (fresh && fresh.players) {
    const slug = fresh.slug
    const players = fresh.players
    const holder = fresh.top[0]
    if (players === 1 && holder) {
      const o = me && above ? outcome(me, { kind: 'join', slug, place: 2, field: 2 }, above.entries, above.offset) : null
      ways.fresh = {
        key: 'fresh',
        slug,
        ...(o && me ? effect(o, me.rank, who) : { big: '+50', small: 'any run' }),
        title: `Play ${gameName(slug)}`,
        text: `Only ${holder.name} has played it${words.noun ? ` ${words.phrase}` : ''}. Any run pays 50, and beating ${formatLeaderboardScore(slug, holder.score)} pays 100.`,
        href: href(slug),
      }
    } else {
      const half = halfwayUp(players)
      const o = me && above ? outcome(me, { kind: 'join', slug, place: half.place, field: half.field }, above.entries, above.offset) : null
      const about = players >= 10 ? 50 : placePoints(half.place, half.field)
      const lands = o && me && o.rank != null && o.rank < me.rank ? `, which would put ${you} about ${ordinal(o.rank)}` : ''
      const on = `${players.toLocaleString()} players ${words.noun ? `are on it ${words.phrase}` : 'have played it'}`
      ways.fresh = {
        key: 'fresh',
        slug,
        big: `About +${about}`,
        small: 'halfway up',
        title: `Play ${gameName(slug)}`,
        text: me
          ? `${on}, and a run halfway up adds about ${about}${lands}.`
          : `${on}. Any run puts ${you} on the boards, and a run halfway up adds about ${about}.`,
        href: href(slug),
      }
    }
  }

  return [ways.first, ways.climb, ways.daily, ways.fresh].filter((w): w is Way => Boolean(w)).slice(0, 3)
}

function WayCards({ ways }: { ways: Way[] }) {
  return (
    <ul className="rh-moves">
      {ways.map((w) => (
        <li key={w.key} className="rh-card rh-move" style={{ '--g': gameAccent(w.slug) } as CSSProperties}>
          <div className="rh-move__big">
            <Thumb slug={w.slug} className="rh-move__thumb" />
            <span>
              <b>{w.big}</b>
              {w.small ? <small>{w.small}</small> : null}
            </span>
          </div>
          <div className="rh-move__words">
            <h3 className="rh-move__title">{w.href ? <a href={w.href}>{w.title}</a> : w.title}</h3>
            <p className="rh-move__text">{w.text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The whole standings as a bar, with the top ten and the shares of the board marked, and what each takes. */
function WholeBoard({
  period,
  rank,
  field,
  score,
  groupId,
  who,
  words,
}: {
  period: LeaderboardPeriod
  rank: number
  field: number
  score: number
  groupId: string | null
  who: Who
  words: PeriodWords
}) {
  const lines = boardLines(field)
  // The lines still ahead, loosest first: the first is the one to chase next.
  const ahead = lines.filter((l) => l.rank < rank)
  const { scores } = useScoresAt(period, ahead.map((l) => l.rank), groupId)
  const next = ahead[0]
  const need = (rankAt: number) => {
    const at = scores[rankAt]
    return at != null ? toPass(at, score) : null
  }
  // Until the labels are measured: a mark close to the one before it lifts its label a row.
  let lastLow = -1
  const marks = lines
    .map((l) => ({ line: l, at: barPosition(l.rank, field) }))
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const up = lastLow >= 0 && m.at - lastLow < 0.16
      if (!up) lastLow = m.at
      const inside = rank <= m.line.rank
      const points = inside ? null : need(m.line.rank)
      const took = inside ? '✓' : points != null ? `${points.toLocaleString()} ${points === 1 ? 'point' : 'points'}` : ''
      return { ...m, up, took }
    })
  // Then each label goes on the lowest row where it clears the labels already there, as wide as they
  // really are: an end label runs leftwards from its mark, and a phone's track is narrow.
  const trackRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<Record<string, number> | null>(null)
  const labelsKey = marks.map((m) => `${m.line.key}:${m.took}`).join('|')
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const place = () => {
      const boxes = [...track.querySelectorAll<HTMLElement>('[data-mark]')]
        .map((el) => ({ key: el.dataset.mark ?? '', box: el.getBoundingClientRect() }))
        .filter((b) => b.box.width > 0)
        .sort((a, b) => a.box.left - b.box.left)
      if (!boxes.length) return // hidden or not laid out: keep the guess
      // A row only moves a label up, never sideways, so measuring with the rows on gives the same boxes.
      const ends: number[] = []
      const found: Record<string, number> = {}
      for (const { key, box } of boxes) {
        let row = ends.findIndex((right) => box.left >= right + 6)
        if (row < 0) row = ends.length
        ends[row] = box.right
        found[key] = row
      }
      setRows((prev) => (prev && JSON.stringify(prev) === JSON.stringify(found) ? prev : found))
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(place)
    watch.observe(track)
    return () => watch.disconnect()
  }, [labelsKey])
  const rowOf = (m: (typeof marks)[number]) => rows?.[m.line.key] ?? (m.up ? 1 : 0)
  const rowCount = Math.max(0, ...marks.map(rowOf)) + 1
  return (
    <section className="rh-card rh-whole" aria-labelledby="rh-whole-h">
      <div className="rh-whole__head">
        <h3 id="rh-whole-h">{who.self ? 'You' : who.name} on the whole board</h3>
        <p>
          {field.toLocaleString()} {field === 1 ? 'player' : 'players'} {words.phrase}
        </p>
      </div>
      <div ref={trackRef} className="rh-track" style={{ '--rows': rowCount } as CSSProperties} aria-hidden="true">
        <span className="rh-track__fill" style={{ width: `${barPosition(rank, field) * 100}%` }} />
        {marks.map((m) => {
          const { line, at, took } = m
          return (
            <span
              key={line.key}
              className={`rh-mark${line === next ? ' rh-mark--next' : ''}${at > 0.86 ? ' rh-mark--end' : at < 0.14 ? ' rh-mark--start' : ''}`}
              style={{ left: `${at * 100}%`, '--row': rowOf(m) } as CSSProperties}
            >
              <span data-mark={line.key}>
                {line.label}
                <b>{took}</b>
              </span>
            </span>
          )
        })}
        <span className="rh-track__dot" style={{ left: `${barPosition(rank, field) * 100}%` }} />
      </div>
      <p className="rh-track__ends" aria-hidden="true">
        <span>{ordinal(field)}</span>
        <span>1st</span>
      </p>
      <ul className="visually-hidden">
        <li>
          {who.self ? 'You’re' : `${who.name} is`} {ordinal(rank)} of {field.toLocaleString()}.
        </li>
        {lines.map((l) => {
          const points = rank <= l.rank ? null : need(l.rank)
          return (
            <li key={l.key}>
              {l.label}, {ordinal(l.rank)} or better:{' '}
              {rank <= l.rank ? `${youOf(who)} ${who.self ? 'are' : 'is'} in it.` : points != null ? `${points} points away.` : 'further up.'}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function WaysStep({
  ways,
  loading,
  who,
  words,
  title = stepTitles(who).up,
  children,
}: {
  ways: Way[]
  loading: boolean
  who: Who
  words: PeriodWords
  title?: string
  children?: ReactNode
}) {
  return (
    <Step
      id={STEP_IDS.up}
      n="→"
      title={title}
      show={
        <div className="rh-ways">
          {loading ? (
            <div className="rh-moves rh-moves--skel" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : ways.length ? (
            <WayCards ways={ways} />
          ) : null}
          {children}
        </div>
      }
    >
      <p className="rh-step__p">
        Worked out from {words.noun ? `this ${words.noun}’s` : 'the all-time'} boards. They change as people play.
      </p>
    </Step>
  )
}

/* ---------- the small print ---------- */

function FinePrint({ words, tie }: { words: PeriodWords; tie?: string | null }) {
  return (
    <div className="rh-fine">
      <section className="rh-card rh-note" aria-labelledby="rh-rule-h">
        <div className="rh-note__head">
          <h2 id="rh-rule-h">The exact rule</h2>
          <span>Small print</span>
        </div>
        <p>
          <b>100 × (players − your place + 1) ÷ players</b>, rounded, never below 1. Your rank is the sum over every ranked
          game {words.noun ? words.phrase : 'you’ve played, but the dailies'}.
        </p>
        <p>The dailies score each day this way, then add up the week’s days and the month’s. They don’t count all time.</p>
        <p>Events work the same way on a small scale: 1st on a game pays 10, last pays 1.</p>
      </section>
      <section className="rh-card rh-note" aria-labelledby="rh-ties-h">
        <div className="rh-note__head">
          <h2 id="rh-ties-h">Ties</h2>
          <span>Who goes first</span>
        </div>
        <p>
          <b>Your rank:</b> more games played, then the tag first in the alphabet.{tie ? ` ${tie}` : ''}
        </p>
        <p>
          <b>A game’s board{words.noun ? `, a daily’s ${words.noun}` : ''}, records:</b> whoever got there first.
        </p>
      </section>
    </div>
  )
}

/* ---------- in general, for no one in particular ---------- */

function GeneralSteps({ words }: { words: PeriodWords }) {
  const who: Who = { self: true, name: '' }
  const example = workedExample({ slug: '', place: 3, total: 13, points: placePoints(3, 13) }, who)
  return (
    <>
      <Step id={STEP_IDS.games} n="1" title={stepTitles(who).games}>
        <p className="rh-step__p">
          Only your best run on each game counts, and each ranked game has its own board for the week, the month and all
          time. A daily’s are for the week and the month only.
        </p>
        <p className="rh-step__p">A game you haven’t played doesn’t count against you. It just hasn’t added anything yet.</p>
        <FunDailiesLine />
      </Step>
      <Step id={STEP_IDS.pays} n="2" title={stepTitles(who).pays}>
        <p className="rh-step__p">
          1st pays 100, the middle about 50, last 1. What counts is <b>how many players you finish ahead of</b>, so a busy
          board and a quiet one pay the same for the same share.
        </p>
        <p className="rh-callout">
          <b>Say you’re 3rd of 13:</b> {example.rest}
        </p>
      </Step>
      <Step id={STEP_IDS.adds} n="3" title={stepTitles(who).adds}>
        <p className="rh-step__p">Your rank is what the ranked games paid you, added up, and the most goes first.</p>
        <p className="rh-step__p">
          Points can move while you’re away: a new player below you raises what your place pays, and one who passes you
          lowers it.
        </p>
      </Step>
      <Step id={STEP_IDS.dailies} n="4" title={stepTitles(who).dailies}>
        <p className="rh-step__p">
          Each day’s board pays its players the same way. The days add up to your {words.noun ?? 'week and your month'}, and
          then <b>{words.noun ? 'that is' : 'each is'} ranked like any other game</b>. Only each day’s own run counts:
          playing a past day again never does.
        </p>
        <p className="rh-step__p">
          So a daily still pays at most 100 toward your rank, however many days you play. Playing more days is how you climb.
        </p>
        <AllTimeDailiesLine />
      </Step>
    </>
  )
}

/** Signed out, or no tag yet: how ranks work in general, and the way to one of your own. */
function General({ signedIn, loading, period }: { signedIn: boolean; loading: boolean; period: LeaderboardPeriod }) {
  const words = periodWords(period)
  return (
    <>
      <Hero
        kicker="How ranks work"
        title="How your rank works"
        lede={`${FUN_DAILIES.length ? 'Most games rank everyone who played them' : 'Every game ranks everyone who played it'}. Your place on each pays up to 100, and your rank adds them up.`}
        words
      />
      {loading ? null : (
        <section className="rh-card rh-invite" aria-labelledby="rh-invite-h">
          <h2 id="rh-invite-h">{signedIn ? 'Pick a gamer tag' : 'See your own'}</h2>
          <p>
            {signedIn
              ? 'Pick a gamer tag to get on the boards, and this page works your rank out, game by game and day by day.'
              : 'Sign in and this page works your rank out from your own runs, game by game and day by day.'}
          </p>
          <button type="button" className="rh-invite__go" onClick={openSiteMenu}>
            {signedIn ? 'Pick a tag' : 'Sign in'}
          </button>
        </section>
      )}
      <GeneralSteps words={words} />
      <FinePrint words={words} />
    </>
  )
}

/* ---------- one player's ---------- */

function Loading({ who, period }: { who: Who; period: LeaderboardPeriod }) {
  return (
    <>
      <Crumbs who={who} period={period} />
      <Hero
        kicker={who.self ? `How your rank works · ${who.name}` : `How ${who.name}’s rank works`}
        title={<span className="skel-line" style={{ '--skel-w': '9ch' } as CSSProperties} />}
        lede={<span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />}
        tabs={<PeriodTabs period={period} player={who.self ? undefined : who.name} />}
      />
      <div className="rh-loading" aria-hidden="true">
        <span />
        <span />
      </div>
    </>
  )
}

function PlayerHow({
  name,
  self,
  period,
  groupId,
  groupName,
}: {
  name: string
  self: boolean
  period: LeaderboardPeriod
  groupId: string | null
  groupName: string | undefined
}) {
  const who: Who = { self, name }
  const data = useScoreboard(period, name, groupId)
  const you = data.you
  const rank = !data.loading ? (you?.rank ?? null) : null
  const byGame: ByGame = you?.byGame ?? {}
  const dailySlugs = Object.keys(byGame).filter((slug) => isDailyGame(slug))
  const days = useDailyDays(dailySlugs, name, groupId)
  const above = useStandingsAbove(period, rank, groupId)
  const words = periodWords(period)
  const where = groupName ? `in ${groupName}` : 'in the arcade'
  const today = boardDay()
  const player = self ? undefined : name
  const kicker = self ? `How your rank works · ${name}` : `How ${name}’s rank works`
  const tabs = <PeriodTabs period={period} player={player} />

  if (data.loading) return <Loading who={who} period={period} />

  if (data.error || !you) {
    return (
      <>
        <Crumbs who={who} period={period} />
        <Hero kicker={kicker} title="Couldn’t load the boards" lede="Check your connection and try again in a moment." tabs={tabs} words />
      </>
    )
  }

  const place = you.rank
  // Whether each daily played this period has today's day in, for the dailies' way up.
  const playedToday = days
    ? Object.fromEntries(dailySlugs.map((slug) => [slug, Boolean(days[slug]?.some((d) => d.day === today && d.you))]))
    : null

  if (place == null) {
    const ways = waysUp({ data, me: null, above: null, who, words, playedToday })
    const when = words.noun ? ` ${words.phrase}` : ''
    return (
      <>
        <Crumbs who={who} period={period} />
        <Hero
          kicker={kicker}
          title={self ? `Not on the boards${when} yet` : `${name} isn’t on the boards${when} yet`}
          lede={`A rank adds up the places on every ranked game played${when}${words.noun ? '' : ', but the dailies'}. One run on any of them puts ${youOf(who)} on the boards${groupName ? ` ${where}` : ''}.`}
          tabs={tabs}
          words
        />
        <GeneralSteps words={words} />
        <WaysStep ways={ways} loading={false} who={who} words={words} title={self ? 'Your ways onto the boards' : `${name}’s ways onto the boards`} />
        <FinePrint words={words} />
      </>
    )
  }

  const placed = placedGames(byGame)
  const nearby = ((you.nearby ?? []) as Standing[]).slice().sort((a, b) => a.rank - b.rank)
  const selfRow = nearby.find((r) => r.name === name)
  const me: Standing & { byGame: ByGame } = {
    name,
    rank: place,
    score: you.score,
    games: selfRow?.games ?? Object.keys(byGame).length,
    byGame,
    avatarId: you.avatarId,
  }
  const rows = selfRow ? nearby.map((r) => (r.name === name ? { ...r, byGame: r.byGame ?? byGame } : r)) : [...nearby, me].sort((a, b) => a.rank - b.rank)
  const aboveRow = rows.find((r) => r.rank === place - 1)
  // Standings that didn't load measure no ways against them: the ways that claim no place still show.
  const ways = above ? waysUp({ data, me, above: above.failed ? null : above, who, words, playedToday }) : []
  const works = placed
    .filter((p) => isDailyGame(p.slug))
    .map((p) => dailyWork(p.slug, byGame, data.bests, days, period, today))
  const unplayed = ALL_DAILIES.filter((slug) => !byGame[slug])

  return (
    <>
      <Crumbs who={who} period={period} />
      <Hero
        kicker={kicker}
        title={
          <>
            {ordinal(place)} of {you.totalPlayers.toLocaleString()}{' '}
            <small>
              {groupName ? `${where} ` : ''}
              {words.phrase}
            </small>
          </>
        }
        lede="Here’s how that’s worked out, in four steps."
        tabs={tabs}
      />
      <StepChips who={who} />
      <GamesStep placed={placed} boards={data.boards.length} who={who} words={words} />
      <PaysStep placed={placed} who={who} />
      <AddsStep me={me} rows={rows} who={who} words={words} where={where} period={period} />
      <DailiesStep
        works={works}
        unplayed={unplayed}
        period={period}
        today={today}
        who={who}
        words={words}
        group={groupId ? (groupName ?? 'the group') : null}
      />
      <WaysStep ways={ways} loading={!above} who={who} words={words}>
        {you.totalPlayers > 1 ? (
          <WholeBoard period={period} rank={place} field={you.totalPlayers} score={you.score} groupId={groupId} who={who} words={words} />
        ) : null}
      </WaysStep>
      <FinePrint words={words} tie={aboveRow ? tieLine(me, aboveRow, self) : null} />
    </>
  )
}

/** How your rank works: yours, or `player`'s, at the route's period (the header's, when the address doesn't say). */
export function RankHowPage({ player, period: routePeriod }: { player?: string; period?: LeaderboardPeriod }) {
  const globalPeriod = useDefaultPeriod()
  const period = coerceVisiblePeriod(routePeriod ?? globalPeriod)
  const { signedIn, loading } = useAuth()
  const myName = normalizePlayerName(usePlayerName())
  const asked = normalizePlayerName(player ?? '')
  const name = asked || myName
  const self = !asked || asked === myName
  const groupId = useActiveGroup()
  const groupName = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  return (
    <PageShell innerClassName="lb-page__inner rh-page">
      {name ? (
        <PlayerHow key={`${name}|${groupId ?? ''}`} name={name} self={self} period={period} groupId={groupId} groupName={groupName} />
      ) : (
        <General signedIn={signedIn} loading={loading} period={period} />
      )}
    </PageShell>
  )
}
