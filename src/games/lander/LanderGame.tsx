import '../../styles/lander.css'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
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
import { reportEgg } from '../../lib/eggs'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { normalizePlayerName } from '../../lib/leaderboard'
import { allTimeFact } from '../../lib/pastBoards'
import type { PastPlay } from '../../lib/pastPlay'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun, runIdFor } from '../../lib/runSession'
import { sfx } from '../../lib/sound'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { alienMiddle, alienOf, sayHi, WAVE_NEAR, type Alien } from './alien'
import { EngineSound } from './audio'
import { fetchBoardGhost, fetchNextGhost, fitsCave, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { ordinal } from '../../lib/scoreboard'
import { caveDay, caveNumber, msUntilNextCave, untilWords } from './daily'
import { CaveMap } from './map'
import { onItsDayFact, type ItsDay } from './pastDay'
import { PastCaveResult, PracticeStartCard } from './PracticeCards'
import {
  claimRun,
  Ghost,
  keepBestRun,
  keepPracticeRun,
  keptRun,
  landerDay,
  paceIfFlown,
  paceOf,
  practiceBest,
  type GhostPose,
  type GhostRun,
  type LanderDay,
} from './runs'
import { CaveScene } from './scene'
import { useSkinInto } from '../../lib/skins'
import { crashWords, formatLanderBoardScore, formatRun, landerBoardScore, landerMsFromBoardScore } from './score'
import { MedalRow } from '../../components/RaceMedal'
import { paceMsOf } from '../../lib/raceMedals'
import { TomorrowCave } from './TomorrowCave'
import { TestResultCard, TestStartCard } from './TestCards'
import {
  CRASH_FOR,
  DT,
  ENGINE_OFF,
  ENGINE_ON,
  engineOn,
  GHOST_EVERY,
  makePilot,
  newShip,
  respawn,
  step,
  WRECKED,
  wrap,
  type Hands,
  type Ship,
} from './sim'

const SLUG = 'lander'

type Phase = 'menu' | 'countdown' | 'flying' | 'wrecked' | 'landed' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'flying', 'wrecked'])
/** The count: 3, 2, 1 a little under a second apart, then go. */
const COUNT_FROM = 3
const COUNT_STEP = 0.8
/** Down on the pad, a moment to see the time before the card comes. */
const CARD_AFTER = 1.1
/** How far a finger drags from where it landed before the stick does anything, and for a full engine, in CSS pixels. */
const STICK_DEAD = 14
const STICK_FULL = 60

type Held = { left: boolean; right: boolean; up: boolean }
const NONE: Held = { left: false, right: false, up: false }
const KEYS: Record<string, keyof Held> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  Space: 'up',
}

/**
 * Whose run the ghost flies: the player one place above you today (`next`, for their place); the board's #1,
 * under their tag; your own best; or the blue ship's. A player's, in the skin it was flown in.
 */
type Chasing =
  | { who: 'next'; name: string; place: number; skin?: string }
  | { who: 'rival'; name: string; skin?: string }
  | { who: 'you'; skin?: string }
  | { who: 'pace' }

/** The name over the ghost: whose run it flies. */
function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'Your best' : 'Blue ship'
}

/** The ghost's tile on the start card: "Beat PILOT for 13th", "Ghost · DAD", "Ghost · Your best", "Blue ship". */
function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue ship'
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
  ship: Ship
  /** Where the ship was a step ago, to draw it between steps. */
  last: { x: number; y: number; a: number }
  /** Seconds into the count, or since landing. */
  clock: number
  /** The run's own clock: seconds since the go, crashes and all. */
  t: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  steps: number
  /** This run's path, for its ghost if it's your best (sim.ts Flight's ghost). */
  record: number[]
  /** Seconds left watching the wreck. */
  wreckFor: number
  /** The engine this step, 0 to 1, for the flame and the sound. */
  throttle: number
  /** Each gate's moment, then the landing's. */
  splits: number[]
  crashes: number
  /** The run's clock at the last bump's knock, so sliding along rock knocks now and then, not every step. */
  bumpAt: number
  /** The alien has waved at this run's ship: the easter egg's found, and it said hi. */
  greeted: boolean
  /** The run being chased, and whose it is. */
  ghost: Ghost
  chasing: Chasing
  /**
   * The run's result, once it's down, and your best here before it. `runId`: a past cave's run, asked for as it
   * ended (runSession runIdFor), which its All time board needs.
   */
  run: {
    time: number
    score: number
    splits: number[]
    crashes: number
    improved: boolean
    before: number | null
    path: number[]
    runId: Promise<string | undefined> | null
  } | null
}

