import { APP_NAME_ACCENT, APP_NAME_LEAD } from '../lib/brand'

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__orb hero__orb--a" aria-hidden="true" />
      <div className="hero__orb hero__orb--b" aria-hidden="true" />
      <div className="hero__orb hero__orb--c" aria-hidden="true" />
      <div className="hero__content">
        <h1 id="hero-title" className="hero__title">
          {APP_NAME_LEAD}
          <span>{APP_NAME_ACCENT}</span>
        </h1>
        <p className="hero__tagline">Simple games. No ads. Just play.</p>
      </div>
    </section>
  )
}
