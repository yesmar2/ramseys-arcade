import { DeviceUnavailable } from '../components/DeviceUnavailable'
import { getGame, gamePlayableOn } from '../data/games'
import { WhackGame } from '../games/whack/WhackGame'
import { useDeviceType } from '../lib/device'

export function WhackPage() {
  const device = useDeviceType()
  const game = getGame('pop')
  if (game && !gamePlayableOn(game, device)) {
    return <DeviceUnavailable game={game} />
  }

  return (
    <main className="game-page game-page--fullscreen">
      <WhackGame />
    </main>
  )
}
