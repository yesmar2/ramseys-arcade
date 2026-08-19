import { DeviceUnavailable } from '../components/DeviceUnavailable'
import { getGame, gamePlayableOn } from '../data/games'
import { PatriotGame } from '../games/patriot/PatriotGame'
import { useDeviceType } from '../lib/device'

export function PatriotPage() {
  const device = useDeviceType()
  const game = getGame('patriot')
  if (game && !gamePlayableOn(game, device)) {
    return <DeviceUnavailable game={game} />
  }

  return (
    <main className="game-page game-page--fullscreen">
      <PatriotGame />
    </main>
  )
}
