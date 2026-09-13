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
    name: 'Crosswalk',
    slug: 'crosswalk',
    description: 'Hop forever. Beat your distance.',
    how: 'Swipe or tap to hop. Dodge traffic, ride the logs, hop the stones, and beat the train. Don’t linger — the hawk is watching. Score is how far you get, one point per row, and your record is marked on the road ahead.',
    accent: '#f5b942',
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
    slug: 'centroid',
    description: 'Find the shape’s true center. Closer scores more.',
    how: 'Tap where you think the center is. Closer scores more. Ten shapes, five seconds each.',
    accent: '#4aa8e8',
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
    name: 'Simon',
    slug: 'simon',
    description: 'Watch the pattern. Repeat it. Don’t miss.',
    how: 'Watch the pads light up, then tap the same pattern. Each round adds a step.',
    accent: '#8a6ad4',
    playable: true,
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
    description: 'Clear the maze. Bank a streak. Surge.',
    how: 'Swipe or arrow keys to steer. Eating fresh crumbs builds a streak multiplier — doubling back over cleared ground resets it. Crumbs also charge Surge: tap the maze or hit space to burn it for a fast burst that bounces any chaser you touch straight back to the den. Power crumbs still turn them blue. Each level has its own maze (same on phone and desktop, just rotated). Three lives.',
    accent: '#f5b942',
    playable: true,
  },
  {
    name: 'Find the Bug',
    slug: 'findbug',
    description: 'Something is hiding in the arcade. Find it before the clock does.',
    how: 'Five scenes of arcade clutter — a cabinet row, a leaderboard, a cable loom, a token spill, the carpet — and one bug hiding in each. It never moves, so nothing on screen will give it away: it just gets smaller and better camouflaged every scene. Tap it to swat. Wrong swats add three seconds, and the hint costs eight. Fastest total time wins. Arrow keys move a reticle and space swats.',
    accent: '#8fb339',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    description: 'Rows of ships. One cannon. Hold the line.',
    how: 'Arrow keys or the thumb pads move the cannon, space or the up pad fires, three shots in the air at once. The fleet does not trade pot shots — it gathers a volley, and the ships about to fire light up and drop a warning lane first. Read the lanes, get into a cold one, and spend the quiet between volleys clearing rows. From wave three the lanes lean, so a cold column is not automatically safe. There is no cover: moving is your only defence. Wrecked ships sometimes drop a capsule — Spread fans your fire, Slow drags the volley to a crawl, Pierce punches a round straight through a whole column, and Jam makes the next volley fizzle. They fall, so you have to move under one to take it, and the lane it drops down may be the one about to fire. Clear a wave for a bonus, clear one without being hit for a bigger one. Any ship reaching the line ends the run whatever your lives say. Three lives.',
    accent: '#e85d75',
    playable: true,
    inDevelopment: true,
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

/**
 * How the shelf is arranged. Deliberately not the order of `games` itself —
 * that stays append-only so "newest in the catalog" keeps meaning something.
 * Anything left off holds its catalog position after these.
 */
const HOME_ORDER: readonly string[] = [
  'crosswalk',
  'snake',
  'asteroids',
  'pellets',
  'patriot',
  'stacker',
  'centroid',
]

/** Lower sorts earlier. Titles that are not finished go to the back. */
function homeRank(game: Game): number {
  if (game.comingSoon) return 3000
  if (game.inDevelopment) return 2000
  const placed = HOME_ORDER.indexOf(game.slug)
  return placed === -1 ? 1000 : placed
}

/** Games shown on the home grid (playable on this device + preview tiles). */
export function homeGames(device: DeviceType) {
  return games
    .filter(
      (g) => !g.hidden && (g.comingSoon || g.inDevelopment || gamePlayableOn(g, device)),
    )
    .sort((a, b) => homeRank(a) - homeRank(b))
}

export function deviceRequirementLabel(game: Game) {
  if (!game.devices?.length) return null
  return `${game.name} plays on ${formatDeviceList(game.devices)}.`
}
