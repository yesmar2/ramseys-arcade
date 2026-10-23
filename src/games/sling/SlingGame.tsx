import '../../styles/sling.css'
import { noteCourseBest } from '../../lib/courseBests'
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
import { dailyTabHref, gamePlayHref, navigate, todayShareHref } from '../../hooks/useHashRoute'
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
import { boardTime, paceMsOf } from '../../lib/raceMedals'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun, runIdFor } from '../../lib/runSession'
import { ordinal } from '../../lib/scoreboard'
import { sfx } from '../../lib/sound'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { GhostPicker } from '../../components/GhostPicker'
import { useRaceTag } from '../../lib/raceGhost'
import { fetchBoardGhost, fetchNextGhost, fetchPlayerGhost, fitsTower, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { msUntilNextTower, towerDay, towerNumber, untilWords } from './daily'
import { TowerMap } from './map'
import { onItsDayFact, type ItsDay } from './pastDay'
import { PastTowerResult, PracticeStartCard } from './PracticeCards'
import {
  claimRun,
  Ghost,
  keepBestRun,
  keepPracticeRun,
  keptRun,
  LAB_DAY,
  paceIfFlown,
  paceOf,
  practiceBest,
  slingDay,
  type GhostPose,
  type GhostRun,
  type SlingDay,
} from './runs'
import { TowerScene, type Aim } from './scene'
import { formatRun, formatSlingBoardScore, missWords, skipWords, slingBoardScore, slingMsFromBoardScore } from './score'
import { cloneBlip, DT, FLOATING, FLYING, GHOST_EVERY, GOOD_HANDS, HANGING, makeHands, newBlip, step, type Blip, type Fling } from './sim'
import { TestResultCard, TestStartCard } from './TestCards'
import { TomorrowTower } from './TomorrowTower'
import { chromeTakesKey, controlTakesKey } from '../keys'

const SLUG = 'sling'

type Phase = 'menu' | 'countdown' | 'climbing' | 'top' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'climbing'])
const COUNT_FROM = 3
const COUNT_STEP = 0.8
/** At the top, a moment to see the time before the card comes. */
const CARD_AFTER = 1.1
/** A drag this long (CSS pixels) flings as hard as Blip can; shorter than MIN_DRAG is no fling. */
const FULL_DRAG = 150
const MIN_DRAG = 18
/** The keys: ← → turn the aim, ↑ ↓ change its power, Space flings. */
const AIM_TURN = 1.9
const AIM_POWER = 0.9
const COACH_RUNS = 3
const COACH_KEY = 'skermix-sling-coach'

type Chasing =
  | { who: 'next'; name: string; place: number; skin?: string }
  | { who: 'rival'; name: string; skin?: string }
  | { who: 'you'; skin?: string }
  | { who: 'pace' }

function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'Your best' : 'Blue blip'
}

function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue blip'
}

/** A drag being made: where the finger went down and where it is now, in CSS pixels on the play area. */
type Drag = { id: number; x0: number; y0: number; x: number; y: number }

type Game = {
  phase: Phase
  day: string
  owner: string | undefined
  blip: Blip
  last: { x: number; y: number }
  clock: number
  carry: number
  steps: number
  /** A fling let go of, for the next step. */
  fling: Fling | null
  record: number[]
  ghost: Ghost
  chasing: Chasing
  run: {
    time: number
    score: number
    splits: number[]
    misses: number
    skips: number
    improved: boolean
    before: number | null
    path: number[]
    runId: Promise<string | undefined> | null
  } | null
}

type PastBoard = { board: TrackBoard | null; refresh: () => void }

type Ui = { phase: Phase; count: number; passed: number; peg: number }

function countOf(g: Game): number {
  if (g.phase === 'countdown') return Math.max(1, COUNT_FROM - Math.floor(g.clock / COUNT_STEP))
  if (g.phase === 'climbing' && g.blip.t < 0.7) return 0
  return -1
}

const snapshot = (g: Game): Ui => ({ phase: g.phase, count: countOf(g), passed: g.blip.splits.length, peg: g.blip.best })

function bestOf(day: string, practice: boolean, viewer: string | null | undefined): GhostRun | null {
  const kept = keptRun(day, viewer)
  if (!practice) return kept
  const tab = practiceBest(day, viewer)
  return tab && (!kept || tab.time < kept.time) ? tab : kept
}

