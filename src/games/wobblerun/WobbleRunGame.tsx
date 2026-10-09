import '../../styles/wobblerun.css'
import { noteCourseBest } from '../../lib/courseBests'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { MedalIcon, MedalRow } from '../../components/RaceMedal'
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
import { MEDAL_NAMES, medalFor, nextMedal, paceMsOf } from '../../lib/raceMedals'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun, runIdFor } from '../../lib/runSession'
import { ordinal } from '../../lib/scoreboard'
import { useSkinInto } from '../../lib/skins'
import { useTrackBoard, type TrackBoard } from '../../lib/trackBoards'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { RunSound } from './audio'
import { fetchBoardGhost, fetchNextGhost, fitsCourse, sendBoardGhost, standIn, type BoardGhost, type NextGhost } from './boardGhost'
import { StarMark } from './StarMark'
import { gauntletDay, gauntletNumber, msUntilNextGauntlet, untilWords } from './daily'
import { BLUE_HANDS, FAST_HANDS, liveHands } from './engine/bots'
import { labRoundNames } from './engine/lab'
import { newRun, step, STEP } from './engine/sim'
import type { Course, Input, Run, SimEvent } from './engine/types'
import { RoundIcon } from './GauntletDrawing'
import { gauntletRounds } from './gauntletPicture'
import { onItsDayFact, type ItsDay } from './pastDay'
import { PastGauntletResult, PracticeStartCard } from './PracticeCards'
import {
  claimRun,
  Ghost,
  keepBestRun,
  keepPracticeRun,
  keptRun,
  LAB_DAY,
  labDay,
  paceIfRun,
  paceOf,
  practiceBest,
  waitingRun,
  wobbleDay,
  type GhostPose,
  type GhostRun,
  type WobbleDay,
} from './runs'
import { WobbleScene, type GhostShow } from './WobbleScene'
import { formatRun, formatWobblerunBoardScore, splashWords, wobblerunBoardScore, wobblerunMsFromBoardScore } from './score'
import { LabResultCard, LabStartCard, TestResultCard, TestStartCard } from './TestCards'
import { TomorrowGauntlet } from './TomorrowGauntlet'

const SLUG = 'wobblerun'

type Phase = 'menu' | 'countdown' | 'running' | 'crowned' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'running'])
/** The count: 3, 2, 1 a little under a second apart, then go. The run's clock is −2.4 s at the first number. */
const COUNT_FROM = 3
const COUNT_STEP = 0.8
/**
 * The star's touch stops the clock (the engine's `crown` trigger, drawn as the Blip star); then, for looks only, the
 * world runs this slow for this long (real seconds) while the camera swings round to Blip (design-final §6 #7). The card comes
 * after CARD_AFTER.
 */
const SLOW = 0.3
const SLOW_FOR = 1
const CARD_AFTER = 1.9
/** How far a thumb drags the stick for a full run, in CSS pixels; past it the stick's centre follows the thumb. */
const STICK_R = 58
/** The share of the screen, from the left, where a thumb coming down is the stick. */
const STICK_SIDE = 0.55
/** The first few runs on a device, a word at the bottom says how to run, jump and dive, and what the colours mean. */
const COACH_RUNS = 3
const COACH_KEY = 'skermix-wobblerun-coach'
/** The first word stays until Blip has run and jumped, or this long into the run. */
const FIRST_WORD_FOR = 7

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
const JUMP_KEYS = new Set(['Space'])
const DIVE_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyE'])

/** The two buttons under the right thumb. */
type Button = 'jump' | 'dive'

/**
 * Whose run the ghost runs: the player one place above you today (`next`, for their place); the board's #1, under
 * their tag; your own best; or the blue blip's. `skin`, the season skin the run was made in, which its ghost wears
 * (lib/skins.ts); the blue blip is always blue.
 */
type Chasing =
  | { who: 'next'; name: string; place: number; skin?: string }
  | { who: 'rival'; name: string; skin?: string }
  | { who: 'you'; skin?: string }
  | { who: 'pace' }

/** The name over the ghost: whose run it runs. */
function ghostTag(chasing: Chasing): string {
  return chasing.who === 'rival' || chasing.who === 'next' ? chasing.name : chasing.who === 'you' ? 'Your best' : 'Blue blip'
}

/** The ghost's tile on the start card: "Beat PILOT for 13th", "Ghost · DAD", "Ghost · Your best", "Blue blip". */
function chasingLabel(chasing: Chasing): string {
  if (chasing.who === 'next') return `Beat ${chasing.name} for ${ordinal(chasing.place)}`
  return chasing.who === 'rival' ? `Ghost · ${chasing.name}` : chasing.who === 'you' ? 'Ghost · Your best' : 'Blue blip'
}

/** Everything a run is, held outside React: the loop changes it 120 times a second. */
type Game = {
  phase: Phase
  day: string
  /**
   * Whose run it is (lib/deviceRuns.ts): the account signed in as it started, or SIGNED_OUT; none at the start
   * card. It's kept as their best and saved as theirs alone, whoever signs in meanwhile.
   */
  owner: string | undefined
  /** The engine's run (engine/sim.ts): the bean, the touch things, the clock, the splits, the ghost path. */
  run: Run
  /** Real seconds since the star's touch. */
  clock: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  /** The run being chased, and whose it is. */
  ghost: Ghost
  chasing: Chasing
  /** Shown alongside: the blue blip (always, but on the test course), and your own best in amber when it isn't the one chased. */
  blue: Ghost | null
  best: { ghost: Ghost; skin?: string } | null
  /** Falls into the soda sea in each round this run (the engine's splats), for the coach's word after two in one. */
  splatsIn: number[]
  /** The last round whose name has swept in this run (−1: none yet). */
  named: number
  /**
   * The run's result, once it has the star, and your best here before it. `runId`: a past gauntlet's run, asked
   * for as it ended (runSession runIdFor), which its All time board needs.
   */
  result: {
    time: number
    score: number
    splits: number[]
    splats: number
    knocks: number
    improved: boolean
    before: number | null
    path: number[]
    /** The skin it was run in (lib/skins.ts), which its ghost wears. */
    skin?: string
    runId: Promise<string | undefined> | null
  } | null
}

/** A past gauntlet's All time board (lib/trackBoards.ts), and asking for it again once a run is saved. */
type PastBoard = { board: TrackBoard | null; refresh: () => void }

type Ui = {
  phase: Phase
  /** 3, 2, 1 while counting; 0 for Go (a moment into the run); −1 for nothing. */
  count: number
  /** Splits so far: checkpoints, then the star. */
  passed: number
  splats: number
  /** Where the bean is along the gauntlet: 2i before round i (on the start, a pad or a slide), 2i + 1 in it. */
  stage: number
}

function countOf(g: Game): number {
  if (g.phase === 'countdown') return Math.max(1, Math.ceil(-g.run.t / COUNT_STEP - 1e-6))
  if (g.phase === 'running' && g.run.t < 0.7) return 0
  return -1
}

/** Where the bean is along the gauntlet (Ui.stage). */
function stageOf(course: Course, z: number): number {
  const rounds = course.rounds
  for (let i = 0; i < rounds.length; i++) {
    if (z < rounds[i]!.z0) return i * 2
    if (z < rounds[i]!.z1) return i * 2 + 1
  }
  return rounds.length * 2
}

const snapshot = (g: Game): Ui => ({
  phase: g.phase,
  count: countOf(g),
  passed: g.run.splits.length,
  splats: g.run.counts.splats,
  stage: stageOf(g.run.course, g.run.bean.z),
})

/** Your best run over a day's gauntlet: in practice, this tab's (or this device's, from its day); else this device's. */
function bestOf(day: string, practice: boolean, viewer: string | null | undefined): GhostRun | null {
  const kept = keptRun(day, viewer)
  if (!practice) return kept
  const tab = practiceBest(day, viewer)
  return tab && (!kept || tab.time < kept.time) ? tab : kept
}

