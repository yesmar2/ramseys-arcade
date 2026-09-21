import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { rankHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import { HomeOfficialEvents } from './HomeOfficialEvents'

/**
 * The rail beside the banner, a strip under it on a narrow screen: the
 * things that are always true today.
 *
 * Your standing on the board, the daily and weekly events with their clocks,
 * and the soonest event you are in. Nothing here depends on how many people
 * are playing — a standing exists for anyone who has played, there is nearly
 * always a daily and a weekly running, and the last card only shows when
 * you are in something — so it is full on the first day as on the thousandth.
 */
export function HomePulse() {
  const { signedIn } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const { rank } = useGlobalRank()
  const loading = useGlobalRankLoading()
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()
  const { mine } = useLiveEvents(name)
  // The official fixtures already have their own rows above; this card is for the rest.
  const next = mine.find((t) => !t.official) ?? null
  const nextSlug = next?.games[0] ?? null
  const nextAccent = next
    ? resolveGameAccent(nextSlug ?? '', getGame(nextSlug ?? '')?.accent ?? 'var(--accent)')
    : null

  return (
    <div className="home-pulse">
      {signedIn && name ? (
        <a className="home-pulse__standing" href={rankHref()}>
          <span className="home-pulse__k">{groupId ? 'Your group standing' : 'Your standing'}</span>
          <span className="home-pulse__v">
            {loading ? (
              <span className="skel-line" aria-hidden="true" />
            ) : rank != null ? (
              `#${rank}`
            ) : (
              'Not ranked yet'
            )}
          </span>
          <span className="home-pulse__n">{PERIOD_LABELS[period]} · Profile ›</span>
        </a>
      ) : (
        <a className="home-pulse__standing" href={rankHref()}>
          <span className="home-pulse__k">Your standing</span>
          <span className="home-pulse__v">Not on the boards yet</span>
          <span className="home-pulse__n">Sign in with a gamer tag to get one ›</span>
        </a>
      )}
      <HomeOfficialEvents />
      {next ? (
        <a
          className="home-pulse__next"
          href={tournamentHref(next.id)}
          style={{ '--ev-accent': nextAccent } as CSSProperties}
        >
          <span className="home-pulse__next-art" aria-hidden="true">
            <GameThumbArt slug={nextSlug ?? ''} accent={nextAccent ?? undefined} />
          </span>
          <span className="home-pulse__next-body">
            <span className="home-pulse__k">Your next event</span>
            <span className="home-pulse__next-title">{next.title}</span>
            <EventCountdown
              endsAt={next.endsAt}
              unlimitedDuration={Boolean(next.rules.unlimitedDuration)}
              className="home-pulse__n"
            />
          </span>
          <span className="home-pulse__next-go">Open</span>
        </a>
      ) : null}
    </div>
  )
}
