import '../../styles/swoop.css'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { MedalRow } from '../../components/RaceMedal'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useAccountId } from '../../hooks/useAccountId'
import { useAuth } from '../../hooks/useAuth'
import { useGamePause } from '../../hooks/useGamePause'
import { dailyTabHref, gamePlayHref, navigate } from '../../hooks/useHashRoute'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useAdminState } from '../../lib/admin'
import { inArchive, useDailyDays } from '../../lib/archive'
import { currentAccountId } from '../../lib/auth'
import { usePastViewer } from '../../lib/dailyPast'
import type { PastKind } from '../../lib/dailyWords'
import { ownerAccount, ownerOf, SIGNED_OUT } from '../../lib/deviceRuns'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { normalizePlayerName } from '../../lib/leaderboard'
import { allTimeFact } from '../../lib/pastBoards'
import type { PastPlay } from '../../lib/pastPlay'
import { getPersonalBest } from '../../lib/personalBest'
import { paceMsOf } from '../../lib/raceMedals'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun, runIdFor } from '../../lib/runSession'
import { ordinal } from '../../lib/scoreboard'
import { sfx } from '../../lib/sound'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { WindSound } from './audio'
import { fetchBoardGhost, fetchNextGhost, fitsHills, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { hillsDay, hillsNumber, msUntilNextHills, untilWords } from './daily'
import { HillsMap } from './map'
import { onItsDayFact, type ItsDay } from './pastDay'
import { PastHillsResult, PracticeStartCard } from './PracticeCards'
import {
  claimRun,
  Ghost,
  keepBestRun,
  keepPracticeRun,
  keptRun,
  paceIfFlown,
  paceOf,
  practiceBest,
  swoopDay,
  type GhostPose,
  type GhostRun,
  type SwoopDay,
} from './runs'
import { HillsScene } from './scene'
import { cleanWords, formatRun, formatSwoopBoardScore, swoopBoardScore, swoopMsFromBoardScore } from './score'
import { DT, GHOST_EVERY, GLIDE, GOOD_HANDS, HOLD, makePerson, newBird, slopeAt, step, type Bird, type Hills } from './sim'
import { TestResultCard, TestStartCard } from './TestCards'
import { TomorrowHills } from './TomorrowHills'

const SLUG = 'swoop'

type Phase = 'menu' | 'countdown' | 'flying' | 'crossed' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'flying'])
/** The count: 3, 2, 1 a little under a second apart, then go. */
const COUNT_FROM = 3
const COUNT_STEP = 0.8
/** Over the line, a moment to see the time, gliding on, before the card comes. */
const CARD_AFTER = 1.1
/** The keys that hold: any of them down dives. */
const HOLD_KEYS = new Set(['Space', 'ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight'])
/** The first few runs on a device, a word at the bottom says when to hold and when to let go. */
const COACH_RUNS = 3
const COACH_KEY = 'skermix-swoop-coach'

/**
 * Whose run the ghost flies: the player one place above you today (`next`, for their place); the board's #1,
 * under their tag; your own best; or the blue bird's.
 */
type Chasing = { who: 'next'; name: string; place: number } | { who: 'rival'; name: string } | { who: 'you' } | { who: 'pace' }

/** The name over the ghost: whose run it flies. */
function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'Your best' : 'Blue bird'
}

/** The ghost's tile on the start card: "Beat PILOT for 13th", "Ghost · DAD", "Ghost · Your best", "Blue bird". */
function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue bird'
}

/** Everything a run is, held outside React: the loop changes it 120 times a second. */
type Game = {
  phase: Phase
  day: string
  /**
   * Whose run it is (lib/deviceRuns.ts): the account signed in as it started, or SIGNED_OUT; none at the
   * start card. It's kept as their best and saved as theirs alone, whoever signs in meanwhile.
   */
  owner: string | undefined
  bird: Bird
  /** Where the bird was a step ago, to draw it between steps. */
  last: { x: number; y: number }
  /** Seconds into the count, or since the line. */
  clock: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  steps: number
  /** Held this step. */
  hold: boolean
  /** This run's path, for its ghost if it's your best (sim.ts Flight's ghost). */
  record: number[]
  /** Past the line the bird glides on down the flat, for looks: the time is kept already. */
  coast: { hills: Hills; bird: Bird } | null
  /** The run being chased, and whose it is. */
  ghost: Ghost
  chasing: Chasing
  /**
   * The run's result, once it's over the line, and your best here before it. `runId`: past hills' run, asked
   * for as it ended (runSession runIdFor), which their All time board needs.
   */
  run: {
    time: number
    score: number
    splits: number[]
    clean: number
    bestStreak: number
    top: number
    improved: boolean
    before: number | null
    path: number[]
    runId: Promise<string | undefined> | null
  } | null
}

/** Past hills' All time board (lib/trackBoards.ts), and asking for it again once a run is saved. */
type PastBoard = { board: TrackBoard | null; refresh: () => void }

type Ui = {
  phase: Phase
  /** 3, 2, 1 while counting; 0 for Go (a moment into the run); −1 for nothing. */
  count: number
  /** Flags passed. */
  passed: number
}