/** The run to chase and whose it is, the blue blip's, and your best when it's shown beside them. */
type Chase = { ghost: Ghost; chasing: Chasing; blue: Ghost | null; best: { ghost: Ghost; skin?: string } | null }

/** Whose the #1's run is: yours, when it's your tag at the top. In the skin it was run in. */
const topChasing = (top: BoardGhost, me: string): Chasing =>
  top.name === me ? { who: 'you', skin: top.skin } : { who: 'rival', name: top.name, skin: top.skin }

/**
 * Your own best, in the skin it was run in; a run kept before runs kept theirs borrows the board's, when it's yours
 * at the top at the same time.
 */
const yourSkin = (mine: GhostRun, top: BoardGhost | null, me: string) =>
  mine.skin ?? (top && top.name === me && Math.abs(top.time - mine.time) < 0.0005 ? top.skin : undefined)

/**
 * Your first run of a gauntlet is against the blue blip (Ramsey, 2026-10-06, of the racing dailies: "the first time
 * you play it should be against blue and not the top score"): no run of yours here yet, none on the board, and the
 * #1 isn't you.
 */
const firstRun = (mine: GhostRun | null, top: BoardGhost | null, me: string, next: NextGhost | null) =>
  !mine && !next && top?.name !== me

/**
 * The run to beat. Your first here, the blue blip's. On today's gauntlet, once you've a run on the board, the
 * player's one place above you, for their place: pass them and the next one lines up (as the other racing dailies
 * have it). Else the board's #1, on their own line, or on the blue blip's at their time when theirs isn't known
 * (boardGhost.ts standIn); unless your own best here is faster. With nobody on the board, your best here when it
 * beats the blue blip, else the blue blip's. Your own is the one of whoever is signed in now. The blue blip runs
 * alongside whoever is chased, and your best too (in amber) when it isn't the one.
 */
function chaseFor(day: string, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const pace = paceOf(day)
  const blue = new Ghost(pace)
  const mine = bestOf(day, practice, currentAccountId())
  const best = mine ? { ghost: new Ghost(mine), skin: yourSkin(mine, top, me) } : null
  if (firstRun(mine, top, me, next)) return { ghost: blue, chasing: { who: 'pace' }, blue, best }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(next.run ?? standIn(pace, next.time)), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin }, blue, best }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: new Ghost(top.run ?? standIn(pace, top.time)), chasing: topChasing(top, me), blue, best }
  }
  return mine && mine.time < pace.time
    ? { ghost: best!.ghost, chasing: { who: 'you', skin: best!.skin }, blue, best }
    : { ghost: blue, chasing: { who: 'pace' }, blue, best }
}

/**
 * The run to chase at the start card, where the blue blip's run may not be worked out yet (paceOf warms it while
 * the card is up): the card needs only the time to beat and whose it is, and nobody runs until the count.
 */
function cardChase(wobble: WobbleDay, practice: boolean, top: BoardGhost | null, me: string, next: NextGhost | null): Chase {
  const mine = bestOf(wobble.day, practice, currentAccountId())
  const known = paceIfRun(wobble.day)
  const blue = new Ghost(known ?? waitingRun(wobble.course, wobble.pace))
  const best = mine ? { ghost: new Ghost(mine), skin: yourSkin(mine, top, me) } : null
  const waiting = (time: number) => new Ghost(known ? standIn(known, time) : waitingRun(wobble.course, time))
  if (firstRun(mine, top, me, next)) return { ghost: blue, chasing: { who: 'pace' }, blue, best }
  if (next && !practice && (!mine || next.time < mine.time - 0.0005)) {
    return { ghost: next.run ? new Ghost(next.run) : waiting(next.time), chasing: { who: 'next', name: next.name, place: next.place, skin: next.skin }, blue, best }
  }
  if (top && (!mine || top.time < mine.time - 0.0005)) {
    return { ghost: top.run ? new Ghost(top.run) : waiting(top.time), chasing: topChasing(top, me), blue, best }
  }
  if (mine && mine.time < wobble.pace) return { ghost: best!.ghost, chasing: { who: 'you', skin: best!.skin }, blue, best }
  return { ghost: blue, chasing: { who: 'pace' }, blue, best }
}

/** The test course has no run to chase and no blue blip: a ghost that never leaves the start, which isn't shown. */
function labChase(wobble: WobbleDay): Chase {
  return { ghost: new Ghost(waitingRun(wobble.course, 0)), chasing: { who: 'pace' }, blue: null, best: null }
}

function freshGame(wobble: WobbleDay, chase: Chase): Game {
  return {
    phase: 'menu',
    day: wobble.day,
    owner: undefined,
    // The run's clock starts at the first number of the count, so the doors and hammers are where they'll be at GO.
    run: newRun(wobble.course, { countdown: COUNT_FROM * COUNT_STEP, ghost: true, cues: true }),
    clock: 0,
    carry: 0,
    ghost: chase.ghost,
    chasing: chase.chasing,
    blue: chase.blue,
    best: chase.best,
    splatsIn: [],
    named: -1,
    result: null,
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

/** A checkpoint's time against the ghost's at the same checkpoint: −0.42 ahead, +1.10 behind. */
function gapText(d: number) {
  return Math.abs(d) < 0.005 ? '0.00' : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`
}
const gapTone = (d: number | null) => (d == null || Math.abs(d) < 0.005 ? '' : d < 0 ? 'good' : 'bad')

/** A run to send on: the day's gauntlet, the time against the blue blip, and the way to today's gauntlet. */
function runShareLine(wobble: WobbleDay, time: number, pace: number, splashes: number): string {
  const gap = Math.abs(time - pace)
  const against = gap < 0.005 ? 'tied with the blue blip' : time < pace ? `beat the blue blip by ${gap.toFixed(2)}s` : `${gap.toFixed(2)}s off the blue blip`
  return [`Wobble Run · Today’s Gauntlet #${wobble.n} 🌟`, `${wobble.name}: ${formatRun(time)}, ${against}, ${splashWords(splashes)}`, `${window.location.origin}${gamePlayHref(SLUG)}`].join(
    '\n',
  )
}

/** Where Blip comes back after a fall into the soda sea, in words. */
const backWords = (kind: string) => (kind === 'start' ? 'back to the start' : kind === 'flag' ? 'back to the flag' : 'back to the checkpoint')

/** The day's rounds in order, finale last, then the Blip star: a chip each, a pepper on a spicy (tier 3) one. */
function RoundList({ k }: { k: string }) {
  return (
    <ol className="wobblerun-rounds__list" aria-label="Rounds">
      {gauntletRounds(k).map((r, i) => (
        <li key={i} className="wobblerun-rounds__chip" title={`${r.name} · ${r.hint}`}>
          <RoundIcon letter={r.letter} size={16} />
          <span className="wobblerun-rounds__name">{r.name}</span>
          {r.tier >= 3 ? (
            <span role="img" aria-label="spicy">
              🌶️
            </span>
          ) : null}
        </li>
      ))}
      <li className="wobblerun-rounds__star" title="The star: touch it and the clock stops">
        <StarMark size={16} />
      </li>
    </ol>
  )
}

/** The rounds as a figure of their own, on a card whose title is the gauntlet's name (a past one's, a test run's). */
function RoundChips({ k }: { k: string }) {
  return (
    <div className="game-pause-meta__row wobblerun-rounds">
      <span>Rounds</span>
      <RoundList k={k} />
    </div>
  )
}

/** Today's gauntlet and its number and rounds, the run its ghost runs (the #1's, your best, or the blue blip's), and when the next gauntlet comes. */
function GauntletTiles({ wobble, ghost, chasing, bestMs }: { wobble: WobbleDay; ghost: number; chasing: Chasing; bestMs: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextGauntlet())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msUntilNextGauntlet()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <>
      <div className="game-pause-meta__row wobblerun-gauntlet wobblerun-rounds">
        <span>Today’s gauntlet · #{wobble.n}</span>
        <strong>{wobble.name}</strong>
        <RoundList k={wobble.k} />
      </div>
      <div className="game-pause-meta__row">
        <span>{chasingLabel(chasing)}</span>
        <strong>{formatRun(ghost)}</strong>
      </div>
      <MedalRow game="wobblerun" paceMs={paceMsOf(wobble.pace)} bestMs={bestMs} format={formatRun} />
      <div className="game-pause-meta__row">
        <span>Next gauntlet</span>
        <strong>{untilWords(left)}</strong>
      </div>
    </>
  )
}

