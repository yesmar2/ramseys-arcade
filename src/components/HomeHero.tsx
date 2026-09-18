import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useActiveGroup } from '../lib/groups'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { getLeaderboard, normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { GameTileArt } from './GameTileArt'

type HeroScores = {
  best: number
  rank: number
  top: number
  topName: string
}

/**
 * The banner: the one game to open right now, run big across the whole
 * width. The game's art fills the right half and bleeds off the edge; the
 * left carries the kicker, the name, the game's own line about itself, Play,
 * and the two figures that make a reason to press it — the board's top and
 * yours. Tinted from the game's colour, like every hero on the site.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  // Both figures below are group-scoped on the wire; switching group has to
  // refetch them or the banner keeps quoting the last group's board.
  const groupId = useActiveGroup()
  const [scores, setScores] = useState<HeroScores | null>(null)
  const lastPlayed = slug != null && recent.includes(slug)

  useEffect(() => {
    if (!slug) {
      setScores(null)
      return
    }
    let cancelled = false
    getLeaderboard(slug, period, name || undefined, { limit: 1 })
      .then(({ entries, you }) => {
        if (cancelled) return
        const leader = entries[0]
        setScores({
          best: you?.score ?? 0,
          rank: you?.rank ?? 0,
          top: leader?.score ?? 0,
          topName: leader?.name ?? '',
        })
      })
      .catch(() => {
        if (!cancelled) setScores(null)
      })
    return () => {
      cancelled = true
    }
  }, [name, slug, period, groupId])

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = game.accent
  const isNew = !lastPlayed && slug === newest
  const kicker = lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'
  const periodWord = PERIOD_LABELS[period].toLowerCase()

  return (
    <section
      className="home-banner"
      style={{ '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties}
      aria-label="Play"
    >
      <div className="home-banner__text">
        <p className="home-banner__kicker">{kicker}</p>
        <h2 className="home-banner__name">
          <a href={gamePlayHref(slug)}>{game.name}</a>
        </h2>
        <p className="home-banner__blurb">{game.description}</p>
        <div className="home-banner__acts">
          <a className="home-banner__cta" href={gamePlayHref(slug)}>
            Play {game.name}
          </a>
          <a className="home-banner__ghost" href={gameHref(slug)}>
            How it scores
          </a>
        </div>
        {scores && scores.top > 0 ? (
          <dl className="home-banner__figures" aria-label={`${game.name} scores`}>
            <div className="home-banner__figure">
              <dt>Top {periodWord}</dt>
              <dd>
                {scores.top.toLocaleString()}
                {scores.topName ? <small> by {scores.topName}</small> : null}
              </dd>
            </div>
            <div className="home-banner__figure">
              <dt>Your best</dt>
              <dd>
                {scores.best > 0 ? scores.best.toLocaleString() : '—'}
                {scores.best > 0 && scores.rank > 0 ? <small> · #{scores.rank}</small> : null}
                {scores.best === 0 ? <small> not on the board yet</small> : null}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
      <a className="home-banner__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
        <GameTileArt slug={slug} />
      </a>
    </section>
  )
}