/** A past cave's All time board (lib/trackBoards.ts), and asking for it again once a flight is saved. */
type PastBoard = { board: TrackBoard | null; refresh: () => void }

type Ui = {
  phase: Phase
  /** 3, 2, 1 while counting; 0 for Go (a moment into the run); −1 for nothing. */
  count: number
  /** Gates passed. */
  passed: number
  crashes: number
}

function countOf(g: Game): number {
  if (g.phase === 'countdown') return Math.max(1, COUNT_FROM - Math.floor(g.clock / COUNT_STEP))
  if (g.phase === 'flying' && g.t < 0.7) return 0
  return -1
}

const snapshot = (g: Game): Ui => ({ phase: g.phase, count: countOf(g), passed: g.ship.gate + 1, crashes: g.crashes })

/** Your best run down a day's cave: in practice, this tab's (or this device's, from its day); else this device's. */
function bestOf(day: string, practice: boolean, viewer: string | null | undefined): GhostRun | null {
  const kept = keptRun(day, viewer)
  if (!practice) return kept
  const tab = practiceBest(day, viewer)
  return tab && (!kept || tab.time < kept.time) ? tab : kept
}

/** The run to chase, and whose it is. */
type Chase = { ghost: Ghost; chasing: Chasing }

/** Whose the #1's run is: yours, when it's your tag at the top. */
const topChasing = (top: BoardGhost, me: string): Chasing =>
  top.name === me ? { who: 'you', skin: top.skin } : { who: 'rival', name: top.name, skin: top.skin }

/**
 * Your own best, as a ghost: in the skin it was flown in. A run kept before runs kept their skin borrows the
 * board's, when the #1 is you at the same time.
 */
const mineChasing = (mine: GhostRun, top: BoardGhost | null, me: string): Chasing => ({
  who: 'you',
  skin: mine.skin ?? (top && top.name === me && Math.abs(top.time - mine.time) < 0.0005 ? top.skin : undefined),
})

/**
 * The run to beat. In today's cave, once you've a run on the board, the player's one place above you, for
 * their place: pass them and the next one lines up (Ramsey, 2026-10-05: a ghost in reach every run). Else the
 * board's #1, on their own line, or on the blue ship's at their time when theirs isn't known (boardGhost.ts
 * standIn); unless your own best here is faster. With nobody on the board, your best here when it beats the
 * blue ship, else the blue ship's. Your own is the one of whoever is signed in now.
 */
function chaseFor(day: string, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const pace = paceOf(day)
  const mine = bestOf(day, practice, currentAccountId())
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(next.run ?? standIn(pace, next.time)), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(top.run ?? standIn(pace, top.time)), chasing: topChasing(top, me) }
  }
  return mine && mine.time < pace.time ? { ghost: new Ghost(mine), chasing: mineChasing(mine, top, me) } : { ghost: new Ghost(pace), chasing: { who: 'pace' } }
}

/**
 * The run to chase at the start card, where the blue ship may not have flown yet (paceOf warms it while the
 * card is up): the card needs only the time to beat and whose it is. Until the blue ship has flown, a run
 * whose path isn't known waits on the start pad; once it has, the card's camera rides along with it.
 */
function cardChase(lander: LanderDay, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const mine = bestOf(lander.day, practice, currentAccountId())
  const flown = paceIfFlown(lander.day)
  const { x, y } = lander.cave.spawn
  const waiting = (time: number) =>
    new Ghost(flown ? standIn(flown, time) : { time, splits: [], ghost: [x, y, 0, ENGINE_OFF, x, y, 0, ENGINE_OFF] })
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: next.run ? new Ghost(next.run) : waiting(next.time), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: top.run ? new Ghost(top.run) : waiting(top.time), chasing: topChasing(top, me) }
  }
  if (mine && mine.time < lander.pace) return { ghost: new Ghost(mine), chasing: mineChasing(mine, top, me) }
  return { ghost: flown ? new Ghost(flown) : waiting(lander.pace), chasing: { who: 'pace' } }
}

