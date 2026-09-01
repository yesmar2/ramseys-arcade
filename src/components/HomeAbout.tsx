import { APP_NAME } from '../lib/brand'
import { leaderboardHref, privacyHref, termsHref, tournamentsHref } from '../hooks/useHashRoute'

const HIGHLIGHTS = [
  {
    title: 'No ads',
    body: 'No banners, no video breaks, no pop-ups between rounds. Just play.',
  },
  {
    title: 'Simple design',
    body: 'A clean arcade layout that loads fast and stays out of your way.',
  },
  {
    title: 'Leaderboards',
    body: 'Daily, weekly, monthly, and all-time boards — plus global rankings and record books.',
  },
  {
    title: 'Play anywhere',
    body: 'Browser games that work on phone, tablet, and desktop. No install required.',
  },
] as const

export function HomeAbout() {
  return (
    <section className="home-about" aria-labelledby="home-about-heading">
      <h2 id="home-about-heading" className="home-about__title">
        About {APP_NAME}
      </h2>

      <p className="home-about__lead">
        {APP_NAME} is a small browser arcade built for quick sessions and high scores. Tap a
        game, play instantly, and see how you stack up — no account required, though you can
        sign in to keep your name across devices.
      </p>

      <ul className="home-about__highlights">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title} className="home-about__highlight">
            <h3 className="home-about__highlight-title">{item.title}</h3>
            <p className="home-about__highlight-body">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="home-about__prose">
        <h3 className="home-about__subtitle">The idea</h3>
        <p>
          We wanted a place that feels like walking up to a good arcade cabinet: one game in
          front of you, a score to chase, and nothing else competing for attention. {APP_NAME}{' '}
          keeps the focus on play — not feeds, loot boxes, or clutter.
        </p>

        <h3 className="home-about__subtitle">Rank up and compete</h3>
        <p>
          Post a score and climb the{' '}
          <a href={leaderboardHref()}>leaderboards</a>. Track personal bests, chase record
          books on select games, and jump into rotating{' '}
          <a href={tournamentsHref()}>events</a> when you want a little extra pressure. Your
          player name is your identity on the board — pick something you’re proud to see in
          the top ten.
        </p>

        <h3 className="home-about__subtitle">Classic inspiration, original games</h3>
        <p>
          The lineup is inspired by the games we grew up on — Asteroids-style survival, Frogger
          crossings, endless hoppers, reflex testers, and arcade shooters — but every title
          here is built for the web as an original take, not a clone. We’re still adding games
          and polishing the in-development ones; expect the cabinet row to grow over time.
        </p>

        <h3 className="home-about__subtitle">Ready to play?</h3>
        <p>
          Scroll up, pick a tile, and hop in. Whether you have two minutes or twenty, there’s
          always another run to beat. Thanks for stopping by — we’re glad you’re here.
        </p>
      </div>

      <p className="home-about__fine">
        <a href={privacyHref()}>Privacy</a>
        <span aria-hidden="true"> · </span>
        <a href={termsHref()}>Terms</a>
      </p>
    </section>
  )
}