/**
 * The rounds to the star, under the chrome where another race keeps its map: a pip a round (green behind you, your
 * colour where you are), the Blip star last, the round you're in or the one coming by name, and on today's gauntlet the
 * medal your best is chasing.
 */
function CourseStrip({ course, stage, passed, done, target }: { course: Course; stage: number; passed: number; done: boolean; target: ReactNode }) {
  const rounds = course.rounds
  const at = Math.min(rounds.length - 1, Math.floor(stage / 2))
  const inIt = stage % 2 === 1 && stage < rounds.length * 2
  const round = rounds[at]
  const label = !round ? '' : inIt ? (round.family === 'finale' ? 'Finale' : `Round ${at + 1}`) : at === 0 ? 'Up first' : 'Up next'
  return (
    <div className="wobblerun__course" aria-hidden="true">
      {rounds.length <= 8 ? (
        <div className="wobblerun__pips">
          {rounds.map((r, i) => (
            <span key={i} className={`wobblerun__pip${passed > i || (done && i === rounds.length - 1) ? ' is-done' : inIt && i === at ? ' is-on' : ''}`} title={r.name} />
          ))}
          <StarMark className="wobblerun__star-pip" size={15} dim={!done} />
        </div>
      ) : null}
      {round ? (
        <div className="wobblerun__where">
          <span>{rounds.length > 8 ? `${label} of ${rounds.length}` : label} · </span>
          {round.name}
        </div>
      ) : null}
      {target}
    </div>
  )
}

/**
 * Wobble Run: Blip, a round mint runner with a spark over its head, against the clock over a day's gauntlet of
 * rounds, in 3D. Doors slam, walls slide, bars sweep, hammers swing, melons roll, planks tip and tiles crumble; run,
 * jump and dive past them to the Blip star at the top of the finale, and touch it to stop the clock. Fall in the soda
 * sea and you're back at the last checkpoint with the clock still running: a fall costs the time it takes, never a
 * penalty on top. Everything moves
 * on the run's clock, the same for everyone, so knowing the gauntlet is knowing a line, and hands win the day.
 *
 * It's a daily: a new gauntlet every day, the same for everyone (daily.ts), run as often as you like, and the board
 * is the day's (the API keeps Wobble Run's board to today's gauntlet, whatever the period). WobbleRunGame mounts it
 * for today; when midnight has brought a new gauntlet by the next start, it asks for the new day with `onNewDay`,
 * which mounts it again, with `notice` to say why when a run was lost to it.
 *
 * The blue blip runs alongside every run, and the ghost is the run to beat with whose it is over it: your first
 * run, the blue blip's; then the player one place above you today, or the board's #1 (on a past gauntlet its All
 * time #1: boardGhost.ts), unless your own best here is faster. Your own best runs alongside too, in amber.
 *
 * Keys: WASD or the arrows run, Space jumps, Shift or E dives, R starts again, P or Escape pauses. On a touch
 * screen, a stick wherever the left thumb lands, and Jump and Dive under the right. A run is scored as its time:
 * the board keeps a million less the milliseconds (score.ts), so the fastest run is the highest score.
 */
