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
    how: 'Swipe or arrow keys to steer. Clear the maze: fresh crumbs build a streak, doubling back breaks it, and a full charge lets you Surge through the chasers. Three lives.',
    accent: '#f5b942',
    playable: true,
  },
  {
    name: 'Find the Bug',
    slug: 'findbug',
    description: 'Something is hiding in the arcade. Find it before the clock does.',
    how: 'Five scenes, one bug hiding in each. Tap it to swat, or move the reticle with the arrow keys and swat with space. It never moves — it just gets smaller and better hidden each scene. Fastest total time wins.',
    accent: '#3ec8cf',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    description: 'Rows of ships. One cannon. Hold the line.',
    how: 'Arrow keys or the thumb pads move the cannon; space or the up pad fires. The fleet fires in volleys and lights up the lanes it will hit first — read them, get into a cold one, and clear rows in the quiet between. There is no cover. Three lives.',
    accent: '#e85d75',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Crumbtrail',
    slug: 'crumbtrail',
    description: 'Pellets with no way out. Climb forever. Don’t settle in.',
    how: 'Swipe or arrow keys to steer. The maze goes up forever: eat fresh crumbs to build a streak, pick your way around the sleeping chasers, and keep climbing — stop, and the tide rises. One life.',
    accent: '#3ed69b',
    playable: true,
  },
  {
    name: 'Bop',
    slug: 'bop',
    description: 'Five controls. One voice. Do what it says, faster.',
    how: 'The console calls a control — bop, twist, pull, flick or spin — and you have until the ring runs out to do it. Tap the button to bop; drag the knob sideways to twist, the lever down to pull, the switch up to flick, the wheel any way to spin. On a keyboard: space, left/right, down, up, S. Wrong control or too slow ends the run.',
    accent: '#e85d75',
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Putt',
    slug: 'putt',
    description: 'Nine holes of pinball golf. Drag to aim, three taps to hit.',
    how: 'Every hole is longer than the screen: the intro flies it from cup to tee, the view follows the ball, and the map in the corner shows the rest, so plan the route. Before a swing, drag or tap the map, scroll, or hold the up and down arrows to look along the hole; the swing brings the view back. Drag to aim; the guide only shows the first few feet and starts pointing straight up the hole, not at the cup. Then three taps: one starts the swing gauge, one takes the power where it is, and then the arrow wobbles either side of your line until the third tap strikes. On the line is pure; off it hooks or slices. The arrow keeps wobbling as long as you like, so you can wait for a windmill, and Cancel beside the gauge (or Escape) backs out of a swing to aim again. Walls bounce, sand drags, water costs a stroke and sends you back, windmills turn, pads push the ball along, pipes spit it out somewhere else, one cup slides, and a ball rolling too fast skips over the cup. Bumpers, kickers and drop targets pay pinball points, lanes pay once, and knocking a whole bank of targets down pays big. Par or better on consecutive holes builds a streak bonus. At par plus three the ball is picked up and the hole scores nothing. On a keyboard, arrows aim and Space taps.',
    accent: '#5cc46a',
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
  'crumbtrail',
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