type Chase = { ghost: Ghost; chasing: Chasing }

const topChasing = (top: BoardGhost, me: string): Chasing =>
  top.name === me ? { who: 'you', skin: top.skin } : { who: 'rival', name: top.name, skin: top.skin }

/** Your first climb up a tower is against the blue blip, as the other races have it. */
const firstRun = (mine: GhostRun | null, top: BoardGhost | null, me: string, next: NextGhost | null) => !mine && !next && top?.name !== me

/**
 * The run to beat. Your first here, the blue blip's. On today's tower, once you've a run on the board, the player
 * one place above you; else the board's #1, unless your own best here is faster; with nobody on the board, your
 * best here when it beats the blue blip, else the blue blip's.
 */
function chaseFor(day: string, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null, picked: NextGhost | null = null): Chase {
  const pace = paceOf(day)
  const mine = bestOf(day, practice, currentAccountId())
  if (picked) return { ghost: new Ghost(picked.run ?? standIn(pace, picked.time)), chasing: topChasing(picked, me) }
  if (firstRun(mine, top, me, next)) return { ghost: new Ghost(pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(next.run ?? standIn(pace, next.time)), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) return { ghost: new Ghost(top.run ?? standIn(pace, top.time)), chasing: topChasing(top, me) }
  return mine && mine.time < pace.time ? { ghost: new Ghost(mine), chasing: { who: 'you' } } : { ghost: new Ghost(pace), chasing: { who: 'pace' } }
}

/** The run to chase at the start card, where the blue blip may not have climbed yet (paceOf warms it while the card is up). */
function cardChase(sling: SlingDay, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null, picked: NextGhost | null = null): Chase {
  const mine = bestOf(sling.day, practice, currentAccountId())
  const flown = paceIfFlown(sling.day)
  const start = newBlip(sling.tower)
  const waiting = (time: number) => new Ghost(flown ? standIn(flown, time) : { time, splits: [], ghost: [start.x, start.y, HANGING, start.x, start.y, HANGING] })
  if (picked) return { ghost: picked.run ? new Ghost(picked.run) : waiting(picked.time), chasing: topChasing(picked, me) }
  if (firstRun(mine, top, me, next)) return { ghost: flown ? new Ghost(flown) : waiting(sling.pace), chasing: { who: 'pace' } }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: next.run ? new Ghost(next.run) : waiting(next.time), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin } }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) return { ghost: top.run ? new Ghost(top.run) : waiting(top.time), chasing: topChasing(top, me) }
  if (mine && mine.time < sling.pace) return { ghost: new Ghost(mine), chasing: { who: 'you' } }
  return { ghost: flown ? new Ghost(flown) : waiting(sling.pace), chasing: { who: 'pace' } }
}