function freshGame(lander: LanderDay, chase: Chase): Game {
  const ship = newShip(lander.cave)
  return {
    phase: 'menu',
    day: lander.day,
    owner: undefined,
    ship,
    last: { x: ship.x, y: ship.y, a: ship.a },
    clock: 0,
    t: 0,
    carry: 0,
    steps: 0,
    record: [],
    wreckFor: 0,
    throttle: 0,
    splits: [],
    crashes: 0,
    bumpAt: -1,
    greeted: false,
    ghost: chase.ghost,
    chasing: chase.chasing,
    run: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

const calmMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** A gate's time against the ghost's at the same gate: −0.42 ahead, +1.10 behind. */
function gapText(d: number) {
  return Math.abs(d) < 0.005 ? '0.00' : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`
}
const gapTone = (d: number | null) => (d == null || Math.abs(d) < 0.005 ? '' : d < 0 ? 'good' : 'bad')

/** "Gate 2", or the last, at the landing room's door: "Landing room". */
const gateName = (lander: LanderDay, i: number) => (i === lander.cave.gates.length - 1 ? 'Landing room' : `Gate ${i + 1}`)

/** A run to send on: the day's cave, the time against the blue ship, and the way to today's cave. */
function runShareLine(lander: LanderDay, time: number, pace: number, crashes: number): string {
  const gap = Math.abs(time - pace)
  const against = gap < 0.005 ? 'tied with the blue ship' : time < pace ? `beat the blue ship by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue ship`
  return [`Lander · Today’s Cave #${lander.n} 🚀`, `${lander.name}: ${formatRun(time)}, ${against}, ${crashWords(crashes)}`, `${window.location.origin}${gamePlayHref(SLUG)}`].join(
    '\n',
  )
}

/** Today's cave and its number, the run its ghost flies (the #1's, your best, or the blue ship's), and when the next cave comes. */
function CaveTiles({ lander, ghost, chasing, bestMs }: { lander: LanderDay; ghost: number; chasing: Chasing; bestMs: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextCave())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextCave()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <>
      <div className="game-pause-meta__row lander-cave">
        <span>Today’s cave · #{lander.n}</span>
        <strong>{lander.name}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>{chasingLabel(chasing)}</span>
        <strong>{formatRun(ghost)}</strong>
      </div>
      <MedalRow paceMs={paceMsOf(lander.pace)} bestMs={bestMs} format={formatRun} />
      <div className="game-pause-meta__row">
        <span>Next cave</span>
        <strong>{untilWords(left)}</strong>
      </div>
    </>
  )
}

/**
 * Lander: fly a ship down a cave and set it down on the pad at the bottom, against the clock. Gravity pulls;
 * the engine pushes the way the nose points. The skill is carrying speed down the open stretches and taking it
 * off before a bend, a squeeze or the pad, and landing gently and level.
 *
 * It's a daily: a new cave every day, the same for everyone (daily.ts), flown as often as you like, and the
 * board is the day's (the API keeps Lander's board to today's cave, whatever the period). LanderGame mounts
 * it for today; when midnight has brought a new cave by the next start, it asks for the new day with
 * `onNewDay`, which mounts it again, with `notice` to say why when a run was lost to it.
 *
 * Bump the rock gently and the ship is knocked off it and flies on; hit it hard and the ship is back at the
 * last gate, with the clock still running: a crash costs the time it takes, never a penalty on top. The ghost is the run to beat, flying alongside the whole way with whose it is
 * over it: the board's #1 (today's, or in a past cave its All time #1: boardGhost.ts), unless your
 * own best here is faster; with nobody on the board, your best here if it beats the blue ship, else the blue
 * ship's.
 *
 * Keys: ← → (or A D) turn, ↑ (or W or Space) the engine, R start again, P or Escape pause. On a touch screen,
 * a stick wherever a finger lands: the nose turns the way it's dragged, and dragging further gives more engine.
 * A run is scored as its time: the board keeps a million less the milliseconds (score.ts), so the fastest run
 * is the highest score.
 */