function countOf(g: Game): number {
  if (g.phase === 'countdown') return Math.max(1, COUNT_FROM - Math.floor(g.clock / COUNT_STEP))
  if (g.phase === 'flying' && g.bird.t < 0.7) return 0
  return -1
}

const snapshot = (g: Game): Ui => ({ phase: g.phase, count: countOf(g), passed: g.bird.flag + 1 })

/** Your best run over a day's hills: in practice, this tab's (or this device's, from its day); else this device's. */
function bestOf(day: string, practice: boolean, viewer: string | null | undefined): GhostRun | null {
  const kept = keptRun(day, viewer)
  if (!practice) return kept
  const tab = practiceBest(day, viewer)
  return tab && (!kept || tab.time < kept.time) ? tab : kept
}

/** The run to chase, and whose it is. */
type Chase = { ghost: Ghost; chasing: Chasing }

/** Whose the #1's run is: yours, when it's your tag at the top. */
const topChasing = (top: BoardGhost, me: string): Chasing => (top.name === me ? { who: 'you' } : { who: 'rival', name: top.name })

/**
 * Your first run over these hills is against the blue bird (Ramsey, 2026-10-06: "the first time you play it
 * should be against blue and not the top score"): no run of yours here yet, none on the board, and the #1 isn't
 * you.
 */
const firstRun = (mine: GhostRun | null, top: BoardGhost | null, me: string, next: NextGhost | null) =>
  !mine && !next && top?.name !== me

/**
 * The run to beat. Your first here, the blue bird's. On today's hills, once you've a run on the board, the
 * player's one place above you, for their place: pass them and the next one lines up (as the other racing
 * dailies have it). Else the board's #1, on their own line, or on the blue bird's at their time when theirs
 * isn't known (boardGhost.ts standIn); unless your own best here is faster. With nobody on the board, your best
 * here when it beats the blue bird, else the blue bird's. Your own is the one of whoever is signed in now.
 */
function chaseFor(day: string, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const pace = paceOf(day)
  const mine = bestOf(day, practice, currentAccountId())
  if (firstRun(mine, top, me, next)) return { ghost: new Ghost(pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(next.run ?? standIn(pace, next.time)), chasing: { who: 'next', name: next.name, place: next.place } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(top.run ?? standIn(pace, top.time)), chasing: topChasing(top, me) }
  }
  return mine && mine.time < pace.time ? { ghost: new Ghost(mine), chasing: { who: 'you' } } : { ghost: new Ghost(pace), chasing: { who: 'pace' } }
}

/**
 * The run to chase at the start card, where the blue bird may not have flown yet (paceOf warms it while the
 * card is up): the card needs only the time to beat and whose it is. Until the blue bird has flown, a run
 * whose path isn't known waits at the start; once it has, the card's camera rides along with it.
 */
function cardChase(swoop: SwoopDay, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const mine = bestOf(swoop.day, practice, currentAccountId())
  const flown = paceIfFlown(swoop.day)
  const start = newBird(swoop.hills)
  const waiting = (time: number) => new Ghost(flown ? standIn(flown, time) : { time, splits: [], ghost: [start.x, start.y, GLIDE, start.x, start.y, GLIDE] })
  if (firstRun(mine, top, me, next)) return { ghost: flown ? new Ghost(flown) : waiting(swoop.pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: next.run ? new Ghost(next.run) : waiting(next.time), chasing: { who: 'next', name: next.name, place: next.place } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: top.run ? new Ghost(top.run) : waiting(top.time), chasing: topChasing(top, me) }
  }
  if (mine && mine.time < swoop.pace) return { ghost: new Ghost(mine), chasing: { who: 'you' } }
  return { ghost: flown ? new Ghost(flown) : waiting(swoop.pace), chasing: { who: 'pace' } }
}

