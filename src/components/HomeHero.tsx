import { useEffect, useState, type CSSProperties } from 'react'
import { getGame, TAG_LABELS, wallGames } from '../data/games'
import { aboutHref, gamePlayHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { boardDay } from '../lib/rankHow'
import { toWall } from '../lib/scrollToPlace'
import { resolveGameAccent } from '../lib/theme'
import { alsoDailies, liveDailies } from '../lib/today'
import { howItWins, type TournamentSummary } from '../lib/tournaments'
import { preloadGamePage } from '../pages/gamePages'
import { BlipFigure } from './BlipFigure'
import { EventCountdown } from './EventCountdown'
import { GameArt } from './GameArt'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import '../styles/welcome.css'

/** What a stranger should know before anything else. */
const PROMISES = ['No ads, ever', 'Nothing to install', 'Free to play', 'Phone or desk']

const TickIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
)

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
 * The welcome, a first visit's (no tag, nothing played on this device), D on the "Home page redesign" canvas: what
 * the arcade is, today's event when there is one, Play on the one game to open now and a way to the wall, and what
 * a stranger should know first, ticked off. Beside it that game plays on a screen of its own, Blip standing by
 * it. The season and Blip's question come after the games (HomeUpNext's first-visit row). Anyone who has played
 * gets today's ticket and Up next for you instead (HomeToday.tsx, HomeUpNext.tsx), where this used to be their
 * banner too: their next place up, or the season's.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const { official, loading: eventsLoading } = useLiveEvents(name)
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

  // The game the welcome offers is fetched once it's up, so Play opens it without a wait.
  useEffect(() => {
    if (firstVisit && slug) preloadGamePage(slug)
  }, [firstVisit, slug])

  if (!firstVisit || !slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = resolveGameAccent(slug, game.accent)
  const kind = game.tags?.[0] ? TAG_LABELS[game.tags[0]] : null
  // As the page counts them: the wall's games ("14 on the floor"), and today's, its races and puzzles.
  const count = numberWord(wallGames(device).length)
  const day = boardDay()
  const dailies = liveDailies(day).length + alsoDailies(day).length
  const andDailies = dailies > 0 ? ` and ${numberWord(dailies)} ${dailies === 1 ? 'daily' : 'dailies'}` : ''
  const daily = official.find((t) => t.cadence === 'daily') ?? null
  return (
    <section className="welcome" style={{ '--hero-accent': accent } as CSSProperties} aria-labelledby="welcome-title">
      <div className="welcome__text">
        <p className="welcome__chip">Free browser arcade</p>
        <h2 id="welcome-title" className="welcome__title">
          Simple games.
          <br />
          No ads. <span className="welcome__lit">Just play.</span>
        </h2>
        <p className="welcome__blurb">
          {count.charAt(0).toUpperCase() + count.slice(1)} original games{andDailies} that start in a tap, on a phone or
          at a desk. Post a score and see where you land.
        </p>
        {daily ? (
          <DailyCard t={daily} />
        ) : eventsLoading && eventLastTime ? (
          <span className="home-banner__daily home-banner__daily--wait" aria-hidden="true" />
        ) : null}
        <div className="welcome__acts">
          <a className="welcome__cta" href={gamePlayHref(slug)}>
            <PlayIcon />
            Play {game.name}
          </a>
          <a className="welcome__ghost" href="#games" onClick={toWall}>
            Browse all games
          </a>
        </div>
        <ul className="welcome__promises">
          {PROMISES.map((p) => (
            <li key={p}>
              <TickIcon />
              {p}
            </li>
          ))}
          <li className="welcome__about">
            <a href={aboutHref()}>About {APP_NAME} ›</a>
          </li>
        </ul>
      </div>
      <div className="welcome__stage">
        {/* The game on its own screen, playing itself the way a cabinet by the door runs its demo; its picture until
            it's ready, in the screen's own shape from the start. */}
        <a className="welcome__screen" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
          <GameArt slug={slug} shape="card" fallback={<GameThumbArt slug={slug} accent={accent} />} />
          {hasGamePreview(slug) ? <GamePreview slug={slug} className="welcome__preview" autoplay /> : null}
          <span className="welcome__name">
            {game.name}
            {kind ? <span className="welcome__kind"> · {kind}</span> : null}
          </span>
          <span className="welcome__start">
            <PlayIcon />
            Press start
          </span>
        </a>
        <BlipFigure className="welcome__blip" mood="hi" />
      </div>
    </section>
  )
}
