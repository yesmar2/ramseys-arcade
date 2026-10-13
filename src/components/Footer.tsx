import { games, isListedGame } from '../data/games'
import { openFeedback } from '../lib/feedback'
import {
  aboutHref,
  homeHref,
  leaderboardHref,
  plusHref,
  privacyHref,
  rankHref,
  recordsIndexHref,
  standingsHref,
  prizesHref, statsHref,
  termsHref,
  tournamentCreateHref,
  tournamentsHref,
  gameHref,
  levelHref,
} from '../hooks/useHashRoute'
import { APP_NAME, CONTACT_EMAIL } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { groupsIndexHref } from '../lib/groups'
import { PERIOD_LABELS } from '../lib/leaderboard'
import { toHomeTop, toWall } from '../lib/scrollToPlace'
import { useSeason } from '../lib/season'
import { seasonHasStandings } from '../lib/seasonStandings'
import { BrandMark } from './BrandMark'
import { useLiveEvents } from '../hooks/useLiveEvents'

/**
 * The footer, with weight: the brand and its promise on the left, then a
 * column for each part of the site. It is the same on every page, so a
 * visitor who scrolls to the end always finds the whole site laid out.
 */
export function Footer() {
  const year = new Date().getFullYear()
  const shelf = games.filter((g) => isListedGame(g) && !g.comingSoon).slice(0, 6)
  // The arcade's own events can be paused (/admin, Site events): then none is listed, and no link offers them.
  const { official } = useLiveEvents('')
  // Standings and Profile open at the period you picked: a stale one in their address would switch the site back.
  const period = useDefaultPeriod()
  // The season's boards too, while it has standings, as the header's Boards offers them.
  const season = seasonHasStandings(useSeason().season)

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          {/* On the home page, back up to its top, as the header's does. */}
          <a className="site-footer__logo" href={homeHref()} aria-label={APP_NAME} onClick={toHomeTop}>
            <BrandMark />
          </a>
          <p className="site-footer__tag">No ads. No install. Free to play.</p>
          <p className="site-footer__lead">Original games that load fast and stay out of your way.</p>
          {/* The cheat code, scratched in like a tip on an arcade cabinet: the clue to an easter egg (EasterEggs.tsx). */}
          <p className="site-footer__scratch" aria-hidden="true">
            ↑↑↓↓←→←→<span className="site-footer__scratch-keys">BA</span>
          </p>
        </div>

        {/* The columns' heads are h2s: the footer is a part of the page of its own, under the page's h1. */}
        <nav className="site-footer__cols" aria-label="Site map">
          <div className="site-footer__col">
            <h2 className="site-footer__head">Games</h2>
            <ul className="site-footer__list">
              {shelf.map((g) => (
                <li key={g.slug}>
                  <a href={gameHref(g.slug)}>{g.name}</a>
                </li>
              ))}
              <li>
                {/* The home page's wall: from anywhere, a link that lands on it; on the home page, down to it. */}
                <a href={`${homeHref()}#games`} onClick={toWall}>
                  All games
                </a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h2 className="site-footer__head">Boards</h2>
            <ul className="site-footer__list">
              <li>
                <a href={leaderboardHref('weekly')}>{PERIOD_LABELS.weekly}</a>
              </li>
              <li>
                <a href={leaderboardHref('monthly')}>{PERIOD_LABELS.monthly}</a>
              </li>
              <li>
                <a href={leaderboardHref('all')}>{PERIOD_LABELS.all}</a>
              </li>
              {season ? (
                <li>
                  <a href={leaderboardHref('season')}>{PERIOD_LABELS.season}</a>
                </li>
              ) : null}
              <li>
                <a href={standingsHref(period)}>Standings</a>
              </li>
              <li>
                <a href={recordsIndexHref()}>Record books</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h2 className="site-footer__head">Events</h2>
            <ul className="site-footer__list">
              {official.length > 0 ? (
                <li>
                  <a href={tournamentsHref()}>Live events</a>
                </li>
              ) : null}
              <li>
                <a href={tournamentCreateHref()}>Create an event</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h2 className="site-footer__head">You</h2>
            <ul className="site-footer__list">
              <li>
                <a href={rankHref(undefined, period)}>Profile</a>
              </li>
              <li>
                <a href={statsHref()}>Stats</a>
              </li>
              <li>
                <a href={prizesHref()}>Prize counter</a>
              </li>
              <li>
                <a href={groupsIndexHref()}>Friends &amp; groups</a>
              </li>
              <li>
                <a href={plusHref()}>Plus</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h2 className="site-footer__head">About</h2>
            <ul className="site-footer__list">
              <li>
                <a href={aboutHref()}>About {APP_NAME}</a>
              </li>
              <li>
                <a href={privacyHref()}>Privacy</a>
              </li>
              <li>
                <a href={termsHref()}>Terms</a>
              </li>
              <li>
                <button type="button" className="feedback-link" onClick={() => openFeedback('idea')}>
                  Suggest a game
                </button>
              </li>
              <li>
                <button type="button" className="feedback-link" onClick={() => openFeedback('problem')}>
                  Something broke
                </button>
              </li>
              {CONTACT_EMAIL ? (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
                </li>
              ) : null}
            </ul>
          </div>
        </nav>
      </div>

      <div className="site-footer__base">
        <p>
          © {year} {APP_NAME}
          {/* A faint door to the Game Over screen, an easter egg (GameOverPage). */}
          <a className="site-footer__level" href={levelHref()} rel="nofollow">
            Level 256
          </a>
        </p>
        <p>Made to be played on a phone or a desk, in a browser, for free.</p>
      </div>
    </footer>
  )
}