function freshGame(swoop: SwoopDay, chase: Chase): Game {
  const bird = newBird(swoop.hills)
  return {
    phase: 'menu',
    day: swoop.day,
    owner: undefined,
    bird,
    last: { x: bird.x, y: bird.y },
    clock: 0,
    carry: 0,
    steps: 0,
    hold: false,
    record: [],
    coast: null,
    ghost: chase.ghost,
    chasing: chase.chasing,
    run: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

const calmMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Runs started on this device so far, for the coach. */
function coachRuns(): number {
  try {
    return Number(localStorage.getItem(COACH_KEY) ?? 0) || 0
  } catch {
    return COACH_RUNS
  }
}

function countCoachRun() {
  try {
    localStorage.setItem(COACH_KEY, String(coachRuns() + 1))
  } catch {
    /* a private window keeps nothing; the coach just keeps talking */
  }
}

/** A flag's time against the ghost's at the same flag: −0.42 ahead, +1.10 behind. */
function gapText(d: number) {
  return Math.abs(d) < 0.005 ? '0.00' : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`
}
const gapTone = (d: number | null) => (d == null || Math.abs(d) < 0.005 ? '' : d < 0 ? 'good' : 'bad')

/** A run to send on: the day's hills, the time against the blue bird, and the way to today's hills. */
function runShareLine(swoop: SwoopDay, time: number, pace: number, clean: number): string {
  const gap = Math.abs(time - pace)
  const against = gap < 0.005 ? 'tied with the blue bird' : time < pace ? `beat the blue bird by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue bird`
  return [`Swoop · Today’s Hills #${swoop.n} 🐦`, `${swoop.name}: ${formatRun(time)}, ${against}, ${cleanWords(clean)}`, `${window.location.origin}${gamePlayHref(SLUG)}`].join(
    '\n',
  )
}

/** Today's hills and their number, the run their ghost flies (the #1's, your best, or the blue bird's), and when the next hills come. */
function HillsTiles({ swoop, ghost, chasing, bestMs }: { swoop: SwoopDay; ghost: number; chasing: Chasing; bestMs: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextHills())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextHills()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <>
      <div className="game-pause-meta__row swoop-hills">
        <span>Today’s hills · #{swoop.n}</span>
        <strong>{swoop.name}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>{chasingLabel(chasing)}</span>
        <strong>{formatRun(ghost)}</strong>
      </div>
      <MedalRow game="swoop" paceMs={paceMsOf(swoop.pace)} bestMs={bestMs} format={formatRun} />
      <div className="game-pause-meta__row">
        <span>Next hills</span>
        <strong>{untilWords(left)}</strong>
      </div>
    </>
  )
}

/**
 * Swoop: a bird over a day of hills, against the clock. Hold to dive: down a slope that's speed, and over a
 * top it keeps the bird on the hill. Let go near the bottom and the bird flies off the next top; land on the
 * far side of a hill, along its slope, to keep the speed (a clean landing adds a little), and not into the
 * face of the next one, which costs most of it.
 *
 * It's a daily: new hills every day, the same for everyone (daily.ts), flown as often as you like, and the
 * board is the day's (the API keeps Swoop's board to today's hills, whatever the period). SwoopGame mounts it
 * for today; when midnight has brought new hills by the next start, it asks for the new day with `onNewDay`,
 * which mounts it again, with `notice` to say why when a run was lost to it.
 *
 * The ghost is the run to beat, flying alongside the whole way with whose it is over it: the board's #1
 * (today's, or on past hills their All time #1: boardGhost.ts), unless your own best here is faster; with
 * nobody on the board, your best here if it beats the blue bird, else the blue bird's.
 *
 * Keys: Space (or ↓, S or Shift) held to dive, R start again, P or Escape pause. On a touch screen, a finger
 * anywhere. A run is scored as its time: the board keeps a million less the milliseconds (score.ts), so the
 * fastest run is the highest score.
 */
