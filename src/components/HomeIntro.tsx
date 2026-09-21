import { usePlayerName } from '../hooks/usePlayerName'
import { normalizePlayerName } from '../lib/leaderboard'

/**
 * The pitch, for a first visit.
 *
 * This used to be the other half of the standing block: someone who had played
 * got their ranking, anyone else got this. The ranking has come off the home
 * page, but the pitch is the only thing that tells a stranger what the site is,
 * so it stays on its own. The About link lives in the footer.
 */
export function HomeIntro() {
  const cleaned = normalizePlayerName(usePlayerName())
  if (cleaned) return null

  return (
    <section className="home-intro" aria-labelledby="home-intro-heading">
      <h2 className="home-intro__title" id="home-intro-heading">
        A small browser arcade for quick sessions and high scores.
      </h2>
      <p className="home-intro__lead">
        Original games that load instantly on phone, tablet, and desktop. No ads, no install,
        no account needed — sign in only if you want your name to follow you between devices.
      </p>
    </section>
  )
}
