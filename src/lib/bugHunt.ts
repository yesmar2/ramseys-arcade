import {
  aboutHref,
  gameBoardHref,
  gameHref,
  homeHref,
  leaderboardHref,
  recordsHref,
  recordsIndexHref,
  termsHref,
  tournamentsHref,
} from '../hooks/useHashRoute'
import { AUTH_EVENT, getSessionToken } from './auth'
import { groupsIndexHref } from './groups'
import { api } from './leaderboard'
import { hashString, mulberry32 } from './seededRandom'

/*
 * The daily bug hunt. Every day one of Find the Bug's wanted bugs gets loose
 * on the site and hides somewhere on it: perched on a heading, peeking over a
 * panel, hanging off the footer, tucked into the menu or the small print.
 * Everyone gets the same bug in the same spot, picked from the date on the
 * boards' clock, and a new one gets loose at midnight there. A clue says
 * roughly where; a hint names the page. Catching one says what that corner of
 * the site is for, and fills in a collection of all twelve.
 *
 * Finds are kept on the device, and signed in, by the API too, so they
 * follow the player and today can say how many caught its bug.
 */

const TZ = 'America/New_York'
const STORE_KEY = 'skermix-bug-hunt'
export const HUNT_EVENT = 'skermix-bug-hunt'
/** Open the hunt's panel from anywhere: the home strip, the menu. */
export const HUNT_OPEN_EVENT = 'skermix-bug-hunt-open'
/** A bug was caught: the header shows the find. */
export const HUNT_CAUGHT_EVENT = 'skermix-bug-hunt-caught'

export function openBugHunt() {
  window.dispatchEvent(new Event(HUNT_OPEN_EVENT))
}

export type HuntBug = { id: string; name: string }

/** The wanted bugs, by the ids findbug/wanted.ts draws them with. */
export const HUNT_BUGS: readonly HuntBug[] = [
  { id: 'bug', name: 'the Bug' },
  { id: 'skip', name: 'Skip' },
  { id: 'dotty', name: 'Dotty' },
  { id: 'pickle', name: 'Pickle' },
  { id: 'tiger', name: 'Tiger' },
  { id: 'rosie', name: 'Rosie' },
  { id: 'ziggy', name: 'Ziggy' },
  { id: 'honey', name: 'Honey' },
  { id: 'buzz', name: 'Buzz' },
  { id: 'pip', name: 'Pip' },
  { id: 'hopper', name: 'Hopper' },
  { id: 'flutter', name: 'Flutter' },
]

/** A name at the start of a sentence: "The Bug", "Rosie". */
export function capitalName(bug: HuntBug): string {
  return bug.name.charAt(0).toUpperCase() + bug.name.slice(1)
}

/** How a bug sits in its spot: on a line, hanging under one, or peeking up from behind one. */
export type HuntPose = 'perch' | 'hang' | 'peek'

export type HuntSpot = {
  id: string
  /** The riddle. */
  clue: string
  /** The hint: the page it's on, and a way there. The menu is opened rather than gone to. */
  page: string
  href: () => string | null
  /** Once it's found: where it was, and what that corner of the site is for. */
  where: string
  lesson: string
}

const HUB_LESSON =
  'Every game has a page of its own: its board, its record book, the events it’s in and how to play.'

