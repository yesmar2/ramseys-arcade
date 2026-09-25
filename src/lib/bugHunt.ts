import { games } from '../data/games'
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
import { api, LEADERBOARD_GAMES } from './leaderboard'
import { GAMES_WITH_RECORDS } from './records'
import { hashString } from './seededRandom'

export { HUNT_BUGS, SET_SIZE, setMonth, type HuntBug }

/*
 * The daily bug hunt. Every day one of Find the Bug's wanted bugs gets loose
 * somewhere on the site: on any page, hiding behind a panel, a card or a
 * game's screen with its head poking out over an edge, or peeking round a
 * corner. There are no clues: finding it means knowing your way round, and
 * learning it on the way. Everyone gets the same bug in the same place,
 * picked from the date on the boards' clock, and a new one gets loose at
 * midnight there. Catching one says what that corner of the site is for, and
 * fills in the month's set of all twelve: the set empties on the 1st, and one
 * caught in full puts a trophy on the player's shelf.
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
/** A bug was caught: the header shows the find. Its detail says how it was poking out. */
export const HUNT_CAUGHT_EVENT = 'skermix-bug-hunt-caught'

export function openBugHunt() {
  window.dispatchEvent(new Event(HUNT_OPEN_EVENT))
}

/** A name at the start of a sentence: "The Bug", "Rosie". */
export function capitalName(bug: HuntBug): string {
  return bug.name.charAt(0).toUpperCase() + bug.name.slice(1)
}

/* ---------------------------------------------------- where it hides --- */

