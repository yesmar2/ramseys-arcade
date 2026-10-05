import '../../styles/hotlap.css'
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
import { dailyTabHref, gamePlayHref, navigate, todayShareHref } from '../../hooks/useHashRoute'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useAdminState } from '../../lib/admin'
import { inArchive } from '../../lib/archive'
import { currentAccountId } from '../../lib/auth'
import type { PastKind } from '../../lib/dailyWords'
import { ownerAccount, ownerOf, SIGNED_OUT, type Viewer } from '../../lib/deviceRuns'
import { eggDone, reportEgg } from '../../lib/eggs'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { normalizePlayerName } from '../../lib/leaderboard'
import type { PastPlay } from '../../lib/pastPlay'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun, runIdFor } from '../../lib/runSession'
import { sfx } from '../../lib/sound'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { CarSound } from './audio'
import { fetchBoardGhost, fetchNextGhost, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { ordinal } from '../../lib/scoreboard'
import { paceNotes, type PaceCall } from './calls'
import { dayWords, msUntilNextTrack, trackDay, trackNumber, trackState, untilWords } from './daily'
import { newDonuts, spinDonuts, type Donuts } from './donuts'
import { bestLapOf, claimLap, Ghost, hotlapCourse, keepBestLap, progressOf, type Course, type GhostLap } from './lap'
import { TrackMap } from './map'
import { usePastTrackFigures, type PastTrackFigures } from './pastTrack'
import { PastTrackResult, PastTrackStart } from './PastTrackCards'
import { HotLapScene } from './scene'
import { useSkinInto } from '../../lib/skins'
import { MedalRow } from '../../components/RaceMedal'
import { paceMsOf } from '../../lib/raceMedals'
import { TomorrowTrack } from './TomorrowTrack'
import { formatLap, hotlapBoardScore, hotlapMsFromBoardScore } from './score'
import { botDriver, GHOST_EVERY, newRun, STEP, stepRun, type Controls, type GhostPath, type Run, type Track } from './sim'
import { TestResultCard, TestStartCard } from './TestCards'

const SLUG = 'hotlap'

type Phase = 'menu' | 'countdown' | 'racing' | 'finished' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'racing'])
/** The lights: three reds a little over half a second apart, then out, and go. */
const LIGHT_GAP = 0.55
const LIGHTS_OUT = 1.65
/** Past the line, a moment to see the time before the card comes. */
const CARD_AFTER = 0.8
/** How long the donuts egg's word stays up, as long as its rise and fade (hotlap.css). */
const DONUTS_SHOWN = 1.8
/**
 * A press of left or right eases the wheel over in about a seventh of a second, and more gently the
 * faster you go (a third of a second at 90 mph), so at speed a tap is a nudge.
 */
const STEER_EASE = 7
/** The card stands at the right of a wide screen, and the car has the left. */
const WIDE = '(min-width: 900px) and (min-aspect-ratio: 4/3)'
/** Room for the latest sector only, beside the clock. */
const NARROW = '(max-width: 720px)'
/**
 * m before its turn-in that a corner's call comes up. One closer than that behind another is called as the
 * car turns into that one.
 */
const CALL_FROM = 300

type Held = { gas: boolean; brake: boolean; left: boolean; right: boolean }
const NONE: Held = { gas: false, brake: false, left: false, right: false }
const KEYS: Record<string, keyof Held> = {
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

/** Everything a lap is, held outside React: the loop changes it 120 times a second. */
type Game = {
  phase: Phase
  /** The day, and its track. */
  day: string
  track: Track
  /** Another day's track: its laps go on no day's board, and are kept only in the tab. */
  test: boolean
  /** Of those, a track whose day has gone: its laps go on the track's own board (PastTrackCards.tsx). */
  past: boolean
  /**
   * Whose lap it is (lib/deviceRuns.ts): the account signed in as it started, or SIGNED_OUT; none at the
   * start card. It's kept as their best and saved as theirs alone, whoever signs in meanwhile.
   */
  owner: string | undefined
  run: Run
  /** Seconds into the countdown, or since the line. */
  clock: number
  /** Seconds since the lights went out: the ghost's clock, which runs on after you finish. */
  t: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  steps: number
  /** This lap's path, for its ghost if it's your best. */
  record: number[]
  /** The wheel, eased toward what the keys or thumbs ask. */
  steer: number
  /** The lap being chased: the board's fastest, your best on this device, or the pace car's. */
  ghost: Ghost
  /** Whose lap the ghost is. */
  chasing: Chasing
  /** The easter egg: the car's circles, counted while it races (donuts.ts). */
  donuts: Donuts
  /** The egg's clue, old donut marks just past the line, till this device has spun its own. */
  donutHint: boolean
  /**
   * The lap's result, once it's over: on a past track, the run it was driven in, taken as it ended; and
   * where the car went, for its ghost on the board if it's the fastest there.
   */
  lap: {
    time: number
    score: number
    splits: number[]
    improved: boolean
    run: Promise<string | undefined> | null
    path: GhostPath
  } | null
}

/**
 * Whose lap the ghost drives: the player one place above you today (`next`, for their place); the board's
 * fastest, under their tag; your own best; or the blue car's.
 */
type Chasing =
  | { who: 'next'; name: string; place: number; skin?: string }
  | { who: 'rival'; name: string; skin?: string }
  | { who: 'you'; skin?: string }
  | { who: 'pace' }

/** The ghost's tile on the start card: "Beat PILOT for 13th", "Ghost · DAD", "Ghost · Your best", "Blue car". */
function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue car'
}

