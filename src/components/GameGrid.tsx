import { useEffect, useState, type CSSProperties } from 'react'
import { getGame, homeGames } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { fetchPlayerBests, normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'
import { GameTile } from './GameTile'

function Feature({ slug, isNew }: { slug: string; isNew: boolean }) {
  const game = getGame(slug)
  if (!game) return null
  const accent = resolveGameAccent(slug, game.accent)
  return (
    <a
      className="game-feature"
      href={gamePlayHref(slug)}
      style={{ '--tile-accent': accent, '--thumb-accent': accent } as CSSProperties}
    >
      <span className="game-feature__art">
        <GameThumbArt slug={slug} accent={accent} />
      </span>
      <span className="game-feature__body">
        <span className="game-feature__kicker">{isNew ? 'New' : 'Today’s pick'}</span>
        <span className="game-feature__name">{game.name}</span>
        <span className="game-feature__desc">{game.description}</span>
        <span className="game-feature__go">Play</span>
      </span>
    </a>
  )
}

export function GameGrid() {
  const device = useDeviceType()
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const recent = useRecentGames()
  const tiles = homeGames(device)
  const [bests, setBests] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!cleaned) {
      setBests(null)
      return
    }
    let cancelled = false
    fetchPlayerBests(cleaned)
      .then((next) => {
        if (!cancelled) setBests(next)
      })
      .catch(() => {
        if (!cancelled) setBests(null)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned])

  const newest = newestSlug(device)
  const feature = newest

  /*
   * Games you have opened sort to the front, so the grid answers "what was I
   * doing" before it answers "what exists". Everything else keeps catalog order
   * and the feature tile is lifted out of the grid entirely.
   */
  const ordered = [...tiles]
    .filter((g) => g.slug !== feature)
    .sort((a, b) => {
      const ai = recent.indexOf(a.slug)
      const bi = recent.indexOf(b.slug)
      const ar = ai === -1 ? Number.MAX_SAFE_INTEGER : ai
      const br = bi === -1 ? Number.MAX_SAFE_INTEGER : bi
      return ar - br
    })

  return (
    <section className="games games--playable" id="games" aria-labelledby="games-heading">
      <h2 id="games-heading" className="visually-hidden">
        Games
      </h2>
      {feature ? <Feature slug={feature} isNew={feature === newest} /> : null}
      <ul className="game-grid game-grid--playable">
        {ordered.map((game, index) => (
          <GameTile
            key={game.slug}
            game={game}
            index={index}
            showOnAllDevices
            best={bests ? (bests[game.slug] ?? 0) : null}
          />
        ))}
      </ul>
    </section>
  )
}
