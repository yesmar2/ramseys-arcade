import { deviceRequirementLabel, type Game } from '../data/games'
import { DeviceIcon } from './DeviceIcon'

type GameDeviceBadgeProps = {
  game: Game
  className?: string
}

/** Device icons for games limited to specific hardware; tooltip explains where to play. */
export function GameDeviceBadge({ game, className }: GameDeviceBadgeProps) {
  if (!game.devices?.length) return null
  const tip = deviceRequirementLabel(game)
  if (!tip) return null

  return (
    <span
      className={`game-device-badge${className ? ` ${className}` : ''}`}
      title={tip}
      aria-label={tip}
    >
      {game.devices.map((device) => (
        <DeviceIcon
          key={device}
          device={device}
          labeled={false}
          className="game-device-badge__icon"
        />
      ))}
    </span>
  )
}
