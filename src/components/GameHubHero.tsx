import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { deviceRequirementLabel, TAG_LABELS, type Game } from '../data/games'
import { gameHref, gamePlayHref, homeHref, recordsHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { hasGamePreview } from '../lib/gamePreviews'
import type { LeaderboardEntry, LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { DevicesIcon, PlayIcon } from './chromeIcons'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { ShareBoardButton } from './ShareBoardButton'
import { HiddenBug } from './BugHunt'

/**
 * The top of a game's page: its name and a way to play, beside its screen,
 * where the game plays itself the way the cabinet by an arcade's door runs its
 * demo, under the high score and whose it is. On a phone, once the page has
 * scrolled past Play, Play follows along above the tab bar.
 */
export function GameHubHero({
  game,
  accent,
  canPlay,
  hasRecords,
  period,
  highScore,
}: {
  game: Game
  accent: string
  canPlay: boolean
  hasRecords: boolean
  period: LeaderboardPeriod
  /** The game's all-time best run, for its screen. */
  highScore: LeaderboardEntry | null
}) {
  const playHref = gamePlayHref(game.slug)
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

  return (
    <section className="gh-hero" aria-labelledby="gh-title">
      <div className="gh-hero__text">
        <nav className="gh-crumbs" aria-label="Breadcrumb">
          <a href={homeHref()}>Games</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{game.name}</span>
          <HiddenBug spot={`crumbs-${game.slug}`} />
        </nav>
        <div className="gh-hero__main">
          {tags.length > 0 || kicker ? (
            <p className="gh-tags">
              {kicker ? <span className="gh-tag gh-tag--note">{kicker}</span> : null}
              {tags.map((tag, i) => (
                <span key={tag} className={`gh-tag${i === 0 ? ' gh-tag--lead' : ''}`}>
                  {tag}
                </span>
              ))}
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
                Play {game.name}
              </a>
            ) : null}
            {hasRecords ? (
              <a className="gh-ghost" href={recordsHref(game.slug, period)}>
                Record books
              </a>
            ) : null}
            <ShareBoardButton
              className="gh-share"
              label={`Think you can beat me at ${game.name}? Prove it on ${APP_NAME}.`}
              url={gameHref(game.slug)}
            />
          </div>
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
          <HiddenBug spot={`where-${game.slug}`} />
        </p>
      </div>

      {/* The game on its screen: its thumb until the first frame is down. */}
      <a className="gh-screen" href={canPlay ? playHref : gameHref(game.slug)} tabIndex={-1} aria-hidden="true">
        <span className="gh-screen__thumb">
          <GameThumbArt slug={game.slug} accent={accent} />
        </span>
        {hasGamePreview(game.slug) ? <GamePreview slug={game.slug} className="gh-screen__game" autoplay /> : null}
        <span className="gh-screen__top">
          <span className="gh-screen__hi">
            Hi score
            <b>{highScore ? formatLeaderboardScore(game.slug, highScore.score) : 'Open'}</b>
          </span>
          {highScore ? <span className="gh-screen__who">{highScore.name}</span> : null}
        </span>
        {canPlay ? <span className="gh-screen__start">Press start</span> : null}
      </a>

      {canPlay && typeof document !== 'undefined'
        ? createPortal(
            <a
              className={`gh-float${pastPlay ? ' gh-float--on' : ''}`}
              href={playHref}
              aria-hidden={!pastPlay}
              tabIndex={pastPlay ? undefined : -1}
              style={{ '--gh-accent': accent, '--gh-ink': inkOn(accent) } as CSSProperties}
            >
              <PlayIcon />
              Play {game.name}
            </a>,
            document.body,
          )
        : null}
    </section>
  )
}
