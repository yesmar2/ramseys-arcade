export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__orb hero__orb--a" aria-hidden="true" />
      <div className="hero__orb hero__orb--b" aria-hidden="true" />
      <div className="hero__orb hero__orb--c" aria-hidden="true" />
      <div className="hero__content">
        <h1 id="hero-title" className="hero__title">
          Ramsey’s <span>Arcade</span>
        </h1>
        <p className="hero__tagline">Simple games. No ads. Just play.</p>
      </div>
    </section>
  )
}