export const HUNT_SPOTS: readonly HuntSpot[] = [
  {
    id: 'home-onnow',
    clue: 'Where the front page says what’s on today.',
    page: 'the home page',
    href: () => homeHref(),
    where: 'on the home page, perched on the On now heading',
    lesson: 'On now is today’s daily, this week’s weekly and last week’s winners. Join one and your runs count toward it.',
  },
  {
    id: 'home-games',
    clue: 'On the wall where every game stands in a row.',
    page: 'the home page',
    href: () => homeHref(),
    where: 'on the home page, up on the wall of games',
    lesson: 'The wall has every game in the arcade. The chips above it sort them into arcade, puzzle, quick play and sport.',
  },
  {
    id: 'home-records',
    clue: 'Peeking over the arcade’s best runs, on the front page.',
    page: 'the home page',
    href: () => homeHref(),
    where: 'on the home page, peeking over the house records',
    lesson: 'House records are the best run ever on each game. Beat one and your tag goes up there.',
  },
  {
    id: 'home-groups',
    clue: 'Near the bottom of the front page, where it asks you to bring your people.',
    page: 'the home page',
    href: () => homeHref(),
    where: 'at the bottom of the home page, by groups',
    lesson: 'A group is a board of just the people you play with: family, friends, the office.',
  },
  {
    id: 'footer',
    clue: 'At the very bottom of a page, hanging off the line about games that load fast.',
    page: 'the bottom of any page',
    href: () => homeHref(),
    where: 'at the bottom of the page, hanging off the footer',
    lesson: 'The footer is a map of the whole site: games, boards, events, and the small print.',
  },
  {
    id: 'menu',
    clue: 'In your menu: top right, or the You tab on a phone.',
    page: 'your menu',
    href: () => null,
    where: 'in your menu',
    lesson: 'Your menu has your player card, stats, friends and groups, and the theme, the sounds and the music.',
  },
  {
    id: 'boards',
    clue: 'Where the whole arcade is ranked, week by week.',
    page: 'the Boards',
    href: () => leaderboardHref(),
    where: 'on the Boards',
    lesson: 'The boards rank everyone by points across every game. Switch to the month or all time at the top.',
  },
  {
    id: 'board-snake',
    clue: 'On the board for the game with the longest tail.',
    page: 'Snake’s board',
    href: () => gameBoardHref('snake'),
    where: 'on Snake’s board',
    lesson: 'Every game has a board of its own: each player’s best run this week, this month and all time.',
  },
  {
    id: 'records',
    clue: 'Where the fastest and the most get written down.',
    page: 'the Record books',
    href: () => recordsIndexHref(),
    where: 'in the Record books',
    lesson: 'Record books keep feats inside a game, like the fastest wave cleared or the longest chain.',
  },
  {
    id: 'book-asteroids',
    clue: 'In the book where every wave cleared is timed.',
    page: 'Asteroids’ record book',
    href: () => recordsHref('asteroids'),
    where: 'in Asteroids’ record book',
    lesson: 'Asteroids times every wave you clear, and each wave has a record of its own.',
  },
  {
    id: 'events',
    clue: 'Where friends race each other for a trophy.',
    page: 'Events',
    href: () => tournamentsHref(),
    where: 'on the Events page',
    lesson: 'Events are tournaments: a daily, a weekly, and ones you make for friends. The winner’s cup stays on their shelf.',
  },
  {
    id: 'groups',
    clue: 'Where you’d make a board for just your crew.',
    page: 'Groups',
    href: () => groupsIndexHref(),
    where: 'on the Groups page',
    lesson: 'Make a group, share its link, and everyone in it gets boards of their own.',
  },
  {
    id: 'about',
    clue: 'Where the arcade says what it is, and what it isn’t.',
    page: 'About',
    href: () => aboutHref(),
    where: 'on the About page',
    lesson: 'Original games, no ads, no install: About is the whole idea in one page.',
  },
  {
    id: 'terms',
    clue: 'In the small print, next to the rule about betting.',
    page: 'the Terms',
    href: () => termsHref(),
    where: 'in the Terms, by the rule about gambling',
    lesson: 'Nobody reads the small print, except you just now. Scores here are for glory only: no wagers, no prizes.',
  },
  {
    id: 'hub-findbug',
    clue: 'Back home, on its own game’s page.',
    page: 'Find the Bug’s page',
    href: () => gameHref('findbug'),
    where: 'back home, on Find the Bug’s page',
    lesson: 'Find the Bug is where these bugs live: spot the wanted one in a crowd, against the clock.',
  },
  {
    id: 'hub-fireflies',
    clue: 'On the page of the game where lanterns light the night.',
    page: 'Fireflies’ page',
    href: () => gameHref('fireflies'),
    where: 'on Fireflies’ page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-crosswalk',
    clue: 'On the page of the game where you hop across the road, forever.',
    page: 'Crosswalk’s page',
    href: () => gameHref('crosswalk'),
    where: 'on Crosswalk’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-centroid',
    clue: 'On the page of the game where plates balance on a pin.',
    page: 'Centroid’s page',
    href: () => gameHref('centroid'),
    where: 'on Centroid’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-frenzy',
    clue: 'On the page of the game where every fish has a number.',
    page: 'Frenzy’s page',
    href: () => gameHref('frenzy'),
    where: 'on Frenzy’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'howto-putt',
    clue: 'In the instructions for the game with a hole at the end.',
    page: 'Putt’s page',
    href: () => gameHref('putt'),
    where: 'in Putt’s how to play',
    lesson: 'Every game’s page ends with how to play: the goal, the controls, what scores, and what ends a run.',
  },
]

