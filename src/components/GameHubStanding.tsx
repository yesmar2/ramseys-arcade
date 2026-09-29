import type { ReactNode } from 'react'
import type { HubBoard } from '../hooks/useGameHub'
import { dayRunIn, gapBetween, oneRunBoard, whatPutsYouOn, wouldPlace, youOnBoard } from '../lib/gameBoard'
import { firstRunAims, standingOn, type Standing } from '../lib/gameHub'
import type { LeaderboardGame, LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { andList, ordinal, periodWord } from '../lib/profileMath'
import { openSiteMenu } from './siteNav'

/**
 * Where you stand on the game's board this period, and the one run that moves
 * you: past the player above in the top ten or on a small board, and a bigger
 * jump further down (gameHub standingOn picks it). Off the board, what your
 * best would do on it; never played, the scores a first run could aim at.
 */
export function GameHubStanding({
  slug,
  gameName,
  period,
  board,
  me,
  signedIn,
}: {
  slug: LeaderboardGame
  gameName: string
  period: LeaderboardPeriod
  board: HubBoard
  me: string
  signedIn: boolean
}) {
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const when = periodWord(period)
  const you = board.loading ? null : youOnBoard(board.players, board.runs, me)
  const field = board.players.length

  let title = 'Where you stand'
  let body: ReactNode
  if (board.loading) {
    body = (
      <div className="gh-stand__skel" aria-hidden="true">
        <span className="skel-line" />
        <span className="skel-line" />
        <span className="skel-line" />
      </div>
    )
  } else if (you) {
    body = <OnBoard slug={slug} standing={standingOn(board.players, you, oneRunBoard(slug, period))} when={when} />
  } else if (me && board.allTimeBest != null && board.allTimeBest > 0) {
    const best = board.allTimeBest
    const landing = wouldPlace(board.players, best)
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
    const aims = firstRunAims(board.players)
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
          <ul className="gh-aims">
            {aims.map((aim) => (
              <li key={aim.label} className="gh-aim">
                <span className="gh-cap">{aim.label}</span>
                <b>{aim.beat == null ? 'Any score' : `Beat ${fmt(aim.beat)}`}</b>
                <span>{ordinal(aim.place)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Callout badge="1st">
            <b>Any run</b> takes 1st until someone beats it.
          </Callout>
        )}
        {!signedIn ? (
          <p className="gh-stand__signin">
            Playing needs no account.{' '}
            <button type="button" onClick={openSiteMenu}>
              Sign in
            </button>{' '}
            to put your runs on the board.
          </p>
        ) : null}
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

function OnBoard({ slug, standing, when }: { slug: LeaderboardGame; standing: Standing; when: string }) {
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const { place, field, best, runs, bar, lines, next, chaser, settled } = standing
  // Past three names the list counts the rest ("Sam, Jo and 2 more"), and a comma keeps that "and" off "and move up".
  const passes = next ? andList(next.passes, 3) : ''
  const counted = next ? next.passes.length > 3 : false
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
          <span>
            your best · {runs} {runs === 1 ? 'run' : 'runs'}
          </span>
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
          {passes ? ` to pass ${passes}${counted ? ',' : ''} and move up` : ' to move up'} to {ordinal(next.place)}.
        </Callout>
      ) : settled && place > 1 ? (
        <Callout badge={ordinal(place)}>{dayRunIn(slug)}</Callout>
      ) : (
        <Callout badge="1st">
          You hold 1st
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
