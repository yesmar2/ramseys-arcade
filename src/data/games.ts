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
  playable?: boolean
  tags?: GameTag[]
  /** Home tile only — not a real game yet. */
  comingSoon?: boolean
  /** On the grid, but not ready to play. */
  inDevelopment?: boolean
  /** Hidden from home, boards, and nav — code kept for later. */
  hidden?: boolean
  /**
   * On deck: finished, and held back to be released after launch, one at a
   * time. Listed nowhere (see isListedGame), but its own pages still play, by
   * address and in an event already running with it. Take the flag off the day
   * it's released, and take it off the API's ON_DECK_GAMES with it.
   */
  onDeck?: boolean
  /** If set, the game is only offered on these devices. */
  devices?: DeviceType[]
  /**
   * A daily: something new to play each day, the same for everyone, so a run is weighed only against its
   * day's. Its board for today is the day's runs; for a week, a month or all time, the API adds up what
   * each day's board paid by place (DAILY_GAMES and dayPointsBoard there), and the site prints those in
   * points (leaderboardFormat isDayPointsBoard). Anything that wants a daily's best run reads today's board.
   */
  daily?: boolean
}

export const games: Game[] = [
  {
    name: 'Asteroids',
    slug: 'asteroids',
    tags: ['arcade'],
    description: 'Spin, thrust, clear the rocks. Chain hits for more.',
    accent: PALETTE.indigo,
    playable: true,
  },
  {
    name: 'Patriot',
    slug: 'patriot',
    tags: ['arcade'],
    description: 'Defend the cities. Aim. Fire. Survive the wave.',
    accent: PALETTE.red,
    playable: true,
  },
  {
    name: 'Snake',
    slug: 'snake',
    tags: ['arcade', 'quick'],
    description: 'Grow longer. Beat the board. Don’t crash.',
    accent: PALETTE.green,
    playable: true,
  },
  {
    name: 'Crosswalk',
    slug: 'crosswalk',
    tags: ['arcade'],
    description: 'Hop forever. Beat your distance.',
    accent: PALETTE.amber,
    playable: true,
  },
  {
    name: 'Stacker',
    slug: 'stacker',
    tags: ['quick', 'puzzle'],
    description: 'Time the drop. Stack higher. Don’t miss.',
    accent: PALETTE.sky,
    playable: true,
  },
  {
    name: 'Centroid',
    slug: 'centroid',
    tags: ['puzzle', 'quick'],
    description: 'Balance each plate on a pin. Find its true center, or watch it tip.',
    accent: PALETTE.sky,
    playable: true,
  },
  {
    name: 'Pop',
    slug: 'pop',
    tags: ['quick', 'arcade'],
    description: 'Pop the bubbles before they fade. Center hits score more.',
    accent: PALETTE.teal,
    playable: true,
  },
  {
    name: 'Simon',
    slug: 'simon',
    tags: ['puzzle', 'quick'],
    description: 'Watch the pattern. Repeat it. Don’t miss.',
    accent: PALETTE.violet,
    playable: true,
    // Fireflies took its place; its scores stay on the books, and an event already running with it plays on.
    hidden: true,
  },
  {
    name: 'Spotter',
    slug: 'spotter',
    tags: ['puzzle'],
    description: 'Find the wrong tile. A new hunt every day.',
    accent: PALETTE.indigo,
    playable: false,
    hidden: true,
  },
  {
    name: 'Pellets',
    slug: 'pellets',
    tags: ['arcade'],
    description: 'Clear the maze. Bank a streak. Surge.',
    accent: PALETTE.orange,
    playable: true,
  },
  {
    name: 'Find the Bug',
    slug: 'findbug',
    tags: ['puzzle'],
    description: 'Five new crowded scenes every day, the same for everyone, with a bug wanted in each. Find them fast: your first run is your result.',
    accent: PALETTE.teal,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Barrage',
    slug: 'barrage',
    tags: ['arcade'],
    description: 'Thread a tiny ship through curtains of bullets. Graze them, then turn them into stars.',
    accent: PALETTE.red,
    playable: true,
  },
  {
    name: 'Crumbtrail',
    slug: 'crumbtrail',
    tags: ['arcade'],
    description: 'Pellets with no way out. Climb forever. Don’t settle in.',
    accent: PALETTE.green,
    playable: true,
  },
  {
    name: 'Bop',
    slug: 'bop',
    tags: ['quick', 'arcade'],
    description: 'Five controls. One voice. Do what it says, faster.',
    accent: PALETTE.pink,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Putt',
    slug: 'putt',
    tags: ['sport'],
    description: 'Seven holes of mini golf: a jump over a lily pond, a bank shot into three pipes, then five long holes, each in a place of its own. Pull back, let go, and find the line.',
    accent: PALETTE.green,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Frenzy',
    slug: 'frenzy',
    tags: ['arcade'],
    description: 'Every fish has a number. Eat your level or below. Anything higher eats you.',
    accent: PALETTE.magenta,
    playable: true,
  },
  {
    name: 'Fireflies',
    slug: 'fireflies',
    tags: ['puzzle', 'quick'],
    description: 'Sing their tunes back. Catch them lit. Follow the gold one.',
    accent: PALETTE.violet,
    playable: true,
  },
  {
    name: 'Ace Chase',
    slug: 'acechase',
    tags: ['sport'],
    description: 'A new hole every day, the same for everyone, in 3D. Dial in the power and the angle and stop the ball dead on the bullseye: every try counts, and your first bullseye is your result.',
    accent: PALETTE.teal,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Hot Lap',
    slug: 'hotlap',
    tags: ['sport', 'quick'],
    description: 'A new track every day, the same for everyone: one lap against the clock in 3D. Brake before the corners, get back on the gas, beat the blue car.',
    accent: PALETTE.orange,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Half Full',
    slug: 'halffull',
    tags: ['quick', 'puzzle'],
    description: 'Five new glasses every day, the same for everyone. Pour each exactly half full, by what it holds, not how tall it is: your first pour is your result.',
    accent: PALETTE.amber,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
]

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug)
}

/** Whether a game's board is the day's: see Game.daily. */
export function isDailyGame(slug: string) {
  return getGame(slug)?.daily === true
}

export function isGameHidden(slug: string) {
  return getGame(slug)?.hidden === true
}

/**
 * Whether a game shows anywhere a visitor browses: the home wall, search, the
 * boards, the record books, the sitemap, new events. A hidden game (retired)
 * doesn't, and nor does one on deck (held back for a release), though an
 * on-deck game's own pages still play.
 */
export function isListedGame(game: Pick<Game, 'hidden' | 'onDeck'>): boolean {
  return !game.hidden && !game.onDeck
}

export function isGameListed(slug: string): boolean {
  const game = getGame(slug)
  return Boolean(game && isListedGame(game))
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
  'fireflies',
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
      (g) => isListedGame(g) && (g.comingSoon || g.inDevelopment || gamePlayableOn(g, device)),
    )
    .sort((a, b) => homeRank(a) - homeRank(b))
}

export function deviceRequirementLabel(game: Game) {
  if (!game.devices?.length) return null
  return `${game.name} plays on ${formatDeviceList(game.devices)}.`
}
