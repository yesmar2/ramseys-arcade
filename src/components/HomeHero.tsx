import { useEffect, useState, type CSSProperties } from 'react'
import { getGame, wallGames } from '../data/games'
import { aboutHref, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { bannerText, bannerTextDark, inkOn, readableFill } from '../lib/color'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { boardDay } from '../lib/rankHow'
import { toWall } from '../lib/scrollToPlace'
import { liveSeason, useSeason } from '../lib/season'
import { resolveGameAccent } from '../lib/theme'
import { alsoDailies, liveDailies } from '../lib/today'
import { howItWins, type TournamentSummary } from '../lib/tournaments'
import { preloadGamePage } from '../pages/gamePages'
import { EventCountdown } from './EventCountdown'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { SeasonWelcomeCard } from './season/SeasonSpotlight'

type PromiseKind = 'ads' | 'install' | 'free' | 'devices'

/** What a stranger should know before anything else, long and, for a phone, short. */
const PROMISES: { kind: PromiseKind; long: string; short: string | null }[] = [
  { kind: 'ads', long: 'No ads, ever', short: 'No ads' },
  { kind: 'install', long: 'Nothing to install', short: 'No install' },
  { kind: 'free', long: 'Free to play', short: 'Free' },
  { kind: 'devices', long: 'Phone or desk', short: null },
]

function PromiseIcon({ kind }: { kind: PromiseKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'ads' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        </>
      ) : kind === 'install' ? (
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      ) : kind === 'free' ? (
        <path d="M7 4.5v15l12.5-7.5z" />
      ) : (
        <>
          <rect x="2" y="4" width="14" height="10" rx="1.5" />
          <path d="M6 18h6" />
          <rect x="17" y="9" width="5" height="11" rx="1.2" />
        </>
      )}
    </svg>
  )
}

/** Today's event on the first-visit banner: its game, how it is won, its clock, and the way in. */
function DailyCard({ t }: { t: TournamentSummary }) {
  const lead = t.games[0] ?? null
  const only = t.games.length === 1 && lead ? getGame(lead) : null
  const accent = lead ? resolveGameAccent(lead, getGame(lead)?.accent ?? 'var(--accent)') : 'var(--accent)'
  return (
    <a className="home-banner__daily" href={tournamentHref(t.id)} style={{ '--daily-accent': accent } as CSSProperties}>
      <span className="home-banner__daily-art" aria-hidden="true">
        {lead ? <GameThumbArt slug={lead} accent={accent} /> : null}
      </span>
      <span className="home-banner__daily-text">
        <span className="home-banner__daily-title">
          {/* Several games: the event's own title already says it's today's event. */}
          {only ? `Today’s event is ${only.name}` : t.title}
        </span>
        <span className="home-banner__daily-sub">
          {howItWins(t)} ·{' '}
          <EventCountdown endsAt={t.endsAt} unlimitedDuration={Boolean(t.rules.unlimitedDuration)} />
        </span>
      </span>
      <svg
        className="home-banner__daily-go"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </a>
  )
}

/**
 * Whether the welcome banner had today's event last time on this device: its slot is held while the events
 * load only then, so it never shows an empty box that goes (the arcade's own events paused, as at launch).
 */
const WELCOME_EVENT_KEY = 'skermix-welcome-event'

