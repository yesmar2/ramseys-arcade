import { games } from '../data/games'
import {
  aboutHref,
  globalRankingsHref,
  homeHref,
  leaderboardHref,
  plusHref,
  privacyHref,
  rankHref,
  recordsIndexHref,
  statsHref,
  termsHref,
  tournamentCreateHref,
  tournamentsHref,
  gameHref,
} from '../hooks/useHashRoute'
import { APP_NAME, CONTACT_EMAIL } from '../lib/brand'
import { groupsIndexHref } from '../lib/groups'
import { PERIOD_LABELS } from '../lib/leaderboard'
import { BrandMark } from './BrandMark'
import { HiddenBug } from './BugHunt'

/**
 * The footer, with weight: the brand and its promise on the left, then a
 * column for each part of the site. It is the same on every page, so a
 * visitor who scrolls to the end always finds the whole site laid out.
 */
export function Footer() {
  const year = new Date().getFullYear()
  const shelf = games.filter((g) => !g.hidden && !g.comingSoon).slice(0, 6)

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <a className="site-footer__logo" href={homeHref()} aria-label={APP_NAME}>
            <BrandMark />
          </a>
          <p className="site-footer__tag">No ads. No install. Free to play.</p>
          <p className="site-footer__lead">
            Original games that load fast and stay out of your way.
            <HiddenBug spot="footer" pose="hang" />
          </p>
        </div>

        <nav className="site-footer__cols" aria-label="Site map">
          <div className="site-footer__col">
            <h3 className="site-footer__head">Games</h3>
            <ul className="site-footer__list">
              {shelf.map((g) => (
                <li key={g.slug}>
                  <a href={gameHref(g.slug)}>{g.name}</a>
                </li>
              ))}
              <li>
                <a href={homeHref()}>All games</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__head">Boards</h3>
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
              <li>
                <a href={globalRankingsHref()}>Global rankings</a>
              </li>
              <li>
                <a href={recordsIndexHref()}>Record books</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__head">Events</h3>
            <ul className="site-footer__list">
              <li>
                <a href={tournamentsHref()}>Live events</a>
              </li>
              <li>
                <a href={tournamentCreateHref()}>Create an event</a>
              </li>
              <li>
                <a href={groupsIndexHref()}>Groups</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__head">You</h3>
            <ul className="site-footer__list">
              <li>
                <a href={rankHref()}>Profile</a>
              </li>
              <li>
                <a href={statsHref()}>Stats</a>
              </li>
              <li>
                <a href={rankHref(undefined, undefined, 'friends')}>Friends</a>
              </li>
              <li>
                <a href={plusHref()}>Plus</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__head">About</h3>
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
        </p>
        <p>Made to be played on a phone or a desk, in a browser, for free.</p>
      </div>
    </footer>
  )
}
