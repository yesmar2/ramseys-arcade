import { useEffect, useState, type CSSProperties } from 'react'
import { games, homeGames, type Game, type GameTag } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useActiveGroup } from '../lib/groups'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { fetchPlayerBests, normalizePlayerName } from '../lib/leaderboard'
import { GameTileArt } from './GameTileArt'

type Tab = 'all' | GameTag | 'new'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'quick', label: 'Quick play' },
  { id: 'sport', label: 'Sport' },
  { id: 'new', label: 'New' },
]

function inTab(game: Game, tab: Tab) {
  if (tab === 'all') return true
  if (tab === 'new') return Boolean(game.inDevelopment || game.comingSoon)
  return Boolean(game.tags?.includes(tab))
}

/**
 * The wall: every game, edge to edge, in a grid that runs six across on a
 * wide screen and two on a phone. The first game on the shelf takes a
 * two-by-two cell and the newest takes two across, so the grid has a rhythm
 * rather than a beat. Art fills each tile and the name sits over it. Tabs
 * along the top cut the wall by what kind of game it is.
 */
export function GameWall() {
  const device = useDeviceType()
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()
  const recent = useRecentGames()
  const [tab, setTab] = useState<Tab>('all')
  const [bests, setBests] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!cleaned) {
      setBests(null)
      return
    }
    let cancelled = false
    fetchPlayerBests(cleaned, period)
      .then((next) => {
        if (!cancelled) setBests(next)
      })
      .catch(() => {
        if (!cancelled) setBests(null)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned, period, groupId])

  const all = homeGames(device)
  const shown = all.filter((g) => inTab(g, tab))
  // The banner above already has the hero; the wall's big cell goes to the next shelf game.
  const hero = heroSlug(device, recent)
  const big = shown.find((g) => g.slug !== hero && !g.inDevelopment && !g.comingSoon)?.slug ?? null
  const newest = games.filter((g) => !g.hidden).at(-1)?.slug ?? null

  return (
    <section className="wall" aria-labelledby="games-heading">
      <div className="wall__bar">
        <h2 id="games-heading" className="wall__title">
          Games
        </h2>
        <div className="chips wall__tabs" role="tablist" aria-label="Kind of game">
          {TABS.map((t) => {
            const count = all.filter((g) => inTab(g, t.id)).length
            if (count === 0) return null
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`chips__item${tab === t.id ? ' chips__item--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <span className="wall__count">
          {shown.length} {shown.length === 1 ? 'game' : 'games'}
        </span>
      </div>
      <ul className="wall__grid">
        {shown.map((game, index) => (
          <WallTile
            key={game.slug}
            game={game}
            index={index}
            size={game.slug === big ? 'big' : game.slug === newest && shown.length > 4 ? 'wide' : 'one'}
            best={bests?.[game.slug] ?? null}
          />
        ))}
      </ul>
    </section>
  )
}

function WallTile({
  game,
  index,
  size,
  best,
}: {
  game: Game
  index: number
  size: 'one' | 'wide' | 'big'
  best: number | null
}) {
  const style = {
    '--tile-accent': game.accent,
    animationDelay: `${Math.min(index, 12) * 0.04}s`,
  } as CSSProperties
  const status = game.inDevelopment ? 'New' : game.comingSoon ? 'Coming soon' : null
  return (
    <li className={`wall__cell wall__cell--${size}`}>
      <a
        className="wall-tile"
        href={gameHref(game.slug)}
        style={style}
        aria-label={status ? `${game.name}, ${status.toLowerCase()}` : game.name}
      >
        <span className="wall-tile__art" aria-hidden="true">
          <GameTileArt slug={game.slug} />
        </span>
        {status ? <span className="wall-tile__flag">{status}</span> : null}
        <span className="wall-tile__meta">
          <span className="wall-tile__name">{game.name}</span>
          {best ? (
            <span className="wall-tile__best">
              Best <b>{best.toLocaleString()}</b>
            </span>
          ) : null}
        </span>
      </a>
    </li>
  )
}
