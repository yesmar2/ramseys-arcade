import type { DeviceType } from '../lib/device'
import { formatDeviceList } from '../lib/device'

/** What kind of game it is, for the home page's tabs. */
export type GameTag = 'arcade' | 'puzzle' | 'quick' | 'sport'

/** The kind of game, as the home page names it. */
export const TAG_LABELS: Record<GameTag, string> = {
  arcade: 'Arcade',
  puzzle: 'Puzzle',
  quick: 'Quick play',
  sport: 'Sport',
}

/**
 * The ten colours a game can be. Every game picks one, so the wall, the hub
 * pages, the event cards and the boards all agree, and a hundred games would
 * still draw from the same ten. One band of saturation and lightness, so they
 * read as a set on the dark ground and hold white text on the wall.
 */
export const PALETTE = {
  amber: '#f5b942',
  orange: '#f2813a',
  red: '#e8564f',
  pink: '#e85d9a',
  violet: '#8a6ad4',
  indigo: '#6b74e8',
  sky: '#4aa8e8',
  teal: '#3ec8cf',
  green: '#3ecf8e',
  magenta: '#c65bd9',
} as const

export type Swatch = keyof typeof PALETTE

export type Game = {
  name: string
  slug: string
  description: string
  /** One of the PALETTE swatches. */
  accent: string
  /** One-line how to play, shown on the game page. */
  how: string
  playable?: boolean
  tags?: GameTag[]
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
    tags: ['arcade'],
    description: 'Spin, thrust, clear the rocks. Chain hits for more.',
    how: 'Arrow keys or WASD to turn and thrust. Space fires. Break rocks into smaller ones without getting hit.',
    accent: PALETTE.indigo,
    playable: true,
  },
  {
    name: 'Patriot',
    slug: 'patriot',
    tags: ['arcade'],
    description: 'Defend the cities. Aim. Fire. Survive the wave.',
    how: 'Move to aim. Click or tap to shoot. Protect the cities through each wave. Keys 1–4 use powers.',
    accent: PALETTE.red,
    playable: true,
  },
  {
    name: 'Snake',
    slug: 'snake',
    tags: ['arcade', 'quick'],
    description: 'Grow longer. Beat the board. Don’t crash.',
    how: 'Swipe or use arrow keys. Eat, grow, and don’t hit the walls or yourself. Food is worth more the sooner you reach it — the ring around it is the bonus draining away, so the safe loop and the tight line past your own tail are never worth the same. Hold space or the bolt to boost: 1.75× speed, and it costs you nothing but the risk of going that fast. The tank holds four seconds and every food is worth one and a half, so eating buys the speed that catches the next one while its ring is still full. Every ten food the board changes: barriers arrive from level two and build to level six, after which the shapes come round again rather than closing in any further.',
    accent: PALETTE.green,
    playable: true,
  },
  {
    name: 'Crosswalk',
    slug: 'crosswalk',
    tags: ['arcade'],
    description: 'Hop forever. Beat your distance.',
    how: 'Swipe or tap to hop. Dodge traffic, ride the logs, hop the stones, and beat the train. Don’t linger — the hawk is watching. Score is how far you get, one point per row, and your record is marked on the road ahead.',
    accent: PALETTE.amber,
    playable: true,
  },
  {
    name: 'Stacker',
    slug: 'stacker',
    tags: ['quick', 'puzzle'],
    description: 'Time the drop. Stack higher. Don’t miss.',
    how: 'Tap or press space to drop the block. Land it on the stack — miss and the round is over.',
    accent: PALETTE.sky,
    playable: true,
  },
  {
    name: 'Centroid',
    slug: 'centroid',
    tags: ['puzzle', 'quick'],
    description: 'Find the shape’s true center. Closer scores more.',
    how: 'Tap where you think the center is. Closer scores more. Ten shapes, five seconds each.',
    accent: PALETTE.sky,
    playable: true,
  },
  {
    name: 'Pop',
    slug: 'pop',
    tags: ['quick', 'arcade'],
    description: 'Tap the circles before they fade. Center hits score more.',
    how: 'Tap circles before they fade. Hits closer to the center score more.',
    accent: PALETTE.teal,
    playable: true,
  },
  {
    name: 'Simon',
    slug: 'simon',
    tags: ['puzzle', 'quick'],
    description: 'Watch the pattern. Repeat it. Don’t miss.',
    how: 'Watch the pads light up, then tap the same pattern. Each round adds a step.',
    accent: PALETTE.violet,
    playable: true,
  },
  {
    name: 'Spotter',
    slug: 'spotter',
    tags: ['puzzle'],
    description: 'Find the wrong tile. A new hunt every day.',
    how: 'Every day, one game on the wall isn’t right. Tap the glitch. Fewer wrong taps and faster finds rank higher.',
    accent: PALETTE.indigo,
    playable: false,
    hidden: true,
  },
  {
    name: 'Pellets',
    slug: 'pellets',
    tags: ['arcade'],
    description: 'Clear the maze. Bank a streak. Surge.',
    how: 'Swipe or arrow keys to steer. Clear the maze: fresh crumbs build a streak, doubling back breaks it, and a full charge lets you Surge through the chasers. Three lives.',
    accent: PALETTE.orange,
    playable: true,
  },
  {
    name: 'Find the Bug',
    slug: 'findbug',
    tags: ['puzzle'],
    description: 'Something is hiding in the arcade. Find it before the clock does.',
    how: 'Five scenes, one bug hiding in each. Tap it to swat, or move the reticle with the arrow keys and swat with space. It never moves — it just gets smaller and better hidden each scene. Fastest total time wins.',
    accent: PALETTE.teal,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    tags: ['arcade'],
    description: 'Rows of ships. One cannon. Hold the line.',
    how: 'Arrow keys or the thumb pads move the cannon; space or the up pad fires. The fleet fires in volleys and lights up the lanes it will hit first — read them, get into a cold one, and clear rows in the quiet between. There is no cover. Three lives.',
    accent: PALETTE.red,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Crumbtrail',
    slug: 'crumbtrail',
    tags: ['arcade'],
    description: 'Pellets with no way out. Climb forever. Don’t settle in.',
    how: 'Swipe or arrow keys to steer. The maze goes up forever: eat fresh crumbs to build a streak, pick your way around the sleeping chasers, and keep climbing — stop, and the tide rises. One life.',
    accent: PALETTE.green,
    playable: true,
  },
  {
    name: 'Bop',
    slug: 'bop',
    tags: ['quick', 'arcade'],
    description: 'Five controls. One voice. Do what it says, faster.',
    how: 'The console calls a control — bop, twist, pull, flick or spin — and you have until the ring runs out to do it. Tap the button to bop; drag the knob sideways to twist, the lever down to pull, the switch up to flick, the wheel any way to spin. On a keyboard: space, left/right, down, up, S. Wrong control or too slow ends the run.',
    accent: PALETTE.pink,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Putt',
    slug: 'putt',
    tags: ['sport'],
    description: 'Five holes of mini golf, none of them the usual kind. Pull back, let go, and find the line.',
    how: 'Every hole is longer than the screen: the intro flies it from cup to tee, the view follows the ball, and the map in the corner shows the rest, so plan the route. Before a swing, drag or tap the map, scroll, or hold the up and down arrows to look along the hole; the swing brings the view back. Pull back from the ball and let go to shoot: the further you pull, the harder it goes, and the guide grows with the pull. Pull back to the ball to change your mind. Holes bend and loop, and the walls are wherever the ground ends. Sand drags, water costs a stroke and sends you back, a bridge is the dry way over it and a drawbridge is only down some of the time, hills push the ball back down unless you hit it firmly, bowls pull it to their middle, a hilltop green rolls it away from the cup, a spinning floor carries it round, windmills turn, sliders sweep across, flaps let you through one way and never back, ramps fly the ball over whatever is in the way if it is going fast enough, pipes spit it out somewhere else, one cup slides, and a ball rolling too fast skips over the cup. Bumpers pop the ball away, and a rover is a loose ball that roams its pen; time your shot around it or bounce off it. The score is golf: par pays 200, a birdie 300, a bogey 100, an ace extra. On a keyboard, arrows aim and holding Space charges the shot; let go to hit.',
    accent: PALETTE.green,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Frenzy',
    slug: 'frenzy',
    tags: ['arcade'],
    description: 'Every fish has a number. Eat your level or below. Anything higher eats you.',
    how: 'Move the cursor, or drag a finger, to swim — the fish points and swims that way. Arrow keys or WASD work too. Every fish carries a number: eat one at your level or below to grow, more for one close to your own. A higher number is a killer, and mines don’t care what your number is. The camera pulls back as you grow, so the ocean gets bigger with you. One life.',
    accent: PALETTE.magenta,
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
