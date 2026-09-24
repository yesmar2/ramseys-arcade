import { AUTH_EVENT, getSessionToken } from './auth'
import {
  HUNT_BUGS,
  SET_SIZE,
  bugForDay,
  dayNumber,
  setEnds,
  setKeyFor,
  setMonth,
  setStartsEarly,
  shuffled,
  type HuntBug,
} from './bugHuntPick'
import { api } from './leaderboard'
import { hashString } from './seededRandom'

export { HUNT_BUGS, SET_SIZE, setMonth, type HuntBug }

/*
 * The daily bug hunt. Every day one of Find the Bug's wanted bugs gets loose
 * on the site and hides somewhere on it: perched on a heading, peeking over a
 * panel, hanging off the footer, tucked into the menu or the small print.
 * Everyone gets the same bug in the same spot, picked from the date on the
 * boards' clock, and a new one gets loose at midnight there. A clue says
 * roughly where; a hint names the page. Catching one says what that corner of
 * the site is for, and fills in the month's set of all twelve: the set empties
 * on the 1st, and one caught in full puts a trophy on the player's shelf. The
 * hint names the page but gives no link: finding the way there is the point.
 *
 * Finds are kept on the device, and signed in, by the API too, so they
 * follow the player and today can say how many caught its bug. Only the API
 * decides what counts toward a set: a find it heard about on its own day, for
 * that day's bug.
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
  /** The hint: the page it's on, to end "It's somewhere…": "on the Boards". */
  page: string
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
    page: 'on the home page',
    where: 'on the home page, perched on the On now heading',
    lesson: 'On now is today’s daily, this week’s weekly and last week’s winners. Join one and your runs count toward it.',
  },
  {
    id: 'home-games',
    clue: 'On the wall where every game stands in a row.',
    page: 'on the home page',
    where: 'on the home page, up on the wall of games',
    lesson: 'The wall has every game in the arcade. The chips above it sort them into arcade, puzzle, quick play and sport.',
  },
  {
    id: 'home-records',
    clue: 'Peeking over the arcade’s best runs, on the front page.',
    page: 'on the home page',
    where: 'on the home page, peeking over the house records',
    lesson: 'House records are the best run ever on each game. Beat one and your tag goes up there.',
  },
  {
    id: 'home-groups',
    clue: 'Near the bottom of the front page, where it asks you to bring your people.',
    page: 'on the home page',
    where: 'at the bottom of the home page, by groups',
    lesson: 'A group is a board of just the people you play with: family, friends, the office.',
  },
  {
    id: 'footer',
    clue: 'Where every page ends, hanging on by a thread.',
    page: 'at the bottom of any page',
    where: 'at the bottom of the page, hanging off the footer',
    lesson: 'The footer is a map of the whole site: games, boards, events, and the small print.',
  },
  {
    id: 'menu',
    clue: 'Where your card, your friends and your sounds are kept.',
    page: 'in your menu, top right (the You tab on a phone)',
    where: 'in your menu',
    lesson: 'Your menu has your player card, stats, friends and groups, and the theme, the sounds and the music.',
  },
  {
    id: 'boards',
    clue: 'Where the whole arcade is ranked, week by week.',
    page: 'on the Boards',
    where: 'on the Boards',
    lesson: 'The boards rank everyone by points across every game. Switch to the month or all time at the top.',
  },
  {
    id: 'board-snake',
    clue: 'On the board for the game with the longest tail.',
    page: 'on Snake’s board',
    where: 'on Snake’s board',
    lesson: 'Every game has a board of its own: each player’s best run this week, this month and all time.',
  },
  {
    id: 'records',
    clue: 'Where the fastest and the most get written down.',
    page: 'in the Record books',
    where: 'in the Record books',
    lesson: 'Record books keep feats inside a game, like the fastest wave cleared or the longest chain.',
  },
  {
    id: 'book-asteroids',
    clue: 'In the book where every wave cleared is timed.',
    page: 'in Asteroids’ record book',
    where: 'in Asteroids’ record book',
    lesson: 'Asteroids times every wave you clear, and each wave has a record of its own.',
  },
  {
    id: 'events',
    clue: 'Where friends race each other for a trophy.',
    page: 'on the Events page',
    where: 'on the Events page',
    lesson: 'Events are tournaments: a daily, a weekly, and ones you make for friends. The winner’s cup stays on their shelf.',
  },
  {
    id: 'groups',
    clue: 'Where you’d make a board for just your crew.',
    page: 'on the Groups page',
    where: 'on the Groups page',
    lesson: 'Make a group, share its link, and everyone in it gets boards of their own.',
  },
  {
    id: 'about',
    clue: 'Where the arcade says what it is, and what it isn’t.',
    page: 'on the About page',
    where: 'on the About page',
    lesson: 'Original games, no ads, no install: About is the whole idea in one page.',
  },
  {
    id: 'terms',
    clue: 'In the small print, next to the rule about betting.',
    page: 'in the Terms',
    where: 'in the Terms, by the rule about gambling',
    lesson: 'Nobody reads the small print, except you just now. Scores here are for glory only: no wagers, no prizes.',
  },
  {
    id: 'hub-findbug',
    clue: 'Back home, on its own game’s page.',
    page: 'on Find the Bug’s page',
    where: 'back home, on Find the Bug’s page',
    lesson: 'Find the Bug is where these bugs live: spot the wanted one in a crowd, against the clock.',
  },
  {
    id: 'hub-fireflies',
    clue: 'On the page of the game where lanterns light the night.',
    page: 'on Fireflies’ page',
    where: 'on Fireflies’ page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-crosswalk',
    clue: 'On the page of the game where you hop across the road, forever.',
    page: 'on Crosswalk’s page',
    where: 'on Crosswalk’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-centroid',
    clue: 'On the page of the game where plates balance on a pin.',
    page: 'on Centroid’s page',
    where: 'on Centroid’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'hub-frenzy',
    clue: 'On the page of the game where every fish has a number.',
    page: 'on Frenzy’s page',
    where: 'on Frenzy’s page',
    lesson: HUB_LESSON,
  },
  {
    id: 'howto-putt',
    clue: 'In the instructions for the game with a hole at the end.',
    page: 'on Putt’s page',
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

/** Until midnight on the boards' clock, when the next bug gets loose. */
export function msUntilNextBug(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
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
 * every one before any comes again. The bugs come round two or three times
 * a month (bugHuntPick.ts), so one missed day never costs the set.
 */
export function huntPick(day = huntDay()): HuntPick {
  const n = dayNumber(day)
  const spots = shuffled(HUNT_SPOTS, `spots:${Math.floor(n / HUNT_SPOTS.length)}`)
  const moods = ['smile', 'smile', 'sleepy', 'o'] as const
  return {
    day,
    spot: devSpot() ?? spots[((n % spots.length) + spots.length) % spots.length]!,
    bug: bugForDay(day),
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
 * their find came in, which of the month's bugs count toward the set, and
 * whether a find just completed it.
 */

type ServerFind = HuntFind & { day: string; counted?: boolean }
type ServerCompleted = { key: string; shelved: boolean; pin: boolean }
type ServerHunt = {
  day: string
  count: number
  you?: { finds: ServerFind[]; place: number | null; set?: { key: string; bugs: string[] } }
  completed?: ServerCompleted
}

export type HuntServer = {
  /** How many players caught this day's bug, once the API has said. */
  count: number | null
  /** Where your find came in today: 1 for the first. */
  place: number | null
  /** The day those are for. */
  day: string | null
  /** Signed in: the month's set as the API counts it. */
  set: { key: string; bugs: ReadonlySet<string> } | null
  /** The set a find made today completed, if one did: on the shelf, and with the pin if it's the first. */
  completed: (ServerCompleted & { day: string }) | null
}

let server: HuntServer = { count: null, place: null, day: null, set: null, completed: null }

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

/** Take what the API said: the count, your place and set, and any finds from your other devices. */
function apply(reply: ServerHunt) {
  const completed = reply.completed
    ? { ...reply.completed, day: reply.day }
    : server.completed?.day === reply.day
      ? server.completed
      : null
  server = {
    count: reply.count,
    place: reply.you ? reply.you.place : null,
    day: reply.day,
    set: reply.you?.set ? { key: reply.you.set.key, bugs: new Set(reply.you.set.bugs) } : null,
    completed,
  }
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

/** The month's set, as the page shows it. */
export type HuntSet = {
  /** YYYY-MM. */
  key: string
  /** "October". */
  month: string
  /** Its last day: "Oct 31". */
  ends: string
  /** The first set, which started with the hunt a week before its month. */
  early: boolean
  /** The month's bugs caught on this device, or on the account's other devices. */
  caught: ReadonlySet<string>
  /** Signed in: the ones the API counts toward the set. Null signed out, or before it has said. */
  counted: ReadonlySet<string> | null
  /** Where the set stands: the counted ones signed in, this device's signed out. */
  have: ReadonlySet<string>
}

export type HuntStats = {
  /** Today's bug is caught. */
  foundToday: boolean
  /** Days in a row, counting today if it's found, or up to yesterday while today's is still loose. */
  streak: number
  /** Every find, all time. */
  total: number
  /** This month's. */
  set: HuntSet
  /**
   * Today's find, if there is one, brought this device's set to all twelve.
   * For a player signed out: signed in, the API's word on it is what counts.
   */
  completedHere: boolean
}

function setBugs(current: HuntLog, key: string, except?: string): Set<string> {
  return new Set(
    Object.entries(current.found)
      .filter(([day]) => day !== except && setKeyFor(day) === key)
      .map(([, f]) => f.bug),
  )
}

export function huntStats(day = huntDay(), current = huntLog(), from: HuntServer | null = null): HuntStats {
  const days = new Set(Object.keys(current.found).map(dayNumber))
  const today = dayNumber(day)
  const foundToday = days.has(today)
  let streak = 0
  for (let d = foundToday ? today : today - 1; days.has(d); d--) streak++
  const key = setKeyFor(day)
  const caught = setBugs(current, key)
  const before = setBugs(current, key, day)
  let counted: Set<string> | null = null
  if (from?.set?.key === key) {
    counted = new Set(from.set.bugs)
    // Today's find reaches the API on its own day, so it counts: shown so while the reply is on its way.
    const todays = current.found[day]
    if (todays && todays.bug === bugForDay(day).id) counted.add(todays.bug)
  }
  return {
    foundToday,
    streak,
    total: days.size,
    set: {
      key,
      month: setMonth(key),
      ends: setEnds(key),
      early: setStartsEarly(key),
      caught,
      counted,
      have: counted ?? caught,
    },
    completedHere: foundToday && before.size < SET_SIZE && caught.size === SET_SIZE,
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
    server = { count: server.count, place: null, day: server.day, set: null, completed: null }
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
