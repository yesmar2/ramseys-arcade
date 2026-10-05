import type { ReactNode } from 'react'
import { isDailyGame } from '../data/games'
import { rankHowHref } from '../hooks/useHashRoute'
import type { HubBeyond, HubBoard } from '../hooks/useGameHub'
import { dailyWords } from '../lib/dailyWords'
import { dayRunIn, firstRunWord, gapBetween, oneRunBoard, whatPutsYouOn } from '../lib/gameBoard'
import { dailyHistory, daysIn, firstRunAims, soFar, standingOn, type Aim, type DailyHistory, type Standing } from '../lib/gameHub'
import type { LeaderboardGame, LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { andList, ordinal, periodWord } from '../lib/profileMath'
import { boardDay } from '../lib/rankHow'
import { ChevronRightIcon } from './chromeIcons'
import { openSiteMenu } from './siteNav'

/**
 * Where you stand on the game's board this period, and the one run that moves
 * you: past the player above in the top ten or on a small board, and a bigger
 * jump further down (gameHub standingOn picks it). Off the board, what your
 * best would do on it; never played, the scores a first run could aim at.
 *
 * A daily's board is today's, so its card also knows the player beyond today
 * (DailyStanding): their week, month or all time on the game, as the header
 * picks, which is what their rank takes from it.
 */
export function GameHubStanding({
  slug,
  gameName,
  period,
  board,
  beyond,
  me,
  signedIn,
}: {
  slug: LeaderboardGame
  gameName: string
  period: LeaderboardPeriod
  board: HubBoard
  /** A daily's viewer beyond today, over the header's period. */
  beyond?: HubBeyond
  me: string
  signedIn: boolean
}) {
  if (isDailyGame(slug)) {
    return <DailyStanding slug={slug} gameName={gameName} board={board} beyond={beyond ?? NOT_ASKED} me={me} signedIn={signedIn} />
  }

  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const when = periodWord(period)
  const you = board.loading ? null : board.you
  const field = board.field

  let title = 'Where you stand'
  let body: ReactNode
  if (board.loading) {
    body = <StandingSkeleton />
  } else if (you) {
    body = <OnBoard slug={slug} standing={standingOn(board.sample, you, oneRunBoard(slug, period))} when={when} />
  } else if (me && board.allTimeBest != null && board.allTimeBest > 0) {
    const best = board.allTimeBest
    const landing = { place: board.wouldPlace ?? board.field + 1 }
    body = (
      <>
        <div className="gh-stand__lead">
          <p className="gh-stand__big gh-stand__big--words">Not on {when === 'all time' ? 'the board' : `${when}’s board`}</p>
          <p className="gh-stand__sub">Your best is {fmt(best)}, all time</p>
        </div>
        <Callout badge={field ? ordinal(landing.place) : '1st'}>
          {field ? (
            <>
              A run like your best would put you <b>{ordinal(landing.place)}</b> {when}.
            </>
          ) : (
            <>
              Nobody’s played {when === 'all time' ? '' : `${when} `}yet, so <b>any run</b> takes 1st.
            </>
          )}
        </Callout>
      </>
    )
  } else {
    title = 'Where you’d start'
    const aims = firstRunAims(board.sample)
    body = (
      <>
        <div className="gh-stand__lead">
          <p className="gh-stand__big gh-stand__big--words">Your first run</p>
          <p className="gh-stand__sub">
            {field
              ? `${field} ${field === 1 ? 'player' : 'players'} ${when}. ${whatPutsYouOn(slug)}.`
              : `Nobody has played ${gameName} ${when === 'all time' ? 'yet' : when}. Whatever you score, you start in 1st.`}
          </p>
        </div>
        {field && aims.length ? (
          <Aims slug={slug} aims={aims} />
        ) : (
          <Callout badge="1st">
            <b>Any run</b> takes 1st until someone beats it.
          </Callout>
        )}
        {!signedIn ? <SignIn /> : null}
      </>
    )
  }

  return (
    <section className="gh-card gh-stand" aria-labelledby="gh-stand-title" data-hunt={`g-stand-${slug}`}>
      <h2 id="gh-stand-title" className="gh-cap">
        {title}
      </h2>
      {body}
    </section>
  )
}

/** Beyond today, when nothing asked: a week, and no places. */
const NOT_ASKED: HubBeyond = { period: 'weekly', loading: false, place: null, rank: null }

/**
 * A daily's card. Today's board is only the day: the player's week, month or all time on the game (the
 * header's period) is what their rank takes from it, so the card says that place (never the points behind
 * it) beside today's, the scores that move them today, and where their rank is explained. Someone back
 * again is never met with "your first run"; someone new is welcomed rather than measured.
 */
function DailyStanding({
  slug,
  gameName,
  board,
  beyond,
  me,
  signedIn,
}: {
  slug: LeaderboardGame
  gameName: string
  board: HubBoard
  beyond: HubBeyond
  me: string
  signedIn: boolean
}) {
  const words = dailyWords(slug)
  const today = boardDay()
  const { days } = board
  const field = board.field
  const you = board.loading ? null : board.you
  const history = dailyHistory(days, me)
  const run = firstRunWord(slug)
  // "Today’s track" mid-sentence: the names (Today’s Wanted, Today’s Pour) keep their capitals.
  const todays = `t${words.today.slice(1)}`
  const over = beyond.period
  // "this week", "this month", "all time"; and the week or month a day counts toward, none for all time.
  const when = periodWord(over)
  const span = over === 'monthly' ? 'month' : over === 'all' ? null : 'week'
  const counts = span ? `your ${span} and your rank` : 'your rank'
  const place = beyond.place

  let title = 'Where you stand'
  let body: ReactNode
  let foot: ReactNode = null
  if (board.loading || beyond.loading) {
    body = <StandingSkeleton />
  } else if (board.error) {
    body = (
      <div className="gh-stand__lead">
        <p className="gh-stand__big gh-stand__big--words">Couldn’t load today</p>
        <p className="gh-stand__sub">Check your connection and try again.</p>
      </div>
    )
  } else if (you) {
    body = <OnBoard slug={slug} standing={standingOn(board.sample, you, oneRunBoard(slug, 'daily'))} when="today" daily />
    foot = (
      <RankFoot period={over}>
        {place ? (
          <>
            You’re <b>{placeOf(place)}</b> {when} on {gameName}.
          </>
        ) : (
          <>Today’s board counts toward {counts}.</>
        )}
      </RankFoot>
    )
  } else if (history === 'back' && days) {
    title = span ? `Your ${span} on ${gameName}` : `All time on ${gameName}`
    const sofar = soFar(days, over, today)
    // Their days can say they've played in the period when its board didn't load: then no place, but no "no days" either.
    const played = Boolean(place) || daysIn(days, over, today).length > 0
    body = (
      <>
        <div className="gh-stand__lead">
          {place ? (
            <p className="gh-stand__big">
              {ordinal(place.place)}
              <span>
                {place.field ? ` of ${place.field}` : ''} {when}
              </span>
            </p>
          ) : (
            <p className="gh-stand__big gh-stand__big--words">{played ? `Your ${span ?? 'days'} so far` : `No days ${when} yet`}</p>
          )}
          <p className="gh-stand__sub">
            {sofar ? `${sofar} ` : ''}
            {played
              ? place?.place === 1
                ? `${words.today} can keep you 1st.`
                : `${words.today} can move you up.`
              : `Play ${todays} to start your ${span ?? 'days'}.`}
          </p>
        </div>
        <TodayAims slug={slug} board={board} lead={`${words.today}: `} run={run} history={history} />
        {!signedIn ? <SignIn /> : null}
      </>
    )
    foot = (
      <RankFoot period={over}>
        {beyond.rank ? (
          <>
            All games: <b>{placeOf(beyond.rank)}</b> {when}
          </>
        ) : null}
      </RankFoot>
    )
  } else {
    // New to it, or their days didn't load: then neither "first" nor "again" is said.
    const fresh = history === 'new'
    title = fresh ? 'Where you’d start' : 'Where you stand'
    body = (
      <>
        <div className="gh-stand__lead">
          <p className="gh-stand__big gh-stand__big--words">{fresh ? `Your first ${run}` : 'Not on today’s board yet'}</p>
          <p className="gh-stand__sub">
            {field
              ? `${field} ${field === 1 ? 'player' : 'players'} today. ${whatPutsYouOn(slug)}.`
              : `Nobody has played ${gameName} today yet.`}
          </p>
        </div>
        <TodayAims slug={slug} board={board} lead="" run={run} history={history} />
        {!signedIn ? <SignIn /> : null}
      </>
    )
    foot = <RankFoot period={over}>{fresh ? <>Each day you play counts toward {counts}.</> : null}</RankFoot>
  }

  return (
    <section className="gh-card gh-stand gh-stand--daily" aria-labelledby="gh-stand-title" data-hunt={`g-stand-${slug}`}>
      <h2 id="gh-stand-title" className="gh-cap">
        {title}
      </h2>
      {body}
      {foot}
    </section>
  )
}

/** 6th of 16; 6th alone from an API that leaves the field out. */
function placeOf({ place, field }: { place: number; field: number | null }): string {
  return field ? `${ordinal(place)} of ${field}` : ordinal(place)
}

/** What moves a daily's player today, off today's board: the scores to beat, or that the day is still open. */
function TodayAims({
  slug,
  board,
  lead,
  run,
  history,
}: {
  slug: LeaderboardGame
  board: HubBoard
  /** Said before how busy today is, where the lines above are about the week rather than today. */
  lead: string
  run: string
  history: DailyHistory
}) {
  const field = board.field
  if (!field) {
    // Someone new, or not known to be back, has just been told nobody's played today.
    return (
      <Callout badge="1st">
        {history === 'back' ? (
          <>
            Nobody’s on today’s board yet: play now and you’re <b>1st today</b>.
          </>
        ) : history === 'new' ? (
          <>
            Your first {run} takes <b>1st today</b>, until someone beats it.
          </>
        ) : (
          <>
            Play now and you’re <b>1st today</b>, until someone beats it.
          </>
        )}
      </Callout>
    )
  }
  const aims = firstRunAims(board.sample, true)
  return (
    <>
      {lead ? (
        <p className="gh-stand__today">
          {lead}
          {field} {field === 1 ? 'player' : 'players'} so far. {whatPutsYouOn(slug)}.
        </p>
      ) : null}
      {aims.length ? <Aims slug={slug} aims={aims} dailyRun={run} /> : null}
    </>
  )
}

function Aims({
  slug,
  aims,
  dailyRun,
}: {
  slug: LeaderboardGame
  aims: Aim[]
  /** A daily's board is today's: each tile names its place today, and a run by the daily's own word. */
  dailyRun?: string
}) {
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  return (
    <ul className="gh-aims">
      {aims.map((aim) =>
        dailyRun ? (
          <li key={aim.label} className="gh-aim">
            <span className="gh-cap">{ordinal(aim.place)} today</span>
            <b>{aim.beat == null ? `Any ${dailyRun}` : `Beat ${fmt(aim.beat)}`}</b>
          </li>
        ) : (
          <li key={aim.label} className="gh-aim">
            <span className="gh-cap">{aim.label}</span>
            <b>{aim.beat == null ? 'Any score' : `Beat ${fmt(aim.beat)}`}</b>
            <span>{ordinal(aim.place)}</span>
          </li>
        ),
      )}
    </ul>
  )
}

/**
 * A daily card's last line: where the player stands beyond today, and the page that explains a rank, at the
 * period the card talks about: the header's.
 */
function RankFoot({ period, children }: { period: LeaderboardPeriod; children: ReactNode }) {
  return (
    <p className="gh-stand__foot">
      {children ? <span>{children}</span> : null}
      <a className="gh-more" href={rankHowHref(undefined, period)}>
        How your rank works
        <ChevronRightIcon />
      </a>
    </p>
  )
}

function SignIn() {
  return (
    <p className="gh-stand__signin">
      Playing needs no account.{' '}
      <button type="button" onClick={openSiteMenu}>
        Sign in
      </button>{' '}
      to put your runs on the board.
    </p>
  )
}

function StandingSkeleton() {
  return (
    <div className="gh-stand__skel" aria-hidden="true">
      <span className="skel-line" />
      <span className="skel-line" />
      <span className="skel-line" />
    </div>
  )
}

function OnBoard({
  slug,
  standing,
  when,
  daily = false,
}: {
  slug: LeaderboardGame
  standing: Standing
  when: string
  /** Today's board of a daily: every place it names is today's. */
  daily?: boolean
}) {
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const { place, field, best, runs, bar, lines, next, chaser, settled } = standing
  // Past three names the list counts the rest ("Sam, Jo and 2 more"), and a comma keeps that "and" off "and move up".
  const passes = next ? andList(next.passes, 3) : ''
  const counted = next ? next.passes.length > 3 : false
  const today = daily ? ' today' : ''
  return (
    <>
      <div className="gh-stand__lead gh-stand__lead--row">
        <div>
          <p className="gh-stand__big">
            {ordinal(place)}
            <span> of {field}</span>
          </p>
          <p className="gh-stand__sub">{when}</p>
        </div>
        <div className="gh-stand__best">
          <b>{fmt(best)}</b>
          {/* On a board that takes one run a player, theirs is it: no best among runs. */}
          <span>{settled ? 'your result today' : `your best · ${runs} ${runs === 1 ? 'run' : 'runs'}`}</span>
        </div>
      </div>

      {/* On a board too big for a place alone to say where it sits, a plain track from last to 1st with your dot. */}
      {lines.length > 0 ? (
        <div className="gh-bar" role="img" aria-label={`${ordinal(place)} of ${field}`}>
          <span className="gh-bar__track">
            <span className="gh-bar__fill" style={{ width: `${bar * 100}%` }} />
          </span>
          <span className="gh-bar__you" style={{ left: `${bar * 100}%` }} />
          <span className="gh-bar__end">{ordinal(field)}</span>
          <span className="gh-bar__end gh-bar__end--first">1st</span>
        </div>
      ) : null}

      {next ? (
        <Callout badge={ordinal(next.place)}>
          Beat <b>{fmt(next.beat)}</b>
          {passes ? ` to pass ${passes}${counted ? ',' : ''} and move up` : ' to move up'} to {ordinal(next.place)}
          {today}.
        </Callout>
      ) : settled && place > 1 ? (
        <Callout badge={ordinal(place)}>{dayRunIn(slug)}</Callout>
      ) : (
        <Callout badge="1st">
          You hold 1st{today}
          {chaser
            ? chaser.gap === 0
              ? `, tied with ${chaser.name}: you got there first`
              : `, and ${chaser.name} is ${gapBetween(slug, best, chaser.score)} back`
            : ''}
          .
        </Callout>
      )}
    </>
  )
}

function Callout({ badge, children }: { badge: string; children: ReactNode }) {
  return (
    <div className="gh-callout">
      <span className="gh-callout__badge">{badge}</span>
      <p>{children}</p>
    </div>
  )
}