/** The lap to chase, and whose it is. */
type Chase = { lap: GhostLap; chasing: Chasing }

/** A past track as it stands: its board, its figures for the cards, and asking for them again once a lap is saved. */
type PastTrack = { board: TrackBoard | null; figures: PastTrackFigures; refresh: () => void }

/** The name over the ghost car: whose lap it drives. */
function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'You' : 'Blue car'
}

type Ui = {
  phase: Phase
  /** 0 before the lights, 1–3 reds, 4 green. */
  lights: number
  splits: number[]
  cut: boolean
  /** Against the ghost at the same point of the lap; null before that's known. */
  ahead: boolean | null
  /** The corner being called (calls.ts): its number on the track, or −1 for none. */
  call: number
}

const snapshot = (g: Game): Ui => ({
  phase: g.phase,
  lights: lightsFor(g),
  splits: [...g.run.splits],
  cut: g.run.cut,
  ahead: aheadOf(g),
  call: callFor(g),
})

/** Metres from the car to where a corner turns in. */
function callDistance(track: Track, call: PaceCall, index: number) {
  const d = track.s[call.from]! - track.s[index]!
  return d < 0 ? d + track.length : d
}

/** While racing, the next corner, once it's within CALL_FROM of the car. */
function callFor(g: Game): number {
  if (g.phase !== 'racing') return -1
  const notes = paceNotes(g.track)
  const k = notes.next[g.run.index]!
  return callDistance(g.track, notes.calls[k]!, g.run.index) <= CALL_FROM ? k : -1
}

/** The distance on the call, in tens of metres: it changes a few times a second, not every frame. */
const callMetres = (d: number) => String(Math.max(10, Math.ceil(d / 10) * 10))

function lightsFor(g: Game) {
  if (g.phase === 'countdown') return g.clock < LIGHTS_OUT ? Math.min(3, Math.floor(g.clock / LIGHT_GAP) + 1) : 4
  if (g.phase === 'racing' && g.run.time < 0.9) return 4
  return 0
}

function aheadOf(g: Game): boolean | null {
  if (g.phase !== 'racing' || g.run.time < 1.5 || g.run.cut) return null
  const at = g.ghost.timeAt(progressOf(g.track, g.run.dist, g.run.gate > 0))
  return g.run.time < at
}

/** A sector's time, or how it went against the same sector of the lap being chased. */
function sectorFigure(k: number, splits: number[], chased: number[]) {
  const at = splits[k]
  if (at == null) return { text: '–', tone: '' }
  const mine = at - (k === 0 ? 0 : splits[k - 1]!)
  const ref = chased[k]
  if (ref == null) return { text: mine.toFixed(2), tone: '' }
  const d = mine - (ref - (k === 0 ? 0 : chased[k - 1]!))
  return { text: `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`, tone: d <= 0 ? 'good' : 'bad' }
}

