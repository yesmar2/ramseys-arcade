import { aboutHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'

/**
 * Quiet closer at the bottom of home.
 *
 * The long About page lives on its own route; here a short promise and a
 * clear link are enough to send curious players through.
 */
export function HomeAboutBand() {
  return (
    <section className="home-band" aria-label={`About ${APP_NAME}`}>
      <div className="home-band__copy">
        <p className="home-band__eyebrow">About the arcade</p>
        <p className="home-band__title">No ads. No install. No account needed.</p>
        <p className="home-band__lead">
          Original games that load fast and stay out of your way.
        </p>
      </div>
      <a className="home-band__link" href={aboutHref()}>
        More about {APP_NAME}
        <span className="home-band__arrow" aria-hidden="true">
          →
        </span>
      </a>
    </section>
  )
}
