import '../../styles/marblerun.css'
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
import { useSkinInto } from '../../lib/skins'
import { sfx } from '../../lib/sound'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { RollSound } from './audio'
import { fetchBoardGhost, fetchNextGhost, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { ordinal } from '../../lib/scoreboard'
import { courseDay, courseNumber, msUntilNextCourse, untilWords } from './daily'
import { CourseMap } from './map'
import { onItsDayFact, type ItsDay } from './pastDay'
import { PastCourseRunResult, PracticeStartCard } from './PracticeCards'
import { claimRun, Ghost, keepBestRun, keepPracticeRun, keptRun, labDay, marbleDay, paceOf, practiceBest, type GhostRun, type MarbleDay } from './runs'
import { MarbleScene } from './scene'
import { formatMarblerunBoardScore, formatRun, marblerunBoardScore, marblerunMsFromBoardScore } from './score'
import { MedalRow } from '../../components/RaceMedal'
import { paceMsOf } from '../../lib/raceMedals'
import { TomorrowCourse } from './TomorrowCourse'
import { LabResultCard, LabStartCard, TestResultCard, TestStartCard } from './TestCards'
import { DT, G, GHOST_EVERY, handsTilt, makeDriver, newBall, PLAYER_BRAKE, PLAYER_TILT_MAX, racingPlan, respawn, STEADY, step, TURN_HELP, zoneUnder, type Ball, type Tilt } from './sim'

const SLUG = 'marblerun'

type Phase = 'menu' | 'countdown' | 'rolling' | 'fallen' | 'finished' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'rolling', 'fallen'])
/** The count: 3, 2, 1 a little under a second apart, then go. */
const COUNT_FROM = 3
const COUNT_STEP = 0.8
/** Past the goal, a moment to see the time before the card comes. */
const CARD_AFTER = 1.1
/** Off the edge, how long the ball is watched falling before it starts again at the checkpoint. */
const FALL_FOR = 1.1
/** How far a thumb drags the stick for a full tilt, in CSS pixels. */
const STICK_R = 58
/** A key held tilts the world all the way in about a sixth of a second. */
const KEY_RATE = 6
/**
 * The easter egg: off the edge this many times in a run before its first checkpoint. "Lost your marbles?"
 * shows for this long, in seconds, and then the secret's pop-up comes.
 */
const MARBLES_FALLS = 3
const MARBLES_FOR = 2.5

type Held = { up: boolean; down: boolean; left: boolean; right: boolean }
const NONE: Held = { up: false, down: false, left: false, right: false }
const KEYS: Record<string, keyof Held> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

/**
 * Whose run the ghost rolls: the player one place above you today (`next`, for their place); the board's #1,
 * under their tag; your own best; or the blue ball's. `skin`, the season skin the run was rolled in, which its
 * ghost wears (lib/skins.ts); the blue ball is always blue.
 */
type Chasing =
  | { who: 'next'; name: string; place: number; skin?: string }
  | { who: 'rival'; name: string; skin?: string }
  | { who: 'you'; skin?: string }
  | { who: 'pace' }

/** The name over the ghost: whose run it rolls. */
function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'Your best' : 'Blue ball'
}

/** The ghost's tile on the start card: "Beat PILOT for 13th", "Ghost · DAD", "Ghost · Your best", "Blue ball". */
function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue ball'
}

/** Everything a run is, held outside React: the loop changes it 240 times a second. */
type Game = {
  phase: Phase
  day: string
  /**
   * Whose run it is (lib/deviceRuns.ts): the account signed in as it started, or SIGNED_OUT; none at the
   * start card. It's kept as their best and saved as theirs alone, whoever signs in meanwhile.
   */
  owner: string | undefined
  ball: Ball
  /** Seconds into the count, or since the goal. */
  clock: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  steps: number
  /** This run's path, for its ghost if it's your best. */
  record: number[]
  /** Seconds left watching a fall. */
  fallFor: number
  /** The keys' or the stick's ask, eased: x right, y forward, each −1 to 1. */
  input: { x: number; y: number }
  /** The world's tilt this moment, in the ball's terms (sim.ts Tilt). */
  tilt: Tilt
  /** The run being chased, and whose it is. */
  ghost: Ghost
  chasing: Chasing
  /** The run's result, once it's over, and your best here before it. */
  run: {
    time: number
    score: number
    splits: number[]
    falls: number
    improved: boolean
    before: number | null
    path: number[]
    /** The skin it was rolled in (lib/skins.ts), which its ghost wears. */
    skin?: string
    /** A past course's run, asked for as it ended (runSession runIdFor), which its All time board needs. */
    runId: Promise<string | undefined> | null
  } | null
}

/** A past course's All time board (lib/trackBoards.ts), and asking for it again once a run is saved. */
type PastBoard = { board: TrackBoard | null; refresh: () => void }

type Ui = {
  phase: Phase
  /** 3, 2, 1 while counting; 0 for Go (a moment into the run); −1 for nothing. */
  count: number
  /** Lines crossed: checkpoints, then the goal. */
  passed: number
  falls: number
}