function hadEventLastTime(): boolean {
  try {
    return localStorage.getItem(WELCOME_EVENT_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The welcome, a first visit's (no tag, nothing played on this device): what the arcade is, today's event when
 * there is one, the season when one is on, Play on the one game to open now, and a way to the wall. Its game
 * leans as a big card on the right, playing itself, tinted from the game's colour like every hero on the site.
 * Anyone who has played gets today's ticket and Up next for you instead (HomeToday.tsx, HomeUpNext.tsx: D on the
 * "Home page redesign" canvas), where this used to be their banner too: their next place up, or the season's.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const { official, loading: eventsLoading } = useLiveEvents(name)
  const seasonStore = useSeason()
  const season = liveSeason(seasonStore)
  const firstVisit = !name && recent.length === 0
  const [eventLastTime] = useState(hadEventLastTime)
  const hasEvent = official.some((t) => t.cadence === 'daily')
  useEffect(() => {
    if (eventsLoading) return
    try {
      localStorage.setItem(WELCOME_EVENT_KEY, hasEvent ? '1' : '0')
    } catch {
      /* a private window keeps nothing: the slot isn't held */
    }
  }, [eventsLoading, hasEvent])

  // The game the banner offers is fetched once the banner is up, so Play opens it without a wait.
  useEffect(() => {
    if (firstVisit && slug) preloadGamePage(slug)
  }, [firstVisit, slug])

  if (!firstVisit || !slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = game.accent
  const style = {
    '--hero-accent': accent,
    '--hero-ink': inkOn(accent),
    '--hero-fill': readableFill(accent),
    '--hero-text': bannerText(accent),
    '--hero-text-dark': bannerTextDark(accent),
    '--tile-accent': accent,
  } as CSSProperties
  // The game on its screen, playing itself the way a cabinet by the door runs its demo; its thumb until it's ready.
  const art = (
    // Shaped for its screen from the start (home.css), not once the screen has come, so the banner doesn't change shape.
    <a className={`home-banner__art${hasGamePreview(slug) ? ' home-banner__art--screen' : ''}`} href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
      <GameThumbArt slug={slug} accent={accent} />
      {hasGamePreview(slug) ? (
        <>
          <GamePreview slug={slug} className="home-banner__screen" autoplay />
          <span className="home-banner__fade" />
          <span className="home-banner__start">Press start</span>
        </>
      ) : null}
    </a>
  )

  // As the page counts them: the wall's games ("14 on the floor"), and today's, its races and puzzles.
  const count = numberWord(wallGames(device).length)
  const day = boardDay()
  const dailies = liveDailies(day).length + alsoDailies(day).length
  const andDailies = dailies > 0 ? ` and ${numberWord(dailies)} ${dailies === 1 ? 'daily' : 'dailies'}` : ''
  const daily = official.find((t) => t.cadence === 'daily') ?? null
  return (
    <section className="home-banner home-banner--welcome" style={style} aria-label="Welcome">
      <div className="home-banner__text">
        <p className="home-banner__kicker">Free browser arcade</p>
        <h2 className="home-banner__goal home-banner__goal--pitch">
          Simple games.
          <br />
          No ads. <span className="home-banner__gap">Just play.</span>
        </h2>
        <p className="home-banner__blurb">
          {count.charAt(0).toUpperCase() + count.slice(1)} original games{andDailies} that start in a tap, on a
          phone or at a desk. Post a score and see where you land.
        </p>
        {daily ? (
          <DailyCard t={daily} />
        ) : eventsLoading && eventLastTime ? (
          <span className="home-banner__daily home-banner__daily--wait" aria-hidden="true" />
        ) : null}
        {/* A season on is a reason to come back: said here, with Play still first. Its room is held while it isn't
            known yet whether one is on, as there nearly always is. */}
        {season ? (
          <SeasonWelcomeCard season={season} />
        ) : !seasonStore.loaded && !seasonStore.season ? (
          <span className="season-spotcard season-spotcard--wait" aria-hidden="true" />
        ) : null}
        <div className="home-banner__acts">
          <a className="home-banner__cta" href={gamePlayHref(slug)}>
            Play {game.name}
          </a>
          <a className="home-banner__ghost" href="#games" onClick={toWall}>
            Browse all games
          </a>
        </div>
      </div>
      {art}
      <div className="home-banner__strip home-banner__promises">
        {PROMISES.map((p) => (
          <span key={p.kind} className={`home-banner__promise${p.short ? '' : ' home-banner__promise--roomy'}`}>
            <PromiseIcon kind={p.kind} />
            <span className="home-banner__promise-long">{p.long}</span>
            {p.short ? <span className="home-banner__promise-short">{p.short}</span> : null}
          </span>
        ))}
        <a className="home-banner__standing-link" href={aboutHref()}>
          About {APP_NAME} ›
        </a>
      </div>
    </section>
  )
}
