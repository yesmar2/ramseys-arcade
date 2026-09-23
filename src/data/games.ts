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
    how: 'Move to aim, click or tap to shoot, and hold the six cities through each wave. Each turret carries ten shells and only refills between waves. Every missile you destroy goes off in a blast of its own, and each kill in a chain pays more than the last — so one shot placed where the trails cross can be worth a whole volley. A hit dead on the missile scores more again. The marks on the ground show where each missile will land. Violet ones split halfway down. Planes and, later, bombers cross the sky dropping more; the bomber takes several blasts and the wave will not end while it lives. Supply blimps carry powers, painted on their sides, and you collect one by blowing it up, which costs a shell: ammo, a one-hit dome over every city, a slow-motion sky, and a seeker that finds the nearest missile itself. Keys 1–4 use them, or tap their badges down the left.',
    accent: PALETTE.red,
    playable: true,
  },
  {
    name: 'Snake',
    slug: 'snake',
    tags: ['arcade', 'quick'],
    description: 'Grow longer. Beat the board. Don’t crash.',
    how: 'Swipe, use the arrow keys, or the turn buttons on a phone. Eat fruit to grow, and reach each one before its ring closes to build a chain — every link makes the next fruit worth more. Golden apples don’t wait long, and the mouse runs: cut it off with your own body. Don’t hit the walls, the stones or yourself. Hold space or the bolt to boost.',
    accent: PALETTE.green,
    playable: true,
  },
  {
    name: 'Crosswalk',
    slug: 'crosswalk',
    tags: ['arcade'],
    description: 'Hop forever. Beat your distance.',
    how: 'Swipe or tap to hop, or use the arrow keys. Cross the road, the river and the rails — one mistake ends the run, and so does letting the clock run out without reaching a new row. Rows taken back to back build a chain, which is a record of its own.',
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
    description: 'Pop the bubbles before they fade. Center hits score more.',
    how: 'Bubbles blow up all over the field and drift. Tap them before they fade — the ring round each one is the time it has left. The bright core in the middle pays the most, gold pays more again, and popping them back to back builds a streak bonus that a bubble let go takes away.',
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
    how: 'Swipe or arrow keys to steer. Clear the maze: fresh crumbs build a streak that multiplies every crumb, doubling back over eaten ground breaks it, and a hundred in a row sends every chaser running. Power pips turn the chasers blue for eating, fruit turns up under the den twice a maze, and a full charge lets you Surge through them. Three lives.',
    accent: PALETTE.orange,
    playable: true,
  },
  {
    name: 'Find the Bug',
    slug: 'findbug',
    tags: ['puzzle'],
    description: 'Five crowded scenes. One Bug in each. Beat the clock.',
    how: 'Every scene is packed with bugs, and one of them is the Bug: red and white stripes, a red bobble hat, round glasses. Plenty of them have one or two of those — only he has all three. Tap him to move on. Pinch or scroll to zoom and drag to look around; on a keyboard, arrows steer a cursor, space taps and plus and minus zoom. A wrong tap leaves you dazed for a moment, and a scene that runs a full minute shows you where he was. Fastest total time wins.',
    accent: PALETTE.teal,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    tags: ['arcade'],
    description: 'Rows of ships. One cannon. Hold the line.',
    how: 'Arrow keys or A and D move the cannon, space fires; on a phone, drag on the field or use the left pads to move, and hold Fire. The fleet fires in volleys: the ships about to shoot light up and their lanes show where the shots will land. Get into a cold lane, or destroy a lit ship before it fires to stop its shot. Kills in quick succession build a chain that multiplies your points. There is no cover, and a ship that reaches the line ends the run. Three lives.',
    accent: PALETTE.red,
    playable: true,
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
    how: 'The toy calls a control on its screen — bop, twist, pull, flick or spin — and you have until the light round its rim runs out to do it. Tap the button to bop; drag the knob sideways to twist, the lever down to pull, the switch up to flick, the wheel any way to spin. On a keyboard: space, left/right, down, up, S. Wrong control or too slow ends the run.',
    accent: PALETTE.pink,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Putt',
    slug: 'putt',
    tags: ['sport'],
    description: 'Five long holes of mini golf, each in a place of its own. Pull back, let go, and find the line.',
    how: 'Five long holes, each somewhere of its own: a garden with a windmill and a creek, a formal garden round a fountain, a castle, a beach out to a lighthouse, and a mountain. Every hole is longer than the screen: the intro flies it from cup to tee, the view follows the ball, and the map in the corner shows the rest, so plan the route. Before a swing, drag or tap the map, scroll, or hold the up and down arrows to look along the hole; the swing brings the view back. Pull back from the ball and let go to shoot: the further you pull, the harder it goes, and the guide grows with the pull. Pull back to the ball to change your mind. The rails are wherever the green ends. Sand drags; water costs a stroke and sends you back, and so does rolling over an edge; a bridge is the dry way over. Some things keep time: a windmill’s sails shut its doors as they pass, a drawbridge and a portcullis rise and fall, and a sandbar is only dry while the tide is out. A ramp flies the ball if it is hit hard and straight; soft or crooked, it rolls off the end. A drain and a cave take the ball somewhere else. Slopes lean a rolling ball, steps and ridges send a timid one back down, a plaza dishes into its fountain, a wind off the sea pushes toward the water, and the last cup sits on a crown that rolls a ball off it. Crabs scuttle, a beam swings round, boulders and planters stand where they are, and a ball rolling too fast skips over the cup. The score is golf: par pays 200, a birdie 300, a bogey 100, an ace extra. On a keyboard, arrows aim and holding Space charges the shot; let go to hit.',
    accent: PALETTE.green,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Frenzy',
    slug: 'frenzy',
    tags: ['arcade'],
    description: 'Every fish has a number. Eat your level or below. Anything higher eats you.',
    how: 'Move the cursor, or drag a finger, to swim — arrow keys or WASD work too. Click, tap or press Space to dash; a dash slips you past a bite. Green numbers are food: eat them to grow. Red numbers eat you, and they flash ! before they lunge. The deeper you swim, the more every bite pays — ×2, ×3, then ×5 — but the deep brings jellyfish that stun and mines that blow up everything near them. Eat in quick succession for a combo; eight in a row sets off a Frenzy. One life.',
    accent: PALETTE.magenta,
    playable: true,
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
  /*
   * The best-looking first, so the wall opens on the games at their best.
   *
   * The wall keeps two tiles of one colour from sharing an edge at every width
   * it lays out (GameWall), and three pairs share a colour: Crumbtrail and
   * Snake, Stacker and Centroid, Barrage and Patriot. That needs the two of a
   * pair seven places apart, so one of each opens the wall and its partner
   * closes it. Any order that breaks this is reshuffled until it doesn't, and
   * the reshuffle does not care which games were meant to lead.
   */
  'frenzy',
  'pellets',
  'crumbtrail',
  'stacker',
  'barrage',
  'asteroids',
  'crosswalk',
  'pop',
  'simon',
  'snake',
  'centroid',
  'patriot',
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
