import type { ReactNode } from 'react'
import { APP_NAME, SITE_LINE } from '../lib/brand'
import { BlipFigure } from '../components/BlipFigure'
import { PageShell } from '../components/PageShell'
import {
  homeHref,
  leaderboardHref,
  privacyHref,
  rankHowHref,
  termsHref,
  todayHref,
  tournamentsHref,
} from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { toWall } from '../lib/scrollToPlace'
import '../styles/info.css'

/** Line icons for the highlights, drawn in the tile's colour. */
const ICON = {
  noAds: (
    <>
      <rect x="3.5" y="5" width="17" height="12" rx="2.5" />
      <path d="M9 21h6M12 17v4" />
      <path d="M5 19 19 3" />
    </>
  ),
  simple: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  boards: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  anywhere: (
    <>
      <rect x="2.5" y="5" width="13" height="10" rx="1.8" />
      <path d="M6 18.5h6" />
      <rect x="15.5" y="9" width="6" height="11" rx="1.6" />
      <path d="M18 17.5h1" />
    </>
  ),
} satisfies Record<string, ReactNode>

const HIGHLIGHTS = [
  {
    title: 'No ads',
    body: 'No banners, no video breaks, no pop-ups between rounds. Just play.',
    icon: ICON.noAds,
    tone: 'mint',
  },
  {
    title: 'Simple design',
    body: 'A clean arcade layout that loads fast and stays out of your way.',
    icon: ICON.simple,
    tone: 'sky',
  },
  {
    title: 'Leaderboards',
    body: 'Weekly, monthly and all-time boards, a fresh board every day for the dailies, an overall rank, and record books.',
    icon: ICON.boards,
    tone: 'gold',
  },
  {
    title: 'Play anywhere',
    body: 'Browser games that work on phone, tablet, and desktop. No install required.',
    icon: ICON.anywhere,
    tone: 'berry',
  },
] as const

export function AboutPage() {
  // The links open at the period you picked: a stale one in their address would switch the site back to it.
  const period = useDefaultPeriod()
  return (
    <PageShell innerClassName="lb-page__inner info-page info-page--about">
      <header className="info-head info-head--about">
        <nav className="info-crumbs" aria-label="Breadcrumb">
          <a href={homeHref()}>Home</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">About</span>
        </nav>
        <div className="info-head__text">
          {/* Blip stands to the right of the words on a computer; on a phone the words wrap round him. */}
          <div className="info-head__art" aria-hidden="true">
            <span className="info-head__halo" />
            <BlipFigure className="info-head__blip" wave />
          </div>
          <p className="info-kicker">About</p>
          <h1 className="info-title">About {APP_NAME}</h1>
          <p className="info-lede">
            {SITE_LINE} Tap a game and play instantly, no account needed. Sign in to put your scores on the boards and
            see how you stack up.
          </p>
        </div>
      </header>

      <section className="about" aria-label={`About ${APP_NAME}`}>
        <ul className="about-highlights">
          {HIGHLIGHTS.map((item, i) => (
            <li
              key={item.title}
              className={`about-highlight about-highlight--${item.tone}`}
              data-hunt={i === 0 ? 'about-highlights' : undefined}
            >
              <span className="about-highlight__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
              </span>
              <h2 className="about-highlight__title">{item.title}</h2>
              <p className="about-highlight__body">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="about-story">
          <div className="about-part">
            <h2 className="about-part__title">The idea</h2>
            <p>
              We wanted a place that feels like walking up to a good arcade cabinet: one game in
              front of you, a score to chase, and nothing else competing for attention. {APP_NAME}{' '}
              keeps the focus on play — not feeds, loot boxes, or clutter.
            </p>
          </div>

          <div className="about-part">
            <h2 className="about-part__title">Rank up and compete</h2>
            <p>
              Post a score and climb the{' '}
              <a href={leaderboardHref(period)}>leaderboards</a>. Track personal bests, chase record
              books on select games, and jump into rotating{' '}
              <a href={tournamentsHref()}>events</a> when you want a little extra pressure. Your
              player name is your identity on the board — pick something you’re proud to see in
              the top ten. Your ten best ranked games count toward your overall rank, and{' '}
              <a href={rankHowHref(undefined, period)}>How your rank works</a> shows yours, game by game.
            </p>
          </div>

          <div className="about-part">
            <h2 className="about-part__title">Classic inspiration, original games</h2>
            <p>
              The lineup is inspired by the games we grew up on — rock-blasting space runs, road
              crossings, endless hoppers, reflex testers, and arcade shooters — but every title
              here is built for the web as an original take, not a clone. We’re still adding games
              and polishing the in-development ones; expect the cabinet row to grow over time.
            </p>
          </div>
        </div>

        {/* The last part with the way back it offers, as buttons: the home page's wall of games, and today's dailies. */}
        <div className="about-cta">
          <div className="about-cta__text">
            <h2 className="about-cta__title">Ready to play?</h2>
            <p>
              Head back to the arcade, pick a tile, and hop in. Whether you have two minutes or
              twenty, there’s always another run to beat. Thanks for stopping by.
            </p>
          </div>
          <div className="about-cta__acts">
            <a className="panel__btn" href={`${homeHref()}#games`} onClick={toWall}>
              Browse games
            </a>
            <a className="panel__btn panel__btn--ghost" href={todayHref()}>
              Today’s dailies
            </a>
          </div>
        </div>

        <footer className="about-foot">
          <p className="about-foot__credit">
            Hot Lap’s Seneca Glen follows a real circuit’s line, from map data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap contributors
            </a>{' '}
            (ODbL), with heights from the US Geological Survey.
          </p>
          <p className="about-foot__links">
            <a href={privacyHref()}>Privacy</a>
            <a href={termsHref()}>Terms</a>
          </p>
        </footer>
      </section>
    </PageShell>
  )
}
