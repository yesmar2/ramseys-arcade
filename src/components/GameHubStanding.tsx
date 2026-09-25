import type { ReactNode } from 'react'
import type { HubBoard } from '../hooks/useGameHub'
import { gapText, wouldPlace, youOnBoard } from '../lib/gameBoard'
import { anyRunPays, firstRunAims, standingOn, type Standing } from '../lib/gameHub'
import type { LeaderboardGame, LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { andList, ordinal, periodWord } from '../lib/profileMath'
import { openSiteMenu } from './siteNav'

/** What an empty period is called in a sentence. */
const NOUN: Record<LeaderboardPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month', all: 'board' }

/**
 * Where you stand on the game's board this period, and the one run that moves
 * you: past the player above in the top ten or on a small board, and to the
 * next share line (the top half, 25%, 10%) further down. Off the board, what
 * your best would do on it; never played, what a first run is worth.
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
    body = <OnBoard slug={slug} standing={standingOn(board.players, you)} when={when} />
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
              A run like your best puts you <b>{ordinal(landing.place)}</b> {when}, and pays{' '}
              <b className="gh-hot">{landing.pays} points</b>.
            </>
          ) : (
            <>
              The {NOUN[period]} is empty, so <b>any run</b> takes 1st and <b className="gh-hot">100 points</b> until
              someone beats it.
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
              ? `${field} ${field === 1 ? 'player' : 'players'} ${when}. Any run puts you on the board, and every place pays points toward the ${NOUN[period] === 'board' ? 'all-time standings' : NOUN[period]}.`
              : `Nobody has played ${gameName} ${when === 'all time' ? 'yet' : when}. Whatever you score, you start in 1st.`}
          </p>
        </div>
        {field && aims.length ? (
          <ul className="gh-aims">
            {aims.map((aim) => (
              <li key={aim.label} className="gh-aim">
                <span className="gh-cap">{aim.label}</span>
                <b>{aim.beat == null ? 'Any score' : `Beat ${fmt(aim.beat)}`}</b>
                <span>
                  {ordinal(aim.place)} · {aim.pays} pts
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Callout badge="1st">
            <b>Any run</b> takes 1st and <b className="gh-hot">{field ? anyRunPays(field) : 100} points</b> until someone
            beats it.
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
  const { place, field, pays, best, runs, bar, lines, next, chaser } = standing
  const nextLabel = next?.line ?? null
  // Name the line being chased; the top ten as well, when it is far enough along not to collide.
  const target = lines.find((l) => l.label === nextLabel)
  const labelled = lines.filter(
    (l) => l === target || (l.label === 'Top ten' && (!target || Math.abs(l.at - target.at) >= 0.2)),
  )
  return (
    <>
      <div className="gh-stand__lead gh-stand__lead--row">
        <div>
          <p className="gh-stand__big">
            {ordinal(place)}
            <span> of {field}</span>
          </p>
          <p className="gh-stand__sub">
            {when} · pays <b className="gh-hot">{pays}</b> of 100 points
          </p>
        </div>
        <div className="gh-stand__best">
          <b>{fmt(best)}</b>
          <span>
            your best · {runs} {runs === 1 ? 'run' : 'runs'}
          </span>
        </div>
      </div>

      {lines.length > 0 ? (
        <div className="gh-bar" role="img" aria-label={`${ordinal(place)} of ${field}${target ? `; the ${target.label.toLowerCase()} starts at ${ordinal(target.rank)}` : ''}`}>
          {labelled.map((l) => (
            <span
              key={l.label}
              className={`gh-bar__label${l === target ? ' gh-bar__label--next' : ''}`}
              style={{ left: `${l.at * 100}%` }}
            >
              {l === target && next ? `${l.label} · ${fmt(next.beat)}` : l.label}
            </span>
          ))}
          <span className="gh-bar__track">
            <span className="gh-bar__fill" style={{ width: `${bar * 100}%` }} />
          </span>
          {lines.map((l) => (
            <span
              key={l.label}
              className={`gh-bar__line${l === target ? ' gh-bar__line--next' : ''}`}
              style={{ left: `${l.at * 100}%` }}
            />
          ))}
          <span className="gh-bar__you" style={{ left: `${bar * 100}%` }} />
          <span className="gh-bar__end">{ordinal(field)}</span>
          <span className="gh-bar__end gh-bar__end--first">1st</span>
        </div>
      ) : null}

      {next ? (
        <Callout badge={ordinal(next.place)}>
          Beat <b>{fmt(next.beat)}</b>
          {next.passes.length ? ` to pass ${andList(next.passes, 3)}` : ''}: {ordinal(next.place)}
          {next.line ? `, the ${next.line.toLowerCase()}` : ''}
          {next.gain > 0 ? (
            <>
              , and <b className="gh-hot">+{next.gain} {next.gain === 1 ? 'point' : 'points'}</b>
            </>
          ) : null}
          .
        </Callout>
      ) : (
        <Callout badge="1st">
          You hold 1st{chaser ? `, and ${chaser.name} is ${gapText(slug, chaser.gap)} back` : ''}.
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