function countOf(g: Game): number {
  if (g.phase === 'countdown') return Math.max(1, COUNT_FROM - Math.floor(g.clock / COUNT_STEP))
  if (g.phase === 'rolling' && g.ball.t < 0.7) return 0
  return -1
}

const snapshot = (g: Game): Ui => ({ phase: g.phase, count: countOf(g), passed: g.ball.next, falls: g.ball.falls })

/** Your best run of a day's course: in practice, this tab's (or this device's, from its day); else this device's. */
function bestOf(day: string, practice: boolean, viewer: string | null | undefined): GhostRun | null {
  const kept = keptRun(day, viewer)
  if (!practice) return kept
  const tab = practiceBest(day, viewer)
  return tab && (!kept || tab.time < kept.time) ? tab : kept
}

/** The run to chase, and whose it is. */
type Chase = { ghost: Ghost; chasing: Chasing }

/** Whose the #1's run is: yours, when it's your tag at the top. In the skin it was rolled in. */
const topChasing = (top: BoardGhost, me: string): Chasing =>
  top.name === me ? { who: 'you', skin: top.skin } : { who: 'rival', name: top.name, skin: top.skin }

/**
 * Your own best, in the skin it was rolled in; a run kept before runs kept theirs borrows the board's, when it's
 * yours at the top at the same time.
 */
const yourSkin = (mine: GhostRun, top: BoardGhost | null, me: string) =>
  mine.skin ?? (top && top.name === me && Math.abs(top.time - mine.time) < 0.0005 ? top.skin : undefined)

/**
 * Your first run on a course is against the blue ball (Ramsey, 2026-10-06: "the first time you play it should
 * be against blue and not the top score"): no run of yours here yet, none on the board, and the #1 isn't you.
 */
const firstRun = (mine: GhostRun | null, top: BoardGhost | null, me: string, next: NextGhost | null) =>
  !mine && !next && top?.name !== me

/**
 * The run to beat. Your first here, the blue ball's. On today's course, once you've a run on the board, the
 * player's one place above you, for their place: pass them and the next one lines up (Ramsey, 2026-10-05: a
 * ghost in reach every run). Else the board's #1, on their own line, or on the blue ball's at their time when
 * theirs isn't known (boardGhost.ts standIn); unless your own best here is faster. With nobody on the board,
 * your best here when it beats the blue ball, else the blue ball's. Your own is the one of whoever is signed in
 * now.
 */
function chaseFor(day: string, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const pace = paceOf(day)
  const mine = bestOf(day, practice, currentAccountId())
  if (firstRun(mine, top, me, next)) return { ghost: new Ghost(pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(next.run ?? standIn(pace, next.time)), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(top.run ?? standIn(pace, top.time)), chasing: topChasing(top, me) }
  }
  return mine && mine.time < pace.time
    ? { ghost: new Ghost(mine), chasing: { who: 'you', skin: yourSkin(mine, top, me) } }
    : { ghost: new Ghost(pace), chasing: { who: 'pace' } }
}

/**
 * The run to chase before the pace ball has rolled (paceOf warms it while the card is up): the card needs only
 * the time to beat and whose it is, and the ghost isn't out until a run starts.
 */
function cardChase(marble: MarbleDay, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const mine = bestOf(marble.day, practice, currentAccountId())
  const sp = marble.course.spawns[0]!
  const waiting = (time: number) => new Ghost({ time, splits: [], ghost: [sp.x, sp.y, sp.z, sp.x, sp.y, sp.z] })
  if (firstRun(mine, top, me, next)) return { ghost: waiting(marble.pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: next.run ? new Ghost(next.run) : waiting(next.time), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: top.run ? new Ghost(top.run) : waiting(top.time), chasing: topChasing(top, me) }
  }
  if (mine && mine.time < marble.pace) return { ghost: new Ghost(mine), chasing: { who: 'you', skin: yourSkin(mine, top, me) } }
  return { ghost: waiting(marble.pace), chasing: { who: 'pace' } }
}

/** The test track has no run to chase: a ghost that never leaves the start, which isn't shown. */
function labChase(marble: MarbleDay): Chase {
  const sp = marble.course.spawns[0]!
  return { ghost: new Ghost({ time: 0, splits: [], ghost: [sp.x, sp.y, sp.z, sp.x, sp.y, sp.z] }), chasing: { who: 'pace' } }
}

