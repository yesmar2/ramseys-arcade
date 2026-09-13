import { aboutHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'

/**
 * What survives of the old About wall on the home page.
 *
 * The full version — nine sections of it — lives on its own route now, where
 * length costs nothing. Here one line carries the promise.
 */
export function HomeAboutBand() {
  return (
    <section className="home-band" aria-label={`About ${APP_NAME}`}>
      <p className="home-band__lead">
        <strong>No ads, no install, no account needed.</strong> Original games that load fast
        and stay out of your way.
      </p>
      <a className="home-band__link" href={aboutHref()}>
        More about {APP_NAME} →
      </a>
    </section>
  )
}
