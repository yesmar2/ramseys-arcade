import { useAuth } from '../hooks/useAuth'
import { rankHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { HomeOfficialEvents } from './HomeOfficialEvents'

/**
 * The strip under the banner: the things that are always true today.
 *
 * Your standing on the board, then the daily and weekly events with their
 * clocks. Nothing here depends on how many people are playing — a standing
 * exists for anyone who has played, and there is nearly always a daily and
 * a weekly running — so it is full on the first day as on the thousandth.
 */
export function HomePulse() {
  const { signedIn } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const { rank } = useGlobalRank()
  const loading = useGlobalRankLoading()
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()

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
      ) : null}
      <HomeOfficialEvents />
    </div>
  )
}