function freshGame(sling: SlingDay, chase: Chase): Game {
  const blip = newBlip(sling.tower)
  return {
    phase: 'menu',
    day: sling.day,
    owner: undefined,
    blip,
    last: { x: blip.x, y: blip.y },
    clock: 0,
    carry: 0,
    steps: 0,
    fling: null,
    record: [],
    ghost: chase.ghost,
    chasing: chase.chasing,
    run: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

const calmMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

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

function gapText(d: number) {
  return Math.abs(d) < 0.005 ? '0.00' : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`
}
const gapTone = (d: number | null) => (d == null || Math.abs(d) < 0.005 ? '' : d < 0 ? 'good' : 'bad')

function runShareLine(sling: SlingDay, time: number, pace: number, misses: number): string {
  const gap = Math.abs(time - pace)
  const against = gap < 0.005 ? 'tied with the blue blip' : time < pace ? `beat the blue blip by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue blip`
  return [`Sling · Today’s Tower #${sling.n} 🧗`, `${sling.name}: ${formatRun(time)}, ${against}, ${missWords(misses)}`, `${window.location.origin}${todayShareHref(sling.day)}`].join('\n')
}

/** A drag's fling: back from where the finger is to where it went down, as hard as it's long. */
function dragFling(d: Drag): Fling | null {
  const ux = d.x0 - d.x
  const uy = d.y0 - d.y
  const len = Math.hypot(ux, uy)
  if (len < MIN_DRAG) return null
  return { ang: Math.atan2(-uy, ux), pw: Math.min(1, len / FULL_DRAG) }
}

function TowerTiles({ sling, ghost, chasing, bestMs }: { sling: SlingDay; ghost: number; chasing: Chasing; bestMs: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextTower())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextTower()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <>
      <div className="game-pause-meta__row sling-tower">
        <span>Today’s tower · #{sling.n}</span>
        <strong>{sling.name}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>{chasingLabel(chasing)}</span>
        <strong>{boardTime('sling', ghost)}</strong>
      </div>
      <MedalRow game="sling" paceMs={paceMsOf(sling.pace)} bestMs={bestMs} />
      <div className="game-pause-meta__row">
        <span>Next tower</span>
        <strong>{untilWords(left)}</strong>
      </div>
    </>
  )
}

/**
 * Sling: Blip up a day's tower, peg to peg, against the clock. Drag back anywhere and let go to fling him; he
 * grabs a peg near the top of his flight, so a good fling can go past a peg to a higher one. Miss, or touch a
 * bramble, a bug or a sweeper, and he floats back to the peg he left. The tower's sections are the day's own:
 * sliders, carousels, clay pegs, brambles, bugs, an updraft, a boost peg and sweepers, in its own order.
 *
 * A daily like the other races: a new tower every day, the same for everyone (daily.ts), climbed as often as you
 * like, raced against the blue blip, the board's #1 or the player one place above you. Keys: ← → aim, ↑ ↓ power,
 * Space fling, R start again, P or Escape pause. A run is scored as its time (score.ts).
 */
function SlingDayGame({
  day,
  practice = false,
  test = false,
  itsDay,
  pastBoard = null,
  onNewDay,
  notice,
}: {
  day: string
  practice?: boolean
  test?: boolean
  itsDay?: ItsDay
  pastBoard?: PastBoard | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const sling = slingDay(day)
  const pace = sling.pace
  const past = pastBoard !== null && !test
  const board = pastBoard?.board ?? null
  const topRef = useRef<BoardGhost | null>(null)
  const nextRef = useRef<NextGhost | null>(null)
  const pickedRef = useRef<NextGhost | null>(null)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(sling, cardChase(sling, practice, null, playerName, null))
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noCanvas, setNoCanvas] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [touch] = useState(touchScreen)
  const holderRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const splitRef = useRef<HTMLElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<TowerScene | null>(null)
  /** The drag being made, if any; the keys' aim, once a key has turned it. */
  const dragRef = useRef<Drag | null>(null)
  const keyAimRef = useRef<{ ang: number; pw: number; on: boolean }>({ ang: Math.PI / 2, pw: 0.6, on: false })
  const keysRef = useRef(new Set<string>())
  const coachRef = useRef({ on: false, flung: false })
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((b: Blip) => Fling | null) | null>(null)
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
    dragRef.current = null
    keysRef.current.clear()
  }

  const coachSays = (text: string) => {
    if (hintRef.current && hintRef.current.textContent !== text) hintRef.current.textContent = text
  }

  const clearSplit = () => {
    const el = splitRef.current
    if (!el) return
    el.textContent = '–'
    el.className = ''
  }

  const newDay = (why?: string) => {
    if (practice || towerDay() === day || devDay()) return false
    onNewDay(why)
    return true
  }
  const newDayRef = useRef(newDay)
  newDayRef.current = newDay

  const start = () => {
    if (newDay()) return
    const owner = ownerOf(currentAccountId())
    if (owner === undefined) {
      say('Still signing you in. Try again in a moment.')
      return
    }
    saveOpenRef.current = false
    setSaveOpen(false)
    if (!practice) {
      clearRunAchievements()
      beginRun(SLUG)
    } else if (past) beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(sling, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current, pickedRef.current))
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    sceneRef.current?.snap()
    letGo()
    keyAimRef.current = { ang: Math.PI / 2, pw: 0.6, on: false }
    const coach = coachRef.current
    coach.on = coachRuns() < COACH_RUNS
    coach.flung = false
    countCoachRun()
    coachSays(coach.on || touch ? (touch ? 'Drag back anywhere, let go to fling' : 'Drag back with the mouse, or aim with ← → ↑ ↓ and Space') : '')
    clearSplit()
    say(null)
    setUi(snapshot(g))
  }

  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(sling, chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current, pickedRef.current))
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 300
    sceneRef.current?.snap()
    letGo()
    coachSays('')
    clearSplit()
    say(null)
    setUi(snapshot(gameRef.current))
  }

  const restart = () => {
    if (!IN_RUN.has(gameRef.current!.phase) || pausedRef.current || saveOpenRef.current) return
    start()
  }

  const rechase = () => {
    if (gameRef.current!.phase !== 'menu') return
    gameRef.current = freshGame(sling, cardChase(sling, practice, topRef.current, nameRef.current, nextRef.current, pickedRef.current))
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  const takeTop = (next: BoardGhost | null) => {
    topRef.current = next?.run && !fitsTower(sling.tower, next.run) ? { ...next, run: null } : next
    rechase()
  }
  const takeTopRef = useRef(takeTop)
  takeTopRef.current = takeTop

  const chasedFor = useRef(`${viewer}|${playerName}`)
  useEffect(() => {
    const who = `${viewer}|${playerName}`
    if (chasedFor.current === who) return
    chasedFor.current = who
    rechaseRef.current()
  }, [viewer, playerName])

  const sendGhost = (run: { time: number; score: number; splits: number[]; path: number[] }, name: string) => {
    if ((practice && !past) || !signedIn || !name) return
    const today = !practice
    void sendBoardGhost(sling.n, name, run).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(sling.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  const askNext = () => {
    const tag = nameRef.current
    if (practice || !signedIn || !tag || sling.day > towerDay()) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(sling.n, tag).then((next) => {
      if (tag !== nameRef.current) return
      nextRef.current = next?.run && !fitsTower(sling.tower, next.run) ? { ...next, run: null } : next
      rechaseRef.current()
    })
  }
  const askNextRef = useRef(askNext)
  askNextRef.current = askNext

  const raceTag = useRaceTag(SLUG, sling.n)
  const [raceNote, setRaceNote] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!raceTag || Boolean(test)) {
      setRaceNote(null)
      if (pickedRef.current) {
        pickedRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchPlayerGhost(sling.n, raceTag).then((got) => {
      if (!live) return
      const next = got === 'plus' ? null : got
      pickedRef.current = next?.run && !fitsTower(sling.tower, next.run) ? { ...next, run: null } : next
      setRaceNote(got === 'plus' ? `Racing ${raceTag}’s ghost is with Plus` : got ? null : `${raceTag} has no run here`)
      rechaseRef.current()
    })
    return () => {
      live = false
    }
  }, [raceTag, sling.n])
  useEffect(() => {
    askNextRef.current()
  }, [signedIn, playerName, sling.n, practice])

  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    let live = true
    const asked = sling.day > towerDay() || sling.day === LAB_DAY ? Promise.resolve(null) : fetchBoardGhost(sling.n)
    void asked.then((found) => {
      if (!live) return
      if (found) takeTopRef.current(found)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [sling.n, sling.day])

  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (practice || !topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = keptRun(day, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: slingBoardScore(mine.time), splits: mine.splits, path: mine.ghost }, playerName)
  }, [practice, topAsked, signedIn, viewer, playerName, day])

  const claimSaved = (g: Game) => {
    const id = currentAccountId()
    if (g.owner !== SIGNED_OUT || !g.run || typeof id !== 'string') return
    claimRun(g.day, id, { time: g.run.time, splits: g.run.splits, ghost: g.run.path })
    g.owner = id
  }

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { tower } = sling
    const canvas = document.createElement('canvas')
    canvas.className = 'sling__view'
    canvas.setAttribute('aria-label', 'The tower, seen from the front, climbing with Blip')
    holder.append(canvas)
    let scene: TowerScene
    try {
      scene = new TowerScene(canvas, tower)
    } catch {
      canvas.remove()
      setNoCanvas(true)
      return
    }
    sceneRef.current = scene
    const map = mapRef.current ? new TowerMap(mapRef.current, tower) : null
    const retheme = () => {
      map?.rebuild()
      scene.retheme()
    }
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const calm = calmMotion()

    const splitShown = (g: Game, k: number, theirs: number | undefined = g.ghost.run.splits[k]) => {
      const at = g.blip.splits[k]
      const d = at != null && theirs != null ? at - theirs : null
      const el = splitRef.current
      if (el) {
        el.textContent = d == null ? (at != null ? formatRun(at) : '–') : gapText(d)
        el.className = gapTone(d) ? `sling__delta--${gapTone(d)}` : ''
      }
      return d
    }

    const finishRun = (g: Game) => {
      const b = g.blip
      const time = b.time
      g.record.push(Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, HANGING)
      const kept = g.owner === undefined ? null : bestOf(g.day, practice, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      const path = g.record
      const splits = [...b.splits]
      if (improved && g.owner !== undefined) {
        const run = { time, splits, ghost: path }
        if (practice) keepPracticeRun(g.day, g.owner, run)
        else keepBestRun(g.day, g.owner, run)
      }
      g.run = { time, score: slingBoardScore(time), splits, misses: b.misses, skips: b.skips, improved, before: kept?.time ?? null, path, runId: past ? runIdFor(SLUG) : null }
      if (!test) noteCourseBest(SLUG, towerNumber(g.day), Math.round(time * 1000), runIdFor(SLUG))
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
      coachSays('')
    }

    /** The aim to draw: a drag being made, or the keys' aim; with the first moments of its flight. */
    const aimFor = (g: Game): Aim | null => {
      if (g.phase !== 'climbing' || !g.blip.on || g.blip.back) return null
      const d = dragRef.current
      let f: Fling | null = null
      let from = { x: 0, y: 0 }
      let to = { x: 0, y: 0 }
      if (d) {
        f = dragFling(d)
        from = { x: d.x0, y: d.y0 }
        to = { x: d.x, y: d.y }
      } else if (keyAimRef.current.on) {
        f = { ang: keyAimRef.current.ang, pw: keyAimRef.current.pw }
        const px = scene.sx(g.blip.x)
        const py = scene.sy(g.blip.y)
        from = { x: px, y: py }
        to = { x: px - Math.cos(f.ang) * f.pw * 60, y: py + Math.sin(f.ang) * f.pw * 60 }
      }
      if (!f) return null
      const c = cloneBlip(g.blip)
      const dots: number[] = []
      step(tower, c, f)
      // The whole rise, over the top and a little way down: where a fling goes is the hard part on a phone.
      for (let k = 0; k < 140 && !c.on && !c.back; k++) {
        step(tower, c, null)
        if (k % 3 === 0) dots.push(c.x, c.y)
        if (c.vy < -320) break
      }
      return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, dots, pw: f.pw }
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    let attract = 0

    const loop = (now: number) => {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const b = g.blip
      const live = !pausedRef.current

      if (live && g.phase === 'countdown') {
        const before = countOf(g)
        g.clock += dt
        if (g.clock >= COUNT_FROM * COUNT_STEP) {
          g.phase = 'climbing'
          g.carry = 0
          sfx('good')
        } else if (countOf(g) !== before) sfx('tap')
      }
      if (live && g.phase === 'climbing') {
        // The keys' aim turns and grows while they're held.
        const keys = keysRef.current
        const ka = keyAimRef.current
        if (keys.has('ArrowLeft') || keys.has('KeyA')) ka.ang = Math.min(Math.PI * 0.97, ka.ang + AIM_TURN * dt)
        if (keys.has('ArrowRight') || keys.has('KeyD')) ka.ang = Math.max(Math.PI * 0.03, ka.ang - AIM_TURN * dt)
        if (keys.has('ArrowUp') || keys.has('KeyW')) ka.pw = Math.min(1, ka.pw + AIM_POWER * dt)
        if (keys.has('ArrowDown') || keys.has('KeyS')) ka.pw = Math.max(0.2, ka.pw - AIM_POWER * dt)
        g.carry += dt
        while (g.carry >= DT && g.phase === 'climbing') {
          g.carry -= DT
          g.last = { x: b.x, y: b.y }
          let fling = autopilot.current ? autopilot.current(b) : g.fling
          if (!b.on || b.back) fling = null
          g.fling = null
          if (g.steps % GHOST_EVERY === 0) g.record.push(Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, b.back ? FLOATING : b.on ? HANGING : FLYING)
          const ev = step(tower, b, fling)
          g.steps += 1
          if (ev === 'fling') {
            sfx('whoosh')
            haptic('turn')
            scene.event(b.boosted ? 'boost' : 'fling', b.x, b.y)
            if (!coachRef.current.flung) {
              coachRef.current.flung = true
              coachSays('')
            }
          } else if (ev === 'grab' || ev === 'skip' || (ev && typeof ev === 'object')) {
            scene.event(ev === 'skip' ? 'skip' : 'grab', b.x, b.y)
            sfx(ev === 'skip' ? 'perfect' : 'hop', ev === 'skip' ? 3 : 0)
            haptic('hit')
            if (ev && typeof ev === 'object') {
              const d = splitShown(g, ev.flag)
              sayRef.current(`Flag ${ev.flag + 1} · ${d == null ? formatRun(b.splits[ev.flag]!) : gapText(d)}`)
            }
          } else if (ev === 'bounce') {
            scene.event('bounce', b.x, b.y)
            sfx('boing')
            haptic('hit')
          } else if (ev === 'miss' || ev === 'prick' || ev === 'bump' || ev === 'swept' || ev === 'crumble') {
            scene.event(ev, b.x, b.y)
            sfx(ev === 'miss' ? 'miss' : 'hit')
            haptic('hit')
            if (coachRef.current.on && ev === 'miss') coachSays('He grabs a peg near the top of his flight: aim a little past it')
          } else if (ev === 'finish') {
            scene.event('skip', b.x, b.y)
            g.phase = 'top'
            g.clock = 0
            dragRef.current = null
            finishRun(g)
            splitShown(g, b.splits.length - 1, g.ghost.run.time)
          }
        }
      }
      if (live && g.phase === 'top') {
        g.clock += dt
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that run, so it was on yesterday’s tower. Here is today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          letGo()
        }
      }

      const f = live && g.phase === 'climbing' ? Math.min(1, g.carry / DT) : 1
      const pose = { x: g.last.x + (b.x - g.last.x) * f, y: g.last.y + (b.y - g.last.y) * f }
      let ghost: GhostPose | null
      if (g.phase === 'menu') {
        if (live) attract += dt
        ghost = g.ghost.at(attract)
        if (ghost.done && attract > g.ghost.run.time + 1.5) {
          attract = 0
          scene.snap()
        }
      } else ghost = g.ghost.at(g.phase === 'countdown' ? 0 : g.run ? g.run.time + g.clock : b.t)
      const runT = g.phase === 'menu' ? attract : g.phase === 'countdown' ? 0 : b.t
      scene.frame(
        {
          mode: g.phase === 'menu' ? 'menu' : g.phase === 'top' || g.phase === 'gameover' ? 'done' : 'play',
          t: runT,
          blip: { x: pose.x, y: pose.y, vx: b.vx, vy: b.vy, on: b.on, floating: b.back !== null, peg: b.p, held: b.held },
          best: b.best,
          flag: b.splits.length - 1,
          aim: live ? aimFor(g) : null,
          ghost,
          ghostTag: ghostTag(g.chasing),
          ghostMine: g.chasing.who === 'you',
          ghostBlue: g.chasing.who === 'pace',
          gone: b.gone && b.t < b.gone.until ? b.gone.i : -1,
          calm,
        },
        live ? dt : 0,
      )
      map?.draw(pose.y, ghost && g.phase !== 'menu' && !ghost.done ? ghost.y : null)
      if (clockRef.current) {
        const text = formatRun(g.run ? g.run.time : g.phase === 'climbing' ? b.t : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }
      const next = snapshot(g)
      const key = `${next.phase}|${next.count}|${next.passed}|${next.peg}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    const warm = window.setTimeout(() => {
      paceOf(sling.day)
      rechaseRef.current()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(warm)
      cancelAnimationFrame(raf)
      dark.removeEventListener?.('change', retheme)
      themeWatch.disconnect()
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The keys: Space or Enter starts from the card; in a run ← → ↑ ↓ aim, Space flings, R starts again.
  useEffect(() => {
    const AIM_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'])
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (saveOpenRef.current || pausedRef.current) return
      if (chromeTakesKey(e)) return
      const g = gameRef.current!
      if (g.phase === 'menu') {
        if (e.code !== 'Space' && e.code !== 'Enter') return
        if (controlTakesKey(e)) return
        e.preventDefault()
        if (!e.repeat && performance.now() >= startGrace.current) start()
        return
      }
      if (!IN_RUN.has(g.phase)) return
      if (AIM_KEYS.has(e.code)) {
        e.preventDefault()
        keysRef.current.add(e.code)
        keyAimRef.current.on = true
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        if (!e.repeat && g.phase === 'climbing' && g.blip.on && !g.blip.back) {
          const ka = keyAimRef.current
          ka.on = true
          g.fling = { ang: ka.ang, pw: ka.pw }
        }
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

  useEffect(() => {
    if (!paused) return
    letGo()
  }, [paused])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (notice) say(notice, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dev only: read the run, or let a good player's hands take over, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __sling?: () => Game
      __slingScene?: () => TowerScene | null
      __slingAuto?: (on?: boolean) => void
      __slingStart?: () => void
    }
    w.__sling = () => gameRef.current!
    w.__slingScene = () => sceneRef.current
    w.__slingAuto = (on = true) => {
      autopilot.current = on ? makeHands(sling.tower, GOOD_HANDS) : null
    }
    w.__slingStart = () => start()
    return () => {
      delete w.__sling
      delete w.__slingScene
      delete w.__slingAuto
      delete w.__slingStart
    }
  })

  /** Where a pointer is on the play area, in CSS pixels. */
  const local = (e: ReactPointerEvent<HTMLElement>) => {
    const box = (holderRef.current ?? e.currentTarget).getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  /* A tap starts a run from the card; in a run, a drag anywhere aims and letting go flings. */
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
    const p = local(e)
    dragRef.current = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y }
    keyAimRef.current.on = false
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const p = local(e)
    d.x = p.x
    d.y = p.y
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    const g = gameRef.current!
    const f = dragFling(d)
    if (f && g.phase === 'climbing' && g.blip.on && !g.blip.back) g.fling = f
  }
  const onPointerCancel = () => {
    dragRef.current = null
  }

  const g = gameRef.current!
  const showroom = ui.phase === 'menu'
  const run = g.run
  const tabBest = practice ? (bestOf(day, true, g.owner === undefined ? viewer : ownerAccount(g.owner))?.time ?? null) : null
  const boardBest = past && viewer !== null && board?.you ? slingMsFromBoardScore(board.you.score) / 1000 : null
  const practiceBestTime = tabBest == null ? boardBest : boardBest == null ? tabBest : Math.min(tabBest, boardBest)
  const bestText = practice ? (practiceBestTime != null ? formatRun(practiceBestTime) : '–') : apiBest > 0 ? formatRun(slingMsFromBoardScore(apiBest) / 1000) : '–'
  const bestHere = practiceBestTime != null ? boardTime(SLUG, practiceBestTime) : '–'
  const runOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  const went: ItsDay = itsDay ?? { days: null, failed: false, me: null }
  const pastKind: PastKind =
    (viewer === null && (g.owner === undefined || g.owner === SIGNED_OUT)) || (ui.phase === 'gameover' && g.owner === SIGNED_OUT) || (past && inArchive(day))
      ? 'practice'
      : 'board'
  const pastPlay: PastPlay | null = past
    ? {
        href: dailyTabHref(SLUG, 'past', day),
        kind: pastKind,
        title: sling.name,
        facts: [onItsDayFact(day, went), allTimeFact(SLUG, board, viewer !== null, formatSlingBoardScore)],
      }
    : null
  const ghostPick = Boolean(test) ? null : <GhostPicker game={SLUG} course={sling.n} racing={ghostTag(g.chasing)} picked={raceTag} note={raceNote} />
  const extra = practice ? (
    <>
      <div className="game-pause-meta__row">
        <span>Blue blip</span>
        <strong>{boardTime(SLUG, pace)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Your best here</span>
        <strong>{bestHere}</strong>
      </div>
    </>
  ) : (
    <TowerTiles sling={sling} ghost={g.ghost.run.time} chasing={g.chasing} bestMs={apiBest > 0 ? slingMsFromBoardScore(apiBest) : null} />
  )
  const splitsText = (r: NonNullable<Game['run']>) =>
    [sling.name, ...r.splits.slice(0, -1).map((at, k) => `F${k + 1} ${formatRun(at)}`), missWords(r.misses), skipWords(r.skips)].join(' · ')
  const pegsTotal = sling.tower.pegs.length - 1

  return (
    <section className={`sling sling--fullscreen${showroom ? ' sling--showroom' : ''}${touch ? ' sling--touch' : ''}${pastPlay ? ' sling--past' : ''}`} style={gameAccentStyle(SLUG)}>
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div
            ref={playRef}
            className="sling__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div ref={holderRef} className="sling__holder" />

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
                <PlayReadoutScore className="sling__clock">
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  <PlayStat label={ui.phase === 'top' || ui.phase === 'gameover' ? 'Top' : ui.passed > 0 ? `Flag ${ui.passed}` : 'Split'} value={<span ref={splitRef}>–</span>} />
                  <PlayStat label="Peg" value={`${Math.min(ui.peg, pegsTotal)}/${pegsTotal}`} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="sling__map" aria-hidden="true" />

            {ui.count >= 0 && !paused ? (
              <div className={`sling__count${ui.count === 0 ? ' is-go' : ''}`} role="status">
                {ui.count === 0 ? 'Go!' : ui.count}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="sling__toast" role="status">
                {toast}
              </div>
            ) : null}

            <div ref={hintRef} className="sling__hint" />

            {noCanvas ? (
              <div className="sling__nocanvas">
                <p>This browser can’t draw Sling’s tower.</p>
              </div>
            ) : null}

            <div className="sling__overlay">
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
                  <TestStartCard sling={sling} best={practiceBestTime} />
                ) : pastPlay ? (
                  <PracticeStartCard sling={sling} kind={pastKind} facts={pastPlay.facts ?? []} tiles={<>{extra}{ghostPick}</>} board={board} />
                ) : (
                  <GameStartCard title="Sling" slug={SLUG} extraMeta={<>{extra}{ghostPick}</>} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && run ? (
                test ? (
                  <TestResultCard sling={sling} time={run.time} misses={run.misses} best={practiceBestTime ?? run.time} improved={run.improved} onAgain={start} onDone={toMenu} />
                ) : tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={run.score} onDone={toMenu} />
                ) : past ? (
                  <PastTowerResult
                    sling={sling}
                    time={run.time}
                    score={run.score}
                    misses={run.misses}
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
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={run.score}
                    title="Top of the tower"
                    subtitle={splitsText(run)}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace * 1000)}
                    shareLine={runShareLine(sling, run.time, pace, run.misses)}
                    medalPace={paceMsOf(sling.pace)}
                    medalFormat={formatRun}
                    kicker={`Today’s Tower #${sling.n}`}
                    tomorrow={<TomorrowTower day={sling.day} />}
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

/** Dev only: localStorage `skermix-sling-dev-day` = YYYY-MM-DD climbs that day's tower, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-sling-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

function PastSling({ day }: { day: string }) {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(SLUG, viewer.name)
  const itsDay: ItsDay = { days, failed, me: viewer.state === 'in' ? viewer.name : null }
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, towerNumber(day), viewer.state === 'out' ? '' : viewer.name, version)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <SlingDayGame day={day} practice itsDay={itsDay} pastBoard={{ board, refresh }} onNewDay={() => {}} />
}

/**
 * Sling on today's tower, mounted again for the next when midnight brings it; with `practiceDay`, a past day's
 * tower from the past tab, onto its All time board; with `testDay`, today's tower or one still to come, test
 * climbed from the admin's Tower Book; with `lab`, the test tower (every section once).
 */
export function SlingGame({ practiceDay, testDay, lab = false }: { practiceDay?: string | null; testDay?: string | null; lab?: boolean }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? towerDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  const shut = (Boolean(testDay) || lab) && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (practiceDay) return <PastSling key={`practice-${practiceDay}`} day={practiceDay} />
  if (lab && admin === true) return <SlingDayGame key="lab" day={LAB_DAY} practice test onNewDay={() => {}} />
  if (lab && !shut) return null
  if (testDay && admin === true) return <SlingDayGame key={`test-${testDay}`} day={testDay} practice test onNewDay={() => {}} />
  if (testDay && !shut) return null
  const notice = testDay && testDay !== towerDay() ? `Tower #${towerNumber(testDay)}’s day hasn’t come yet. Here is today’s.` : today.notice
  return <SlingDayGame key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: towerDay(), notice: why })} />
}
