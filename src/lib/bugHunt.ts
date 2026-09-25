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
 * on the site and hides somewhere in it: in the small print, by a count, at
 * the end of a line nobody reads, small and faded so it takes a look. Everyone
 * gets the same bug in the same spot, picked from the date on the boards'
 * clock, and a new one gets loose at midnight there. Until noon there's only a
 * riddle; then a hint names the page, and at six another says where on it.
 * Neither links there: finding the way is the point. Catching one says what
 * that corner of the site is for, and fills in the month's set of all twelve:
 * the set empties on the 1st, and one caught in full puts a trophy on the
 * player's shelf.
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
  /** The riddle: all there is to go on until noon. */
  clue: string
  /** The first hint, from noon: the page, to end "It's…": "on the Boards". */
  page: string
  /** The second, from six: where on the page to look. */
  place: string
  /** Once it's found: where it was, and what that corner of the site is for. */
  where: string
  lesson: string
}

const HOW_TO_LESSON =
  'Every game’s page ends with how to play: the goal, the controls, what scores, what ends a run, and a tip.'

/*
 * The spots, in a fixed order: the day's spot is picked by its place in this
 * list, so a spot is moved or reworded where it stands, never reordered. None
 * sits on a page's title. Each hides in the body of its page, in words that
 * render for everyone, signed out included.
 */