function SwoopDayGame({
  day,
  practice = false,
  test = false,
  itsDay,
  pastBoard = null,
  onNewDay,
  notice,
}: {
  day: string
  /**
   * A day's hills not flown for today's board: past hills from the past tab (with `pastBoard`), or an admin's
   * test run (with `test`). Your best here on this device lasts the tab.
   */
  practice?: boolean
  /**
   * An admin's test run of today's hills or some still to come, from the Hills Book: nothing kept, as in
   * practice (and `practice` is set with it), on cards of its own (TestCards.tsx).
   */
  test?: boolean
  /** Past hills' day as the API has it, for their cards: who was 1st, and you. */
  itsDay?: ItsDay
  /** Past hills' All time board: signed in, a run on them goes there, under a run of its own. */
  pastBoard?: PastBoard | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const swoop = swoopDay(day)
  const pace = swoop.pace
  const past = pastBoard !== null && !test
  const board = pastBoard?.board ?? null
  /** The board's #1 as last told (boardGhost.ts), and the tag you play under, for whose the ghost is. */
  const topRef = useRef<BoardGhost | null>(null)
  // On today's hills, the player one place above you, once you've a run on the board (boardGhost.ts fetchNextGhost).
  const nextRef = useRef<NextGhost | null>(null)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(swoop, cardChase(swoop, practice, null, playerName, null))
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noCanvas, setNoCanvas] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [touch] = useState(touchScreen)
  const holderRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const splitRef = useRef<HTMLElement>(null)
  const speedRef = useRef<HTMLSpanElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HillsScene | null>(null)
  const soundRef = useRef<WindSound | null>(null)
  /** The keys held down, and the fingers on the screen: any of them dives. */
  const keysRef = useRef(new Set<string>())
  const fingersRef = useRef(new Set<number>())
  /** This run's coach: whether it's talking, and what it said last. */
  const coachRef = useRef({ on: false, want: '', since: 0, shown: '', showFor: 0, pressed: false })
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((b: Bird) => boolean) | null>(null)
  const toastTimer = useRef(0)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const say = (text: string | null, seconds = 2.2) => {
    window.clearTimeout(toastTimer.current)
    setToast(text)
    if (text) toastTimer.current = window.setTimeout(() => setToast(null), seconds * 1000)
  }
  const sayRef = useRef(say)
  sayRef.current = say

  const letGo = () => {
    keysRef.current.clear()
    fingersRef.current.clear()
  }

  /** The coach's word at the bottom, or none (an empty hint isn't shown: swoop.css). */
  const coachSays = (text: string) => {
    if (hintRef.current && hintRef.current.textContent !== text) hintRef.current.textContent = text
  }

  /** Midnight has brought new hills: the page mounts the game again for them. */
  const newDay = (why?: string) => {
    if (practice || hillsDay() === day || devDay()) return false
    onNewDay(why)
    return true
  }
  const newDayRef = useRef(newDay)
  newDayRef.current = newDay

  /**
   * The count, and a new run for the boards, chasing the best run there is. The run is whoever's signed in
   * as it starts, so it waits the moment it takes to know who that is.
   */
  const start = () => {
    if (newDay()) return
    const owner = ownerOf(currentAccountId())
    if (owner === undefined) {
      say('Still signing you in. Try again in a moment.')
      return
    }
    saveOpenRef.current = false
    setSaveOpen(false)
    // A test run opens no run: nothing it does is saved. Past hills' run goes on their All time board, timed
    // by the server as a day's is.
    if (!practice) {
      clearRunAchievements()
      beginRun(SLUG)
    } else if (past) beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(swoop, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    sceneRef.current?.snap()
    soundRef.current?.wake()
    // The first few runs on this device, the coach says what to do: first how to dive, then when.
    const coach = coachRef.current
    coach.on = coachRuns() < COACH_RUNS
    coach.want = ''
    coach.since = 0
    coach.shown = ''
    coach.showFor = 0
    coach.pressed = false
    countCoachRun()
    coachSays(coach.on || touch ? (touch ? 'Hold anywhere to dive. Let go to fly.' : 'Hold Space to dive. Let go to fly.') : '')
    say(null)
    setUi(snapshot(g))
  }

  /** Done with the run: back to the start card. Nothing counts until the next one starts. */
  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(swoop, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 300
    sceneRef.current?.snap()
    letGo()
    coachSays('')
    say(null)
    setUi(snapshot(gameRef.current))
  }

  const restart = () => {
    if (!IN_RUN.has(gameRef.current!.phase) || pausedRef.current || saveOpenRef.current) return
    start()
  }

  /** At the start card, the run to beat worked out again: it changes at once. Mid-run, a run keeps the ghost it began with. */
  const rechase = () => {
    if (gameRef.current!.phase !== 'menu') return
    gameRef.current = freshGame(swoop, cardChase(swoop, practice, topRef.current, nameRef.current, nextRef.current))
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  /** The board's fastest run, as it's known: at the start card, the ghost to race changes to it at once. */
  const takeTop = (next: BoardGhost | null) => {
    // A path flown over these hills before they were laid again goes through them: their time on the blue bird's line instead.
    topRef.current = next?.run && !fitsHills(swoop.hills, next.run) ? { ...next, run: null } : next
    rechase()
  }
  const takeTopRef = useRef(takeTop)
  takeTopRef.current = takeTop

  // Signed in, out, or as someone else, or under another tag: at the start card, the ghost is the new player's to beat.
  const chasedFor = useRef(`${viewer}|${playerName}`)
  useEffect(() => {
    const who = `${viewer}|${playerName}`
    if (chasedFor.current === who) return
    chasedFor.current = who
    rechaseRef.current()
  }, [viewer, playerName])

  /**
   * A run saved on the board sends where the bird went: the API keeps it if it's the tag's run on the board
   * and the fastest there, and then it's everyone's ghost, yours included from your next run. On today's hills
   * every run goes, as the API keeps each player's best for whoever is one place below them to race; then the
   * player above you is asked for again, as you may have passed them. On past hills only one that could be
   * their fastest goes: the #1 is faster, or their line is known and at least as fast, and it stays home.
   */
  const sendGhost = (run: { time: number; score: number; splits: number[]; path: number[] }, name: string) => {
    if ((practice && !past) || !signedIn || !name) return
    const known = topRef.current
    const today = !practice
    if (!today && known && (known.time < run.time - 0.0005 || (known.run && known.run.time <= run.time + 0.0005))) return
    void sendBoardGhost(swoop.n, name, run).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(swoop.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  /** The player one place above you on today's hills: asked for as they open, and again after each run you save. */
  const askNext = () => {
    const tag = nameRef.current
    if (practice || !signedIn || !tag || swoop.day > hillsDay()) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(swoop.n, tag).then((next) => {
      // Signed in as someone else meanwhile: theirs is asked for in turn.
      if (tag !== nameRef.current) return
      nextRef.current = next?.run && !fitsHills(swoop.hills, next.run) ? { ...next, run: null } : next
      rechaseRef.current()
    })
  }
  const askNextRef = useRef(askNext)
  askNextRef.current = askNext
  useEffect(() => {
    askNextRef.current()
  }, [signedIn, playerName, swoop.n, practice])

  // The board's fastest run, for the ghost: asked for as the hills open (past ones', their All time #1).
  // Hills whose day hasn't come, on an admin's test run, have no board yet.
  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    let live = true
    const asked = swoop.day > hillsDay() ? Promise.resolve(null) : fetchBoardGhost(swoop.n)
    void asked.then((found) => {
      if (!live) return
      if (found) takeTopRef.current(found)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [swoop.n, swoop.day])

  // Then your best here on this device, if it's faster than that: the API keeps it only if it's on the board
  // under your tag. So a run saved on a card closed too soon still gets there. Only your account's own run
  // goes, once for each account signed in here: never one flown signed out, or another's.
  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (practice || !topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = keptRun(day, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: swoopBoardScore(mine.time), splits: mine.splits, path: mine.ghost }, playerName)
  }, [practice, topAsked, signedIn, viewer, playerName, day])

  /**
   * A run flown signed out, put on the board by whoever signed in on its card: it's theirs from now on, their
   * best here if it's faster than the one they had (runs.ts claimRun).
   */
  const claimSaved = (g: Game) => {
    const id = currentAccountId()
    if (g.owner !== SIGNED_OUT || !g.run || typeof id !== 'string') return
    claimRun(g.day, id, { time: g.run.time, splits: g.run.splits, ghost: g.run.path })
    g.owner = id
  }

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { hills } = swoop
    // A canvas of the scene's own: when it goes, it goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'swoop__view'
    canvas.setAttribute('aria-label', 'The hills, seen from the side, following your bird')
    holder.append(canvas)
    let scene: HillsScene
    try {
      scene = new HillsScene(canvas, hills)
    } catch {
      canvas.remove()
      setNoCanvas(true)
      return
    }
    sceneRef.current = scene
    const sound = new WindSound()
    soundRef.current = sound
    const map = mapRef.current ? new HillsMap(mapRef.current, hills) : null
    const retheme = () => {
      map?.rebuild()
      scene.retheme()
    }
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const calm = calmMotion()

    /** Held this step: any hold key, or any finger on the screen. */
    const readHold = (g: Game): boolean => {
      if (autopilot.current) return autopilot.current(g.bird)
      return keysRef.current.size > 0 || fingersRef.current.size > 0
    }

    const splitShown = (g: Game, k: number) => {
      const at = g.bird.splits[k]
      const theirs = g.ghost.run.splits[k]
      const d = at != null && theirs != null ? at - theirs : null
      const el = splitRef.current
      if (el) {
        el.textContent = d == null ? (at != null ? formatRun(at) : '–') : gapText(d)
        el.className = gapTone(d) ? `swoop__delta--${gapTone(d)}` : ''
      }
      return d
    }

    /**
     * The coach, the first few runs on a device: a word at the bottom when the bird is coasting down a slope
     * with nobody holding, or being held up the far side of one.
     */
    const coach = (g: Game, dt: number) => {
      const c = coachRef.current
      if (!c.on) return
      const b = g.bird
      let want = ''
      if (b.ground && Math.hypot(b.vx, b.vy) < 45) {
        const d = slopeAt(hills, b.x)
        if (d < -0.15 && !g.hold) want = touch ? 'Hold down the slope' : 'Hold Space down the slope'
        else if (d > 0.15 && g.hold) want = 'Let go now, and fly off the top'
      }
      if (want !== c.want) {
        c.want = want
        c.since = 0
      } else c.since += dt
      if (want && c.since > 0.2 && c.shown !== want) {
        c.shown = want
        c.showFor = 1.4
        coachSays(want)
      }
      if (c.showFor > 0) {
        c.showFor -= dt
        if (c.showFor <= 0) {
          c.shown = ''
          coachSays('')
        }
      }
    }

    const finishRun = (g: Game) => {
      const b = g.bird
      const time = b.time
      g.record.push(Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, GLIDE)
      // Against the best of whoever flew it, and kept as theirs: someone else signed in meanwhile has theirs.
      const kept = g.owner === undefined ? null : bestOf(g.day, practice, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      const path = g.record
      const splits = [...b.splits]
      if (improved && g.owner !== undefined) {
        const run = { time, splits, ghost: path }
        if (practice) keepPracticeRun(g.day, g.owner, run)
        else keepBestRun(g.day, g.owner, run)
      }
      g.run = {
        time,
        score: swoopBoardScore(time),
        splits,
        clean: b.clean,
        bestStreak: b.bestStreak,
        top: b.top,
        improved,
        before: kept?.time ?? null,
        path,
        runId: past ? runIdFor(SLUG) : null,
      }
      // On down the flat past the line, for looks.
      g.coast = { hills: { ...hills, finish: Infinity, flags: [] }, bird: { ...b, done: false, splits: [] } }
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
      coachSays('')
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    let attract = 0

    const loop = (now: number) => {
      if (!alive) return
      // The next frame first, so one that fails to draw can't stop the run.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const b = g.bird
      const live = !pausedRef.current

      if (live && g.phase === 'countdown') {
        const before = countOf(g)
        g.clock += dt
        if (g.clock >= COUNT_FROM * COUNT_STEP) {
          g.phase = 'flying'
          g.carry = 0
          sfx('good')
        } else if (countOf(g) !== before) sfx('tap')
      }
      if (live && g.phase === 'flying') {
        g.carry += dt
        while (g.carry >= DT && g.phase === 'flying') {
          g.carry -= DT
          g.last = { x: b.x, y: b.y }
          const hold = readHold(g)
          g.hold = hold
          if (hold && !coachRef.current.pressed) {
            coachRef.current.pressed = true
            if (!coachRef.current.on || coachRef.current.shown === '') coachSays('')
          }
          // The ghost's path keeps time with the clock.
          if (g.steps % GHOST_EVERY === 0) g.record.push(Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, hold ? HOLD : GLIDE)
          const ev = step(hills, b, hold)
          g.steps += 1
          if (ev === 'launch') sfx('whoosh')
          else if (ev === 'clean') {
            scene.landed('clean', b.x, b.y, b.vx, b.streak)
            sfx('perfect', Math.min(b.streak - 1, 7))
            haptic('boost')
          } else if (ev === 'thump') {
            scene.landed('thump', b.x, b.y, b.vx, 0)
            sfx('hit')
            haptic('hit')
          } else if (ev === 'land') scene.landed('land', b.x, b.y, b.vx, 0)
          else if (ev === 'finish') {
            g.phase = 'crossed'
            g.clock = 0
            finishRun(g)
          } else if (ev && typeof ev === 'object') {
            const d = splitShown(g, ev.flag)
            sayRef.current(`Flag ${ev.flag + 1} · ${d == null ? formatRun(b.splits[ev.flag]!) : gapText(d)}`)
            sfx('good', d != null && d < 0 ? 2 : 0)
          }
        }
        coach(g, dt)
      }
      if (g.phase === 'crossed' || g.phase === 'gameover') {
        // Gliding on down the flat past the line.
        const coast = g.coast
        if (coast && live) {
          g.carry += dt
          while (g.carry >= DT) {
            g.carry -= DT
            g.last = { x: coast.bird.x, y: coast.bird.y }
            step(coast.hills, coast.bird, false)
          }
        }
      }
      if (live && g.phase === 'crossed') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another run first. A run that midnight came
        // in the middle of was on yesterday's hills, and today's board is other hills': not saved.
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that run, so it was on yesterday’s hills. Here are today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          letGo()
        }
      }

      // Where things are this frame: the bird between its last two steps, the ghost at the run's moment.
      const flying = g.coast ? g.coast.bird : b
      const f = live && (g.phase === 'flying' || g.coast) ? Math.min(1, g.carry / DT) : 1
      const pose = {
        x: g.last.x + (flying.x - g.last.x) * f,
        y: g.last.y + (flying.y - g.last.y) * f,
        vx: flying.vx,
        vy: flying.vy,
        ground: flying.ground,
      }
      let ghost: GhostPose | null
      if (g.phase === 'menu') {
        // Before a run the camera rides with the run to beat, round and round.
        if (live) attract += dt
        ghost = g.ghost.at(attract)
        if (ghost.done && attract > g.ghost.run.time + 1.5) {
          attract = 0
          scene.snap()
        }
      } else ghost = g.ghost.at(g.phase === 'countdown' ? 0 : g.run ? g.run.time + g.clock : b.t)
      scene.frame(
        {
          mode: g.phase === 'menu' ? 'menu' : g.phase === 'crossed' || g.phase === 'gameover' ? 'done' : 'play',
          bird: pose,
          hold: live && g.phase === 'flying' && g.hold,
          flag: b.flag,
          ghost,
          ghostTag: ghostTag(g.chasing),
          ghostMine: g.chasing.who === 'you',
          ghostBlue: g.chasing.who === 'pace',
          calm,
        },
        live ? dt : 0,
      )
      map?.draw(pose.x, pose.y, ghost && g.phase !== 'menu' && !ghost.done ? ghost : null)
      sound.update(Math.hypot(b.vx, b.vy), !b.ground, live && g.phase === 'flying')
      if (clockRef.current) {
        const text = formatRun(g.run ? g.run.time : g.phase === 'flying' ? b.t : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }
      if (speedRef.current) {
        const text = String(g.phase === 'flying' ? Math.round(Math.hypot(b.vx, b.vy) * 3.6) : 0)
        if (speedRef.current.textContent !== text) speedRef.current.textContent = text
      }

      // The rest of the heads-up changes only when something happens: the count, a flag, the line.
      const next = snapshot(g)
      const key = `${next.phase}|${next.count}|${next.passed}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    // The blue bird's run, flown now while the card is up, so the start doesn't wait on it; the card's camera
    // then rides along with the run to beat.
    const warm = window.setTimeout(() => {
      paceOf(swoop.day)
      rechaseRef.current()
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(warm)
      cancelAnimationFrame(raf)
      dark.removeEventListener?.('change', retheme)
      themeWatch.disconnect()
      sound.dispose()
      soundRef.current = null
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
    // Once for the day's hills: the page mounts the game again for another day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The keys: held while down; a run starts from the card on Space or Enter, and R starts it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (saveOpenRef.current || pausedRef.current) return
      const g = gameRef.current!
      if (g.phase === 'menu') {
        if (e.code !== 'Space' && e.code !== 'Enter') return
        e.preventDefault()
        if (!e.repeat && performance.now() >= startGrace.current) {
          start()
          // The Space that started the run is held on into it.
          if (e.code === 'Space') keysRef.current.add(e.code)
        }
        return
      }
      if (!IN_RUN.has(g.phase)) return
      if (HOLD_KEYS.has(e.code)) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        keysRef.current.add(e.code)
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault()
        restart()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', letGo)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', letGo)
    }
  })

  // Paused: nothing held carries over into the run when it resumes.
  useEffect(() => {
    if (!paused) return
    letGo()
  }, [paused])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  // Mounted again for a new day because a run was lost to midnight: say so.
  useEffect(() => {
    if (notice) say(notice, 6)
    // Once, on the mount the notice came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dev only: read the run, or let a good player's hands take over, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __swoop?: () => Game
      __swoopScene?: () => HillsScene | null
      __swoopAuto?: (on?: boolean) => void
      __swoopStart?: () => void
    }
    w.__swoop = () => gameRef.current!
    w.__swoopScene = () => sceneRef.current
    w.__swoopAuto = (on = true) => {
      autopilot.current = on ? makePerson(swoop.hills, GOOD_HANDS) : null
    }
    w.__swoopStart = () => start()
    return () => {
      delete w.__swoop
      delete w.__swoopScene
      delete w.__swoopAuto
      delete w.__swoopStart
    }
  })

  /* A tap on the hills starts a run from the card; in a run, a finger anywhere dives. */
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const g = gameRef.current!
    if (g.phase === 'menu') {
      e.preventDefault()
      if (performance.now() >= startGrace.current) start()
      return
    }
    if (!IN_RUN.has(g.phase)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    fingersRef.current.add(e.pointerId)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    fingersRef.current.delete(e.pointerId)
  }

  const g = gameRef.current!
  const showroom = ui.phase === 'menu'
  const run = g.run
  const tabBest = practice ? (bestOf(day, true, g.owner === undefined ? viewer : ownerAccount(g.owner))?.time ?? null) : null
  // Past hills' best here is your best on their All time board too, signed in.
  const boardBest = past && viewer !== null && board?.you ? swoopMsFromBoardScore(board.you.score) / 1000 : null
  const practiceBestTime = tabBest == null ? boardBest : boardBest == null ? tabBest : Math.min(tabBest, boardBest)
  const bestText = practice
    ? practiceBestTime != null
      ? formatRun(practiceBestTime)
      : '–'
    : apiBest > 0
      ? formatRun(swoopMsFromBoardScore(apiBest) / 1000)
      : '–'
  // Whose the run is, for its card: an account's run waits for that account; one flown signed out goes to whoever signs in.
  const runOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  // Past hills: the chip, the tab's title, the way back to their row and their day's figures, the same on the
  // play screen, the pause card and the start card (lib/pastPlay.ts).
  const went: ItsDay = itsDay ?? { days: null, failed: false, me: null }
  // Signed in, a run goes on the hills' All time board. Signed out it's practice, and so is a run flown signed
  // out, for good: signing in on its card is for the runs after it. Hills in the archive, older than a week
  // (lib/archive.ts), are practice for everyone: their board is closed.
  const pastKind: PastKind =
    (viewer === null && (g.owner === undefined || g.owner === SIGNED_OUT)) ||
    (ui.phase === 'gameover' && g.owner === SIGNED_OUT) ||
    (past && inArchive(day))
      ? 'practice'
      : 'board'
  const pastPlay: PastPlay | null = past
    ? {
        href: dailyTabHref(SLUG, 'past', day),
        kind: pastKind,
        title: swoop.name,
        facts: [onItsDayFact(day, went), allTimeFact(SLUG, board, viewer !== null, formatSwoopBoardScore)],
      }
    : null
  const extra = practice ? (
    <>
      <div className="game-pause-meta__row">
        <span>Blue bird</span>
        <strong>{formatRun(pace)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Your best here</span>
        <strong>{bestText}</strong>
      </div>
    </>
  ) : (
    <HillsTiles swoop={swoop} ghost={g.ghost.run.time} chasing={g.chasing} bestMs={apiBest > 0 ? swoopMsFromBoardScore(apiBest) : null} />
  )
  const splitsText = (r: NonNullable<Game['run']>) =>
    [
      swoop.name,
      ...r.splits.slice(0, -1).map((at, k) => `F${k + 1} ${formatRun(at)}`),
      cleanWords(r.clean),
      `top ${Math.round(r.top * 3.6)} km/h`,
    ].join(' · ')

  return (
    <section
      className={`swoop swoop--fullscreen${showroom ? ' swoop--showroom' : ''}${touch ? ' swoop--touch' : ''}${pastPlay ? ' swoop--past' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div
            className="swoop__play"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div ref={holderRef} className="swoop__holder" />

            <GamePlayChrome slug={SLUG} inRun={() => IN_RUN.has(gameRef.current!.phase)} paused={paused} past={pastPlay}>
              {inRun && !paused ? (
                <button
                  type="button"
                  className="game-pause-btn"
                  aria-label="Start the run again (R)"
                  title="Start again (R)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.currentTarget.blur()
                    restart()
                  }}
                >
                  <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M4.2 4.5v4.3h4.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            {!showroom ? (
              <PlayReadout>
                <PlayReadoutScore className="swoop__clock">
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  <PlayStat label={ui.passed > 0 ? `Flag ${ui.passed}` : 'Split'} value={<span ref={splitRef}>–</span>} />
                  <PlayStat label="km/h" value={<span ref={speedRef}>0</span>} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="swoop__map" aria-hidden="true" />

            {ui.count >= 0 && !paused ? (
              <div className={`swoop__count${ui.count === 0 ? ' is-go' : ''}`} role="status">
                {ui.count === 0 ? 'Go!' : ui.count}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="swoop__toast" role="status">
                {toast}
              </div>
            ) : null}

            <div ref={hintRef} className="swoop__hint" />

            {noCanvas ? (
              <div className="swoop__nocanvas">
                <p>This browser can’t draw Swoop’s hills.</p>
              </div>
            ) : null}

            <div className="swoop__overlay">
              <GamePauseOverlay
                slug={SLUG}
                personalBest={inRun ? previousBestRef.current : apiBest}
                hideBest={practice}
                hideRecord={practice}
                past={pastPlay}
                paused={paused}
                onResume={resume}
                onRestart={start}
                extraMeta={extra}
              />
              {showroom && !saveOpen && !paused && !noCanvas ? (
                test ? (
                  <TestStartCard swoop={swoop} best={practiceBestTime} />
                ) : pastPlay ? (
                  <PracticeStartCard swoop={swoop} kind={pastKind} facts={pastPlay.facts ?? []} tiles={extra} board={board} />
                ) : (
                  <GameStartCard title="Swoop" slug={SLUG} extraMeta={extra} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && run ? (
                test ? (
                  <TestResultCard
                    swoop={swoop}
                    time={run.time}
                    clean={run.clean}
                    best={practiceBestTime ?? run.time}
                    improved={run.improved}
                    onAgain={start}
                    onDone={toMenu}
                  />
                ) : past ? (
                  <PastHillsResult
                    swoop={swoop}
                    time={run.time}
                    score={run.score}
                    clean={run.clean}
                    pace={pace}
                    run={run.runId}
                    board={board}
                    owner={runOwner}
                    onSaved={(result) => {
                      pastBoard?.refresh()
                      sendGhost(run, result.name)
                    }}
                    onAgain={start}
                  />
                ) : tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={run.score} onDone={toMenu} />
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={run.score}
                    title="Over the line"
                    subtitle={splitsText(run)}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace * 1000)}
                    shareLine={runShareLine(swoop, run.time, pace, run.clean)}
                    medalPace={paceMsOf(swoop.pace)}
                    medalFormat={formatRun}
                    kicker={`Today’s Hills #${swoop.n}`}
                    tomorrow={<TomorrowHills day={swoop.day} />}
                    owner={runOwner}
                    onSettled={() => sendGhost(run, playerName)}
                    onSaved={() => claimSaved(g)}
                    onDone={toMenu}
                  />
                )
              ) : null}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}

/** Dev only: localStorage `skermix-swoop-dev-day` = YYYY-MM-DD flies that day's hills, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-swoop-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

/**
 * A past day's hills, from the past tab: anyone's to fly, and signed in, a run goes on their All time board
 * (PracticeCards.tsx). How their day went (lib/archive.ts) and their board are asked for here, the board again
 * once a run is saved. Signed out, they're asked for without a tag: nobody's place is shown as yours.
 */
function PastSwoop({ day }: { day: string }) {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(SLUG, viewer.name)
  const itsDay: ItsDay = { days, failed, me: viewer.state === 'in' ? viewer.name : null }
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, hillsNumber(day), viewer.state === 'out' ? '' : viewer.name, version)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <SwoopDayGame day={day} practice itsDay={itsDay} pastBoard={{ board, refresh }} onNewDay={() => {}} />
}

/**
 * Swoop on today's hills, mounted again for the next when midnight brings them; with `practiceDay`, a past
 * day's hills from the past tab, onto their All time board; with `testDay`, today's hills or some still to
 * come, test flown from the admin's Hills Book. A test run is only an admin's: anyone else is sent to today's
 * hills, with a word about why when the hills' day hasn't come.
 */
export function SwoopGame({ practiceDay, testDay }: { practiceDay?: string | null; testDay?: string | null }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? hillsDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  // Sent away only once we know: signed in (or not), and the API has said this account isn't an admin.
  const shut = Boolean(testDay) && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (practiceDay) return <PastSwoop key={`practice-${practiceDay}`} day={practiceDay} />
  if (testDay && admin === true) return <SwoopDayGame key={`test-${testDay}`} day={testDay} practice test onNewDay={() => {}} />
  // Still signing in, or still asking the API whether this account is an admin.
  if (testDay && !shut) return null
  const notice = testDay && testDay !== hillsDay() ? `Hills #${hillsNumber(testDay)}’s day hasn’t come yet. Here are today’s.` : today.notice
  return <SwoopDayGame key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: hillsDay(), notice: why })} />
}
