import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { deviceRequirementLabel, isRankedGame, TAG_LABELS, type Game } from '../data/games'
import { gameHref, gamePlayHref, homeHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { inkOn, readableFill } from '../lib/color'
import { dailyWords } from '../lib/dailyWords'
import { hasDayPreview, hasGamePreview } from '../lib/gamePreviews'
import { useScope } from '../lib/groups'
import type { LeaderboardEntry } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { boardDay } from '../lib/rankHow'
import { DevicesIcon, PlayIcon } from './chromeIcons'
import { GameHubHowTo } from './GameHubHowTo'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { useSpotlight } from '../lib/season'
import { SkinPicker } from './season/SkinPicker'
import { SpotlightCard } from './season/SeasonSpotlight'
import { ShareBoardButton } from './ShareBoardButton'

/** "Race today’s track": a daily's Play says which run it starts, the one that counts. */
function dailyPlayLabel(slug: string): string {
  return dailyWords(slug).playToday
}

/**
 * The games whose screen draws its own HUD where the hero writes over it: along the top, under the high score
 * (Pileup's Hold and Next, Bop's bezel), and along the bottom, under Press start (Frenzy's lives, bar and chain,
 * and on a phone Pileup's pieces up next and Bop's Spin). Their game plays clear of what's written over it (hub.css
 * .gh-screen--hud-top, .gh-screen--hud-low), so the two never land on each other.
 */
const HUD_EDGES: Readonly<Partial<Record<string, { top?: boolean; low?: boolean }>>> = {
  bop: { top: true, low: true },
  pileup: { top: true, low: true },
  frenzy: { low: true },
}

/**
 * The top of a game's page: its name and a way to play, beside its screen,
 * where the game plays itself the way the cabinet by an arcade's door runs its
 * demo, under the high score and whose it is. On a phone, once the page has
 * scrolled past Play, Play follows along above the tab bar.
 *
 * A daily's is shorter, with its tabs under it: Play starts today's course,
 * the screen shows who is 1st today, and its records are a tab of their own.
 */
export function GameHubHero({
  game,
  accent,
  canPlay,
  highScore,
}: {
  game: Game
  accent: string
  canPlay: boolean
  /** The game's all-time best run, for its screen: null when nobody has one, undefined while it isn't known. */
  highScore: LeaderboardEntry | null | undefined
}) {
  const playHref = gamePlayHref(game.slug)
  // The boards' group, when they show one: the high score on the screen is then the group's.
  const group = useScope().name
  const ctaRef = useRef<HTMLAnchorElement>(null)
  const [pastPlay, setPastPlay] = useState(false)

  // Play follows the page once the one in the banner has scrolled up out of sight.
  useEffect(() => {
    const cta = ctaRef.current
    if (!cta) return
    const watch = new IntersectionObserver(([entry]) => {
      setPastPlay(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    watch.observe(cta)
    return () => watch.disconnect()
  }, [canPlay])

  const tags = (game.tags ?? []).map((tag) => TAG_LABELS[tag])
  const where = `${deviceRequirementLabel(game) ?? 'Phone or desk'} · Free to play`
  const kicker = game.comingSoon ? 'Coming soon' : game.inDevelopment ? 'New' : null
  const daily = Boolean(game.daily)
  const ranked = isRankedGame(game.slug)
  const playLabel = daily ? dailyPlayLabel(game.slug) : `Play ${game.name}`
  const spotlight = useSpotlight(game.slug)
  // A daily's screen plays today where it has a day to play, as its card on the home page's Dailies row does:
  // the track driven, the course rolled, the cave flown, the hills flown. With only its thumb, a racing daily's
  // screen was a small picture in the middle of a dark one (Ramsey, 2026-10-07: "the game image is very small").
  const plays = hasGamePreview(game.slug) || (daily && hasDayPreview(game.slug))
  // A day's track, course, cave and hills are drawn dark in either theme: the high score over them stays dark too.
  const night = daily && hasDayPreview(game.slug)
  // The high score is written over the screen's top for a ranked game, Press start over its bottom when it plays here.
  const hud = plays ? HUD_EDGES[game.slug] : undefined
  const screenClass = ['gh-screen', hud?.top && ranked ? 'gh-screen--hud-top' : '', hud?.low && canPlay ? 'gh-screen--hud-low' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={`gh-hero${daily ? ' gh-hero--daily' : ''}${night ? ' gh-hero--night' : ''}`}
      aria-labelledby="gh-title"
      data-hunt={`g-hero-${game.slug}`}
    >
      <div className="gh-hero__text">
        <nav className="gh-crumbs" aria-label="Breadcrumb">
          {/* The games are the home page's wall, down the page: the link lands on it. */}
          <a href={`${homeHref()}#games`}>Games</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{game.name}</span>
        </nav>
        <div className="gh-hero__main">
          {tags.length > 0 || kicker || spotlight ? (
            <p className="gh-tags">
              {kicker ? <span className="gh-tag gh-tag--note">{kicker}</span> : null}
              {tags.map((tag, i) => (
                <span key={tag} className={`gh-tag${i === 0 ? ' gh-tag--lead' : ''}`}>
                  {tag}
                </span>
              ))}
              {spotlight ? <span className="gh-tag season-tag">Season spotlight</span> : null}
            </p>
          ) : null}
          <h1 id="gh-title" className="gh-hero__name">
            {game.name}
          </h1>
          <p className="gh-hero__blurb">{game.description}</p>
          <div className="gh-hero__acts">
            {canPlay ? (
              <a ref={ctaRef} className="gh-play" href={playHref}>
                <PlayIcon />
                {playLabel}
              </a>
            ) : null}
            <GameHubHowTo game={game} className="gh-ghost" />
            <ShareBoardButton
              className="gh-share"
              label={
                ranked ? `Think you can beat me at ${game.name}? Prove it on ${APP_NAME}.` : `Try today’s ${game.name} on ${APP_NAME}.`
              }
              url={gameHref(game.slug)}
            />
          </div>
          <SkinPicker game={game.slug} />
          {spotlight ? <SpotlightCard slug={game.slug} name={game.name} /> : null}
          {!canPlay ? (
            <p className="gh-hero__hint">
              {game.comingSoon
                ? 'Coming soon. The screen shows what it will be.'
                : (deviceRequirementLabel(game) ?? `${game.name} isn’t available on this device.`)}
            </p>
          ) : game.inDevelopment ? (
            <p className="gh-hero__hint">Still being tuned, so expect rough edges.</p>
          ) : null}
        </div>
        <p className="gh-hero__where">
          <DevicesIcon />
          {where}
        </p>
      </div>

      {/* The game on its screen (a daily's, today): its thumb until the first frame is down. */}
      <a
        className={screenClass}
        href={canPlay ? playHref : gameHref(game.slug)}
        tabIndex={-1}
        aria-hidden="true"
        data-hunt={`g-screen-${game.slug}`}
      >
        <span className="gh-screen__thumb">
          <GameThumbArt slug={game.slug} accent={accent} />
        </span>
        {plays ? <GamePreview slug={game.slug} day={daily ? boardDay() : undefined} className="gh-screen__game" autoplay /> : null}
        {/* A daily just for fun has no 1st: nobody is placed (data/games.ts Game.ranked). */}
        {ranked ? (
          <span className="gh-screen__top">
            <span className="gh-screen__hi">
              {daily ? '1st today' : 'Hi score'}
              {group ? ` · ${group}` : ''}
              {/* The score as the boards print it, its units lower case (54.759s). Open only when nobody has one:
                  a board on its way, or one that couldn't be read, is a dash. */}
              {highScore ? (
                <b className="gh-screen__score">{formatLeaderboardScore(game.slug, highScore.score)}</b>
              ) : (
                <b>{highScore === null ? 'Open' : '–'}</b>
              )}
            </span>
            {highScore ? <span className="gh-screen__who">{highScore.name}</span> : null}
          </span>
        ) : null}
        {canPlay ? <span className="gh-screen__start">Press start</span> : null}
      </a>

      {canPlay && typeof document !== 'undefined'
        ? createPortal(
            <a
              className={`gh-float${pastPlay ? ' gh-float--on' : ''}`}
              href={playHref}
              aria-hidden={!pastPlay}
              tabIndex={pastPlay ? undefined : -1}
              style={{ '--gh-accent': accent, '--gh-ink': inkOn(accent), '--gh-fill': readableFill(accent) } as CSSProperties}
            >
              <PlayIcon />
              {playLabel}
            </a>,
            document.body,
          )
        : null}
    </section>
  )
}