function WobbleRunDay({
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
   * A day's gauntlet not run for today's board: a past gauntlet from the past tab (with `pastBoard`), or an admin's
   * test run (with `test`). Your best here on this device lasts the tab.
   */
  practice?: boolean
  /**
   * An admin's test run of today's gauntlet or one still to come, from the Gauntlet Book: nothing kept, as in
   * practice (and `practice` is set with it), on cards of its own (TestCards.tsx).
   */
  test?: boolean
  /**
   * The test course of every round (runs.ts labDay), an admin's, with `practice`: kept nowhere, not even the tab
   * (your best here lasts while it's open), with no ghost, no blue blip and no call to the API, on cards of its own
   * (TestCards.tsx LabStartCard).
   */
  lab?: boolean
  /** A past gauntlet's day as the API has it, for its cards: who was 1st, and you. */
  itsDay?: ItsDay
  /** A past gauntlet's All time board: signed in, a run on it goes there, under a run of its own. */
  pastBoard?: PastBoard | null
  onNewDay: (notice?: string) => void
  notice?: string
}) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  const { signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const wobble = lab ? labDay() : wobbleDay(day)
  const pace = wobble.pace
  /** The test course's best run while it's open: kept nowhere else. */
  const labBest = useRef<number | null>(null)
  const past = pastBoard !== null && !test
  const board = pastBoard?.board ?? null
  /** The board's #1 as last told (boardGhost.ts), and the tag you play under, for whose the ghost is. */
  const topRef = useRef<BoardGhost | null>(null)
  // On today's gauntlet, the player one place above you, once you've a run on the board (boardGhost.ts fetchNextGhost).
  const nextRef = useRef<NextGhost | null>(null)
  const nameRef = useRef(playerName)
  nameRef.current = playerName

  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(wobble, lab ? labChase(wobble) : cardChase(wobble, practice, null, playerName, null))
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noGl, setNoGl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  /** The round's name sweeping in as a checkpoint is crossed ("Round 3 · Pad Hop"); `key` starts it again. */
  const [banner, setBanner] = useState<{ key: number; small: string; big: string } | null>(null)
  const [touch] = useState(touchScreen)
  /** The right thumb's buttons held down, for how they're drawn. */
  const [pads, setPads] = useState<{ jump: boolean; dive: boolean }>({ jump: false, dive: false })
  const holderRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const splitRef = useRef<HTMLElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const jumpRef = useRef<HTMLSpanElement>(null)
  const diveRef = useRef<HTMLSpanElement>(null)
  const sceneRef = useRef<WobbleScene | null>(null)
  const soundRef = useRef<RunSound | null>(null)
  // The player's own skin, if they chose one (lib/skins.ts): looks only, and only on their Blip.
  const skinRef = useRef<string | null>(null)
  useSkinInto(SLUG, skinRef)
  const keysRef = useRef<Held>({ ...NONE })
  /** Jump and Dive pressed since the last step: the engine takes a press on the step after it (and keeps it 0.15 s). */
  const pressRef = useRef({ jump: false, dive: false })
  /** The thumb on the stick: the stick's centre (which follows a thumb pushed past the rim), and where the thumb is. */
  const stickAt = useRef<{ id: number; cx: number; cy: number; x: number; y: number } | null>(null)
  /** The fingers on the right thumb's buttons, and which button each is on. */
  const padFingers = useRef(new Map<number, Button>())
  /** This run's coach: whether it's talking, what it has said, and what the player has done yet. */
  const coachRef = useRef({ on: false, first: false, firstWords: '', shown: '', showFor: 0, moved: false, jumped: false, colours: false, gold: false })
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  /** Dev only: the engine's hands running the run instead of the player's (__wobbleAuto). */
  const autopilot = useRef<{ fast: boolean; hands: ReturnType<typeof liveHands> } | null>(null)
  const toastTimer = useRef(0)
  /** Until when the notice up is one that a small one ("Close!", "Phew!") mustn't cover. */
  const toastUntil = useRef(0)
  const bannerTimer = useRef(0)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const say = (text: string | null, seconds = 2.2) => {
    window.clearTimeout(toastTimer.current)
    setToast(text)
    toastUntil.current = text ? performance.now() + seconds * 1000 : 0
    if (text) toastTimer.current = window.setTimeout(() => setToast(null), seconds * 1000)
  }
  const sayRef = useRef(say)
  sayRef.current = say

  /** A small word ("Close!", "Phew!") only when no notice that matters more is up. */
  const pop = (text: string) => {
    if (performance.now() < toastUntil.current) return
    say(text, 0.9)
  }
  const popRef = useRef(pop)
  popRef.current = pop

  const sweep = (small: string, big: string) => {
    window.clearTimeout(bannerTimer.current)
    setBanner({ key: performance.now(), small, big })
    bannerTimer.current = window.setTimeout(() => setBanner(null), 1700)
  }
  const sweepRef = useRef(sweep)
  sweepRef.current = sweep

  const letGoStick = () => {
    stickAt.current = null
    if (stickRef.current) stickRef.current.hidden = true
  }

  /** Nothing held carries on: keys, the stick, the buttons and presses not yet taken. */
  const letGo = () => {
    keysRef.current = { ...NONE }
    pressRef.current.jump = false
    pressRef.current.dive = false
    padFingers.current.clear()
    setPads({ jump: false, dive: false })
    letGoStick()
  }

  /** The coach's word at the bottom, or none (an empty hint isn't shown: wobblerun.css). */
  const coachSays = (text: string) => {
    if (hintRef.current && hintRef.current.textContent !== text) hintRef.current.textContent = text
  }

  /** A word from the coach for a few seconds, then back to the first word if it's still up, or nothing. */
  const coachShows = (text: string, seconds: number) => {
    const c = coachRef.current
    c.shown = text
    c.showFor = seconds
    coachSays(text)
  }
  const coachShowsRef = useRef(coachShows)
  coachShowsRef.current = coachShows

  /** Midnight has brought a new gauntlet: the page mounts the game again for it. */
  const newDay = (why?: string) => {
    if (practice || gauntletDay() === day || devDay()) return false
    onNewDay(why)
    return true
  }
  const newDayRef = useRef(newDay)
  newDayRef.current = newDay

  /**
   * The count, and a new run for the boards, chasing the best run there is. The run is whoever's signed in as it
   * starts, so it waits the moment it takes to know who that is.
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
    // A test run opens no run: nothing it does is saved. A past gauntlet's run goes on its All time board, timed by
    // the server as a day's is. Every start and start again opens one, so the server's clock is the run's.
    if (!practice) {
      clearRunAchievements()
      beginRun(SLUG)
    } else if (past) beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(wobble, lab ? labChase(wobble) : chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
    g.phase = 'countdown'
    g.owner = owner
    gameRef.current = g
    // The dev autopilot runs each new run from its start.
    if (autopilot.current) autopilot.current.hands = liveHands(wobble.course, autopilot.current.fast ? FAST_HANDS : BLUE_HANDS)
    sceneRef.current?.snap()
    soundRef.current?.wake()
    soundRef.current?.count(COUNT_FROM)
    // Presses not yet taken are let go (the Space or tap that starts a run never jumps at GO); a direction or the
    // stick still held carries on into the new run, as the other racing dailies keep theirs through R.
    pressRef.current.jump = false
    pressRef.current.dive = false
    padFingers.current.clear()
    setPads({ jump: false, dive: false })
    // The first few runs on this device, the coach says how to run, jump and dive, then what the colours mean. On a
    // touch screen the first word is always said, until the thumbs have found the controls.
    const coach = coachRef.current
    coach.on = coachRuns() < COACH_RUNS
    coach.firstWords = touch ? 'Drag on the left to run · Jump and Dive on the right' : 'WASD or arrows to run · Space jumps · Shift dives'
    coach.first = coach.on || touch
    coach.shown = ''
    coach.showFor = 0
    coach.moved = false
    coach.jumped = false
    coach.colours = false
    coach.gold = false
    countCoachRun()
    coachSays(coach.first ? coach.firstWords : '')
    say(null)
    if (splitRef.current) {
      splitRef.current.textContent = '–'
      splitRef.current.className = ''
    }
    window.clearTimeout(bannerTimer.current)
    setBanner(null)
    setUi(snapshot(g))
  }

  /** Done with the run: back to the start card. Nothing counts until the next one starts. */
  const toMenu = () => {
    if (newDay()) return
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(wobble, lab ? labChase(wobble) : chaseFor(day, practice, topRef.current, nameRef.current, nextRef.current))
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
    if (gameRef.current!.phase !== 'menu' || lab) return
    gameRef.current = freshGame(wobble, cardChase(wobble, practice, topRef.current, nameRef.current, nextRef.current))
    setUi(snapshot(gameRef.current))
  }
  const rechaseRef = useRef(rechase)
  rechaseRef.current = rechase

  /** The board's fastest run, as it's known: at the start card, the ghost to race changes to it at once. */
  const takeTop = (next: BoardGhost | null) => {
    // A path run over this gauntlet before it was laid again runs on air: their time on the blue blip's line instead.
    topRef.current = next?.run && !fitsCourse(wobble.course, next.run) ? { ...next, run: null } : next
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
   * A run saved on the board sends where the bean went: the API keeps it if it's the tag's run on the board and the
   * fastest there, and then it's everyone's ghost, yours included from your next run. On today's gauntlet every run
   * goes, as the API keeps each player's best for whoever is one place below them to race; then the player above
   * you is asked for again, as you may have passed them. On a past gauntlet only one that could be its fastest goes:
   * the #1 is faster, or their line is known and at least as fast, and it stays home.
   */
  const sendGhost = (run: { time: number; score: number; splits: number[]; path: number[]; skin?: string }, name: string) => {
    if ((practice && !past) || !signedIn || !name) return
    const known = topRef.current
    const today = !practice
    if (!today && known && (known.time < run.time - 0.0005 || (known.run && known.run.time <= run.time + 0.0005))) return
    void sendBoardGhost(wobble.n, name, run).then(async (kept) => {
      if (kept) {
        const fresh = await fetchBoardGhost(wobble.n, true)
        if (fresh) takeTopRef.current(fresh)
      }
      if (today) askNextRef.current()
    })
  }
  const sendGhostRef = useRef(sendGhost)
  sendGhostRef.current = sendGhost

  /** The player one place above you on today's gauntlet: asked for as it opens, and again after each run you save. */
  const askNext = () => {
    const tag = nameRef.current
    if (practice || !signedIn || !tag || wobble.day > gauntletDay()) {
      if (nextRef.current) {
        nextRef.current = null
        rechaseRef.current()
      }
      return
    }
    void fetchNextGhost(wobble.n, tag).then((next) => {
      // Signed in as someone else meanwhile: theirs is asked for in turn.
      if (tag !== nameRef.current) return
      nextRef.current = next?.run && !fitsCourse(wobble.course, next.run) ? { ...next, run: null } : next
      rechaseRef.current()
    })
  }
  const askNextRef = useRef(askNext)
  askNextRef.current = askNext
  useEffect(() => {
    askNextRef.current()
  }, [signedIn, playerName, wobble.n, practice])

  // The board's fastest run, for the ghost: asked for as the gauntlet opens (a past one's, its All time #1). A
  // gauntlet whose day hasn't come, on an admin's test run, has no board yet, nor has the test course.
  const [topAsked, setTopAsked] = useState(false)
  useEffect(() => {
    let live = true
    const asked = lab || wobble.day > gauntletDay() ? Promise.resolve(null) : fetchBoardGhost(wobble.n)
    void asked.then((found) => {
      if (!live) return
      if (found) takeTopRef.current(found)
      setTopAsked(true)
    })
    return () => {
      live = false
    }
  }, [wobble.n, wobble.day, lab])

  // Then your best here on this device, if it's faster than that: the API keeps it only if it's on the board under
  // your tag. So a run saved on a card closed too soon still gets there. Only your account's own run goes, once for
  // each account signed in here: never one run signed out, or another's.
  const offered = useRef<string | null>(null)
  useEffect(() => {
    if (practice || !topAsked || !signedIn || typeof viewer !== 'string' || !playerName || offered.current === viewer) return
    offered.current = viewer
    const mine = keptRun(day, viewer)
    if (mine) sendGhostRef.current({ time: mine.time, score: wobblerunBoardScore(mine.time), splits: mine.splits, path: mine.ghost, skin: mine.skin }, playerName)
  }, [practice, topAsked, signedIn, viewer, playerName, day])

  /**
   * A run made signed out, put on the board by whoever signed in on its card: it's theirs from now on, their best
   * here if it's faster than the one they had (runs.ts claimRun).
   */
  const claimSaved = (g: Game) => {
    const id = currentAccountId()
    if (g.owner !== SIGNED_OUT || !g.result || typeof id !== 'string') return
    claimRun(g.day, id, { time: g.result.time, splits: g.result.splits, ghost: g.result.path, ...(g.result.skin ? { skin: g.result.skin } : {}) })
    g.owner = id
  }

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { course } = wobble
    // A canvas of the scene's own: when it goes, its GL context goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'wobblerun__view'
    canvas.setAttribute('aria-label', 'The gauntlet, seen from behind Blip')
    holder.append(canvas)
    let scene: WobbleScene
    try {
      scene = new WobbleScene(canvas, course)
    } catch {
      canvas.remove()
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    const sound = new RunSound()
    soundRef.current = sound
    const calm = calmMotion()
    /** This step's input, one object for the whole run. */
    const input: Input = { x: 0, y: 0, jump: false, dive: false }
    /** Where the bean was before its last step, and where it's drawn: between the two. */
    const from = { x: 0, y: 0, z: 0 }
    const at = { x: 0, y: 0, z: 0 }
    let drawn: Run | null = null
    /** The ghosts drawn this frame, one list for the whole run. */
    const ghosts: GhostShow[] = []
    const show = (kind: GhostShow['kind'], tag: string, p: GhostPose, skin: string | null): GhostShow => ({ kind, tag, x: p.x, y: p.y, z: p.z, state: p.state, skin })

    /** The hands this step: the stick's or the keys' way, and Jump and Dive if they were pressed since the last step. */
    const handsFor = (g: Game): Input => {
      if (autopilot.current) return autopilot.current.hands.input(g.run)
      const s = stickAt.current
      let x = 0
      let y = 0
      if (s) {
        x = (s.x - s.cx) / STICK_R
        y = (s.cy - s.y) / STICK_R
        const l = Math.hypot(x, y)
        // A little dead in the middle, then finer near it than at the rim (Marble Run's stick).
        const m = Math.min(1, l)
        const k = m < 0.08 ? 0 : Math.pow((m - 0.08) / 0.92, 1.25) / Math.max(l, 1e-6)
        x *= k
        y *= k
      } else {
        const keys = keysRef.current
        x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        y = (keys.up ? 1 : 0) - (keys.down ? 1 : 0)
        const l = Math.hypot(x, y)
        if (l > 1) {
          x /= l
          y /= l
        }
      }
      const press = pressRef.current
      input.x = x
      input.y = y
      input.jump = press.jump
      input.dive = press.dive
      press.jump = false
      press.dive = false
      const c = coachRef.current
      if (Math.abs(x) + Math.abs(y) > 0.3) c.moved = true
      if (input.jump) c.jumped = true
      return input
    }

    const splitShown = (g: Game, k: number) => {
      const at = g.run.splits[k]
      const theirs = g.ghost.run.splits[k]
      const d = at != null && theirs != null ? at - theirs : null
      const el = splitRef.current
      if (el) {
        el.textContent = d == null ? (at != null ? formatRun(at) : '–') : gapText(d)
        el.className = gapTone(d) ? `wobblerun__delta--${gapTone(d)}` : ''
      }
      return d
    }

    /**
     * What a step did, felt and said: buzzes, notices, the round's name at a checkpoint. Its sounds are the run's own
     * (audio.ts RunSound.events: boings, bonks, the crowd, the chimes, the telegraphs panned to where they are).
     */
    const hear = (g: Game, e: SimEvent) => {
      const run = g.run
      switch (e.k) {
        case 'bonk':
        case 'knock':
        case 'yeet':
          haptic('hit')
          break
        case 'closeCall':
          popRef.current('Close!')
          break
        case 'ledge':
          popRef.current('Phew!')
          break
        case 'perfectBounce':
          haptic('boost')
          popRef.current('Perfect bounce!')
          break
        case 'hoop':
          haptic('boost')
          break
        case 'splat': {
          haptic('crash')
          const sp = course.spawns[run.bean.spawn]
          sayRef.current(`Fizz! · ${backWords(sp?.kind ?? 'check')}`, 1.4)
          // Twice in one round: the safe way is slower, and sure (design-final §6 #14). The course doesn't change.
          const r = Math.max(0, Math.min(course.rounds.length - 1, Math.floor(stageOf(course, e.z) / 2)))
          g.splatsIn[r] = (g.splatsIn[r] ?? 0) + 1
          if (g.splatsIn[r] === 2) coachShowsRef.current('Try the safe way: wait for a gap, and skip the gold edges', 3.5)
          break
        }
        case 'checkpoint': {
          const k = run.splits.length - 1
          const d = splitShown(g, k)
          sayRef.current(`Checkpoint ${k + 1} · ${formatRun(run.splits[k]!)}${d == null ? '' : ` · ${gapText(d)}`}`)
          haptic('boost')
          const next = course.rounds[k + 1]
          if (next && g.named < k + 1) {
            g.named = k + 1
            sweepRef.current(next.family === 'finale' ? 'Finale' : `Round ${k + 2}`, next.name)
          }
          break
        }
        case 'flag':
          popRef.current('Flag · you’ll come back here')
          break
        default:
          break
      }
    }

    /**
     * The coach, the first few runs on a device: the first word until Blip has run and jumped; what the colours
     * mean as the first round comes; and the gold edges, the first time one is near.
     */
    const coach = (g: Game, dt: number) => {
      const c = coachRef.current
      const run = g.run
      if (c.first && run.t > 0 && ((c.moved && c.jumped) || run.t > FIRST_WORD_FOR)) {
        c.first = false
        if (c.showFor <= 0) coachSays('')
      }
      if (c.on && run.t > 0) {
        const z = run.bean.z
        const inRound = stageOf(course, z) % 2 === 1
        if (!c.colours && inRound) {
          c.colours = true
          c.first = false
          coachShows('Jump the orange, dive under the purple', 3.5)
        } else if (c.colours && !c.gold && c.showFor <= 0 && course.rounds.some((r) => r.gold.some((gl) => z > gl.z0 - 14 && z < gl.z0))) {
          c.gold = true
          coachShows('Gold edges are risky shortcuts', 3)
        }
      }
      if (c.showFor > 0) {
        c.showFor -= dt
        if (c.showFor <= 0) {
          c.shown = ''
          coachSays(c.first ? c.firstWords : '')
        }
      }
    }

    const finishRun = (g: Game) => {
      const run = g.run
      const time = run.time
      const path = run.ghost ? run.ghost.slice() : []
      const splits = run.splits.slice()
      // Against the best of whoever ran it, and kept as theirs: someone else signed in meanwhile has theirs. The test
      // course's best is kept only while it's open.
      const kept = lab ? (labBest.current == null ? null : { time: labBest.current }) : g.owner === undefined ? null : bestOf(g.day, practice, ownerAccount(g.owner))
      const improved = !kept || time < kept.time
      // The skin it was run in, so its ghost wears it: yours as your best, everyone's from the board.
      const skin = skinRef.current ?? undefined
      if (lab) {
        if (improved) labBest.current = time
      } else if (improved && g.owner !== undefined) {
        const best = { time, splits, ghost: path, ...(skin ? { skin } : {}) }
        if (practice) keepPracticeRun(g.day, g.owner, best)
        else keepBestRun(g.day, g.owner, best)
      }
      g.result = {
        time,
        score: wobblerunBoardScore(time),
        splits,
        splats: run.counts.splats,
        knocks: run.counts.knocks + run.counts.yeets,
        improved,
        before: kept?.time ?? null,
        path,
        ...(skin ? { skin } : {}),
        runId: past ? runIdFor(SLUG) : null,
      }
      // Your best on this course, for your medals on its past card (lib/courseBests.ts): any run but a test's.
      if (!lab && !test) noteCourseBest(SLUG, gauntletNumber(g.day), Math.round(time * 1000), runIdFor(SLUG))
      splitShown(g, splits.length - 1)
      // The star's fanfare is the run's own sound (audio.ts, on the engine's `crown` event).
      haptic('boost')
      coachSays('')
      coachRef.current.showFor = 0
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    let failed = 0

    const loop = (now: number) => {
      if (!alive) return
      // The next frame first, so one that fails to draw can't stop the run.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const run = g.run
      const live = !pausedRef.current
      if (run !== drawn) {
        // A new run: the bean is drawn from where it starts.
        drawn = run
        from.x = run.bean.x
        from.y = run.bean.y
        from.z = run.bean.z
      }

      if (live && IN_RUN.has(g.phase)) {
        g.carry += dt
        while (g.carry >= STEP && IN_RUN.has(g.phase)) {
          g.carry -= STEP
          const before = countOf(g)
          from.x = run.bean.x
          from.y = run.bean.y
          from.z = run.bean.z
          step(run, handsFor(g))
          // Every step's events, so nothing between frames is missed: the scene's squashes, splashes and confetti,
          // the run's sounds (GO's whistle among them), and the shell's words and buzzes.
          scene.events(run.ev, run)
          sound.events(run.ev, run)
          for (const e of run.ev) hear(g, e)
          if (g.phase === 'countdown') {
            if (run.t >= 0) g.phase = 'running'
            else if (countOf(g) !== before) sound.count(countOf(g))
          } else if (run.done) {
            // The star (the engine's crown): the clock stopped at its touch, inside the step (engine/sim.ts).
            g.phase = 'crowned'
            g.clock = 0
            finishRun(g)
          }
        }
        coach(g, dt)
      } else if (live && (g.phase === 'crowned' || g.phase === 'gameover')) {
        // The run goes on past the star for looks (input is ignored once it's done), slowed at first.
        g.carry += dt * (g.phase === 'crowned' && g.clock < SLOW_FOR && !calm ? SLOW : 1)
        while (g.carry >= STEP) {
          g.carry -= STEP
          from.x = run.bean.x
          from.y = run.bean.y
          from.z = run.bean.z
          step(run)
          scene.events(run.ev, run)
          sound.events(run.ev, run)
        }
      }
      if (live && g.phase === 'crowned') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another run first. A run that midnight came in the
        // middle of was on yesterday's gauntlet, and today's board is another's: not saved.
        if (g.clock >= CARD_AFTER) {
          if (newDayRef.current('Midnight came during that run, so it was on yesterday’s gauntlet. Here’s today’s.')) return
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          letGo()
        }
      }

      // Drawn between its last two steps (the slow motion steps less than once a frame), with the course at that
      // moment; never across a respawn's jump.
      const f = g.phase === 'menu' ? 1 : Math.min(1, g.carry / STEP)
      const b = run.bean
      const jumped = Math.hypot(b.x - from.x, b.y - from.y, b.z - from.z) > 3
      at.x = jumped ? b.x : from.x + (b.x - from.x) * f
      at.y = jumped ? b.y : from.y + (b.y - from.y) * f
      at.z = jumped ? b.z : from.z + (b.z - from.z) * f
      const drawT = run.t - (1 - f) * STEP

      // The ghosts at the run's moment: the blue blip, the run chased (its name over it), your best. Not before a
      // run, nor on the test course.
      const t = Math.max(0, drawT)
      ghosts.length = 0
      if (g.phase !== 'menu' && !lab) {
        const chased = g.chasing.who
        if (g.blue) ghosts.push(show('blue', chased === 'pace' ? 'Blue blip' : '', g.blue.at(t), null))
        if (chased !== 'pace') ghosts.push(show(chased === 'you' ? 'mine' : 'rival', ghostTag(g.chasing), g.ghost.at(t), g.chasing.skin ?? null))
        if (g.best && chased !== 'you') ghosts.push(show('mine', '', g.best.ghost.at(t), g.best.skin ?? null))
      }
      try {
        scene.frame(
          {
            mode: g.phase === 'menu' ? 'menu' : IN_RUN.has(g.phase) ? 'play' : 'done',
            run,
            t: drawT,
            at,
            doneFor: g.phase === 'crowned' ? g.clock : g.phase === 'gameover' ? CARD_AFTER + 1 : 0,
            ghosts,
            skin: skinRef.current,
            calm,
          },
          live ? dt : 0,
        )
        failed = 0
      } catch (err) {
        // A phone can take the 3D context back; three.js stops drawing until it's restored, though a frame or two
        // can fail first. If drawing never comes back, say so.
        failed += 1
        if (failed === 1) console.warn('Wobble Run: a frame failed to draw', err)
        if (failed > 120) {
          alive = false
          setNoGl(true)
          return
        }
      }
      // The patter of its feet, a belly slide's hiss, a fan's wind: only while a run is going.
      sound.update({ speed: Math.hypot(b.vx + b.gcx, b.vz + b.gcz), grounded: b.ground >= 0 && b.dead <= 0, sliding: b.slide > 0, on: live && g.phase === 'running', run })
      if (clockRef.current) {
        const text = formatRun(g.result ? g.result.time : g.phase === 'running' ? run.t : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }

      // The rest of the heads-up changes only when something happens: the count, a checkpoint, a splat, a round.
      const next = snapshot(g)
      const key = `${next.phase}|${next.count}|${next.passed}|${next.splats}|${next.stage}`
      if (key !== shown) {
        shown = key
        // The first round's name as the bean comes down the slide into it; the others' come at their checkpoints.
        if (next.stage === 1 && g.named < 0 && g.phase === 'running') {
          g.named = 0
          sweepRef.current('Round 1', course.rounds[0]!.name)
        }
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    // The blue blip's run, worked out now while the card is up, so the start doesn't wait on it. The test course has none.
    const warm = lab
      ? 0
      : window.setTimeout(() => {
          paceOf(wobble.day)
          rechaseRef.current()
        }, 400)
    return () => {
      alive = false
      window.clearTimeout(warm)
      cancelAnimationFrame(raf)
      sound.dispose()
      soundRef.current = null
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
    // Once for the day's gauntlet: the page mounts the game again for another day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The keys: held while down for running, pressed for Jump and Dive; a run starts from the card on Space or Enter,
  // and R starts it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (saveOpenRef.current || pausedRef.current) return
      const g = gameRef.current!
      if (g.phase === 'menu') {
        if (e.code !== 'Space' && e.code !== 'Enter') return
        e.preventDefault()
        // The Space that starts the run is never a jump: presses are let go at the start, and the bean can't move till GO.
        if (!e.repeat && performance.now() >= startGrace.current) start()
        return
      }
      if (!IN_RUN.has(g.phase)) return
      const held = KEYS[e.code]
      if (held) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        keysRef.current[held] = true
      } else if (JUMP_KEYS.has(e.code)) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        if (!e.repeat) pressRef.current.jump = true
      } else if (DIVE_KEYS.has(e.code)) {
        e.preventDefault()
        if (!e.repeat) pressRef.current.dive = true
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault()
        restart()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const held = KEYS[e.code]
      if (held) keysRef.current[held] = false
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(bannerTimer.current)
    },
    [],
  )

  // Mounted again for a new day because a run was lost to midnight: say so.
  useEffect(() => {
    if (notice) say(notice, 6)
    // Once, on the mount the notice came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dev only: read the run, or let the engine's hands take over (the fast hands, gold lines and all, or the blue
  // blip's careful ones), for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __wobble?: () => Game
      __wobbleScene?: () => WobbleScene | null
      __wobbleAuto?: (on?: boolean, hands?: 'fast' | 'blue') => void
      __wobbleStart?: () => void
    }
    w.__wobble = () => gameRef.current!
    w.__wobbleScene = () => sceneRef.current
    w.__wobbleAuto = (on = true, hands = 'fast') => {
      const fast = hands !== 'blue'
      autopilot.current = on ? { fast, hands: liveHands(wobble.course, fast ? FAST_HANDS : BLUE_HANDS) } : null
    }
    w.__wobbleStart = () => start()
    return () => {
      delete w.__wobble
      delete w.__wobbleScene
      delete w.__wobbleAuto
      delete w.__wobbleStart
    }
  })

  /** Keeps a finger's moves coming here wherever it slides; a browser that won't (or a pointer already gone) just doesn't. */
  const capture = (e: ReactPointerEvent<HTMLElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* the finger still works where it is */
    }
  }

  /* A tap on the gauntlet starts a run from the card; in a run, a thumb coming down on the left is the stick. */
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const g = gameRef.current!
    if (g.phase === 'menu') {
      e.preventDefault()
      if (performance.now() >= startGrace.current) start()
      return
    }
    // A mouse doesn't run the bean: on a computer that's the keys.
    if (!IN_RUN.has(g.phase) || stickAt.current || e.pointerType === 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    if (x > box.width * STICK_SIDE) return
    e.preventDefault()
    capture(e)
    stickAt.current = { id: e.pointerId, cx: x, cy: y, x, y }
    const stick = stickRef.current
    if (stick) {
      stick.style.left = `${x}px`
      stick.style.top = `${y}px`
      stick.hidden = false
    }
    if (knobRef.current) knobRef.current.style.transform = ''
  }
  /** The thumb moves: pushed past the rim, the stick's centre comes along behind it (Frenzy's leash), so a turn is always a short move. */
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = stickAt.current
    if (!s || e.pointerId !== s.id) return
    const box = e.currentTarget.getBoundingClientRect()
    s.x = e.clientX - box.left
    s.y = e.clientY - box.top
    let dx = s.x - s.cx
    let dy = s.y - s.cy
    const l = Math.hypot(dx, dy)
    if (l > STICK_R) {
      s.cx = s.x - (dx / l) * STICK_R
      s.cy = s.y - (dy / l) * STICK_R
      dx = s.x - s.cx
      dy = s.y - s.cy
      if (stickRef.current) {
        stickRef.current.style.left = `${s.cx}px`
        stickRef.current.style.top = `${s.cy}px`
      }
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (stickAt.current?.id === e.pointerId) letGoStick()
  }

  /* The right thumb: wherever it comes down in its zone goes to the nearer button, and rolling onto the other presses that. */
  const readPads = () => {
    const on = { jump: false, dive: false }
    for (const b of padFingers.current.values()) on[b] = true
    setPads(on)
  }
  const pickButton = (e: ReactPointerEvent<HTMLElement>): Button => {
    const centre = (el: HTMLElement | null) => {
      const r = el?.getBoundingClientRect()
      return r ? Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) : Infinity
    }
    return centre(diveRef.current) < centre(jumpRef.current) ? 'dive' : 'jump'
  }
  const pressButton = (b: Button) => {
    if (b === 'jump') pressRef.current.jump = true
    else pressRef.current.dive = true
    haptic('turn')
  }
  const padHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (saveOpenRef.current || pausedRef.current || !IN_RUN.has(gameRef.current!.phase)) return
      capture(e)
      const b = pickButton(e)
      padFingers.current.set(e.pointerId, b)
      pressButton(b)
      readPads()
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const was = padFingers.current.get(e.pointerId)
      if (!was) return
      const now = pickButton(e)
      if (now === was) return
      padFingers.current.set(e.pointerId, now)
      pressButton(now)
      readPads()
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (padFingers.current.delete(e.pointerId)) readPads()
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (padFingers.current.delete(e.pointerId)) readPads()
    },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (padFingers.current.delete(e.pointerId)) readPads()
    },
  }

  const g = gameRef.current!
  const showroom = ui.phase === 'menu'
  const result = g.result
  const tabBest = lab ? labBest.current : practice ? (bestOf(day, true, g.owner === undefined ? viewer : ownerAccount(g.owner))?.time ?? null) : null
  // A past gauntlet's best here is your best on its All time board too, signed in.
  const boardBest = past && viewer !== null && board?.you ? wobblerunMsFromBoardScore(board.you.score) / 1000 : null
  const practiceBestTime = tabBest == null ? boardBest : boardBest == null ? tabBest : Math.min(tabBest, boardBest)
  const todayBestMs = apiBest > 0 ? wobblerunMsFromBoardScore(apiBest) : null
  const bestText = practice ? (practiceBestTime != null ? formatRun(practiceBestTime) : '–') : todayBestMs != null ? formatRun(todayBestMs / 1000) : '–'
  // Whose the run is, for its card: an account's run waits for that account; one run signed out goes to whoever signs in.
  const runOwner = g.owner === undefined ? undefined : ownerAccount(g.owner)
  // A past gauntlet: the chip, the tab's title, the way back to its row and its day's figures, the same on the play
  // screen, the pause card and the start card (lib/pastPlay.ts).
  const went: ItsDay = itsDay ?? { days: null, failed: false, me: null }
  // Signed in, a run goes on the gauntlet's All time board. Signed out it's practice, and so is a run made signed
  // out, for good: signing in on its card is for the runs after it. One in the archive, older than a week
  // (lib/archive.ts), is practice for everyone: its board is closed.
  const pastKind: PastKind =
    (viewer === null && (g.owner === undefined || g.owner === SIGNED_OUT)) || (ui.phase === 'gameover' && g.owner === SIGNED_OUT) || (past && inArchive(day))
      ? 'practice'
      : 'board'
  const pastPlay: PastPlay | null = past
    ? {
        href: dailyTabHref(SLUG, 'past', day),
        kind: pastKind,
        title: wobble.name,
        facts: [onItsDayFact(day, went), allTimeFact(SLUG, board, viewer !== null, formatWobblerunBoardScore)],
      }
    : null
  const chips = lab ? null : <RoundChips k={wobble.k} />
  // A past gauntlet's start card has its tiles without the rounds (its title names the gauntlet), so it fits as
  // Swoop's does: the card passes taps through to start, so it can't be scrolled. The pause card has the rounds.
  const practiceTiles = (
    <>
      <div className="game-pause-meta__row">
        <span>Blue blip</span>
        <strong>{formatRun(pace)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Your best here</span>
        <strong>{bestText}</strong>
      </div>
    </>
  )
  const extra = lab ? (
    <div className="game-pause-meta__row">
      <span>Your best here</span>
      <strong>{bestText}</strong>
    </div>
  ) : practice ? (
    <>
      {chips}
      {practiceTiles}
    </>
  ) : (
    <GauntletTiles wobble={wobble} ghost={g.ghost.run.time} chasing={g.chasing} bestMs={todayBestMs} />
  )
  // On today's gauntlet, the medal your best today is chasing, under the rounds.
  const held = practice ? null : medalFor('wobblerun', paceMsOf(pace), todayBestMs)
  const chasingMedal = practice ? null : nextMedal('wobblerun', paceMsOf(pace), held)
  const target = practice ? null : chasingMedal ? (
    <div className="wobblerun__target">
      <MedalIcon medal={chasingMedal.medal} size={13} />
      {MEDAL_NAMES[chasingMedal.medal]} · {formatRun(chasingMedal.ms / 1000)}
    </div>
  ) : (
    <div className="wobblerun__target">
      <MedalIcon medal="platinum" size={13} />
      Top medal won
    </div>
  )
  const splitsText = (r: NonNullable<Game['result']>) =>
    [
      wobble.name,
      ...r.splits.slice(0, -1).map((at, k) => `CP${k + 1} ${formatRun(at)}`),
      splashWords(r.splats),
      r.knocks === 0 ? 'never knocked over' : r.knocks === 1 ? 'knocked over once' : `knocked over ${r.knocks} times`,
    ].join(' · ')
  const splitCount = wobble.course.splitCount

  return (
    <section
      className={`wobblerun wobblerun--fullscreen${showroom ? ' wobblerun--showroom' : ''}${touch ? ' wobblerun--touch' : ''}${pastPlay ? ' wobblerun--past' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div
            className="wobblerun__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div ref={holderRef} className="wobblerun__holder" />

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
                <PlayReadoutScore className={`wobblerun__clock${result ? ' is-done' : ''}`}>
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  <PlayStat label={ui.passed > 0 && ui.passed < splitCount ? `CP ${ui.passed}` : 'Split'} value={<span ref={splitRef}>–</span>} />
                  <PlayStat label="Splashes" value={String(ui.splats)} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            {!showroom ? <CourseStrip course={wobble.course} stage={ui.stage} passed={ui.passed} done={result != null} target={target} /> : null}

            {ui.count >= 0 && !paused ? (
              <div className={`wobblerun__count${ui.count === 0 ? ' is-go' : ''}`} role="status">
                {ui.count === 0 ? 'Go!' : ui.count}
              </div>
            ) : null}

            {banner && ui.phase === 'running' && !paused ? (
              <div key={banner.key} className="wobblerun__banner" aria-hidden="true">
                <small>{banner.small}</small>
                {banner.big}
              </div>
            ) : null}

            {ui.phase === 'crowned' && result && !paused ? (
              <div className="wobblerun__star" role="status" aria-label={`Star! ${formatRun(result.time)}`}>
                <StarMark size={56} />
                {formatRun(result.time)}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="wobblerun__toast" role="status">
                {toast}
              </div>
            ) : null}

            <div ref={stickRef} className="wobblerun__stick" hidden>
              <div ref={knobRef} className="wobblerun__knob" />
            </div>

            {touch && inRun && !paused ? (
              <div className="wobblerun__pad" {...padHandlers}>
                <span ref={diveRef} className={`wobblerun__btn wobblerun__btn--dive${pads.dive ? ' is-on' : ''}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8c4 0 7 2 9 6" />
                    <path d="M9 15h5v-5" transform="rotate(10 12 12)" />
                    <path d="M4 19h16" />
                  </svg>
                  Dive
                </span>
                <span ref={jumpRef} className={`wobblerun__btn wobblerun__btn--jump${pads.jump ? ' is-on' : ''}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 14l6-6 6 6" />
                    <path d="M6 20l6-6 6 6" opacity="0.55" />
                  </svg>
                  Jump
                </span>
              </div>
            ) : null}

            <div ref={hintRef} className="wobblerun__hint" />

            {noGl ? (
              <div className="wobblerun__nogl">
                <p>Wobble Run is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="wobblerun__overlay">
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
                  <LabStartCard rounds={labRoundNames()} best={practiceBestTime} />
                ) : test ? (
                  <TestStartCard wobble={wobble} best={practiceBestTime} chips={chips} />
                ) : pastPlay ? (
                  <PracticeStartCard wobble={wobble} kind={pastKind} facts={pastPlay.facts ?? []} tiles={practiceTiles} board={board} />
                ) : (
                  <GameStartCard title="Wobble Run" slug={SLUG} extraMeta={extra} />
                )
              ) : null}
              {ui.phase === 'gameover' && saveOpen && result ? (
                lab ? (
                  <LabResultCard time={result.time} splats={result.splats} best={practiceBestTime ?? result.time} improved={result.improved} onAgain={start} onDone={toMenu} />
                ) : test ? (
                  <TestResultCard
                    wobble={wobble}
                    time={result.time}
                    splats={result.splats}
                    best={practiceBestTime ?? result.time}
                    improved={result.improved}
                    onAgain={start}
                    onDone={toMenu}
                  />
                ) : tournament ? (
                  // In an event, its card: a past course's run counts for the event, not the course's board.
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={result.score} onDone={toMenu} />
                ) : past ? (
                  <PastGauntletResult
                    wobble={wobble}
                    time={result.time}
                    score={result.score}
                    splats={result.splats}
                    pace={pace}
                    run={result.runId}
                    board={board}
                    owner={runOwner}
                    onSaved={(saved) => {
                      pastBoard?.refresh()
                      sendGhost(result, saved.name)
                    }}
                    onAgain={start}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={result.score}
                    title="Got the star"
                    subtitle={splitsText(result)}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    pace={Math.round(pace * 1000)}
                    shareLine={runShareLine(wobble, result.time, pace, result.splats)}
                    medalPace={paceMsOf(wobble.pace)}
                    medalFormat={formatRun}
                    kicker={`Today’s Gauntlet #${wobble.n}`}
                    tomorrow={<TomorrowGauntlet day={wobble.day} />}
                    owner={runOwner}
                    onSettled={() => sendGhost(result, playerName)}
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

/** Dev only: localStorage `skermix-wobblerun-dev-day` = YYYY-MM-DD runs that day's gauntlet, to look over the plan. */
function devDay(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const day = localStorage.getItem('skermix-wobblerun-dev-day')
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
  } catch {
    return null
  }
}

/**
 * A past day's gauntlet, from the past tab: anyone's to run, and signed in, a run goes on its All time board
 * (PracticeCards.tsx). How its day went (lib/archive.ts) and its board are asked for here, the board again once a
 * run is saved. Signed out, they're asked for without a tag: nobody's place is shown as yours.
 */
function PastWobbleRun({ day }: { day: string }) {
  const viewer = usePastViewer()
  const { days, failed } = useDailyDays(SLUG, viewer.name)
  const itsDay: ItsDay = { days, failed, me: viewer.state === 'in' ? viewer.name : null }
  const [version, setVersion] = useState(0)
  const board = useTrackBoard(SLUG, gauntletNumber(day), viewer.state === 'out' ? '' : viewer.name, version)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return <WobbleRunDay day={day} practice itsDay={itsDay} pastBoard={{ board, refresh }} onNewDay={() => {}} />
}

/**
 * Wobble Run on today's gauntlet, mounted again for the next when midnight brings it; with `practiceDay`, a past
 * day's gauntlet from the past tab, onto its All time board; with `testDay`, today's gauntlet or one still to come,
 * test run from the admin's Gauntlet Book (?track=<n> or ?day=); with `lab`, the test course of every round
 * (runs.ts labDay), from the Gauntlet Book too. A test run and the test course are only an admin's: anyone else is
 * sent to today's gauntlet, with a word about why when the gauntlet's day hasn't come, or when it was the test course.
 */
export function WobbleRunGame({ practiceDay, testDay, lab = false }: { practiceDay?: string | null; testDay?: string | null; lab?: boolean }) {
  const [today, setToday] = useState<{ day: string; notice?: string }>(() => ({ day: devDay() ?? gauntletDay() }))
  const admin = useAdminState()
  const { loading } = useAuth()
  const adminOnly = Boolean(testDay) || lab
  // Sent away only once we know: signed in (or not), and the API has said this account isn't an admin.
  const shut = adminOnly && admin === false && !loading
  useEffect(() => {
    if (shut) navigate(gamePlayHref(SLUG), { replace: true })
  }, [shut])
  if (practiceDay) return <PastWobbleRun key={`practice-${practiceDay}`} day={practiceDay} />
  if (lab && admin === true) return <WobbleRunDay key="lab" day={LAB_DAY} practice lab onNewDay={() => {}} />
  if (testDay && admin === true) return <WobbleRunDay key={`test-${testDay}`} day={testDay} practice test onNewDay={() => {}} />
  // Still signing in, or still asking the API whether this account is an admin.
  if (adminOnly && !shut) return null
  const notice = lab
    ? 'The test course is for admins. Here’s today’s gauntlet.'
    : testDay && testDay !== gauntletDay()
      ? `Gauntlet #${gauntletNumber(testDay)}’s day hasn’t come yet. Here’s today’s.`
      : today.notice
  return <WobbleRunDay key={today.day} day={today.day} notice={notice} onNewDay={(why) => setToday({ day: gauntletDay(), notice: why })} />
}

export default WobbleRunGame