export const HUNT_SPOTS: readonly HuntSpot[] = [
  {
    id: 'home-standings',
    clue: 'It went to see who’s winning, without leaving the front door.',
    page: 'on the home page',
    place: 'Look by the Standings.',
    where: 'on the home page, by the week’s standings',
    lesson: 'Standings add up everyone’s points across all the games. Every game’s board pays points by place.',
  },
  {
    id: 'home-games',
    clue: 'It’s down on the floor with every game in the place.',
    page: 'on the home page',
    place: 'Look beside the count of games on the floor.',
    where: 'on the home page, down on the floor with the games',
    lesson: 'The wall has every game in the arcade. The chips above it sort them into arcade, puzzle, quick play and sport.',
  },
  {
    id: 'home-records',
    clue: 'It wants a house record of its own.',
    page: 'on the home page',
    place: 'Look along the house records.',
    where: 'on the home page, among the house records',
    lesson: 'House records are the arcade’s own: the longest streak, the most days played, the busiest day. Beat one and your tag goes up there.',
  },
  {
    id: 'home-groups',
    clue: 'It read the pitch for a board of your own people.',
    page: 'on the home page',
    place: 'Look at the end of the words about groups, near the bottom.',
    where: 'near the bottom of the home page, at the end of the words about groups',
    lesson: 'A group is a board of just the people you play with: family, friends, the office.',
  },
  {
    id: 'footer',
    clue: 'It always reads to the very last word.',
    page: 'at the bottom of any page',
    place: 'Look after the very last line.',
    where: 'at the very bottom of the page, after the last line',
    lesson: 'The footer is a map of the whole site: games, boards, events, and the small print.',
  },
  {
    id: 'menu',
    clue: 'It came for the music, and stayed where you’d turn it off.',
    page: 'in your menu, top right (the You tab on a phone)',
    place: 'Look by the Music setting.',
    where: 'in your menu, by the music',
    lesson: 'Your menu has your player card, stats, friends and groups, and the theme, the sounds and the music.',
  },
  {
    id: 'boards',
    clue: 'It’s hunting for the easiest points going.',
    page: 'on the Boards',
    place: 'Look at the card about where the next points are.',
    where: 'on the Boards, by where the next points are',
    lesson: 'The boards rank everyone by points across every game, and point out where the next points come easiest.',
  },
  {
    id: 'board-snake',
    clue: 'On the longest tail’s board, it only counts its best run.',
    page: 'on Snake’s board',
    place: 'Look at the small print above the table.',
    where: 'on Snake’s board, in the small print above the table',
    lesson: 'Every game has a board of its own: each player’s best run this week, this month and all time.',
  },
  {
    id: 'records',
    clue: 'It wants its name in ink.',
    page: 'in the Record books',
    place: 'Look by the newest names.',
    where: 'in the Record books, by the newest names in ink',
    lesson: 'Record books keep feats inside a game, like the fastest wave cleared or the longest chain.',
  },
  {
    id: 'book-asteroids',
    clue: 'It skipped to the last chapter of the book about rocks.',
    page: 'in Asteroids’ record book',
    place: 'Look at the last group of records.',
    where: 'in Asteroids’ record book, by its last group of records',
    lesson: 'Asteroids times every wave you clear, and each wave has a record of its own.',
  },
  {
    id: 'events',
    clue: 'It read up on how to win a trophy with friends.',
    page: 'on the Events page',
    place: 'Look at how events work, by the trophies.',
    where: 'on the Events page, by how the trophies work',
    lesson: 'Events are tournaments: a daily, a weekly, and ones you make for friends. The winner’s cup stays on their shelf.',
  },
  {
    id: 'groups',
    clue: 'It’s waiting on an invite that never came.',
    page: 'on the Groups page',
    place: 'Look at the small print about invite links.',
    where: 'on the Groups page, by the small print about invite links',
    lesson: 'Make a group, share its link, and everyone in it gets boards of their own.',
  },
  {
    id: 'about',
    clue: 'It snuck in with the clutter the arcade says it keeps out.',
    page: 'on the About page',
    place: 'Look at the end of the idea.',
    where: 'on the About page, among the clutter',
    lesson: 'Original games, no ads, no install: About is the whole idea in one page.',
  },
  {
    id: 'terms',
    clue: 'It bet that nobody reads the small print.',
    page: 'in the Terms',
    place: 'Look under the rule about gambling.',
    where: 'in the Terms, under the rule about gambling',
    lesson: 'Nobody reads the small print, except you just now. Scores here are for glory only: no wagers, no prizes.',
  },
  {
    id: 'where-findbug',
    clue: 'It went back home to the crowd it came from.',
    page: 'on Find the Bug’s page',
    place: 'Look at the line that says where you can play.',
    where: 'back home on Find the Bug’s page, by where you can play',
    lesson: 'Find the Bug is where these bugs live: spot the wanted one in a crowd, against the clock.',
  },
  {
    id: 'tip-fireflies',
    clue: 'It has a tip for anyone who sings tunes back.',
    page: 'on Fireflies’ page',
    place: 'Look at the tip in How to play.',
    where: 'on Fireflies’ page, by the tip in How to play',
    lesson: HOW_TO_LESSON,
  },
  {
    id: 'count-crosswalk',
    clue: 'It’s counting everyone who keeps crossing the road.',
    page: 'on Crosswalk’s page',
    place: 'Look at the board, by how many are playing.',
    where: 'on Crosswalk’s page, by the count of players on its board',
    lesson: 'Every game’s page has its board on it: this week’s best runs, and where a first run would land.',
  },
  {
    id: 'crumbs-centroid',
    clue: 'It left a trail of crumbs from the game of plates on a pin.',
    page: 'on Centroid’s page',
    place: 'Look at the very top, on the trail back to the games.',
    where: 'on Centroid’s page, at the end of the trail of crumbs',
    lesson: 'The trail at the top of a page says where you are. Tap Games on it to go back to the wall.',
  },
  {
    id: 'shelf-frenzy',
    clue: 'It liked the fish with numbers so much, it wants more like them.',
    page: 'on Frenzy’s page',
    place: 'Look near the bottom, where more games are suggested.',
    where: 'at the bottom of Frenzy’s page, by more games like it',
    lesson: 'The bottom of every game’s page suggests more games like it.',
  },
  {
    id: 'ends-putt',
    clue: 'It knows how the mini golf ends.',
    page: 'on Putt’s page',
    place: 'Look in How to play, at when a round ends.',
    where: 'on Putt’s page, where How to play says a round ends',
    lesson: HOW_TO_LESSON,
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

/** How far into the day on the boards' clock. */
function sinceMidnight(now: number): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return (h! * 3600 + m! * 60 + s!) * 1000
}

/** Until midnight on the boards' clock, when the next bug gets loose. */
export function msUntilNextBug(now = Date.now()): number {
  return Math.max(0, 24 * 3_600_000 - sinceMidnight(now))
}

/** When each hint comes out, in hours on the boards' clock: the page at noon, where on it at six. */
const HINT_HOURS = [12, 18] as const

export type HuntHints = {
  /** The hints out so far: none in the morning, then the page, then where on it. */
  shown: string[]
  /** Until the next one comes out; null once they're all out. */
  nextIn: number | null
}

export function huntHints(spot: HuntSpot, now = Date.now()): HuntHints {
  const into = sinceMidnight(now)
  const all = [`It’s ${spot.page}.`, spot.place]
  const out = devHints() ?? HINT_HOURS.filter((hour) => into >= hour * 3_600_000).length
  const next = HINT_HOURS[out]
  return { shown: all.slice(0, out), nextIn: next == null ? null : next * 3_600_000 - into }
}

/** On a dev server, `localStorage['skermix-bug-hunt-hints']` (0, 1 or 2) says how many hints are out, to look at them. */
function devHints(): number | null {
  if (!import.meta.env.DEV) return null
  try {
    const n = Number(localStorage.getItem('skermix-bug-hunt-hints') ?? '')
    return localStorage.getItem('skermix-bug-hunt-hints') != null && n >= 0 && n <= 2 ? n : null
  } catch {
    return null
  }
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