/** Which way the bug pokes out from behind its hiding place: over an edge, or round a corner. */
export type HuntPose = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Over the top most often, since there's always room above; each side and corner some days. */
const POSES: readonly HuntPose[] = ['top', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

export function isHuntPose(value: string | null | undefined): value is HuntPose {
  return Boolean(value && (POSES as readonly string[]).includes(value))
}

/**
 * Something on the site the bug can hide behind. The page marks it with
 * `data-hunt="<id>"`, on an element that renders for everyone, signed out
 * and on a phone included.
 */
export type HuntAnchor = {
  id: string
  /** The page, to say where it was: "on Snake’s page". */
  page: string
  /** What it hid behind: "How to play". */
  thing: string
  /** What that corner of the site is for, said once it's caught. */
  lesson: string
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}’` : `${name}’s`
}

const GAME_PAGE_LESSON = 'Every game has a page of its own: its board, its record book, the events it’s in and how to play.'
const BOARD_LESSON = 'Every game has a board of its own: each player’s best run this week, this month and all time. Its place pays points.'
const BOOK_LESSON = 'Record books keep feats inside a game, like the fastest wave cleared or the longest chain.'
const ABOUT_LESSON = 'Original games, no ads, no install: About is the whole idea in one page.'
const GROUPS_LESSON = 'Make a group, share its link, and everyone in it gets boards of their own.'

const SITE_ANCHORS: HuntAnchor[] = [
  {
    id: 'home-hero',
    page: 'on the home page',
    thing: 'the big banner at the top',
    lesson: 'The banner at the top of the home page is the way in: today’s daily, or the next game to try.',
  },
  {
    id: 'home-onnow',
    page: 'on the home page',
    thing: 'today’s daily, under On now',
    lesson: 'On now is today’s daily, this week’s weekly and last week’s winners. Join one and your runs count toward it.',
  },
  {
    id: 'home-wall',
    page: 'on the home page',
    thing: 'the first game on the wall',
    lesson: 'The wall has every game in the arcade. The chips above it sort them into arcade, puzzle, quick play and sport.',
  },
  {
    id: 'home-standings',
    page: 'on the home page',
    thing: 'the Standings',
    lesson: 'Standings add up everyone’s points across all the games. Every game’s board pays points by place.',
  },
  {
    id: 'home-records',
    page: 'on the home page',
    thing: 'the house records',
    lesson: 'House records are the arcade’s own: the longest streak, the most days played, the busiest day. Beat one and your tag goes up there.',
  },
  {
    id: 'home-groups',
    page: 'on the home page',
    thing: 'the part about groups',
    lesson: 'A group is a board of just the people you play with: family, friends, the office.',
  },
  {
    id: 'boards-you',
    page: 'on the Boards',
    thing: 'the card about you',
    lesson: 'The Boards rank everyone by points across every game, and say where you stand or where you’d start.',
  },
  {
    id: 'boards-moves',
    page: 'on the Boards',
    thing: 'the card about the next points',
    lesson: 'The Boards point out where your next points come easiest.',
  },
  { id: 'records-books', page: 'in the Record books', thing: 'the first book on the shelf', lesson: BOOK_LESSON },
  {
    id: 'records-latest',
    page: 'in the Record books',
    thing: 'Latest in ink',
    lesson: 'Latest in ink is the newest names written into any record book.',
  },
  {
    id: 'events-how',
    page: 'on the Events page',
    thing: 'How events work',
    lesson: 'Events are tournaments: a daily, a weekly, and ones you make for friends. The winner’s cup stays on their shelf.',
  },
  { id: 'groups-start', page: 'on the Groups page', thing: 'the card for starting a group', lesson: GROUPS_LESSON },
  {
    id: 'groups-link',
    page: 'on the Groups page',
    thing: 'the card for invite links',
    lesson: 'Got an invite link? Paste it there and the group opens.',
  },
  { id: 'about-highlights', page: 'on the About page', thing: 'the first of its promises', lesson: ABOUT_LESSON },
]

/** Each game's page, its board and its record book: the panels on them the bug can hide behind. */
function gameAnchors(): HuntAnchor[] {
  const out: HuntAnchor[] = []
  const boards: readonly string[] = LEADERBOARD_GAMES
  const books: readonly string[] = GAMES_WITH_RECORDS
  for (const game of games) {
    if (game.hidden) continue
    const { slug } = game
    const page = `on ${possessive(game.name)} page`
    out.push(
      { id: `g-hero-${slug}`, page, thing: 'the panel at the top', lesson: GAME_PAGE_LESSON },
      {
        id: `g-screen-${slug}`,
        page,
        thing: 'the game’s screen',
        lesson: 'The screen on a game’s page plays a little of the game. Tap it to play the real thing.',
      },
      {
        id: `g-howto-${slug}`,
        page,
        thing: 'How to play',
        lesson: 'Every game’s page ends with how to play: the goal, the controls, what scores, what ends a run, and a tip.',
      },
    )
    if (boards.includes(slug)) {
      const board = `on ${possessive(game.name)} board`
      out.push(
        {
          id: `g-board-${slug}`,
          page,
          thing: 'its board',
          lesson: 'Every game’s page has its board on it: the best runs this week, this month or all time.',
        },
        {
          id: `g-stand-${slug}`,
          page,
          thing: 'the card about where you stand',
          lesson: 'Every game’s page says where you stand on its board, or where a first run would land.',
        },
        { id: `b-head-${slug}`, page: board, thing: 'the panel at the top', lesson: BOARD_LESSON },
        { id: `b-board-${slug}`, page: board, thing: 'the table', lesson: BOARD_LESSON },
      )
    }
    if (books.includes(slug)) {
      out.push({ id: `r-head-${slug}`, page: `in ${possessive(game.name)} record book`, thing: 'the panel at the top', lesson: BOOK_LESSON })
    }
  }
  return out
}

/**
 * Everywhere the bug can hide, across the whole site. The day's hiding place
 * comes round in a shuffled order, every one before any comes again.
 */
export const HUNT_ANCHORS: readonly HuntAnchor[] = [...SITE_ANCHORS, ...gameAnchors()]

/** Where the bug was, in words: "on Snake’s page, peeking over How to play". */
export function huntWhere(anchor: HuntAnchor, pose: HuntPose): string {
  const how =
    pose === 'top'
      ? `peeking over ${anchor.thing}`
      : pose === 'bottom'
        ? `peeking out from under ${anchor.thing}`
        : pose === 'left' || pose === 'right'
          ? `peeking out from behind ${anchor.thing}`
          : `peeking round a corner of ${anchor.thing}`
  return `${anchor.page}, ${how}`
}

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
  /** What it hides behind. */
  anchor: HuntAnchor
  /** Which way it pokes out, and how far along the edge (0 to 1). */
  pose: HuntPose
  at: number
  /** How it looks while it hides: napping or keeping an eye out. */
  mood: 'smile' | 'sleepy' | 'o'
}

/**
 * Today's bug and where it hides. The bugs come round two or three times a
 * month (bugHuntPick.ts), so one missed day never costs the set.
 */
export function huntPick(day = huntDay()): HuntPick {
  const n = dayNumber(day)
  const count = HUNT_ANCHORS.length
  const order = shuffled(HUNT_ANCHORS, `anchors:${Math.floor(n / count)}`)
  const moods = ['smile', 'smile', 'sleepy', 'o'] as const
  const dev = devPlace()
  return {
    day,
    bug: bugForDay(day),
    anchor: dev.anchor ?? order[((n % count) + count) % count]!,
    pose: dev.pose ?? POSES[hashString(`pose:${day}`) % POSES.length]!,
    at: 0.15 + (hashString(`at:${day}`) % 71) / 100,
    mood: moods[hashString(`mood:${day}`) % moods.length]!,
  }
}

/**
 * On a dev server, `localStorage['skermix-bug-hunt-spot']` hides today's bug
 * behind any anchor, and `['skermix-bug-hunt-pose']` says which way it pokes out.
 */
function devPlace(): { anchor: HuntAnchor | null; pose: HuntPose | null } {
  if (!import.meta.env.DEV) return { anchor: null, pose: null }
  try {
    const id = localStorage.getItem('skermix-bug-hunt-spot')
    const pose = localStorage.getItem('skermix-bug-hunt-pose')
    return { anchor: HUNT_ANCHORS.find((a) => a.id === id) ?? null, pose: isHuntPose(pose) ? pose : null }
  } catch {
    return { anchor: null, pose: null }
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
  saveLog({ found: { ...current.found, [pick.day]: { bug: pick.bug.id, spot: pick.anchor.id, at: now } } })
  emit()
  if (getSessionToken()) {
    const find = { day: pick.day, bug: pick.bug.id, spot: pick.anchor.id }
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