function LanderDayGame({
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
   * A day's cave not flown for today's board: a past cave from the past tab (with `pastBoard`), or an admin's
   * test flight (with `test`). Your best here on this device lasts the tab.
   */
  practice?: boolean
  /**
   * An admin's test flight of today's cave or one still to come, from the Cave Book: nothing kept, as in
   * practice (and `practice` is set with it), on cards of its own (TestCards.tsx).
   */
  test?: boolean
  /** A past cave's day as the API has it, for its cards: who was 1st, and you. */
  itsDay?: ItsDay
  /** A past cave's All time board: signed in, a flight on it goes there, under a run of its own. */
  pastBoard?: PastBoard | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const lander = landerDay(day)
  const pace = lander.pace
  const past = pastBoard !== null && !test
  const board = pastBoard?.board ?? null
  /** The board's #1 as last told (boardGhost.ts), and the tag you play under, for whose the ghost is. */
  const topRef = useRef<BoardGhost | null>(null)
  // In today's cave, the player one place above you, once you've a run on the board (boardGhost.ts fetchNextGhost).
  const nextRef = useRef<NextGhost | null>(null)
  // The player's own skin, if they chose one (lib/skins.ts): looks only.
  const skinRef = useRef<string | null>(null)
  useSkinInto(SLUG, skinRef)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(lander, cardChase(lander, practice, null, playerName, null))
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noCanvas, setNoCanvas] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [touch] = useState(touchScreen)
  const [hint, setHint] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const splitRef = useRef<HTMLElement>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CaveScene | null>(null)
  /** The cave's alien (alien.ts), once the blue ship has flown and it's known where it stands. */
  const alienRef = useRef<Alien | null>(null)
  const soundRef = useRef<EngineSound | null>(null)
  const keysRef = useRef<Held>({ ...NONE })
  /** The finger on the stick: where it came down, and where it is now. */
  const stickAt = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null)
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((s: Ship) => Hands) | null>(null)
  /** The hands on the last step, for the dev hook. */
  const handsRef = useRef<Hands>({ turn: 0, thrust: 0 })
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

  const letGoStick = () => {
    stickAt.current = null
    if (stickRef.current) stickRef.current.hidden = true
  }

  /** Midnight has brought a new cave: the page mounts the game again for it. */
  const newDay = (why?: string) => {
    if (practice || caveDay() === day || devDay()) return false
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
    // A test flight opens no run: nothing it does is saved. A past cave's flight goes on its All time board,
    // timed by the server as a day's is.
    if (!practice) {
      clearRunAchievements()
      beginRun(SLUG)
    } else if (past) beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(lander, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    sceneRef.current?.snap()
    soundRef.current?.wake()
    letGoStick()
    setHint(touch)
    say(null)
    setUi(snapshot(g))
  }

  /** Done with the run: back to the start card. Nothing counts until the next one starts. */
  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(lander, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 300
    letGoStick()
    setHint(false)
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
    gameRef.current = freshGame(lander, cardChase(lander, practice, topRef.current, nameRef.current, nextRef.current))
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  /** The board's fastest run, as it's known: at the start card, the ghost to race changes to it at once. */
  const takeTop = (next: BoardGhost | null) => {
    // A path flown down this cave before it was dug again flies through rock: their time on the blue ship's line instead.
    topRef.current = next?.run && !fitsCave(lander.cave, next.run) ? { ...next, run: null } : next
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
   * A run saved on the board sends where the ship went: the API keeps it if it's the tag's run on the board and
   * the fastest there, and then it's everyone's ghost, yours included from your next run. In today's cave every
   * run goes, as the API keeps each player's best for whoever is one place below them to race; then the player
   * above you is asked for again, as you may have passed them. In a past cave only one that could be its fastest
   * goes: the #1 is faster, or their line is known and at least as fast, and it stays home.
   */
  const sendGhost = (run: { time: number; score: number; splits: number[]; path: number[] }, name: string) => {
    if ((practice && !past) || !signedIn || !name) return
    const known = topRef.current
    const today = !practice
    if (!today && known && (known.time < run.time - 0.0005 || (known.run && known.run.time <= run.time + 0.0005))) return
    void sendBoardGhost(lander.n, name, run).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(lander.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  /** The player one place above you in today's cave: asked for as it opens, and again after each run you save. */
  const askNext = () => {
    const tag = nameRef.current
    if (practice || !signedIn || !tag || lander.day > caveDay()) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(lander.n, tag).then((next) => {
      // Signed in as someone else meanwhile: theirs is asked for in turn.
      if (tag !== nameRef.current) return
      // A path flown down this cave before it was dug again flies through rock: their time on the blue ship's line instead.
      nextRef.current = next?.run && !fitsCave(lander.cave, next.run) ? { ...next, run: null } : next
      rechaseRef.current()
    })
  }
  const askNextRef = useRef(askNext)
  askNextRef.current = askNext
  useEffect(() => {
    askNextRef.current()
  }, [signedIn, playerName, lander.n, practice])

  // The board's fastest run, for the ghost: asked for as the cave opens (a past one's, its All time #1).
  // A cave whose day hasn't come, on an admin's test flight, has no board yet.
  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    let live = true
    const asked = lander.day > caveDay() ? Promise.resolve(null) : fetchBoardGhost(lander.n)
    void asked.then((found) => {
      if (!live) return
      if (found) takeTopRef.current(found)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [lander.n, lander.day])

  // Then your best here on this device, if it's faster than that: the API keeps it only if it's on the board
  // under your tag. So a run saved on a card closed too soon still gets there. Only your account's own run
  // goes, once for each account signed in here: never one flown signed out, or another's.
  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (practice || !topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = keptRun(day, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: landerBoardScore(mine.time), splits: mine.splits, path: mine.ghost }, playerName)
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
    const { cave } = lander
    // A canvas of the scene's own: when it goes, it goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'lander__view'
    canvas.setAttribute('aria-label', 'The cave, seen from the side, following your ship')
    holder.append(canvas)
    let scene: CaveScene
    try {
      scene = new CaveScene(canvas, cave)
    } catch {
      canvas.remove()
      setNoCanvas(true)
      return
    }
    sceneRef.current = scene
    const sound = new EngineSound()
    soundRef.current = sound
    const map = mapRef.current ? new CaveMap(mapRef.current, cave) : null
    const retheme = () => map?.rebuild()
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const calm = calmMotion()

    /**
     * The hands this step. The stick points the nose the way the finger went from where it landed, and fires
     * harder the further it went, easing off while the nose is still coming round. The keys turn and fire.
     */
    const readHands = (g: Game): Hands => {
      if (autopilot.current) return autopilot.current(g.ship)
      const s = stickAt.current
      if (s) {
        const dx = s.x - s.x0
        const dy = s.y - s.y0
        const len = Math.hypot(dx, dy)
        if (len < STICK_DEAD) return { turn: 0, thrust: 0 }
        const err = wrap(Math.atan2(dx, -dy) - g.ship.a)
        const level = Math.min(1, (len - STICK_DEAD) / (STICK_FULL - STICK_DEAD))
        return { turn: Math.max(-1, Math.min(1, err * 5)), thrust: level * Math.max(0, Math.cos(err)) ** 2 }
      }
      const keys = keysRef.current
      return { turn: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), thrust: keys.up ? 1 : 0 }
    }

    const splitShown = (g: Game, k: number) => {
      const at = g.splits[k]
      const theirs = g.ghost.run.splits[k]
      const d = at != null && theirs != null ? at - theirs : null
      const el = splitRef.current
      if (el) {
        el.textContent = d == null ? (at != null ? formatRun(at) : '–') : gapText(d)
        el.className = gapTone(d) ? `lander__delta--${gapTone(d)}` : ''
      }
      return d
    }

    const finishRun = (g: Game) => {
      const time = g.t
      const s = g.ship
      g.splits.push(time)
      g.record.push(Math.round(s.x * 100) / 100, Math.round(s.y * 100) / 100, 0, ENGINE_OFF)
      // Against the best of whoever flew it, and kept as theirs: someone else signed in meanwhile has theirs.
      const kept = g.owner === undefined ? null : bestOf(g.day, practice, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      const path = g.record
      if (improved && g.owner !== undefined) {
        const run = { time, splits: [...g.splits], ghost: path, ...(skinRef.current ? { skin: skinRef.current } : {}) }
        if (practice) keepPracticeRun(g.day, g.owner, run)
        else keepBestRun(g.day, g.owner, run)
      }
      g.run = {
        time,
        score: landerBoardScore(time),
        splits: [...g.splits],
        crashes: g.crashes,
        improved,
        before: kept?.time ?? null,
        path,
        runId: past ? runIdFor(SLUG) : null,
      }
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
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
      const s = g.ship
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
      if (live && (g.phase === 'flying' || g.phase === 'wrecked')) {
        g.carry += dt
        while (g.carry >= DT && (g.phase === 'flying' || g.phase === 'wrecked')) {
          g.carry -= DT
          if (g.phase === 'wrecked') {
            // The wreck watched a moment, the clock running, then the ship back at its gate.
            if (g.steps % GHOST_EVERY === 0) g.record.push(Math.round(s.x * 100) / 100, Math.round(s.y * 100) / 100, Math.round(s.a * 100) / 100, WRECKED)
            g.steps += 1
            g.t += DT
            g.wreckFor -= DT
            if (g.wreckFor <= 0) {
              respawn(lander.cave, s)
              g.last = { x: s.x, y: s.y, a: s.a }
              g.phase = 'flying'
              scene.snap()
            }
            continue
          }
          g.last = { x: s.x, y: s.y, a: s.a }
          const hands = readHands(g)
          handsRef.current = hands
          // The ghost's path keeps time with the clock, crashes and all.
          if (g.steps % GHOST_EVERY === 0) {
            g.record.push(Math.round(s.x * 100) / 100, Math.round(s.y * 100) / 100, Math.round(s.a * 100) / 100, engineOn(s, hands) ? ENGINE_ON : ENGINE_OFF)
          }
          const ev = step(lander.cave, s, hands)
          g.steps += 1
          g.t += DT
          g.throttle = s.rest || s.hold > 0 ? 0 : hands.thrust
          if (ev === 'crash') {
            g.crashes += 1
            g.phase = 'wrecked'
            g.wreckFor = CRASH_FOR
            g.throttle = 0
            scene.crash(s, CRASH_FOR)
            const back = s.gate < 0 ? 'the start' : s.gate === lander.cave.gates.length - 1 ? 'the landing room' : `gate ${s.gate + 1}`
            sayRef.current(`Crashed · back to ${back}`, 1.6)
            sfx('boom')
            haptic('crash')
          } else if (ev === 'bump') {
            // Knocked off the rock, and on: a knock and a buzz, no more than a few times a second while it slides.
            if (g.t - g.bumpAt > 0.3) {
              sfx('hit')
              haptic('hit')
            }
            g.bumpAt = g.t
          } else if (ev === 'landed') {
            // Timed to the moment the foot met the pad, inside the step, as a lap is to the line.
            g.t -= DT * (1 - (s.landFrac ?? 1))
            g.phase = 'landed'
            g.clock = 0
            g.throttle = 0
            finishRun(g)
          } else if (ev && typeof ev === 'object') {
            g.splits[ev.gate] = g.t
            const d = splitShown(g, ev.gate)
            sayRef.current(`${gateName(lander, ev.gate)} · ${d == null ? formatRun(g.t) : gapText(d)}`)
            sfx('good', d != null && d < 0 ? 2 : 0)
          }
        }
      }
      if (live && g.phase === 'landed') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another run first. A run that midnight came
        // in the middle of was in yesterday's cave, and today's board is another cave's: not saved.
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that run, so it was in yesterday’s cave. Here’s today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          letGoStick()
        }
      }

      // Where things are this frame: the ship between its last two steps, the ghost at the run's moment.
      const f = g.phase === 'flying' && live ? Math.min(1, g.carry / DT) : 1
      const pose = {
        x: g.last.x + (s.x - g.last.x) * f,
        y: g.last.y + (s.y - g.last.y) * f,
        a: g.last.a + wrap(s.a - g.last.a) * f,
        vx: s.vx,
        vy: s.vy,
      }
      let ghost: GhostPose | null
      if (g.phase === 'menu') {
        // Before a run the camera rides with the run to beat, round and round.
        if (live) attract += dt
        ghost = g.ghost.at(attract)
        if (ghost.done && attract > g.ghost.run.time + 2) attract = 0
      } else ghost = g.ghost.at(g.phase === 'countdown' ? 0 : g.t)
      // The easter egg: the alien waves at your ship, never the ghost, while it's flying close. The first wave
      // of a run says hi and finds the secret.
      const alien = alienRef.current
      let greet = false
      if (alien && g.phase === 'flying') {
        const [ax, ay] = alienMiddle(alien)
        greet = Math.hypot(s.x - ax, s.y - ay) < WAVE_NEAR
        if (greet && !g.greeted) {
          g.greeted = true
          sayHi()
          haptic('turn')
          void reportEgg('alien')
        }
      }
      const mode = g.phase === 'menu' ? 'menu' : g.phase === 'wrecked' ? 'wreck' : g.phase === 'landed' || g.phase === 'gameover' ? 'done' : 'play'
      scene.frame(
        {
          mode,
          ship: pose,
          engine: live && g.phase === 'flying' ? g.throttle : 0,
          gate: s.gate,
          ghost,
          ghostTag: ghostTag(g.chasing),
          ghostMine: g.chasing.who === 'you',
          calm,
          skin: skinRef.current,
          ghostSkin: g.chasing.who === 'pace' ? null : (g.chasing.skin ?? null),
          greet,
        },
        live ? dt : 0,
      )
      map?.draw(pose.x, pose.y, ghost && !ghost.wrecked && g.phase !== 'menu' ? ghost : null)
      sound.update(g.throttle, live && g.phase === 'flying')
      if (clockRef.current) {
        const text = formatRun(g.run ? g.run.time : g.phase === 'flying' || g.phase === 'wrecked' ? g.t : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }

      // The rest of the heads-up changes only when something happens: the count, a gate, a crash.
      const next = snapshot(g)
      const key = `${next.phase}|${next.count}|${next.passed}|${next.crashes}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    // The blue ship's run, flown now while the card is up, so the start doesn't wait on it; the card's camera
    // then rides along with the run to beat. The alien stands a little way off its line, so it comes then too.
    const warm = window.setTimeout(() => {
      const pace = paceOf(lander.day)
      alienRef.current = alienOf(cave, pace.ghost)
      scene.meet(alienRef.current)
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
    // Once for the day's cave: the page mounts the game again for another day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The keys: held while down; a run starts from the card on Space or Enter, and R starts it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (saveOpenRef.current || pausedRef.current) return
      const g = gameRef.current!
      if (g.phase === 'menu') {
        if (e.code !== 'Space' && e.code !== 'Enter') return
        e.preventDefault()
        if (!e.repeat && performance.now() >= startGrace.current) start()
        return
      }
      if (!IN_RUN.has(g.phase)) return
      const held = KEYS[e.code]
      if (held) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        keysRef.current[held] = true
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault()
        restart()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const held = KEYS[e.code]
      if (held) keysRef.current[held] = false
    }
    const letGo = () => {
      keysRef.current = { ...NONE }
      letGoStick()
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
    keysRef.current = { ...NONE }
    letGoStick()
  }, [paused])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  // Mounted again for a new day because a run was lost to midnight: say so.
  useEffect(() => {
    if (notice) say(notice, 6)
    // Once, on the mount the notice came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dev only: read the run, or let the blue ship's hands take over, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __lander?: () => Game
      __landerScene?: () => CaveScene | null
      __landerAuto?: (on?: boolean) => void
      __landerStart?: () => void
      __landerHands?: () => { hands: Hands; stick: typeof stickAt.current }
    }
    w.__lander = () => gameRef.current!
    w.__landerHands = () => ({ hands: handsRef.current, stick: stickAt.current })
    w.__landerScene = () => sceneRef.current
    w.__landerAuto = (on = true) => {
      autopilot.current = on ? makePilot(lander.cave) : null
    }
    w.__landerStart = () => start()
    return () => {
      delete w.__lander
      delete w.__landerScene
      delete w.__landerAuto
      delete w.__landerStart
      delete w.__landerHands
    }
  })

  /* A tap in the cave starts a run from the card; in a run, a finger anywhere is the stick. */
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const g = gameRef.current!
    if (g.phase === 'menu') {
      e.preventDefault()
      if (performance.now() >= startGrace.current) start()
      return
    }
    if (!IN_RUN.has(g.phase) || stickAt.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    stickAt.current = { id: e.pointerId, x0: x, y0: y, x, y }
    const stick = stickRef.current
    if (stick) {
      stick.style.left = `${x}px`
      stick.style.top = `${y}px`
      stick.hidden = false
    }
    if (knobRef.current) knobRef.current.style.transform = ''
    setHint(false)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = stickAt.current
    if (!s || e.pointerId !== s.id) return
    const box = e.currentTarget.getBoundingClientRect()
    s.x = e.clientX - box.left
    s.y = e.clientY - box.top
    let dx = s.x - s.x0
    let dy = s.y - s.y0
    const l = Math.hypot(dx, dy)
    if (l > STICK_FULL) {
      dx *= STICK_FULL / l
      dy *= STICK_FULL / l
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (stickAt.current?.id === e.pointerId) letGoStick()
  }

  const g = gameRef.current!
  const showroom = ui.phase === 'menu'
  const run = g.run
  const tabBest = practice ? (bestOf(day, true, g.owner === undefined ? viewer : ownerAccount(g.owner))?.time ?? null) : null
  // A past cave's best here is your best on its All time board too, signed in.
  const boardBest = past && viewer !== null && board?.you ? landerMsFromBoardScore(board.you.score) / 1000 : null
  const practiceBestTime = tabBest == null ? boardBest : boardBest == null ? tabBest : Math.min(tabBest, boardBest)
  const bestText = practice
    ? practiceBestTime != null
      ? formatRun(practiceBestTime)
      : '–'
    : apiBest > 0
      ? formatRun(landerMsFromBoardScore(apiBest) / 1000)
      : '–'
  // Whose the run is, for its card: an account's run waits for that account; one flown signed out goes to whoever signs in.
  const runOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  // A past cave: the chip, the tab's title, the way back to its row and its day's figures, the same on the play
  // screen, the pause card and the start card (lib/pastPlay.ts).
  const went: ItsDay = itsDay ?? { days: null, failed: false, me: null }
  // Signed in, a flight goes on the cave's All time board. Signed out it's practice, and so is a flight flown
  // signed out, for good: signing in on its card is for the flights after it.
  // One in the archive, older than a week (lib/archive.ts), is practice for everyone: its board is closed.
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
        title: lander.name,
        facts: [onItsDayFact(day, went), allTimeFact(SLUG, board, viewer !== null, formatLanderBoardScore)],
      }
    : null
  const extra = practice ? (
    <>
      <div className="game-pause-meta__row">
        <span>Blue ship</span>
        <strong>{formatRun(pace)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Your best here</span>
        <strong>{bestText}</strong>
      </div>
    </>
  ) : (
    <CaveTiles lander={lander} ghost={g.ghost.run.time} chasing={g.chasing} bestMs={apiBest > 0 ? landerMsFromBoardScore(apiBest) : null} />
  )
  const splitsText = (r: NonNullable<Game['run']>) =>
    [lander.name, ...r.splits.slice(0, -1).map((at, k) => `${k === lander.cave.gates.length - 1 ? 'Room' : `G${k + 1}`} ${formatRun(at)}`), crashWords(r.crashes)].join(' · ')
  const lastGate = ui.passed > 0 ? ui.passed - 1 : -1

  return (
    <section
      className={`lander lander--fullscreen${showroom ? ' lander--showroom' : ''}${touch ? ' lander--touch' : ''}${pastPlay ? ' lander--past' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div className="lander__play" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div ref={holderRef} className="lander__holder" />

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
                <PlayReadoutScore className="lander__clock">
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  <PlayStat
                    label={lastGate < 0 ? 'Split' : lastGate === lander.cave.gates.length - 1 ? 'Room' : `Gate ${lastGate + 1}`}
                    value={<span ref={splitRef}>–</span>}
                  />
                  <PlayStat label="Crashes" value={String(ui.crashes)} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="lander__map" aria-hidden="true" />

            {ui.count >= 0 && !paused ? (
              <div className={`lander__count${ui.count === 0 ? ' is-go' : ''}`} role="status">
                {ui.count === 0 ? 'Go!' : ui.count}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="lander__toast" role="status">
                {toast}
              </div>
            ) : null}

            <div ref={stickRef} className="lander__stick" hidden>
              <div ref={knobRef} className="lander__knob" />
            </div>
            {hint && inRun && !paused ? <div className="lander__hint">Drag to fly: the nose points the way you drag, further for more engine</div> : null}

            {noCanvas ? (
              <div className="lander__nocanvas">
                <p>This browser can’t draw Lander’s cave.</p>
              </div>
            ) : null}

            <div className="lander__overlay">
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
                  <TestStartCard lander={lander} best={practiceBestTime} />
                ) : pastPlay ? (
                  <PracticeStartCard lander={lander} kind={pastKind} facts={pastPlay.facts ?? []} tiles={extra} board={board} />
                ) : (
                  <GameStartCard title="Lander" slug={SLUG} extraMeta={extra} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && run ? (
                test ? (
                  <TestResultCard
                    lander={lander}
                    time={run.time}
                    crashes={run.crashes}
                    best={practiceBestTime ?? run.time}
                    improved={run.improved}
                    onAgain={start}
                    onDone={toMenu}
                  />
                ) : past ? (
                  <PastCaveResult
                    lander={lander}
                    time={run.time}
                    score={run.score}
                    crashes={run.crashes}
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
                    title="Landed"
                    subtitle={splitsText(run)}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace * 1000)}
                    shareLine={runShareLine(lander, run.time, pace, run.crashes)}
                    medalPace={paceMsOf(lander.pace)}
                    medalFormat={formatRun}
                    kicker={`Today’s Cave #${lander.n}`}
                    tomorrow={<TomorrowCave day={lander.day} />}
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

/** Dev only: localStorage `skermix-lander-dev-day` = YYYY-MM-DD flies that day's cave, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-lander-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

/**
 * A past day's cave, from the past tab: anyone's to fly, and signed in, a flight goes on its All time board
 * (PracticeCards.tsx). How its day went (lib/archive.ts) and its board are asked for here, the board again
 * once a flight is saved. Signed out, they're asked for without a tag: nobody's place is shown as yours.
 */
function PastLander({ day }: { day: string }) {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(SLUG, viewer.name)
  const itsDay: ItsDay = { days, failed, me: viewer.state === 'in' ? viewer.name : null }
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, caveNumber(day), viewer.state === 'out' ? '' : viewer.name, version)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <LanderDayGame day={day} practice itsDay={itsDay} pastBoard={{ board, refresh }} onNewDay={() => {}} />
}

/**
 * Lander in today's cave, mounted again for the next when midnight brings it; with `practiceDay`, a past
 * day's cave from the past tab, onto its All time board; with `testDay`, today's cave or one still to come, test
 * flown from the admin's Cave Book. A test flight is only an admin's: anyone else is sent to today's cave,
 * with a word about why when the cave's day hasn't come.
 */
export function LanderGame({ practiceDay, testDay }: { practiceDay?: string | null; testDay?: string | null }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? caveDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  // Sent away only once we know: signed in (or not), and the API has said this account isn't an admin.
  const shut = Boolean(testDay) && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (practiceDay) return <PastLander key={`practice-${practiceDay}`} day={practiceDay} />
  if (testDay && admin === true) return <LanderDayGame key={`test-${testDay}`} day={testDay} practice test onNewDay={() => {}} />
  // Still signing in, or still asking the API whether this account is an admin.
  if (testDay && !shut) return null
  const notice = testDay && testDay !== caveDay() ? `Cave #${caveNumber(testDay)}’s day hasn’t come yet. Here’s today’s.` : today.notice
  return <LanderDayGame key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: caveDay(), notice: why })} />
}