/* ------------------------------------------------------------- the day --- */

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** The day on the boards' clock, as YYYY-MM-DD. */
export function huntDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Days since the hunt's calendar starts, so each day has a number. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(2026, 0, 1)) / 86_400_000)
}

/** Until midnight on the boards' clock, when the next bug gets loose. */
export function msUntilNextBug(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

function shuffled<T>(list: readonly T[], key: string): T[] {
  const rand = mulberry32(hashString(key))
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export type HuntPick = {
  day: string
  bug: HuntBug
  spot: HuntSpot
  /** How it looks while it hides: napping or keeping an eye out. */
  mood: 'smile' | 'sleepy' | 'o'
}

/**
 * Today's bug and where it hides. The spots come round in a shuffled order,
 * every one before any comes again, and so do the bugs: a run of twelve days
 * meets all twelve.
 */
export function huntPick(day = huntDay()): HuntPick {
  const n = dayNumber(day)
  const spots = shuffled(HUNT_SPOTS, `spots:${Math.floor(n / HUNT_SPOTS.length)}`)
  const bugs = shuffled(HUNT_BUGS, `bugs:${Math.floor(n / HUNT_BUGS.length)}`)
  const moods = ['smile', 'smile', 'sleepy', 'o'] as const
  return {
    day,
    spot: devSpot() ?? spots[((n % spots.length) + spots.length) % spots.length]!,
    bug: bugs[((n % bugs.length) + bugs.length) % bugs.length]!,
    mood: moods[hashString(`mood:${day}`) % moods.length]!,
  }
}

/** On a dev server, `localStorage['skermix-bug-hunt-spot']` puts today's bug in any spot, to look at it there. */
function devSpot(): HuntSpot | null {
  if (!import.meta.env.DEV) return null
  try {
    const id = localStorage.getItem('skermix-bug-hunt-spot')
    return HUNT_SPOTS.find((s) => s.id === id) ?? null
  } catch {
    return null
  }
}

/* ---------------------------------------------------------- your finds --- */

export type HuntFind = { bug: string; spot: string; at: number }

type HuntLog = { found: Record<string, HuntFind> }

function readLog(): HuntLog {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<HuntLog>) : null
    if (parsed && typeof parsed.found === 'object' && parsed.found) return { found: parsed.found }
  } catch {
    // Private windows and full storage: the hunt still runs, it just forgets.
  }
  return { found: {} }
}

function saveLog(next: HuntLog) {
  log = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    // Kept for this visit, anyway.
  }
}

let log: HuntLog | null = null

export function huntLog(): HuntLog {
  if (!log) log = readLog()
  return log
}

/* -------------------------------------------------------- the server --- */

/*
 * Signed in, finds are kept by the API too: they follow the player to any
 * device, and the finds this device made before signing in go up to join
 * them. Anyone can see how many caught today's bug; a player learns where
 * their find came in.
 */

type ServerFind = HuntFind & { day: string }
type ServerHunt = { day: string; count: number; you?: { finds: ServerFind[]; place: number | null } }

export type HuntServer = {
  /** How many players caught this day's bug, once the API has said. */
  count: number | null
  /** Where your find came in today: 1 for the first. */
  place: number | null
  /** The day those are for. */
  day: string | null
}

let server: HuntServer = { count: null, place: null, day: null }

