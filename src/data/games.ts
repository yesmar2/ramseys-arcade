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
  /**
   * A new game's launch day, YYYY-MM-DD: everyone's from then. Plus members play it the week before, as
   * practice; admins any time; anyone else finds a card saying when (components/EarlyGate.tsx). Its boards
   * open to all on launch day, so Plus buys no head start on them (lib/earlyAccess.ts). The API's
   * LAUNCH_DAYS (earlyAccess.ts) says the same. For a game whose runs end on the run report (ScoreSaveCard).
   */
  launchDay?: string
  /** If set, the game is only offered on these devices. */
  devices?: DeviceType[]
  /**
   * A daily: something new to play each day, the same for everyone, so a run is weighed only against its
   * day's. Its board for today is the day's runs; for a week, a month or all time, the API adds up what
   * each day's board paid by place (DAILY_GAMES and dayPointsBoard there), and the site prints those in
   * points (leaderboardFormat isDayPointsBoard). Anything that wants a daily's best run reads today's board.
   */
  daily?: boolean
  /**
   * False for a daily that's just for fun (Ace Chase, Find the Bug and Half Full, since 2026-09-30): its
   * answer is the same for everyone and a friend can hand it over, so it places nobody. It has no boards, no
   * points in the standings and no record book; a player keeps their own result, their days, the Dailies
   * punch and the share. Hot Lap and Marble Run, where hands decide, are ranked. The API's UNRANKED_GAMES
   * says the same.
   */
  ranked?: false
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
    description: 'Six new plates every day, the same for everyone. Tap where each one would balance: the closer to its true center, the higher your score. Your first go is your result.',
    accent: PALETTE.sky,
    playable: true,
    // A daily since 2026-10-06, as Ramsey asked ("centroid should be a daily like the fill the cup game"):
    // just for fun, with the puzzles under the Dailies ticket ("Also today").
    daily: true,
    ranked: false,
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
    ranked: false,
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
    description: 'Five holes of mini golf: jump a hedge, bank into three pipes, time a windmill, make a loop, and sink it in a volcano. Pull back, let go, and find the line.',
    accent: PALETTE.green,
    playable: true,
    inDevelopment: true,
  },
  {
    name: 'Frenzy',
    slug: 'frenzy',
    tags: ['arcade'],
    description: 'Eat smaller fish and grow from Fry to Leviathan across an open ocean. Leap out of the water, and watch for the shark and the fisherman’s hook.',
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
    description: 'A new hole every day, the same for everyone, in 3D. Pick your spot on the tee, aim, and swing to stop the ball dead on the bullseye: every try counts, and your first bullseye is your result.',
    accent: PALETTE.teal,
    playable: true,
    inDevelopment: true,
    daily: true,
    ranked: false,
    // Held back (Ramsey, 2026-10-06: "let's hide it for now"), after the swing in a026bf4 didn't land either.
    // Off every listing and off Also today; its pages still play by address. The API's ON_DECK_GAMES too.
    onDeck: true,
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
    ranked: false,
  },
  {
    name: 'Marble Run',
    slug: 'marblerun',
    tags: ['arcade', 'quick'],
    description: 'A new course every day, the same for everyone, in 3D. Tilt the world to roll a marble down it against the clock: fall off and you’re back at the last checkpoint. Beat the blue ball.',
    accent: PALETTE.magenta,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Lander',
    slug: 'lander',
    tags: ['arcade', 'quick'],
    description: 'A new cave every day, the same for everyone. Fly the ship down it and set it down on the pad at the bottom against the clock: bump the rock and you bounce off, hit it hard and you’re back at the last gate. Beat the blue ship.',
    accent: PALETTE.violet,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Pileup',
    slug: 'pileup',
    tags: ['puzzle', 'arcade'],
    description: 'Fill a row to clear it. Shake the gaps out.',
    accent: PALETTE.pink,
    playable: true,
  },
  {
    name: 'Swoop',
    slug: 'swoop',
    tags: ['arcade', 'quick'],
    description:
      'New hills every day, the same for everyone. Hold to dive down the slopes and let go to fly off the tops: land along the far side of a hill to keep your speed, into the next one and you lose it. Beat the blue bird.',
    accent: PALETTE.red,
    playable: true,
    inDevelopment: true,
    daily: true,
  },
  {
    name: 'Wobble Run',
    slug: 'wobblerun',
    tags: ['arcade', 'quick'],
    description:
      'A new gauntlet every day, the same for everyone, in 3D. Run, jump and dive Blip past doors, hammers, tippy planks and crumbling tiles to the star against the clock: fall in the soda sea and you’re back at the last checkpoint. Beat the blue blip.',
    accent: PALETTE.pink,
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

/** Whether a game's results place its players: every game but the dailies just for fun (see Game.ranked). */
export function isRankedGame(slug: string) {
  return getGame(slug)?.ranked !== false
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
  'pileup',
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

/**
 * The games on the home page's wall, and on each game page's shelf: every one but the dailies, which have
 * a place of their own: today's row above the wall, and the Today page it leads to.
 */
export function wallGames(device: DeviceType) {
  return homeGames(device).filter((g) => !g.daily)
}

export function deviceRequirementLabel(game: Game) {
  if (!game.devices?.length) return null
  return `${game.name} plays on ${formatDeviceList(game.devices)}.`
}
