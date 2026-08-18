import type { DeviceType } from '../lib/device'
import { formatDeviceList } from '../lib/device'

export type Game = {
  name: string
  slug: string
  description: string
  accent: string
  playable?: boolean
  /** If set, the game is only offered on these devices. */
  devices?: DeviceType[]
}

export const games: Game[] = [
  {
    name: 'Stacker',
    slug: 'stacker',
    description: 'Time the drop. Stack higher. Don’t miss.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Patriot',
    slug: 'patriot',
    description: 'Defend the cities. Aim. Fire. Survive the wave.',
    accent: '#e85d75',
    playable: true,
    devices: ['desktop', 'tablet'],
  },
  {
    name: 'Snake',
    slug: 'snake',
    description: 'Grow longer. Don’t crash.',
    accent: '#3ecf8e',
    playable: true,
  },
  {
    name: 'Pop',
    slug: 'pop',
    description: 'Tap the circles before they fade. Center hits score more.',
    accent: '#4aa8e8',
    playable: true,
    devices: ['tablet', 'phone'],
  },
  {
    name: 'Simon',
    slug: 'simon',
    description: 'Watch the pattern. Repeat it. Don’t miss.',
    accent: '#8a6ad4',
    playable: true,
  },
  {
    name: 'Centroid',
    slug: 'dead-center',
    description: 'Find the shape’s true center. Closer scores more.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Asteroids',
    slug: 'asteroids',
    description: 'Spin, thrust, clear the rocks. Chain hits for more.',
    accent: '#5a8fd4',
    playable: true,
  },
]

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug)
}

export function gamePlayableOn(game: Game, device: DeviceType) {
  if (!game.playable) return false
  if (!game.devices || game.devices.length === 0) return true
  return game.devices.includes(device)
}

export function playableGames(device?: DeviceType) {
  return games.filter((g) => (device ? gamePlayableOn(g, device) : g.playable))
}

export function deviceRequirementLabel(game: Game) {
  if (!game.devices?.length) return null
  return `${game.name} plays on ${formatDeviceList(game.devices)}.`
}
