import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useActiveGroup } from '../lib/groups'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import {
  getLeaderboard,
  normalizePlayerName,
  PERIOD_LABELS,
} from '../lib/leaderboard'
import { usePlayerName } from '../hooks/usePlayerName'
import { EventArt } from './EventCard'
import { resolveGameAccent } from '../lib/theme'
import { inkOn } from '../lib/color'

type HeroScores = {
  best: number
  rank: number
  top: number
  topName: string
}

/**
 * The single "what should I play" slot.
 *
 * The same hero every other page opens with — tinted from the game's colour,
 * art on the left, a kicker, the name, a line about it, and Play — so the
 * home page reads as the front door to the same building.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  // Both figures below are group-scoped on the wire; switching group has to
  // refetch them or the hero keeps quoting the last group's board.
  const groupId = useActiveGroup()
  const [scores, setScores] = useState<HeroScores | null>(null)
  const lastPlayed = slug != null && recent.includes(slug)

  useEffect(() => {
    if (!slug) {
      setScores(null)
      return
    }
    let cancelled = false
    /*
     * One call for both figures. The board already carries the leader and the
     * player's own row, so asking for bests separately was a second round trip
     * for something the first response contained.
     */
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

  const accent = resolveGameAccent(slug, game.accent)
  const isNew = !lastPlayed && slug === newest
  const kicker = lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'

  return (
    <section
      className="hero home-hero"
      style={{ '--hero-accent': accent, '--hero-ink': inkOn(accent), '--thumb-accent': accent } as CSSProperties}
      aria-label="Play"
    >
      <div className="hero__main">
        <a className="hero__art home-hero__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
          <EventArt games={[slug]} />
        </a>
        <div className="hero__text">
          <p className="ev-kicker hero__kicker">
            <span className="ev-kicker__bit">{kicker}</span>
          </p>
          <h2 className="hero__title home-hero__name">
            <a href={gamePlayHref(slug)}>{game.name}</a>
          </h2>
        </div>
        <div className="hero__actions">
          <a className="hero__cta" href={gamePlayHref(slug)}>
            Play
          </a>
        </div>
        {scores && scores.top > 0 ? (
          <div className="hero__aside hero-scores" aria-label={`${game.name} scores`}>
            <div className="hero-score">
              <span className="hero-score__label">Your best</span>
              <span className="hero-score__value">
                {scores.best > 0 ? scores.best.toLocaleString() : '—'}
              </span>
              <span className="hero-score__note">
                {scores.best > 0
                  ? scores.rank > 0
                    ? `#${scores.rank} ${PERIOD_LABELS[period].toLowerCase()}`
                    : PERIOD_LABELS[period]
                  : 'Not on the board yet'}
              </span>
            </div>
            <div className="hero-score">
              <span className="hero-score__label">Top score</span>
              <span className="hero-score__value">{scores.top.toLocaleString()}</span>
              <span className="hero-score__note">
                {scores.topName ? `by ${scores.topName}` : PERIOD_LABELS[period]}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