function freshGame(marble: MarbleDay, chase: Chase): Game {
  return {
    phase: 'menu',
    day: marble.day,
    owner: undefined,
    ball: newBall(marble.course, 0),
    clock: 0,
    carry: 0,
    steps: 0,
    record: [],
    fallFor: 0,
    input: { x: 0, y: 0 },
    tilt: { x: 0, z: 0 },
    ghost: chase.ghost,
    chasing: chase.chasing,
    run: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

/** A checkpoint's time against the ghost's at the same checkpoint: −0.42 ahead, +1.10 behind. */
function gapText(d: number) {
  return Math.abs(d) < 0.005 ? '0.00' : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`
}
const gapTone = (d: number | null) => (d == null || Math.abs(d) < 0.005 ? '' : d < 0 ? 'good' : 'bad')

/** A run to send on: the day's course, the time against the blue ball, and the way to today's course. */
function runShareLine(marble: MarbleDay, time: number, pace: number, falls: number): string {
  const gap = Math.abs(time - pace)
  const against = gap < 0.005 ? 'tied with the blue ball' : time < pace ? `beat the blue ball by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue ball`
  const fell = falls === 0 ? 'no falls' : falls === 1 ? '1 fall' : `${falls} falls`
  return [`Marble Run · Today’s Course #${marble.n} 🔮`, `${marble.name}: ${formatRun(time)}, ${against}, ${fell}`, `${window.location.origin}${gamePlayHref(SLUG)}`].join('\n')
}

/** Today's course and its number, the run its ghost rolls (the #1's, your best, or the blue ball's), and when the next course comes. */
function CourseTiles({ marble, ghost, chasing, bestMs }: { marble: MarbleDay; ghost: number; chasing: Chasing; bestMs: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextCourse())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextCourse()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <>
      <div className="game-pause-meta__row marblerun-course">
        <span>Today’s course · #{marble.n}</span>
        <strong>{marble.name}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>{chasingLabel(chasing)}</span>
        <strong>{formatRun(ghost)}</strong>
      </div>
      <MedalRow game="marblerun" paceMs={paceMsOf(marble.pace)} bestMs={bestMs} format={formatRun} />
      <div className="game-pause-meta__row">
        <span>Next course</span>
        <strong>{untilWords(left)}</strong>
      </div>
    </>
  )
}

/**
 * Marble Run: roll a marble down a course hanging in the dark, against the clock, in 3D. You don't push the
 * marble, you tilt the world: it rolls the way the world leans, and keeps its speed until you lean the
 * other way. The skill is carrying speed where the track allows it and taking it off before a curve, a
 * narrow or a jump that doesn't.
 *
 * It's a daily: a new course every day, the same for everyone (daily.ts), rolled as often as you like, and
 * the board is the day's (the API keeps Marble Run's board to today's course, whatever the period).
 * MarbleRunGame mounts it for today; when midnight has brought a new course by the next start, it asks for
 * the new day with `onNewDay`, which mounts it again, with `notice` to say why when a run was lost to it.
 *
 * Roll off an edge and the marble starts again at the last checkpoint, with the clock still running: a
 * fall costs the time it takes, never a penalty on top. The ghost is the run to beat, rolling alongside
 * the whole way with whose it is over it: the board's #1 (today's, or on a past course its All time
 * #1: boardGhost.ts), unless your own best here is faster; with nobody on the board, your best
 * here if it beats the blue ball, else the blue ball's.
 *
 * Keys: ← → ↑ ↓ or WASD tilt, R start again, P or Escape pause. On a touch screen, a stick wherever a thumb
 * lands. A run is scored as its time: the board keeps a million less the milliseconds (score.ts), so the
 * fastest run is the highest score.
 */
function MarbleRunDay({
  day,
  practice = false,
  test = false,
  lab = false,
  itsDay,
  pastBoard = null,
  onNewDay,
  notice,
}: {
  day: string
  /**
   * A day's course not rolled for today's board: a past course from the past tab (with `pastBoard`), or an
   * admin's test run (with `test`). Your best here on this device lasts the tab.
   */
  practice?: boolean
  /**
   * An admin's test run of today's course or one still to come, from the Course Book: nothing kept, as in
   * practice (and `practice` is set with it), on cards of its own (TestCards.tsx).
   */
  test?: boolean
  /**
   * The test track of new pieces (runs.ts labDay), an admin's, with `practice`: kept nowhere, not even the tab
   * (your best here lasts while it's open), with no ghost, no blue ball and no call to the API, on cards of its
   * own (TestCards.tsx LabStartCard).
   */
  lab?: boolean
  /** A past course's day as the API has it, for its cards: who was 1st, and you. */
  itsDay?: ItsDay
  /** A past course's All time board: signed in, a run on it goes there, under a run of its own. */
  pastBoard?: PastBoard | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const marble = lab ? labDay() : marbleDay(day)
  const pace = marble.pace
  /** The test track's best run while it's open: kept nowhere else. */
  const labBest = useRef<number | null>(null)
  const past = pastBoard !== null && !test
  const board = pastBoard?.board ?? null
  /** The board's #1 as last told (boardGhost.ts), and the tag you play under, for whose the ghost is. */
  const topRef = useRef<BoardGhost | null>(null)
  // On today's course, the player one place above you, once you've a run on the board (boardGhost.ts fetchNextGhost).
  const nextRef = useRef<NextGhost | null>(null)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(marble, lab ? labChase(marble) : cardChase(marble, practice, null, playerName, null))
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noGl, setNoGl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  /** "Lost your marbles?" is up: the easter egg's line. */
  const [marbles, setMarbles] = useState(false)
  const [touch] = useState(touchScreen)
  const [hint, setHint] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const splitRef = useRef<HTMLElement>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MarbleScene | null>(null)
  const soundRef = useRef<RollSound | null>(null)
  /** The skin the player chose for their marble (lib/skins.ts), for the scene. */
  const skinRef = useRef<string | null>(null)
  useSkinInto(SLUG, skinRef)
  const keysRef = useRef<Held>({ ...NONE })
  /** The thumb on the stick: where it came down, and where it is now. */
  const stickAt = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null)
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((b: Ball) => Tilt) | null>(null)
  const toastTimer = useRef(0)
  /** Till the easter egg's pop-up comes, after its line has had its moment. */
  const marblesTimer = useRef(0)
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

  /**
   * The easter egg: a third fall before the run's first checkpoint. "Lost your marbles?" a moment in place of
   * the fall's notice, then the secret. The run goes on as any fall's does, its clock and falls untouched.
   */
  const lostMarbles = () => {
    say(null)
    setMarbles(true)
    window.clearTimeout(marblesTimer.current)
    marblesTimer.current = window.setTimeout(() => {
      marblesTimer.current = 0
      setMarbles(false)
      void reportEgg('marbles')
    }, MARBLES_FOR * 1000)
  }
  const lostMarblesRef = useRef(lostMarbles)
  lostMarblesRef.current = lostMarbles

  const letGoStick = () => {
    stickAt.current = null
    if (stickRef.current) stickRef.current.hidden = true
  }

  /** Midnight has brought a new course: the page mounts the game again for it. */
  const newDay = (why?: string) => {
    if (practice || courseDay() === day || devDay()) return false
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
    // A test run opens no run: nothing it does is saved. A past course's run goes on its All time board,
    // timed by the server as a day's is.
    if (!practice) {
      clearRunAchievements()
      beginRun(SLUG)
    } else if (past) beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(marble, lab ? labChase(marble) : chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    sceneRef.current?.snap()
    soundRef.current?.wake()
    letGoStick()
    setHint(touch)
    say(null)
    // A run started again over the egg's line clears it; its secret still comes.
    setMarbles(false)
    setUi(snapshot(g))
  }

  /** Done with the run: back to the start card. Nothing counts until the next one starts. */
  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(marble, lab ? labChase(marble) : chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
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
    if (gameRef.current!.phase !== 'menu' || lab) return
    gameRef.current = freshGame(marble, cardChase(marble, practice, topRef.current, nameRef.current, nextRef.current))
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  /** The board's fastest run, as it's known: at the start card, the ghost to race changes to it at once. */
  const takeTop = (next: BoardGhost | null) => {
    topRef.current = next
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
   * A run saved on the board sends where the marble went: the API keeps it if it's the tag's run on the board
   * and the fastest there, and then it's everyone's ghost, yours included from your next run. On today's course
   * every run goes, as the API keeps each player's best for whoever is one place below them to race; then the
   * player above you is asked for again, as you may have passed them. On a past course only one that could be
   * its fastest goes: the #1 is faster, or their line is known and at least as fast, and it stays home.
   */
  const sendGhost = (run: { time: number; score: number; splits: number[]; path: number[]; skin?: string }, name: string) => {
    if ((practice && !past) || !signedIn || !name) return
    const known = topRef.current
    const today = !practice
    if (!today && known && (known.time < run.time - 0.0005 || (known.run && known.run.time <= run.time + 0.0005))) return
    void sendBoardGhost(marble.n, name, run).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(marble.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  /** The player one place above you on today's course: asked for as it opens, and again after each run you save. */
  const askNext = () => {
    const tag = nameRef.current
    if (practice || !signedIn || !tag || marble.day > courseDay()) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(marble.n, tag).then((next) => {
      // Signed in as someone else meanwhile: theirs is asked for in turn.
      if (tag !== nameRef.current) return
      nextRef.current = next
      rechaseRef.current()
    })
  }
  const askNextRef = useRef(askNext)
  askNextRef.current = askNext
  useEffect(() => {
    askNextRef.current()
  }, [signedIn, playerName, marble.n, practice])

  // The board's fastest run, for the ghost: asked for as the course opens (a past one's, its All time #1).
  // A course whose day hasn't come, on an admin's test run, has no board yet, nor has the test track.
  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    let live = true
    const asked = lab || marble.day > courseDay() ? Promise.resolve(null) : fetchBoardGhost(marble.n)
    void asked.then((found) => {
      if (!live) return
      if (found) takeTopRef.current(found)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [marble.n, marble.day, lab])

  // Then your best here on this device, if it's faster than that: the API keeps it only if it's on the board
  // under your tag. So a run saved before runs sent their paths, or on a card closed too soon, still gets there.
  // Only your account's own run goes, once for each account signed in here: never one rolled signed out, or another's.
  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (practice || !topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = keptRun(day, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: marblerunBoardScore(mine.time), splits: mine.splits, path: mine.ghost, skin: mine.skin }, playerName)
  }, [practice, topAsked, signedIn, viewer, playerName, day])

  /**
   * A run rolled signed out, put on the board by whoever signed in on its card: it's theirs from now on,
   * their best here if it's faster than the one they had (runs.ts claimRun).
   */
  const claimSaved = (g: Game) => {
    const id = currentAccountId()
    if (g.owner !== SIGNED_OUT || !g.run || typeof id !== 'string') return
    claimRun(g.day, id, { time: g.run.time, splits: g.run.splits, ghost: g.run.path, ...(g.run.skin ? { skin: g.run.skin } : {}) })
    g.owner = id
  }

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { course } = marble
    // A canvas of the scene's own: when it goes, its GL context goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'marblerun__view'
    canvas.setAttribute('aria-label', 'The course, seen from behind your marble')
    holder.append(canvas)
    let scene: MarbleScene
    try {
      scene = new MarbleScene(canvas, course)
    } catch {
      canvas.remove()
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    const sound = new RollSound()
    soundRef.current = sound
    const map = mapRef.current ? new CourseMap(mapRef.current, course) : null
    const retheme = () => map?.rebuild()
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    /** The keys' ask, eased toward what's held; the stick's, as it is. */
    const readHands = (g: Game, dt: number) => {
      const s = stickAt.current
      if (s) {
        let dx = (s.x - s.x0) / STICK_R
        let dy = (s.y0 - s.y) / STICK_R
        const l = Math.hypot(dx, dy)
        if (l > 1) {
          dx /= l
          dy /= l
        }
        // A little dead in the middle, then finer near it than at the rim.
        const m = Math.min(1, l)
        const k = m < 0.08 ? 0 : Math.pow((m - 0.08) / 0.92, 1.25) / Math.max(m, 1e-6)
        g.input.x = dx * k
        g.input.y = dy * k
        return
      }
      const keys = keysRef.current
      let tx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
      let ty = (keys.up ? 1 : 0) - (keys.down ? 1 : 0)
      const l = Math.hypot(tx, ty)
      if (l > 1) {
        tx /= l
        ty /= l
      }
      const rate = KEY_RATE * dt
      g.input.x += Math.max(-rate, Math.min(rate, tx - g.input.x))
      g.input.y += Math.max(-rate, Math.min(rate, ty - g.input.y))
    }

    /**
     * The world's tilt for what the hands ask, with the turning helped (sim.ts handsTilt): forward is the way
     * the track goes just ahead, right its right, and part of each curve's pull comes by itself.
     */
    const tiltFor = (g: Game): Tilt => {
      if (autopilot.current) return autopilot.current(g.ball)
      return handsTilt(marble.course, g.ball, g.input, scene.heading(), TURN_HELP, STEADY, PLAYER_TILT_MAX, PLAYER_BRAKE)
    }

    const splitShown = (g: Game, k: number) => {
      const at = g.ball.splits[k]
      const theirs = g.ghost.run.splits[k]
      const d = at != null && theirs != null ? at - theirs : null
      const el = splitRef.current
      if (el) {
        el.textContent = d == null ? (at != null ? formatRun(at) : '–') : gapText(d)
        el.className = gapTone(d) ? `marblerun__delta--${gapTone(d)}` : ''
      }
      return d
    }

    const finishRun = (g: Game) => {
      const b = g.ball
      const time = b.time!
      g.record.push(b.x, b.y, b.z)
      // Against the best of whoever rolled it, and kept as theirs: someone else signed in meanwhile has theirs.
      // The test track's best is kept only while it's open.
      const kept = lab ? (labBest.current == null ? null : { time: labBest.current }) : g.owner === undefined ? null : bestOf(g.day, practice, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      const path = g.record
      // The skin it was rolled in, so its ghost wears it: yours as your best, everyone's from the board.
      const skin = skinRef.current ?? undefined
      if (lab) {
        if (improved) labBest.current = time
      } else if (improved && g.owner !== undefined) {
        const run = { time, splits: [...b.splits], ghost: path, ...(skin ? { skin } : {}) }
        if (practice) keepPracticeRun(g.day, g.owner, run)
        else keepBestRun(g.day, g.owner, run)
      }
      g.run = {
        time,
        score: marblerunBoardScore(time),
        splits: [...b.splits],
        falls: b.falls,
        improved,
        before: kept?.time ?? null,
        path,
        ...(skin ? { skin } : {}),
        runId: past ? runIdFor(SLUG) : null,
      }
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    let failed = 0
    // The new pieces' moments to hear (only a course with them has any): onto a boost pad, into a loop.
    const extras = course.extras
    let boosted = false

    const loop = (now: number) => {
      if (!alive) return
      // The next frame first, so one that fails to draw can't stop the run.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const b = g.ball
      const live = !pausedRef.current
      if (live) readHands(g, dt)

      if (live && g.phase === 'countdown') {
        const before = countOf(g)
        g.clock += dt
        if (g.clock >= COUNT_FROM * COUNT_STEP) {
          g.phase = 'rolling'
          g.carry = 0
          sfx('good')
        } else if (countOf(g) !== before) sfx('tap')
      }
      if (live && g.phase !== 'menu' && g.phase !== 'countdown') {
        g.carry += dt
        while (g.carry >= DT) {
          g.carry -= DT
          const running = g.phase === 'rolling' || g.phase === 'fallen'
          // The ghost's path keeps time with the clock, falls and all.
          if (running && g.steps % GHOST_EVERY === 0) g.record.push(b.x, b.y, b.z)
          g.steps += 1
          if (g.phase === 'fallen') {
            // Watched falling, with the clock running, then back to the checkpoint.
            b.t += DT
            b.vy -= G * DT
            b.x += b.vx * DT
            b.y += b.vy * DT
            b.z += b.vz * DT
            g.fallFor -= DT
            if (g.fallFor <= 0) {
              respawn(marble.course, b)
              g.phase = 'rolling'
              scene.snap()
            }
            continue
          }
          g.tilt = g.phase === 'rolling' ? tiltFor(g) : { x: 0, z: 0 }
          const rode = b.loop !== null
          // As far as a player's hands tilt it (sim.ts PLAYER_BRAKE, the furthest, held back).
          step(marble.course, b, g.tilt, PLAYER_BRAKE)
          if (b.landed > 2.5) sfx('place')
          if (b.hit > 1.2) {
            sfx('plink', 2)
            haptic('hit')
          }
          if (extras) {
            // A bumper's kick, which it flashes for; a hammer's or an arm's knock; into a loop; onto a boost pad.
            if (b.bumped >= 0) {
              scene.bumped(b.bumped, b.t)
              sfx('boing', 1)
              haptic('hit')
            }
            if (b.knocked > 2) {
              sfx('hit')
              haptic('crash')
            }
            if (b.loop && !rode) sfx('whoosh')
            const boosting = zoneUnder(b.support)?.kind === 'boost'
            if (boosting && !boosted) sfx('zip', 1)
            boosted = boosting
          }
          if (g.phase !== 'rolling') continue
          if (b.crossed >= 0) {
            const L = marble.course.lines[b.crossed]!
            if (!L.goal) {
              const d = splitShown(g, b.crossed)
              const at = b.splits[b.crossed]!
              sayRef.current(`Checkpoint ${b.crossed + 1} · ${formatRun(at)}${d == null ? '' : ` · ${gapText(d)}`}`)
              sfx('good')
            }
          }
          if (b.lost) {
            // Off the edge: watched a moment, then back at the checkpoint with the clock still running.
            g.phase = 'fallen'
            g.fallFor = FALL_FOR
            b.lost = false
            b.air = true
            if (!lab && b.falls === MARBLES_FALLS && b.next === 0) lostMarblesRef.current()
            else sayRef.current('Off the edge · back to the checkpoint', 1.4)
            sfx('whoosh')
            haptic('crash')
          } else if (b.finished) {
            g.phase = 'finished'
            g.clock = 0
            finishRun(g)
          }
        }
      }
      if (live && g.phase === 'finished') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another run first. A run that midnight came
        // in the middle of was on yesterday's course, and today's board is another course's: not saved.
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that run, so it was on yesterday’s course. Here’s today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          letGoStick()
        }
      }

      const ghostAt = g.phase === 'menu' || lab ? null : g.ghost.at(b.t)
      try {
        scene.frame(
          {
            ball: b,
            tilt: g.tilt,
            mode: g.phase === 'menu' ? 'menu' : g.phase === 'fallen' ? 'fallen' : g.phase === 'finished' || g.phase === 'gameover' ? 'done' : 'play',
            doneFor: g.phase === 'finished' ? g.clock : g.phase === 'gameover' ? CARD_AFTER + 1 : 0,
            ghost: ghostAt,
            ghostTag: ghostTag(g.chasing),
            // The ghost in the skin its run was rolled in; the blue ball is always blue.
            ghostSkin: g.chasing.who === 'pace' ? null : (g.chasing.skin ?? null),
            passed: b.next,
            skin: skinRef.current,
          },
          live ? dt : 0,
        )
        failed = 0
      } catch (err) {
        // A phone can take the 3D context back; three.js stops drawing until it's restored, though a frame or
        // two can fail first. If drawing never comes back, say so.
        failed += 1
        if (failed === 1) console.warn('Marble Run: a frame failed to draw', err)
        if (failed > 120) {
          alive = false
          setNoGl(true)
          return
        }
      }
      map?.draw(b.x, b.z, ghostAt)
      sound.update(Math.hypot(b.vx, b.vy, b.vz), !b.air, live && (g.phase === 'rolling' || g.phase === 'finished'))
      if (clockRef.current) {
        const text = formatRun(g.run ? g.run.time : g.phase === 'rolling' || g.phase === 'fallen' ? b.t : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }

      // The rest of the heads-up changes only when something happens: the count, a checkpoint, a fall.
      const next = snapshot(g)
      const key = `${next.phase}|${next.count}|${next.passed}|${next.falls}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    // The pace ball's run, rolled now while the card is up, so the start doesn't wait on it. The test track has none.
    const warm = lab ? 0 : window.setTimeout(() => paceOf(marble.day), 400)
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
    // Once for the day's course: the page mounts the game again for another day.
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

  // Gone from the page while the egg's line was up: it was found all the same.
  useEffect(
    () => () => {
      if (!marblesTimer.current) return
      window.clearTimeout(marblesTimer.current)
      void reportEgg('marbles')
    },
    [],
  )

  // Mounted again for a new day because a run was lost to midnight: say so.
  useEffect(() => {
    if (notice) say(notice, 6)
    // Once, on the mount the notice came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dev only: read the run, or let the pace ball's hands take over, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __marblerun?: () => Game
      __marblerunScene?: () => MarbleScene | null
      __marblerunAuto?: (on?: boolean) => void
      __marblerunStart?: () => void
    }
    w.__marblerun = () => gameRef.current!
    w.__marblerunScene = () => sceneRef.current
    w.__marblerunAuto = (on = true) => {
      const plan = on ? racingPlan(marble.course) : null
      autopilot.current = plan ? makeDriver(plan) : null
    }
    w.__marblerunStart = () => start()
    return () => {
      delete w.__marblerun
      delete w.__marblerunScene
      delete w.__marblerunAuto
      delete w.__marblerunStart
    }
  })

  /* A tap on the course starts a run from the card; in a run, a thumb anywhere is the stick. */
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
    if (l > STICK_R) {
      dx *= STICK_R / l
      dy *= STICK_R / l
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (stickAt.current?.id === e.pointerId) letGoStick()
  }

  const g = gameRef.current!
  const showroom = ui.phase === 'menu'
  const run = g.run
  const tabBest = lab ? labBest.current : practice ? (bestOf(day, true, g.owner === undefined ? viewer : ownerAccount(g.owner))?.time ?? null) : null
  // A past course's best here is your best on its All time board too, signed in.
  const boardBest = past && viewer !== null && board?.you ? marblerunMsFromBoardScore(board.you.score) / 1000 : null
  const practiceBestTime = tabBest == null ? boardBest : boardBest == null ? tabBest : Math.min(tabBest, boardBest)
  const bestText = practice
    ? practiceBestTime != null
      ? formatRun(practiceBestTime)
      : '–'
    : apiBest > 0
      ? formatRun(marblerunMsFromBoardScore(apiBest) / 1000)
      : '–'
  // Whose the run is, for its card: an account's run waits for that account; one rolled signed out goes to whoever signs in.
  const runOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  // A past course: the chip, the tab's title, the way back to its row and its day's figures, the same on
  // the play screen, the pause card and the start card (lib/pastPlay.ts).
  const went: ItsDay = itsDay ?? { days: null, failed: false, me: null }
  // Signed in, a run goes on the course's All time board. Signed out it's practice, and so is a run rolled
  // signed out, for good: signing in on its card is for the runs after it.
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
        title: marble.name,
        facts: [onItsDayFact(day, went), allTimeFact(SLUG, board, viewer !== null, formatMarblerunBoardScore)],
      }
    : null
  const extra = lab ? (
    <div className="game-pause-meta__row">
      <span>Your best here</span>
      <strong>{bestText}</strong>
    </div>
  ) : practice ? (
    <>
      <div className="game-pause-meta__row">
        <span>Blue ball</span>
        <strong>{formatRun(pace)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Your best here</span>
        <strong>{bestText}</strong>
      </div>
    </>
  ) : (
    <CourseTiles marble={marble} ghost={g.ghost.run.time} chasing={g.chasing} bestMs={apiBest > 0 ? marblerunMsFromBoardScore(apiBest) : null} />
  )
  const splitsText = (r: NonNullable<Game['run']>) =>
    [
      marble.name,
      ...r.splits.slice(0, -1).map((at, k) => `CP${k + 1} ${formatRun(at)}`),
      r.falls === 0 ? 'no falls' : r.falls === 1 ? '1 fall' : `${r.falls} falls`,
    ].join(' · ')

  return (
    <section
      className={`marblerun marblerun--fullscreen${showroom ? ' marblerun--showroom' : ''}${touch ? ' marblerun--touch' : ''}${pastPlay ? ' marblerun--past' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div className="marblerun__play" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div ref={holderRef} className="marblerun__holder" />

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
                <PlayReadoutScore className="marblerun__clock">
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  <PlayStat label={ui.passed > 0 && ui.passed <= marble.course.lines.length - 1 ? `CP ${ui.passed}` : 'Split'} value={<span ref={splitRef}>–</span>} />
                  <PlayStat label="Falls" value={String(ui.falls)} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="marblerun__map" aria-hidden="true" />

            {ui.count >= 0 && !paused ? (
              <div className={`marblerun__count${ui.count === 0 ? ' is-go' : ''}`} role="status">
                {ui.count === 0 ? 'Go!' : ui.count}
              </div>
            ) : null}

            {toast && !marbles && !paused && !saveOpen ? (
              <div className="marblerun__toast" role="status">
                {toast}
              </div>
            ) : null}
            {marbles && !paused && !saveOpen ? (
              <div className="marblerun__toast marblerun__toast--marbles" role="status">
                Lost your marbles?
              </div>
            ) : null}

            <div ref={stickRef} className="marblerun__stick" hidden>
              <div ref={knobRef} className="marblerun__knob" />
            </div>
            {hint && inRun && !paused ? <div className="marblerun__hint">Drag anywhere to tilt</div> : null}

            {noGl ? (
              <div className="marblerun__nogl">
                <p>Marble Run is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="marblerun__overlay">
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
              {showroom && !saveOpen && !paused && !noGl ? (
                lab ? (
                  <LabStartCard best={practiceBestTime} />
                ) : test ? (
                  <TestStartCard marble={marble} best={practiceBestTime} />
                ) : pastPlay ? (
                  <PracticeStartCard marble={marble} kind={pastKind} facts={pastPlay.facts ?? []} tiles={extra} board={board} />
                ) : (
                  <GameStartCard title="Marble Run" slug={SLUG} extraMeta={extra} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && run ? (
                lab ? (
                  <LabResultCard time={run.time} falls={run.falls} best={practiceBestTime ?? run.time} improved={run.improved} onAgain={start} onDone={toMenu} />
                ) : test ? (
                  <TestResultCard
                    marble={marble}
                    time={run.time}
                    falls={run.falls}
                    best={practiceBestTime ?? run.time}
                    improved={run.improved}
                    onAgain={start}
                    onDone={toMenu}
                  />
                ) : past ? (
                  <PastCourseRunResult
                    marble={marble}
                    time={run.time}
                    score={run.score}
                    falls={run.falls}
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
                    title="Run complete"
                    subtitle={splitsText(run)}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace * 1000)}
                    shareLine={runShareLine(marble, run.time, pace, run.falls)}
                    medalPace={paceMsOf(marble.pace)}
                    medalFormat={formatRun}
                    kicker={`Today’s Course #${marble.n}`}
                    tomorrow={<TomorrowCourse day={marble.day} />}
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

/** Dev only: localStorage `skermix-marblerun-dev-day` = YYYY-MM-DD plays that day's course, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-marblerun-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

/**
 * A past day's course, from the past tab: anyone's to roll, and signed in, a run goes on its All time board
 * (PracticeCards.tsx). How its day went (lib/archive.ts) and its board are asked for here, the board again
 * once a run is saved. Signed out, they're asked for without a tag: nobody's place is shown as yours.
 */
function PastMarbleRun({ day }: { day: string }) {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(SLUG, viewer.name)
  const itsDay: ItsDay = { days, failed, me: viewer.state === 'in' ? viewer.name : null }
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, courseNumber(day), viewer.state === 'out' ? '' : viewer.name, version)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <MarbleRunDay day={day} practice itsDay={itsDay} pastBoard={{ board, refresh }} onNewDay={() => {}} />
}

/**
 * Marble Run on today's course, mounted again for the next when midnight brings it; with `practiceDay`, a past
 * day's course from the past tab, onto its All time board; with `testDay`, today's course or one still to come,
 * test run from the admin's Course Book; with `lab`, the test track of new pieces (runs.ts labDay), from the
 * Course Book too. A test run and the test track are only an admin's: anyone else is sent to today's course,
 * with a word about why when the course's day hasn't come, or when it was the test track.
 */
export function MarbleRunGame({ practiceDay, testDay, lab = false }: { practiceDay?: string | null; testDay?: string | null; lab?: boolean }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? courseDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  const adminOnly = Boolean(testDay) || lab
  // Sent away only once we know: signed in (or not), and the API has said this account isn't an admin.
  const shut = adminOnly && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (practiceDay) return <PastMarbleRun key={`practice-${practiceDay}`} day={practiceDay} />
  if (lab && admin === true) return <MarbleRunDay key="lab" day="lab" practice lab onNewDay={() => {}} />
  if (testDay && admin === true) return <MarbleRunDay key={`test-${testDay}`} day={testDay} practice test onNewDay={() => {}} />
  // Still signing in, or still asking the API whether this account is an admin.
  if (adminOnly && !shut) return null
  const notice = lab
    ? 'The test track is for admins. Here’s today’s course.'
    : testDay && testDay !== courseDay()
      ? `Course #${courseNumber(testDay)}’s day hasn’t come yet. Here’s today’s.`
      : today.notice
  return <MarbleRunDay key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: courseDay(), notice: why })} />
}

