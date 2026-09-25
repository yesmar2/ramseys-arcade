import { useEffect, useState, type CSSProperties } from 'react'
import type { Game } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'

type GameTileProps = {
  game: Game
  index: number
  /** Defaults to the game lobby. */
  href?: string
  /** Keep the tile visible on phones even if the game isn’t playable there. */
  showOnAllDevices?: boolean
  /** Your best on this game, shown as a footer so the grid reads as a board. */
  best?: number | null
}

export function GameTile({
  game,
  index,
  href,
  showOnAllDevices = false,
  best,
}: GameTileProps) {
  const [, setThemeTick] = useState(0)
  useEffect(() => {
    const sync = () => setThemeTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])
  const accent = resolveGameAccent(game.slug, game.accent)
  const style = {
    '--tile-accent': accent,
    '--thumb-accent': accent,
    animationDelay: `${0.05 + index * 0.05}s`,
  } as CSSProperties

  const hideOnPhone =
    !showOnAllDevices && Boolean(game.devices && !game.devices.includes('phone'))

  return (
    <li className={hideOnPhone ? 'game-grid__item--no-phone' : undefined}>
      <a
        className="game-tile game-tile--thumb"
        href={href ?? gameHref(game.slug)}
        style={style}
        aria-label={
          game.inDevelopment
            ? `${game.name}, in development`
            : game.comingSoon
              ? `${game.name}, coming soon`
              : game.name
        }
      >
        <GameThumbArt slug={game.slug} accent={accent} shape="card" />
        <h3 className="game-tile__title">{game.name}</h3>
        {game.inDevelopment ? (
          <span className="game-tile__status">In development</span>
        ) : game.comingSoon ? (
          <span className="game-tile__status">Coming soon</span>
        ) : best ? (
          <span className="game-tile__best">
            <span className="game-tile__best-k">Best</span>
            <span className="game-tile__best-v">{best.toLocaleString()}</span>
          </span>
        ) : null}
      </a>
    </li>
  )
}
