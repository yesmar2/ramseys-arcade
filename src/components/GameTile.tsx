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
}

export function GameTile({
  game,
  index,
  href,
  showOnAllDevices = false,
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
        <GameThumbArt slug={game.slug} accent={accent} />
        <h3 className="game-tile__title">{game.name}</h3>
        {game.inDevelopment ? (
          <span className="game-tile__status">In development</span>
        ) : game.comingSoon ? (
          <span className="game-tile__status">Coming soon</span>
        ) : null}
      </a>
    </li>
  )
}
