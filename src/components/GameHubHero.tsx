import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { comingWords, deviceRequirementLabel, isComingSoon, isRankedGame, type Game } from '../data/games'
import { gameHref, gamePlayHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useIsAdmin } from '../lib/admin'
import { APP_NAME } from '../lib/brand'
import { inkOn, readableFill } from '../lib/color'
import { dailyWords } from '../lib/dailyWords'
import { hasDayPreview, hasGamePreview } from '../lib/gamePreviews'
import { archiveDayWords } from '../lib/archive'
import { msUntilNextHole } from '../lib/dailyHole'
import { earlyFrom, earlyStage, launchDayOf } from '../lib/earlyAccess'
import { useScope } from '../lib/groups'
import type { LeaderboardEntry } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { boardDay } from '../lib/rankHow'
import { ChaseButton } from './Chase'
import { CalendarIcon, PlayIcon, TimerIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { GameHubHowTo } from './GameHubHowTo'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { useSpotlight } from '../lib/season'
import { SkinChip } from './season/SkinPicker'
import { SpotlightCard } from './season/SeasonSpotlight'
import { ShareBoardButton } from './ShareBoardButton'

/** "Race today’s track": a daily's Play says which run it starts, the one that counts. */
function dailyPlayLabel(slug: string): string {
  return dailyWords(slug).playToday
}

/**
 * The games whose screen draws its own HUD where the hero writes over it: along the top, under the high score
 * (Pileup's Hold and Next, Bop's bezel), and along the bottom, under the name and Play (Frenzy's lives, bar and
 * chain, and on a phone Pileup's pieces up next and Bop's Spin). Their game plays clear of the screen's edges (hub.css
 * .gh-screen--hud-top, .gh-screen--hud-low), so the two never land on each other.
 */
const HUD_EDGES: Readonly<Partial<Record<string, { top?: boolean; low?: boolean }>>> = {
  bop: { top: true, low: true },
  pileup: { top: true, low: true },
  frenzy: { low: true },
}

/**
 * The top of a game's page: its screen, across the page, where the game plays itself the way the cabinet by an
 * arcade's door runs its demo; and on it, the high score and whose it is, How to play and share along the top, and
 * the game's name and Play along the bottom, with the look you play in. B of the "Game page, simpler" canvas
 * (Ramsey, 2026-11-17: "it's too much text and i want it simplified", then "Build B"): the words beside the
 * screen were breadcrumbs, tags, a blurb, four labelled buttons, a row of five skins with two lines each, and
 * "Phone or desk · Free to play". On a phone, once the page has scrolled past Play, Play follows along above the
 * tab bar.
 *
 * A daily's Play starts today's course, and its screen shows who is 1st today; over its name, today's course by name,
 * with the clock to the next along the top and its past courses beside Play (`today`), where its Today card was.
 */
export function GameHubHero({
  game,
  accent,
  canPlay,
  highScore,
  today,
}: {
  game: Game
  accent: string
  canPlay: boolean
  /** The game's all-time best run, for its screen: null when nobody has one, undefined while it isn't known. */
  highScore: LeaderboardEntry | null | undefined
  /** A daily's today: its course by name, a run kept on this device, its past courses, and a hunt place on its clock. */
  today?: { name: ReactNode; kept: ReactNode; pastHref: string; pastLabel: string; clockHunt?: string }
}) {
  const playHref = gamePlayHref(game.slug)
  // The boards' group, when they show one: the high score on the screen is then the group's.
  const group = useScope().name
  const ctaRef = useRef<HTMLAnchorElement>(null)
  const [pastPlay, setPastPlay] = useState(false)
  const [playInSight, setPlayInSight] = useState(false)

  // Play follows the page once the one on the screen has scrolled up out of sight.
  useEffect(() => {
    const cta = ctaRef.current
    if (!cta) return
    const watch = new IntersectionObserver(([entry]) => {
      setPastPlay(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    watch.observe(cta)
    return () => watch.disconnect()
  }, [canPlay])

  // ...and stands down while another way into the game is on screen, or the footer is. A daily's Today card has its
  // own Play, and on a phone the two stacked, one on top of the other (launch review, 2026-10-15).
  useEffect(() => {
    if (!canPlay) return
    let frame = 0
    const inSight = (el: Element) => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
    }
    const look = () => {
      frame = 0
      const others = document.querySelectorAll(`a[href^="${playHref}"]:not(.gh-float), .site-footer`)
      setPlayInSight([...others].some((el) => el !== ctaRef.current && inSight(el)))
    }
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(look)
    }
    look()
    window.addEventListener('scroll', soon, { passive: true })
    window.addEventListener('resize', soon)
    return () => {
      window.removeEventListener('scroll', soon)
      window.removeEventListener('resize', soon)
      cancelAnimationFrame(frame)
    }
  }, [canPlay, playHref])
  const floating = pastPlay && !playInSight

  const kicker = isComingSoon(game) ? comingWords(game) : game.inDevelopment ? 'New' : null
  // A new game before its launch day (lib/earlyAccess.ts): when everyone plays it, and Plus members' week first.
  const launch = launchDayOf(game.slug)
  const launchLine =
    launch && earlyStage(game.slug) === 'early'
      ? `Plus members are playing it a week early. Everyone can play from ${archiveDayWords(launch)}.`
      : null
  // Till it's yours to play, a date card stands where Play would (A on Ramsey's pick, 2026-10-28: "I think it needs
  // to be more obvious that it's coming Nov 21st"): everyone's before the early week, and in it everyone's but Plus
  // members'. An admin gets a small way in under it.
  const { isPlus } = useAuth()
  const admin = useIsAdmin()
  const soon = launch && !(earlyStage(game.slug) === 'early' && isPlus) ? launch : null
  const toGo = soon ? Math.round((Date.parse(`${soon}T12:00:00Z`) - Date.parse(`${boardDay()}T12:00:00Z`)) / 86_400_000) : 0
  const soonMonth = soon ? new Date(`${soon}T12:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) : ''
  const daily = Boolean(game.daily)
  const ranked = isRankedGame(game.slug)
  const playLabel = daily ? dailyPlayLabel(game.slug) : `Play ${game.name}`
  const spotlight = useSpotlight(game.slug)
  // A daily's screen plays today where it has a day to play, as its card on the home page's Dailies row does:
  // the track driven, the course rolled, the cave flown, the hills flown. With only its thumb, a racing daily's
  // screen was a small picture in the middle of a dark one (Ramsey, 2026-10-07: "the game image is very small").
  const plays = hasGamePreview(game.slug) || (daily && hasDayPreview(game.slug))
  // The high score is written over the screen's top for a ranked game, the name and Play over its bottom.
  const hud = plays ? HUD_EDGES[game.slug] : undefined
  const screenClass = ['gh-screen', hud?.top && ranked ? 'gh-screen--hud-top' : '', hud?.low && canPlay ? 'gh-screen--hud-low' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <section className={`gh-stage${daily ? ' gh-stage--daily' : ''}`} aria-labelledby="gh-title" data-hunt={`g-hero-${game.slug}`}>
        {/* The game on its screen (a daily's, today), the whole of the card: its thumb until the first frame is down. */}
        <a
          className={screenClass}
          href={canPlay && !soon ? playHref : gameHref(game.slug)}
          tabIndex={-1}
          aria-hidden="true"
          data-hunt={`g-screen-${game.slug}`}
        >
          <span className="gh-screen__thumb">
            <GameThumbArt slug={game.slug} accent={accent} />
          </span>
          {plays ? <GamePreview slug={game.slug} day={daily ? boardDay() : undefined} className="gh-screen__game" autoplay /> : null}
        </a>
        {/* Dark under the words, whatever the game draws there, so they read in either theme. */}
        <span className="gh-stage__shade" aria-hidden="true" />

        <div className="gh-stage__top">
          {/* A daily just for fun has no 1st: nobody is placed (data/games.ts Game.ranked). */}
          {ranked ? (
            <p className="gh-hi">
              {highScore ? <PlayerMark name={highScore.name} avatarId={highScore.avatarId} className="gh-hi__mark" /> : null}
              <span className="gh-hi__what">
                {daily ? '1st today' : 'Hi score'}
                {group ? ` · ${group}` : ''}
              </span>
              {/* The score as the boards print it, its units lower case (54.759s). Open only when nobody has one:
                  a board on its way, or one that couldn't be read, is a dash. */}
              {highScore ? (
                <b className="gh-hi__score">{formatLeaderboardScore(game.slug, highScore.score)}</b>
              ) : (
                <b>{highScore === null ? 'Open' : '–'}</b>
              )}
              {highScore ? <span className="gh-hi__who">{highScore.name}</span> : null}
            </p>
          ) : null}
          <span className="gh-stage__tools">
            {/* A daily's clock to its next course, at midnight on the boards' clock, as every daily's is. */}
            {today ? (
              <span className="gh-clock" data-hunt={today.clockHunt}>
                <TimerIcon />
                <EventCountdown endsAt={Date.now() + msUntilNextHole()} />
              </span>
            ) : null}
            <GameHubHowTo game={game} className="gh-round" iconOnly />
            <ShareBoardButton
              className="gh-round gh-share"
              label={
                ranked ? `Think you can beat me at ${game.name}? Prove it on ${APP_NAME}.` : `Try today’s ${game.name} on ${APP_NAME}.`
              }
              url={gameHref(game.slug)}
            />
          </span>
        </div>

        <div className="gh-stage__low">
          <div className="gh-stage__title">
            {kicker ? <span className="gh-stage__tag">{kicker}</span> : null}
            {today?.name ? (
              <p className="gh-stage__today">
                {today.name}
                {/* On a phone the clock is here, as the top row has no room for it. */}
                <span className="gh-stage__left">
                  {' · '}
                  <EventCountdown endsAt={Date.now() + msUntilNextHole()} />
                </span>
              </p>
            ) : null}
            <h1 id="gh-title" className="gh-stage__name">
              {game.name}
            </h1>
          </div>
          {soon || canPlay ? (
            <div className="gh-stage__acts">
              {soon ? (
                <p className="gh-soon">
                  <span className="gh-soon__cal" aria-hidden="true">
                    <span>{soonMonth}</span>
                    <b>{Number(soon.slice(8))}</b>
                  </span>
                  <span className="gh-soon__words">
                    <b>Coming {archiveDayWords(soon)}</b>
                    <span>{toGo === 1 ? 'Tomorrow' : `${toGo} days to go`}</span>
                  </span>
                </p>
              ) : (
                <>
                  <a ref={ctaRef} className="gh-play" href={playHref}>
                    <PlayIcon />
                    {playLabel}
                  </a>
                  {/* A record to chase in the run, picked here and carried to the play page (lib/chase.ts). */}
                  <ChaseButton slug={game.slug} href={playHref} className="gh-round gh-chase" iconOnly />
                  {/* A daily's past courses, to play again: "Past tracks". */}
                  {today ? (
                    <a className="gh-past" href={today.pastHref}>
                      <CalendarIcon />
                      {/* On a phone the words go, for Play's room: the calendar, named. */}
                      <span className="gh-past__words">{today.pastLabel}</span>
                    </a>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          {/* A racing daily's run this device keeps signed out: on no board till a sign-in (TodaysCardParts DeviceRunNote). */}
          {today?.kept ? <div className="gh-stage__kept">{today.kept}</div> : null}
          {!canPlay ? (
            <p className="gh-stage__hint">
              {game.comingSoon
                ? 'Coming soon. The screen shows what it will be.'
                : (deviceRequirementLabel(game) ?? `${game.name} isn’t available on this device.`)}
            </p>
          ) : soon ? (
            <p className="gh-stage__hint">
              {earlyStage(game.slug) === 'early'
                ? 'Plus members are playing it now, a week early.'
                : `Plus members play it a week early, from ${archiveDayWords(earlyFrom(soon))}.`}
              {admin ? (
                <>
                  {' '}
                  <a className="gh-soon__admin" href={playHref}>
                    Play early (admin)
                  </a>
                </>
              ) : null}
            </p>
          ) : launchLine ? (
            <p className="gh-stage__hint">{launchLine}</p>
          ) : null}
          <SkinChip game={game.slug} className="gh-stage__skin" />
        </div>
      </section>

      {spotlight ? <SpotlightCard slug={game.slug} name={game.name} /> : null}

      {canPlay && !soon && typeof document !== 'undefined'
        ? createPortal(
            <a
              className={`gh-float${floating ? ' gh-float--on' : ''}`}
              href={playHref}
              aria-hidden={!floating}
              tabIndex={floating ? undefined : -1}
              style={{ '--gh-accent': accent, '--gh-ink': inkOn(accent), '--gh-fill': readableFill(accent) } as CSSProperties}
            >
              <PlayIcon />
              {playLabel}
            </a>,
            document.body,
          )
        : null}
    </>
  )
}