function freshGame(course: Course, chase: Chase, test: boolean, past: boolean): Game {
  const { track } = course
  return {
    phase: 'menu',
    day: course.day,
    track,
    test,
    past,
    owner: undefined,
    run: newRun(track),
    clock: 0,
    t: 0,
    carry: 0,
    steps: 0,
    record: [],
    steer: 0,
    ghost: new Ghost(track, chase.lap),
    chasing: chase.chasing,
    donuts: newDonuts(),
    donutHint: !eggDone('donuts'),
    lap: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

/**
 * A lap to send on, as Ace Chase's and Find the Bug's days go: the day's track, the lap against the
 * day's blue car, and the day's link, which unfurls into the day's card and opens the Today page.
 */
function lapShareLine(course: Course, time: number, pace: number): string {
  const gap = Math.abs(time - pace)
  const against =
    gap < 0.005 ? 'tied with the blue car' : time < pace ? `beat the blue car by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue car`
  return [
    `Hot Lap · Today’s Track #${course.n} 🏎️`,
    `${course.name}: ${formatLap(time)}, ${against}`,
    `${window.location.origin}${todayShareHref(course.day)}`,
  ].join('\n')
}

/**
 * Today's track and its number, the lap its ghost drives (the board's fastest, your best or the blue car's),
 * and when the next track comes (a test drive: its day). A past track's card says what it is and its
 * figures itself (PastPlay), so its tiles are only the lap to beat.
 */
function TrackTiles({
  course,
  ghost,
  chasing,
  test,
  past,
  bestMs,
}: {
  course: Course
  ghost: number
  chasing: Chasing
  test: boolean
  past: boolean
  /** Your best lap of the day, for its medals. */
  bestMs: number | null
}) {
  const [left, setLeft] = useState(() => msUntilNextTrack())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextTrack()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  const chase = (
    <div className="game-pause-meta__row">
      <span>{chasingLabel(chasing)}</span>
      <strong>{formatLap(ghost)}</strong>
    </div>
  )
  if (past) return chase
  return (
    <>
      <div className="game-pause-meta__row hotlap-track">
        <span>
          {test ? 'Test drive' : 'Today’s track'} · #{course.n}
        </span>
        <strong>{course.name}</strong>
      </div>
      {chase}
      <MedalRow paceMs={paceMsOf(course.pace)} bestMs={bestMs} format={formatLap} />
      {test ? (
        <div className="game-pause-meta__row">
          <span>Its day</span>
          <strong>{dayWords(course.day)}</strong>
        </div>
      ) : (
        <div className="game-pause-meta__row">
          <span>Next track</span>
          <strong>{untilWords(left)}</strong>
        </div>
      )}
    </>
  )
}

/**
 * Hot Lap: one lap of a racing circuit against the clock, in 3D. Gas, brake and steering; the skill is
 * when to brake for a corner, how much of the road to use, and how soon to get back on the gas.
 *
 * It's a daily: a new track every day, the same for everyone (daily.ts), driven as often as you like,
 * and the board is the day's (the API keeps Hot Lap's board to today's track, whatever the period).
 * HotLapGame mounts it for today; when midnight has brought a new track by the next start, it asks for
 * the new day with `onNewDay`, which mounts it again, with `notice` to say why when a lap was lost to it.
 *
 * With `test`, it's the day's track driven on another day: no score card, your best lap is kept only in
 * the tab, and midnight changes nothing. Today's track or one still to come is an admin's test drive, on
 * no board (TestCards.tsx). With `pastTrack` too, the track's day has gone and it keeps a board of its own
 * for good: a lap on it goes there, under a run of its own, and never on today's board, your week or your
 * rank. Its cards say so (PastTrackCards.tsx), and so do the chip over the track, the tab's title and the
 * pause card, and leaving goes back to its row on Past tracks.
 *
 * The ghost is the lap to beat, driven alongside you the whole way, its name over it: the board's #1
 * (today's #1, or a past track's record holder: boardGhost.ts), on the blue car's line at their time when
 * their own isn't known; unless your own best on this device is faster; with nobody on the board, the blue
 * car's. It stays on the road all lap, fainter while it's right on top of you, and waits where it finished
 * if it gets there first. A cut across the grass skips a gate and the lap
 * can't count; R or the restart button starts another.
 *
 * Under the clock, a co-driver's call names the corner coming: its shape, how sharp, what follows it, and
 * the metres to its turn-in (calls.ts).
 *
 * The easter egg: spin three donuts while racing (sim.ts donutStep, donuts.ts): slow or stopped, the wheel
 * hard over, a tap of the brake and then the gas. The tyres scream and smoke the whole time it spins, and
 * on the third "Donuts!" goes up and the secret is found. It costs the lap its time and changes nothing
 * else. Its clue is old donut marks on the road just past the line, till this device has spun its own.
 *
 * Keys: ↑ or W gas, ↓, S or Space brake, ← → or A D steer, R restart, P or Escape pause. On a touch
 * screen: steer with the left thumb, pedals under the right. A lap is scored as its time: the board
 * keeps a million less the milliseconds (score.ts), so the fastest lap is the highest score.
 */
function HotLapDay({
  day,
  test = false,
  pastTrack = null,
  onNewDay,
  notice,
}: {
  day: string
  test?: boolean
  /** A past track's board and figures (PastTrackDay): its laps go on its board. With `test`. */
  pastTrack?: PastTrack | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const course = hotlapCourse(day)
  const pace = course.paceLap
  const past = pastTrack !== null
  const { signedIn } = useAuth()
  const viewer = useAccountId()
  const playerName = normalizePlayerName(usePlayerName())
  const board = pastTrack?.board ?? null
  // Today's track and a past one have boards, and so a #1 whose ghost to race; a track still to come has neither.
  const onBoard = !test || past
  const topRef = useRef<BoardGhost | null>(null)
  // On today's track, the player one place above you, once you've a lap on the board (boardGhost.ts fetchNextGhost).
  const nextRef = useRef<NextGhost | null>(null)
  // The player's own skin, if they chose one (lib/skins.ts): looks only.
  const skinRef = useRef<string | null>(null)
  useSkinInto(SLUG, skinRef)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  /**
   * The lap to beat. On today's track, once you've a lap on the board, the player's one place above you, for
   * their place: pass them and the next one lines up (Ramsey, 2026-10-05: a ghost in reach every lap). Else
   * the board's #1, on their own line, or on the blue car's at their time when theirs isn't known
   * (boardGhost.ts standIn); unless your own best here is faster. With nobody on the board, your best, or
   * the blue car's. Your own is the one of whoever is signed in now: another player's lap on this device isn't
   * yours.
   */
  const chase = (): Chase => {
    const mine = bestLapOf(day, test, currentAccountId())
    const next = nextRef.current
    if (next && !test && !past && (!mine || next.time < mine.time - 0.0005)) {
      return { lap: next.lap ?? standIn(pace, next.time), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
    }
    const top = topRef.current
    if (top && (!mine || top.time < mine.time - 0.0005)) {
      const lap = top.lap ?? standIn(pace, top.time)
      // In the skin the lap was driven in, when it's the board's.
      return { lap, chasing: top.name === nameRef.current ? { who: 'you', skin: top.skin } : { who: 'rival', name: top.name, skin: top.skin } }
    }
    // Your own best, in the skin it was driven in; a lap kept before laps kept theirs borrows the board's, when
    // the #1 is you at the same time.
    const mineSkin = mine?.skin ?? (top && mine && top.name === nameRef.current && Math.abs(top.time - mine.time) < 0.0005 ? top.skin : undefined)
    return mine ? { lap: mine, chasing: { who: 'you', skin: mineSkin } } : { lap: pace, chasing: { who: 'pace' } }
  }

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(course, chase(), test, past)
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noGl, setNoGl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  /** The donuts egg's word, up for a moment as the third donut closes. */
  const [spun, setSpun] = useState(false)
  const spunTimer = useRef(0)
  const [touch] = useState(touchScreen)
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(NARROW).matches)
  const [pads, setPads] = useState<Held>(NONE)
  const holderRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const speedRef = useRef<HTMLElement>(null)
  const callFarRef = useRef<HTMLElement>(null)
  const callBarRef = useRef<HTMLElement>(null)
  /** The call on the card as last drawn: the loop counts down only that one's distance. */
  const callShownRef = useRef(-1)
  const sceneRef = useRef<HotLapScene | null>(null)
  const soundRef = useRef<CarSound | null>(null)
  const keysRef = useRef<Held>({ ...NONE })
  const fingersRef = useRef(new Map<number, keyof Held>())
  const padRef = useRef<Held>({ ...NONE })
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((run: Run) => Controls) | null>(null)
  const toastTimer = useRef(0)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const say = (text: string | null, seconds = 3) => {
    window.clearTimeout(toastTimer.current)
    setToast(text)
    if (text) toastTimer.current = window.setTimeout(() => setToast(null), seconds * 1000)
  }

  const clearThumbs = () => {
    fingersRef.current.clear()
    padRef.current = { ...NONE }
    setPads(NONE)
  }

  /** The easter egg: three donuts in one spot. The tyres scream and smoke, the word goes up, and the secret is found. */
  const spinOut = () => {
    soundRef.current?.screech()
    sceneRef.current?.smoke()
    haptic('boost')
    window.clearTimeout(spunTimer.current)
    setSpun(true)
    spunTimer.current = window.setTimeout(() => setSpun(false), DONUTS_SHOWN * 1000)
    void reportEgg('donuts')
  }

  /** Midnight has brought a new track: the page mounts the game again for it. */
  const newDay = (why?: string) => {
    if (test || trackDay() === day || devDay()) return false
    onNewDay(why)
    return true
  }
  const newDayRef = useRef(newDay)
  newDayRef.current = newDay

  /**
   * Lights, and a new lap: a new run for the boards (not a test drive's), chasing the best lap there is.
   * The lap is whoever's signed in as it starts, so it waits the moment it takes to know who that is (a
   * session from before laps had owners, until the API says).
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
    if (!test) {
      clearRunAchievements()
      beginRun(SLUG)
      previousBestRef.current = getPersonalBest(SLUG)
    } else if (past) {
      // A past track's lap goes on its board, timed by the server as a day's is.
      beginRun(SLUG)
    }
    const g = freshGame(course, chase(), test, past)
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    sceneRef.current?.startLap()
    soundRef.current?.wake()
    say(null)
    setUi(snapshot(g))
  }

  /** Done with the lap: back to the start card, where what it changed shows. Nothing counts until the next one starts. */
  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(course, chase(), test, past)
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 300
    clearThumbs()
    say(null)
    setUi(snapshot(gameRef.current))
  }

  const restart = () => {
    if (!IN_RUN.has(gameRef.current!.phase) || pausedRef.current || saveOpenRef.current) return
    start()
  }

  /** At the start card, the lap to beat worked out again: it changes at once. Mid-lap, the lap keeps the ghost it began with. */
  const rechase = () => {
    if (gameRef.current!.phase !== 'menu') return
    gameRef.current = freshGame(course, chase(), test, past)
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  /** The board's fastest lap, as it's known: at the start card, the ghost to race changes to it at once. */
  const takeTop = (top: BoardGhost | null) => {
    topRef.current = top
    rechase()
  }
  const takeTopRef = useRef(takeTop)
  takeTopRef.current = takeTop

  // Signed in, out, or as someone else: at the start card, the ghost is the new driver's to beat.
  const chasedFor = useRef(viewer)
  useEffect(() => {
    if (chasedFor.current === viewer) return
    chasedFor.current = viewer
    rechaseRef.current()
  }, [viewer])

  /**
   * A lap saved on the board sends where the car went: the API keeps it if it's the tag's lap on the board and
   * the fastest there, and then it's everyone's ghost, yours included from your next lap. On today's track
   * every lap goes, as the API keeps each player's best for whoever is one place below them to race; then the
   * player above you is asked for again, as you may have passed them. On a past track only one that could be
   * its fastest goes: the #1 is faster, or their line is known and at least as fast, and it stays home.
   */
  const sendGhost = (lap: { time: number; score: number; splits: number[]; path: GhostPath }, name: string) => {
    if (!onBoard || !signedIn || !name) return
    const top = topRef.current
    const today = !test && !past
    if (!today && top && (top.time < lap.time - 0.0005 || (top.lap && top.lap.time <= lap.time + 0.0005))) return
    void sendBoardGhost(course.n, name, { score: lap.score, splits: lap.splits, path: lap.path }).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(course.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  /** The player one place above you on today's track: asked for as it opens, and again after each lap you save. */
  const askNext = () => {
    const tag = nameRef.current
    if (test || past || !signedIn || !tag) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(course.n, tag).then((next) => {
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
  }, [signedIn, playerName, course.n, test, past])

  /**
   * A lap driven signed out, put on the board by whoever signed in on its card: it's theirs from now on,
   * their best here if it's faster than the one they had (lap.ts claimLap), and theirs if the card asks again.
   */
  const claimSaved = (g: Game) => {
    const id = currentAccountId()
    if (g.owner !== SIGNED_OUT || !g.lap || typeof id !== 'string') return
    claimLap(g.day, g.test, id, { time: g.lap.time, splits: g.lap.splits, ghost: g.lap.path })
    g.owner = id
  }

  // The board's fastest lap, for the ghost: asked for as the track opens.
  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    if (!onBoard) return
    let live = true
    void fetchBoardGhost(course.n).then((top) => {
      if (!live) return
      if (top) takeTopRef.current(top)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [onBoard, course.n])

  // Then your best here on this device, if it's faster than that: the API keeps it only if it's on the board
  // under your tag. So a lap saved before laps kept their ghosts, or on a card closed too soon, still gets there.
  // Only your account's own lap goes, once for each account signed in here: never one driven signed out, or another's.
  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (!topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = bestLapOf(day, test, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: hotlapBoardScore(mine.time), splits: mine.splits, path: mine.ghost }, playerName)
  }, [topAsked, signedIn, viewer, playerName, day, test])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { track } = gameRef.current!
    // A canvas of the scene's own: when it goes, its GL context goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'hotlap__view'
    canvas.setAttribute('aria-label', 'The track, seen from behind your car')
    holder.append(canvas)
    let scene: HotLapScene
    try {
      scene = new HotLapScene(canvas, track)
    } catch {
      canvas.remove()
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    const sound = new CarSound()
    soundRef.current = sound
    const map = mapRef.current ? new TrackMap(mapRef.current, track) : null
    const wide = window.matchMedia(WIDE)
    const retheme = () => map?.rebuild()
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const controls = (g: Game): Controls => {
      const run = g.run
      if (autopilot.current) return autopilot.current(run)
      const keys = keysRef.current
      const pad = padRef.current
      const gas = keys.gas || pad.gas
      const brake = keys.brake || pad.brake
      const want = (keys.left || pad.left ? 1 : 0) - (keys.right || pad.right ? 1 : 0)
      const ease = STEER_EASE * Math.max(0.45, Math.min(1, 18 / Math.max(run.u, 1)))
      const toward = want === 0 || Math.sign(want) !== Math.sign(g.steer) ? ease * 1.6 : ease
      g.steer += Math.max(-toward * STEP, Math.min(toward * STEP, want - g.steer))
      return { steer: g.steer, throttle: gas ? 1 : 0, brake: brake ? 1 : 0 }
    }

    const finishLap = (g: Game) => {
      const run = g.run
      const time = run.lapTime!
      // Against the best of whoever drove it, and kept as theirs: someone else signed in meanwhile has theirs.
      const kept = g.owner === undefined ? null : bestLapOf(g.day, g.test, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      if (improved && g.owner !== undefined) {
        keepBestLap(g.day, g.test, g.owner, { time, splits: [...run.splits], ghost: g.record, ...(skinRef.current ? { skin: skinRef.current } : {}) })
      }
      g.lap = { time, score: hotlapBoardScore(time), splits: [...run.splits], improved, run: g.past ? runIdFor(SLUG) : null, path: g.record }
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    /** Frames in a row that failed to draw. */
    let failed = 0

    const loop = (now: number) => {
      if (!alive) return
      // The next frame first, so one that fails to draw can't stop the lap.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const run = g.run
      const live = !pausedRef.current

      if (live && g.phase === 'countdown') {
        const before = lightsFor(g)
        g.clock += dt
        const after = lightsFor(g)
        if (after !== before) sfx(after === 4 ? 'good' : 'tap')
        if (g.clock >= LIGHTS_OUT) {
          g.phase = 'racing'
          g.carry = 0
        }
      }
      if (live && (g.phase === 'racing' || g.phase === 'finished' || g.phase === 'gameover')) {
        g.carry += dt
        while (g.carry >= STEP) {
          g.carry -= STEP
          const racing = g.phase === 'racing'
          const input = racing ? controls(g) : { steer: 0, throttle: 0, brake: 0.35 }
          const bumpedBefore = run.bumped
          const wasCut = run.cut
          if (racing && g.steps % GHOST_EVERY === 0) g.record.push(run.x, run.y, run.h)
          stepRun(run, input, track)
          g.steps += 1
          g.t += STEP
          // The egg counts your car's donuts while it races: never the ghost's, nor once you're past the line.
          if (racing && spinDonuts(g.donuts, run)) spinOut()
          if (run.bumped > 0 && bumpedBefore === 0) {
            scene.bump()
            haptic('hit')
          }
          if (run.cut && !wasCut) {
            sfx('miss')
            say('You cut the track, so this lap won’t count. Restart to go again.', 6)
          }
          if (run.finished && racing) {
            g.phase = 'finished'
            g.clock = 0
            finishLap(g)
          }
        }
      }
      if (live && g.phase === 'finished') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another lap first. A lap that midnight
        // came in the middle of was on yesterday's track, and today's board is another track's: not saved.
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that lap, so it was on yesterday’s track. Here’s today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          clearThumbs()
        }
      }

      const pose = g.phase === 'menu' ? null : g.ghost.at(g.t)
      try {
        scene.frame(
          {
            run,
            showroom: g.phase === 'menu',
            driving: g.phase !== 'menu' && g.phase !== 'countdown',
            ghost: pose,
            ghostTag: ghostTag(g.chasing),
            cardAside: wide.matches,
            donutHint: g.donutHint,
            skin: skinRef.current,
            ghostSkin: g.chasing.who === 'pace' ? null : (g.chasing.skin ?? null),
          },
          live ? dt : 0,
        )
        failed = 0
      } catch (err) {
        // A phone can take the 3D context back (memory, a long time in the background); three.js stops
        // drawing until it's restored, though a frame or two can fail first. If drawing never comes back, say so.
        failed += 1
        if (failed === 1) console.warn('Hot Lap: a frame failed to draw', err)
        if (failed > 120) {
          alive = false
          setNoGl(true)
          return
        }
      }
      map?.draw(run.x, run.y, pose)
      const keys = keysRef.current
      const gasDown = !autopilot.current && (keys.gas || padRef.current.gas)
      sound.update(
        run,
        g.phase === 'racing' ? (gasDown ? 1 : 0) : g.phase === 'countdown' && gasDown ? 0.8 : 0,
        g.phase === 'countdown',
        live && (g.phase === 'countdown' || g.phase === 'racing' || g.phase === 'finished'),
      )
      if (clockRef.current) {
        const text = formatLap(g.lap ? g.lap.time : g.phase === 'racing' ? run.time : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }
      if (speedRef.current) {
        const text = String(Math.round(run.v * 2.237))
        if (speedRef.current.textContent !== text) speedRef.current.textContent = text
      }
      // The call's distance counts down; the card itself changes with the corner, below.
      const called = callShownRef.current
      if (called >= 0 && callFarRef.current && callBarRef.current) {
        const d = callDistance(track, paceNotes(track).calls[called]!, run.index)
        const text = callMetres(d)
        if (callFarRef.current.textContent !== text) callFarRef.current.textContent = text
        callBarRef.current.style.transform = `scaleX(${Math.min(1, d / CALL_FROM).toFixed(3)})`
      }

      // The rest of the heads-up changes only when something happens: the lights, a sector, the ghost, a corner.
      const next = snapshot(g)
      const key = `${next.phase}|${next.lights}|${next.splits.length}|${next.cut}|${next.ahead}|${next.call}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      dark.removeEventListener?.('change', retheme)
      themeWatch.disconnect()
      sound.dispose()
      soundRef.current = null
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
  }, [])

  // The keys: held while down; a lap starts from the card on Space or Enter, and R starts it again.
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
        // While driving, Space is the brake: a button still focused from a click mustn't take it too.
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
      clearThumbs()
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

  // Paused: nothing held carries over into the lap when it resumes.
  useEffect(() => {
    if (!paused) return
    keysRef.current = { ...NONE }
    clearThumbs()
  }, [paused])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(spunTimer.current)
    },
    [],
  )

  // Mounted again for a new day because a lap was lost to midnight: say so.
  useEffect(() => {
    if (notice) say(notice, 6)
    // Once, on the mount the notice came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const query = matchMedia(NARROW)
    const update = () => setNarrow(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  // Dev only: read the lap, or let the pace driver take the wheel, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __hotlap?: () => Game
      __hotlapScene?: () => HotLapScene | null
      __hotlapAuto?: (on?: boolean) => void
      __hotlapStart?: () => void
    }
    w.__hotlap = () => gameRef.current!
    w.__hotlapScene = () => sceneRef.current
    w.__hotlapAuto = (on = true) => {
      autopilot.current = on ? botDriver(course.track) : null
    }
    w.__hotlapStart = () => start()
    return () => {
      delete w.__hotlap
      delete w.__hotlapScene
      delete w.__hotlapAuto
      delete w.__hotlapStart
    }
  })

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    // Only the start card starts a lap from a tap; the end of one waits for its card.
    if (gameRef.current!.phase !== 'menu') return
    e.preventDefault()
    if (performance.now() >= startGrace.current) start()
  }

  /* Touch: each thumb on a side is one control, and sliding across that side changes which. */
  const readThumbs = () => {
    const on: Held = { ...NONE }
    for (const what of fingersRef.current.values()) on[what] = true
    padRef.current = on
    setPads(on)
  }
  const thumbZone = (a: keyof Held, b: keyof Held) => {
    const pick = (e: ReactPointerEvent<HTMLDivElement>) => {
      const [first, second] = Array.from(e.currentTarget.querySelectorAll('.hotlap__btn'))
      if (!first || !second) return a
      const split = (first.getBoundingClientRect().right + second.getBoundingClientRect().left) / 2
      return e.clientX < split ? a : b
    }
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        fingersRef.current.set(e.pointerId, pick(e))
        readThumbs()
      },
      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!fingersRef.current.has(e.pointerId)) return
        const now = pick(e)
        if (fingersRef.current.get(e.pointerId) === now) return
        fingersRef.current.set(e.pointerId, now)
        readThumbs()
      },
      onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
        fingersRef.current.delete(e.pointerId)
        readThumbs()
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
        fingersRef.current.delete(e.pointerId)
        readThumbs()
      },
      onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!fingersRef.current.delete(e.pointerId)) return
        readThumbs()
      },
    }
  }

  const g = gameRef.current!
  const chased = g.ghost.lap.splits
  const sectors = [0, 1, 2].map((k) => sectorFigure(k, ui.splits, chased))
  const latest = Math.max(0, ui.splits.length - 1)
  // Whose laps these are: the lap's driver once it's under way, whoever else signs in meanwhile.
  const driver: Viewer = g.owner === undefined ? viewer : ownerAccount(g.owner)
  // Your best today on the board; on another day's track, your best lap of it in this tab, or on a past
  // track's board if that's faster.
  const best = Math.max(apiBest, 0)
  const testBest = Math.min(
    test ? (bestLapOf(day, true, driver)?.time ?? Infinity) : Infinity,
    past && board?.you ? hotlapMsFromBoardScore(board.you.score) / 1000 : Infinity,
  )
  const bestText = test ? (testBest < Infinity ? formatLap(testBest) : '–') : best > 0 ? formatLap(hotlapMsFromBoardScore(best) / 1000) : '–'
  const showroom = ui.phase === 'menu'
  // The corner being called, on its card under the clock: not while paused, nor under a notice there.
  const call = ui.call >= 0 && !paused && !toast ? paceNotes(g.track).calls[ui.call] : undefined
  callShownRef.current = call ? ui.call : -1
  const callFar = call ? callDistance(g.track, call, g.run.index) : 0
  const lap = g.lap
  // Whose the lap is, for its card: an account's lap waits for that account; one driven signed out goes to whoever signs in.
  const lapOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  const bestMs = test ? (testBest < Infinity ? Math.round(testBest * 1000) : null) : best > 0 ? hotlapMsFromBoardScore(best) : null
  const extra = <TrackTiles course={course} ghost={g.ghost.lap.time} chasing={g.chasing} test={test} past={past} bestMs={bestMs} />
  // A past track, signed in: a lap goes on its board. Signed out it's practice, and so is a lap driven
  // signed out, for good: signing in on its card is for the laps after it.
  // One in the archive, older than a week (lib/archive.ts), is practice for everyone: its board is closed.
  const pastKind: PastKind =
    (viewer === null && (g.owner === undefined || g.owner === SIGNED_OUT)) ||
    (ui.phase === 'gameover' && g.owner === SIGNED_OUT) ||
    (pastTrack != null && inArchive(course.day))
      ? 'practice'
      : 'board'
  // The same one to the chrome and the pause card: the chip, the tab's title, Leave and the pause card's figures.
  const pastPlay: PastPlay | null = pastTrack
    ? { href: dailyTabHref(SLUG, 'past', course.n), kind: pastKind, title: course.name, facts: pastTrack.figures.facts }
    : null

  return (
    <section
      className={`hotlap hotlap--fullscreen${showroom ? ' hotlap--showroom' : ''}${touch ? ' hotlap--touch' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div className="hotlap__play" onPointerDown={onPointerDown}>
            <div ref={holderRef} className="hotlap__holder" />

            <GamePlayChrome slug={SLUG} inRun={() => IN_RUN.has(gameRef.current!.phase)} paused={paused} past={pastPlay}>
              {inRun && !paused ? (
                <button
                  type="button"
                  className="game-pause-btn"
                  aria-label="Restart the lap (R)"
                  title="Restart (R)"
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
                <PlayReadoutScore className={`hotlap__clock${ui.ahead === true ? ' is-ahead' : ui.ahead === false ? ' is-behind' : ''}`}>
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  {(narrow ? [latest] : [0, 1, 2]).map((k) => (
                    <PlayStat
                      key={k}
                      label={`S${k + 1}`}
                      value={<span className={sectors[k]!.tone ? `hotlap__delta--${sectors[k]!.tone}` : undefined}>{sectors[k]!.text}</span>}
                    />
                  ))}
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="hotlap__map" aria-hidden="true" />

            {!showroom ? (
              <div className="hotlap__speed" aria-hidden="true">
                <b ref={speedRef}>0</b>
                <span>mph</span>
              </div>
            ) : null}

            {call ? (
              <div key={ui.call} className={`hotlap__call hotlap__call--${call.grade}`} aria-hidden="true">
                <svg className="hotlap__call-shape" viewBox="-6 -6 112 112">
                  <path className="hotlap__call-glow" d={call.line} />
                  <path d={call.line} />
                  <path d={call.arrow} />
                </svg>
                <span className="hotlap__call-words">
                  <b>{call.word}</b>
                  <span>{call.more}</span>
                </span>
                <span className="hotlap__call-far">
                  <b ref={callFarRef}>{callMetres(callFar)}</b>
                  <span>m</span>
                </span>
                <i className="hotlap__call-bar">
                  <i ref={callBarRef} style={{ transform: `scaleX(${Math.min(1, callFar / CALL_FROM).toFixed(3)})` }} />
                </i>
              </div>
            ) : null}

            {ui.lights > 0 && !paused ? (
              <div className={`hotlap__lights${ui.lights === 4 ? ' is-go' : ''}`} role="status" aria-label={ui.lights === 4 ? 'Go' : 'Ready'}>
                {[1, 2, 3].map((k) => (
                  <i key={k} className={ui.lights === 4 || ui.lights >= k ? 'is-on' : undefined} />
                ))}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="hotlap__toast" role="status">
                {toast}
              </div>
            ) : null}

            {spun && !paused ? (
              <div className="hotlap__donuts" aria-hidden="true">
                Donuts!
              </div>
            ) : null}

            {touch && inRun && !paused ? (
              <div className="hotlap__pad">
                <div className="hotlap__zone hotlap__zone--steer" {...thumbZone('left', 'right')}>
                  <span className={`hotlap__btn${pads.left ? ' is-on' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.5 4.5 6 12l9.5 7.5z" />
                    </svg>
                  </span>
                  <span className={`hotlap__btn${pads.right ? ' is-on' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.5 4.5 18 12l-9.5 7.5z" />
                    </svg>
                  </span>
                </div>
                <div className="hotlap__zone hotlap__zone--pedals" {...thumbZone('brake', 'gas')}>
                  <span className={`hotlap__btn hotlap__btn--brake${pads.brake ? ' is-on' : ''}`}>Brake</span>
                  <span className={`hotlap__btn hotlap__btn--gas${pads.gas ? ' is-on' : ''}`}>Gas</span>
                </div>
              </div>
            ) : null}

            {noGl ? (
              <div className="hotlap__nogl">
                <p>Hot Lap is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="hotlap__overlay">
              <GamePauseOverlay
                slug={SLUG}
                personalBest={inRun ? previousBestRef.current : apiBest}
                hideBest={test}
                hideRecord={test}
                past={pastPlay}
                paused={paused}
                onResume={resume}
                onRestart={start}
                extraMeta={extra}
              />
              {showroom && !saveOpen && !paused && !noGl ? (
                pastTrack ? (
                  <PastTrackStart course={course} kind={pastKind} figures={pastTrack.figures} board={board} />
                ) : test ? (
                  <TestStartCard course={course} ghost={g.ghost.lap.time} />
                ) : (
                  <GameStartCard title="Hot Lap" slug={SLUG} extraMeta={extra} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && lap ? (
                pastTrack ? (
                  <PastTrackResult
                    course={course}
                    time={lap.time}
                    score={lap.score}
                    run={lap.run}
                    board={board}
                    owner={lapOwner}
                    onSaved={(result) => {
                      claimSaved(g)
                      pastTrack.refresh()
                      sendGhost(lap, result.name)
                    }}
                    onAgain={start}
                  />
                ) : test ? (
                  <TestResultCard
                    course={course}
                    time={lap.time}
                    splits={lap.splits}
                    best={bestLapOf(day, true, driver)?.time ?? lap.time}
                    improved={lap.improved}
                    onAgain={start}
                    onDone={toMenu}
                  />
                ) : tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={lap.score} onDone={toMenu} />
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={lap.score}
                    title="Lap complete"
                    subtitle={`${course.name} · sectors ${lap.splits.map((at, k) => (at - (k === 0 ? 0 : lap.splits[k - 1]!)).toFixed(2)).join(' · ')}`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace.time * 1000)}
                    shareLine={lapShareLine(course, lap.time, pace.time)}
                    medalPace={paceMsOf(course.pace)}
                    medalFormat={formatLap}
                    kicker={`Today’s Track #${course.n}`}
                    tomorrow={<TomorrowTrack day={course.day} />}
                    owner={lapOwner}
                    onSettled={() => sendGhost(lap, playerName)}
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

/** Dev only: localStorage `skermix-hotlap-dev-day` = YYYY-MM-DD plays that day's track, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-hotlap-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

/**
 * A past track, from its row on Past tracks: anyone's to race, and a lap on it goes on its own board
 * (PastTrackCards.tsx). Its board and its figures are asked for here, and again once a lap is saved.
 * Signed out, they're asked for without a tag: nobody's place is shown as yours.
 */
function PastTrackDay({ day }: { day: string }) {
  const viewer = useAccountId()
  const playerName = normalizePlayerName(usePlayerName())
  const name = viewer === null ? '' : playerName
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, trackNumber(day), name, version)
  const figures = usePastTrackFigures(day, board, viewer, name)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <HotLapDay day={day} test pastTrack={{ board, figures, refresh }} onNewDay={() => {}} />
}

/**
 * Hot Lap on today's track, mounted again for the next when midnight brings it; with `testDay` (the play
 * page's ?track=), another day's track. A past one is anyone's to race, on its own board. Today's, or one
 * still to come, is a test drive, and only an admin's: anyone else is sent to today's track, with a word
 * about why when the track's day hasn't come.
 */
export function HotLapGame({ testDay }: { testDay?: string | null }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? trackDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  const state = testDay ? trackState(trackNumber(testDay)) : null
  const gated = state !== null && state !== 'past'
  // Sent away only once we know: signed in (or not), and the API has said this account isn't an admin.
  const shut = gated && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (testDay && state === 'past') return <PastTrackDay key={`past-${testDay}`} day={testDay} />
  if (testDay && admin === true) return <HotLapDay key={`test-${testDay}`} day={testDay} test onNewDay={() => {}} />
  // Still signing in, or still asking the API whether this account is an admin.
  if (testDay && !shut) return null
  const notice = testDay && state === 'ahead' ? `Track #${trackNumber(testDay)}’s day hasn’t come yet. Here’s today’s.` : today.notice
  return <HotLapDay key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: trackDay(), notice: why })} />
}