/** Everything the page shows, as one value that changes when any of it does. */
export type HuntSnapshot = { log: HuntLog; server: HuntServer }

let snapshot: HuntSnapshot | null = null

export function huntSnapshot(): HuntSnapshot {
  if (!snapshot || snapshot.log !== huntLog() || snapshot.server !== server) snapshot = { log: huntLog(), server }
  return snapshot
}

function emit() {
  window.dispatchEvent(new Event(HUNT_EVENT))
}

/** Take what the API said: the count, your place, and any finds from your other devices. */
function apply(reply: ServerHunt) {
  const place = reply.you ? reply.you.place : null
  server = { count: reply.count, place, day: reply.day }
  if (reply.you) {
    const found = { ...huntLog().found }
    let added = false
    for (const f of reply.you.finds) {
      if (found[f.day]) continue
      found[f.day] = { bug: f.bug, spot: f.spot, at: f.at }
      added = true
    }
    if (added) saveLog({ found })
  }
  emit()
}

const SYNC_EVERY_MS = 60_000
let syncedAt = 0
let syncing: Promise<void> | null = null

/**
 * Ask the API how today stands, and signed in, send up the finds it doesn't
 * have yet. Pages call this freely: it goes out once a minute at most.
 */
export function syncHunt(force = false): Promise<void> {
  if (syncing) return syncing
  if (!force && Date.now() - syncedAt < SYNC_EVERY_MS) return Promise.resolve()
  syncedAt = Date.now()
  syncing = (async () => {
    try {
      const reply = await api<ServerHunt>('/hunt')
      apply(reply)
      if (!reply.you) return
      const kept = new Set(reply.you.finds.map((f) => f.day))
      const missing = Object.entries(huntLog().found)
        .filter(([day]) => !kept.has(day))
        .map(([day, f]) => ({ day, bug: f.bug, spot: f.spot, at: f.at }))
        .slice(-400)
      if (missing.length) apply(await api<ServerHunt>('/hunt/finds', { method: 'POST', body: JSON.stringify({ finds: missing }) }))
    } catch {
      // The hunt runs without the API; it catches up next time.
    }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

/** Record today's find. False when it was already caught today. */
export function recordFind(pick: HuntPick, now = Date.now()): boolean {
  const current = huntLog()
  if (current.found[pick.day]) return false
  saveLog({ found: { ...current.found, [pick.day]: { bug: pick.bug.id, spot: pick.spot.id, at: now } } })
  emit()
  if (getSessionToken()) {
    const find = { day: pick.day, bug: pick.bug.id, spot: pick.spot.id }
    void api<ServerHunt>('/hunt/finds', { method: 'POST', body: JSON.stringify({ finds: [find] }) })
      .then(apply)
      .catch(() => {
        // Sent again with the backlog next time.
      })
  } else {
    void syncHunt(true)
  }
  return true
}

export type HuntStats = {
  /** Today's bug is caught. */
  foundToday: boolean
  /** Days in a row, counting today if it's found, or up to yesterday while today's is still loose. */
  streak: number
  total: number
  /** Which of the twelve have been caught at least once. */
  caught: ReadonlySet<string>
}

export function huntStats(day = huntDay(), current = huntLog()): HuntStats {
  const days = new Set(Object.keys(current.found).map(dayNumber))
  const today = dayNumber(day)
  const foundToday = days.has(today)
  let streak = 0
  for (let d = foundToday ? today : today - 1; days.has(d); d--) streak++
  return {
    foundToday,
    streak,
    total: days.size,
    caught: new Set(Object.values(current.found).map((f) => f.bug)),
  }
}

/** Listen for finds made in this tab or another one, and for what the API says. */
export function subscribeHunt(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE_KEY) return
    log = readLog()
    onChange()
  }
  // Signing in or out: the finds to show, and whose, have changed.
  const onAuth = () => {
    server = { count: server.count, place: null, day: server.day }
    void syncHunt(true)
  }
  window.addEventListener(HUNT_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  window.addEventListener(AUTH_EVENT, onAuth)
  return () => {
    window.removeEventListener(HUNT_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(AUTH_EVENT, onAuth)
  }
}
