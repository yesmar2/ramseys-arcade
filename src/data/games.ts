import type { DeviceType } from '../lib/device'
import { formatDeviceList } from '../lib/device'

export type Game = {
  name: string
  slug: string
  description: string
  accent: string
  /** One-line how to play, shown on the game page. */
  how: string
  playable?: boolean
  /** Home tile only — not a real game yet. */
  comingSoon?: boolean
  /** On the grid, but not ready to play. */
  inDevelopment?: boolean
  /** Hidden from home, boards, and nav — code kept for later. */
  hidden?: boolean
  /** If set, the game is only offered on these devices. */
  devices?: DeviceType[]
}

export const games: Game[] = [
  {
    name: 'Asteroids',
    slug: 'asteroids',
    description: 'Spin, thrust, clear the rocks. Chain hits for more.',
    how: 'Arrow keys or WASD to turn and thrust. Space fires. Break rocks into smaller ones without getting hit.',
    accent: '#2eb87a',
    playable: true,
  },
  {
    name: 'Patriot',
    slug: 'patriot',
    description: 'Defend the cities. Aim. Fire. Survive the wave.',
    how: 'Move to aim. Click or tap to shoot. Protect the cities through each wave. Keys 1–4 use powers.',
    accent: '#e85d75',
    playable: true,
  },
  {
    name: 'Snake',
    slug: 'snake',
    description: 'Grow longer. Don’t crash.',
    how: 'Swipe or use arrow keys. Eat, grow, and don’t hit the walls or yourself.',
    accent: '#3ecf8e',
    playable: true,
  },
  {
    name: 'Pop',
    slug: 'pop',
    description: 'Tap the circles before they fade. Center hits score more.',
    how: 'Tap circles before they fade. Hits closer to the center score more.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Stacker',
    slug: 'stacker',
    description: 'Time the drop. Stack higher. Don’t miss.',
    how: 'Tap or press space to drop the block. Land it on the stack — miss and the round is over.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Centroid',
    slug: 'dead-center',
    description: 'Find the shape’s true center. Closer scores more.',
    how: 'Tap where you think the center is. Closer scores more. Ten shapes, five seconds each.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Simon',
    slug: 'simon',
    description: 'Watch the pattern. Repeat it. Don’t miss.',
    how: 'Watch the pads light up, then tap the same pattern. Each round adds a step.',
    accent: '#8a6ad4',
    playable: true,
  },
  {
    name: 'Crosswalk',
    slug: 'crosswalk',
    description: 'Dodge traffic, ride the river, fill every bay.',
    how: 'Hop up through the traffic, then ride logs and turtles across the river. Land in one of the five bays at the top; fill all five to clear the level. Water, cars, and the timer all cost a life.',
    accent: '#3ecf8e',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Stride',
    slug: 'stride',
    description: 'Hop forever. Beat your distance.',
    how: 'Swipe or tap to hop. Dodge traffic, ride the logs, and beat the train. Don’t linger — the hawk is watching. Score is how far you get, one point per row, and your record is marked on the road ahead.',
    accent: '#f5b942',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Spotter',
    slug: 'spotter',
    description: 'Find the wrong tile. A new hunt every day.',
    how: 'Every day, one game on the wall isn’t right. Tap the glitch. Fewer wrong taps and faster finds rank higher.',
    accent: '#7a6cf0',
    playable: false,
    hidden: true,
  },
  {
    name: 'Pellets',
    slug: 'pellets',
    description: 'Clear the maze. Watch the ghosts.',
    how: 'Coming soon.',
    accent: '#f5b942',
    comingSoon: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    description: 'Rows of ships. One cannon. Hold the line.',
    how: 'Coming soon.',
    accent: '#e85d75',
    comingSoon: true,
  },
]

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug)
}

export function isGameHidden(slug: string) {
  return getGame(slug)?.hidden === true
}

export function isGameInDevelopment(slug: string) {
  return getGame(slug)?.inDevelopment === true
}

export function gamePlayableOn(game: Game, device: DeviceType) {
  if (game.hidden) return false
  if (!game.playable) return false
  if (!game.devices || game.devices.length === 0) return true
  return game.devices.includes(device)
}

export function playableGames(device?: DeviceType) {
  return games.filter(
    (g) => !g.hidden && (device ? gamePlayableOn(g, device) : g.playable),
  )
}

/** Games shown on the home grid (playable on this device + preview tiles). */
export function homeGames(device: DeviceType) {
  return games.filter(
    (g) =>
      !g.hidden &&
      (g.comingSoon || g.inDevelopment || gamePlayableOn(g, device)),
  )
}

export function deviceRequirementLabel(game: Game) {
  if (!game.devices?.length) return null
  return `${game.name} plays on ${formatDeviceList(game.devices)}.`
}
