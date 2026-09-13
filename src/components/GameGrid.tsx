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
   * Games you have opened sort to the front, so the grid answers "what was I
   * doing" before it answers "what exists".
   */
  // The hero already gives this one a full-width slot of its own.
  const hero = heroSlug(device, recent)
  const ordered = [...tiles].filter((g) => g.slug !== hero).sort((a, b) => {
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
