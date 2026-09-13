import { useEffect, useState } from 'react'
import { homeGames } from '../data/games'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { fetchPlayerBests, normalizePlayerName } from '../lib/leaderboard'
import { GameTile } from './GameTile'

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

  /*
   * The grid keeps the fixed shelf order from homeGames rather than sorting
   * what you played most recently to the front. The hero directly above it is
   * already the "what was I doing" slot — it opens on your last game — so
   * reshuffling here only made the shelf move under you, and it dragged
   * in-development titles up to the front the moment you tried one.
   */
  // The hero already gives this one a full-width slot of its own.
  const hero = heroSlug(device, recent)
  const ordered = tiles.filter((g) => g.slug !== hero)

  return (
    <section className="games games--playable" id="games" aria-labelledby="games-heading">
      <h2 id="games-heading" className="visually-hidden">
        Games
      </h2>
      <ul className="game-grid game-grid--playable">
        {ordered.map((game, index) => (
          <GameTile
            key={game.slug}
            game={game}
            index={index}
            showOnAllDevices
            best={bests?.[game.slug] ?? null}
          />
        ))}
      </ul>
    </section>
  )
}
