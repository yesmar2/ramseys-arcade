import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/asteroids-records.css'
import { haptic } from '../../lib/haptics'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useDeviceType } from '../../lib/device'
import { getGame } from '../../data/games'
import { getPersonalBest } from '../../lib/personalBest'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { useActiveChallenge } from '../../lib/challenges'
import { normalizePlayerName } from '../../lib/leaderboard'
import {
  clearRunAchievements,
  isRunAssisted,
  pushRunAchievement,
} from '../../lib/runAchievements'
import {
  ASTEROIDS_HIGHEST_COMBO_ID,
  asteroidsWaveTimeRecordId,
  fetchBookGlance,
  formatRecordMs,
  placeInBook,
  submitAsteroidsHighestCombo,
  submitAsteroidsWaveClearBooks,
  shouldCelebrateRecordSubmit,
  type BookGlance,
  type RecordBookHit,
} from '../../lib/records'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  asteroidsLayout,
  beginNextWave,
  createInitialState,
  formatWaveTime,
  jumpToWave,
  POWER_HUE,
  POWER_LABEL,
  resizeState,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type PowerKind,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

type HoldKey = 'turnLeft' | 'turnRight' | 'thrust' | 'reverse'

const KEY_MAP: Record<string, HoldKey> = {
  ArrowLeft: 'turnLeft',
  KeyA: 'turnLeft',
  KeyQ: 'turnLeft',
  KeyZ: 'turnLeft',
  ArrowRight: 'turnRight',
  KeyD: 'turnRight',
  KeyE: 'turnRight',
  ArrowUp: 'thrust',
  KeyW: 'thrust',
  ArrowDown: 'reverse',
  KeyS: 'reverse',
}

function emptyPressed(): Record<HoldKey, Set<string>> {
  return {
    turnLeft: new Set(),
    turnRight: new Set(),
    thrust: new Set(),
    reverse: new Set(),
  }
}

function currentLayout() {
  return asteroidsLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

/*
 * Every wave has a record book for the fastest clear, and the run has one for
 * the highest combo. A wave's book is looked at before the wave begins, so
 * the "Wave N" banner and a chip under the score can say what there is to
 * beat, and the wave's card can say what the clear did in the book the
 * moment it opens. Saving the clear then only confirms it, or corrects it if
 * someone got in first. Before, the card waited on the save and a gold row
 * appeared on it a moment later, or after it had closed, with nothing to say
 * one was coming.
 */

/** A row on a wave's card for a record book: gold for a place won, plain for the record that stands. */
type BookRow = { id: string; label: string; value: string; gold: boolean; checking?: boolean }

const waveBook = (wave: number) => `asteroids:wave-time-${wave}`
const COMBO_BOOK = 'asteroids:highest-combo'
/** The places a glance covers, and so the places a card can call before the save answers. */
const GLANCE_PLACES = 10

function placeWords(rank: number | null) {
  return rank === 1 ? 'New record' : rank != null ? `#${rank} in the book` : 'In the book'
}

function isMe(entryName: string, name: string) {
  return normalizePlayerName(entryName) === normalizePlayerName(name)
}

/** The record that stands on a wave, as a plain row. */
function standingRow(wave: number, glance: BookGlance, name: string): BookRow {
  const top = glance.entries[0]
  return {
    id: waveBook(wave),
    label: `Wave ${wave} record`,
    value: top ? `${formatRecordMs(top.score)} · ${isMe(top.name, name) ? 'yours' : top.name}` : 'Nobody yet',
    gold: false,
  }
}

/** What a clear did in the books, called from the glances taken before the wave. */
function predictedRows(
  wave: number,
  seconds: number,
  combo: number,
  glances: Map<string, BookGlance | null>,
  name: string,
): BookRow[] {
  const rows: BookRow[] = []
  const waveId = asteroidsWaveTimeRecordId(wave)
  if (waveId) {
    const glance = glances.get(waveId)
    if (glance === undefined) {
      rows.push({ id: waveBook(wave), label: `Fastest wave ${wave}`, value: 'Checking the book', gold: false, checking: true })
    } else if (glance) {
      const place = placeInBook(glance, Math.max(1, Math.round(seconds * 1000)), 'lower', name)
      rows.push(
        place.improved && place.rank != null && place.rank <= GLANCE_PLACES
          ? { id: waveBook(wave), label: `Fastest wave ${wave}`, value: placeWords(place.rank), gold: true }
          : standingRow(wave, glance, name),
      )
    }
  }
  const comboGlance = glances.get(ASTEROIDS_HIGHEST_COMBO_ID)
  if (combo >= 2 && comboGlance) {
    const place = placeInBook(comboGlance, combo, 'higher', name)
    if (place.improved && place.rank != null && place.rank <= GLANCE_PLACES) {
      rows.push({ id: COMBO_BOOK, label: `Highest combo ×${combo}`, value: placeWords(place.rank), gold: true })
    }
  }
  return rows
}

/** The rows once the save has answered: its places, and otherwise the record that stands. */
function settledRows(
  wave: number,
  combo: number,
  hits: RecordBookHit[],
  glances: Map<string, BookGlance | null>,
  name: string,
): BookRow[] {
  const rows: BookRow[] = []
  const waveHit = hits.find((h) => h.id === waveBook(wave))
  const waveGlance = glances.get(asteroidsWaveTimeRecordId(wave) ?? '')
  if (waveHit) rows.push({ id: waveBook(wave), label: `Fastest wave ${wave}`, value: placeWords(waveHit.rank), gold: true })
  else if (waveGlance) rows.push(standingRow(wave, waveGlance, name))
  const comboHit = hits.find((h) => h.id === COMBO_BOOK)
  if (comboHit) {
    rows.push({ id: COMBO_BOOK, label: `Highest combo ${comboHit.value ?? `×${combo}`}`, value: placeWords(comboHit.rank), gold: true })
  }
  return rows
}

/**
 * Under the score while a wave is on: whose record it is and how long is left
 * to beat it, the bar running down with the wave's clock. Once the time has
 * gone by, it dims and stays, so the record is still there to read.
 */
function WaveRecordChip({
  glance,
  seconds,
  name,
  low,
}: {
  glance: BookGlance
  seconds: number
  name: string
  /** A friend's challenge has the place under the score. */
  low: boolean
}) {
  const top = glance.entries[0]
  const place = `asteroids-record${low ? ' asteroids-record--low' : ''}`
  if (!top) {
    return (
      <span className={`${place} asteroids-record--open`} aria-hidden="true">
        No record yet: first clear sets it
      </span>
    )
  }
  const record = top.score / 1000
  const left = record - seconds
  return (
    <span className={`${place}${left <= 0 ? ' asteroids-record--gone' : ''}`} aria-hidden="true">
      <PlayerAvatar avatarId={top.avatarId} name={top.name} size="sm" />
      <span>
        {isMe(top.name, name) ? 'Your record' : top.name} <strong>{formatRecordMs(top.score)}</strong>
      </span>
      {left > 0 ? (
        <span className="asteroids-record__bar">
          <span style={{ width: `${Math.max(0, Math.min(1, left / record)) * 100}%` }} />
        </span>
      ) : null}
    </span>
  )
}

export function AsteroidsGame() {
  const tournament = useTournamentPlay()
  const device = useDeviceType()
  const playerName = usePlayerName()
  const apiBest = usePersonalBest('asteroids')
  const accent = getGame('asteroids')?.accent ?? '#2eb87a'
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 960, h: 540 })
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const pressedRef = useRef(emptyPressed())
  /** Last pressed turn wins — left+right never cancel each other out. */
  const turnDirRef = useRef<-1 | 0 | 1>(0)
  const saveOpenRef = useRef(false)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  /** What the wave just cleared did in the record books, as rows on its card. */
  const [bookRows, setBookRows] = useState<BookRow[]>([])
  /** The rows each clear was called with, so a card that opens again says the same. */
  const predictionsRef = useRef(new Map<string, BookRow[]>())
  const booksReportedRef = useRef<string | null>(null)
  /** This run's glances at the books, by record id: a glance, null when it couldn't be had, absent until it lands. */
  const glancesRef = useRef(new Map<string, BookGlance | null>())
  const glanceLoadsRef = useRef(new Set<string>())
  const runEpochRef = useRef(0)
  const [, setGlancesLanded] = useState(0)
  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName
  const tournamentRef = useRef(tournament)
  tournamentRef.current = tournament
  const challenge = useActiveChallenge('asteroids')
  const offeredScore = useRef<number | null>(null)
  const comboRecordKey = useRef<string | null>(null)
  const previousBestRef = useRef(getPersonalBest('asteroids'))
  const startGrace = useRef(0)
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen
  const pausable =
    (ui.phase === 'playing' || ui.phase === 'waveClear') && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  saveOpenRef.current = saveOpen

  /** The run report lists the places a clear won at the end, with everything else the run won. */
  const reportBooks = (hits: RecordBookHit[], submitKey: string) => {
    if (booksReportedRef.current === submitKey) return
    booksReportedRef.current = submitKey
    for (const hit of hits) pushRunAchievement({ id: hit.id, label: hit.label, value: hit.value, rank: hit.rank })
  }

  /** Books that count for this run: not in an event, and not after an admin's wave skip. */
  const booksCount = () => !tournamentRef.current && !isRunAssisted()

  /** Look at a book once a run, in the background. */
  const lookAtBook = (recordId: string | null) => {
    if (!recordId) return
    const epoch = runEpochRef.current
    const key = `${epoch}:${recordId}`
    if (glancesRef.current.has(recordId) || glanceLoadsRef.current.has(key)) return
    glanceLoadsRef.current.add(key)
    fetchBookGlance('asteroids', recordId, playerNameRef.current, GLANCE_PLACES)
      .catch(() => null)
      .then((glance) => {
        glanceLoadsRef.current.delete(key)
        // A run that has ended has no use for it; the next looks for itself.
        if (epoch !== runEpochRef.current) return
        glancesRef.current.set(recordId, glance)
        setGlancesLanded((n) => n + 1)
      })
  }

  /** The line under "Wave N" as it begins: the time to beat. */
  const waveRecordNote = (wave: number) => {
    if (!booksCount()) return ''
    const id = asteroidsWaveTimeRecordId(wave)
    const glance = id ? glancesRef.current.get(id) : null
    if (!glance) return ''
    const top = glance.entries[0]
    if (!top) return 'No record yet: the first clear sets it'
    return isMe(top.name, playerNameRef.current)
      ? `Your record ${formatRecordMs(top.score)}`
      : `Record ${formatRecordMs(top.score)} · ${top.name}`
  }

  const syncControls = () => {
    const p = pressedRef.current
    const s = stateRef.current
    const turnLeft = turnDirRef.current === -1
    const turnRight = turnDirRef.current === 1
    const thrust = p.thrust.size > 0
    const reverse = p.reverse.size > 0
    if (
      s.turnLeft === turnLeft &&
      s.turnRight === turnRight &&
      s.turn === 0 &&
      s.thrust === thrust &&
      s.reverse === reverse &&
      s.fireHeld === false
    ) {
      return
    }
    stateRef.current = {
      ...s,
      turnLeft,
      turnRight,
      turn: 0,
      thrust,
      reverse,
      fireHeld: false,
    }
  }

  const recomputeTurnDir = () => {
    const left = pressedRef.current.turnLeft.size > 0
    const right = pressedRef.current.turnRight.size > 0
    if (left && !right) turnDirRef.current = -1
    else if (right && !left) turnDirRef.current = 1
    else if (!left && !right) turnDirRef.current = 0
  }

  const clearPressed = () => {
    pressedRef.current = emptyPressed()
    turnDirRef.current = 0
    syncControls()
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const w = canvas?.parentElement?.clientWidth || canvas?.clientWidth || 0
      const h = canvas?.parentElement?.clientHeight || canvas?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

      syncControls()
      const s0 = stateRef.current
      if (s0.phase === 'playing' && s0.waveIntro > 0) {
        const note = waveRecordNote(s0.wave)
        if ((s0.waveRecordNote ?? '') !== note) stateRef.current = { ...s0, waveRecordNote: note }
      }
      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current, dt)
      }

      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        const snap = toSnapshot(stateRef.current)
        setUi(snap)
        if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
          offeredScore.current = snap.score
          setSaveOpen(true)
          clearPressed()
        }
      }

      if (canvas && w > 0 && h > 0) {
        const ctx = canvas.getContext('2d')
        if (ctx) renderGame(ctx, stateRef.current, w, h)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  // The books for the wave under way and the one after, and the combo book: looked at before they're
  // needed, the first ones while the start card is up.
  useEffect(() => {
    if (ui.phase === 'gameover' || !booksCount()) return
    lookAtBook(asteroidsWaveTimeRecordId(ui.wave))
    lookAtBook(asteroidsWaveTimeRecordId(ui.wave + 1))
    lookAtBook(ASTEROIDS_HIGHEST_COMBO_ID)
  }, [ui.phase, ui.wave, tournament])

  useEffect(() => {
    if (ui.phase !== 'waveClear' || !booksCount()) {
      if (ui.phase !== 'waveClear') setBookRows([])
      return
    }
    const wave = ui.lastWave
    const time = ui.lastWaveTime
    const combo = ui.runComboBest
    const submitKey = `${wave}:${time.toFixed(3)}`
    let rows = predictionsRef.current.get(submitKey)
    if (!rows) {
      rows = predictedRows(wave, time, combo, glancesRef.current, playerName)
      predictionsRef.current.set(submitKey, rows)
    }
    setBookRows(rows)

    let open = true
    void (async () => {
      const hits = await submitAsteroidsWaveClearBooks({ wave, seconds: time, combo, name: playerName })
      // The combo went into its book with the clear; the end of the run needn't send it again.
      if (combo >= 2) comboRecordKey.current = `combo:${combo}`
      const comboGlance = glancesRef.current.get(ASTEROIDS_HIGHEST_COMBO_ID)
      const comboHit = hits.find((h) => h.id === COMBO_BOOK)
      if (comboHit && comboGlance) {
        // The combo book has moved: a later clear with the same combo mustn't call it a place again.
        const at = Date.now()
        comboGlance.you = { ...(comboGlance.you ?? { id: `mine-${at}`, name: playerName }), score: combo, at, rank: comboHit.rank ?? 0 }
      }
      if (hits.length) reportBooks(hits, submitKey)
      // Still on this clear's card: settle its rows. Once it has closed, the places wait for the run report.
      if (open && stateRef.current.phase === 'waveClear') {
        setBookRows(settledRows(wave, combo, hits, glancesRef.current, playerName))
      }
    })()
    return () => {
      open = false
    }
  }, [
    ui.phase,
    ui.lastWave,
    ui.lastWaveTime,
    ui.runComboBest,
    playerName,
    tournament,
  ])

  useEffect(() => {
    if (ui.phase !== 'gameover' || tournament) return
    const combo = ui.runComboBest
    if (combo < 2) return
    const key = `combo:${combo}`
    if (comboRecordKey.current === key) return
    comboRecordKey.current = key
    void (async () => {
      const comboResult = await submitAsteroidsHighestCombo(combo, playerName)
      if (shouldCelebrateRecordSubmit(comboResult)) {
        pushRunAchievement({
          id: 'asteroids:highest-combo',
          label: 'Highest combo',
          value: `×${combo}`,
          rank: comboResult.rank,
        })
      }
    })()
  }, [ui.phase, ui.runComboBest, playerName, tournament])

  useEffect(() => {
    const sync = () => {
      if (stateRef.current.phase !== 'menu') return
      const next = currentLayout()
      setAspect((cur) =>
        cur.w === next.aspectW && cur.h === next.aspectH ? cur : { w: next.aspectW, h: next.aspectH },
      )
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    booksReportedRef.current = null
    comboRecordKey.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('asteroids')
    setBookRows([])
    // After a run, the books are looked at afresh: it may have moved them. From the start card, what was
    // looked at while it was up is this run's.
    if (stateRef.current.phase !== 'menu') {
      runEpochRef.current += 1
      glancesRef.current = new Map()
    }
    predictionsRef.current = new Map()
    clearPressed()
    const next = currentLayout()
    setAspect({ w: next.aspectW, h: next.aspectH })
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('asteroids')
    startGrace.current = performance.now() + 180
    // Same reset, stopped at the start card instead of in play.
    if (intoMenu) stateRef.current = { ...stateRef.current, phase: 'menu' }
    setUi(toSnapshot(stateRef.current))
  }

  /**
   * Done with the run: back to the start card rather than into another one.
   * That card is where the numbers a run just changed are shown, and dropping
   * the player straight back into play skips past all of it. No run is opened,
   * so nothing counts until they actually start one.
   */
  const toMenu = () => restart(true)

  const press = (key: HoldKey, id: string) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
    } else if (s.phase !== 'playing') {
      return
    }
    pressedRef.current[key].add(id)
    if (key === 'turnLeft') turnDirRef.current = -1
    if (key === 'turnRight') turnDirRef.current = 1
    syncControls()
  }

  const release = (key: HoldKey, id: string) => {
    pressedRef.current[key].delete(id)
    if (key === 'turnLeft' || key === 'turnRight') recomputeTurnDir()
    syncControls()
  }

  const holdPad = (key: HoldKey) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      // Every pad, one place: an on-screen control gives the eye
      // feedback and the hand none, which is the gap this closes.
      haptic(key === 'thrust' ? 'boost' : 'turn')
      press(key, `pad:${e.pointerId}`)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault()
    },
  })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // The score card's tag field and buttons, and the pause screen, get their keys to themselves.
      if (saveOpenRef.current || pausedRef.current) return
      // Prefer e.code; also accept e.key for ArrowLeft (some layouts/hosts)
      const fromCode = KEY_MAP[e.code]
      const fromKey =
        e.key === 'ArrowLeft'
          ? 'turnLeft'
          : e.key === 'ArrowRight'
            ? 'turnRight'
            : e.key === 'ArrowUp'
              ? 'thrust'
              : e.key === 'ArrowDown'
                ? 'reverse'
                : null
      const key = fromCode ?? fromKey
      if (!key) {
        if (e.code === 'Enter' || e.key === 'Enter' || e.code === 'Space' || e.key === ' ') {
          e.preventDefault()
          const s = stateRef.current
          if (s.phase === 'waveClear') continueWave()
          // A run that has ended waits for its report: only the start card starts another, or a press as it ends throws the score away.
          else if (s.phase === 'menu') restart()
        }
        return
      }
      e.preventDefault()
      if (e.repeat) return
      press(key, `key:${e.code || e.key}`)
    }
    const up = (e: KeyboardEvent) => {
      const fromCode = KEY_MAP[e.code]
      const fromKey =
        e.key === 'ArrowLeft'
          ? 'turnLeft'
          : e.key === 'ArrowRight'
            ? 'turnRight'
            : e.key === 'ArrowUp'
              ? 'thrust'
              : e.key === 'ArrowDown'
                ? 'reverse'
                : null
      const key = fromCode ?? fromKey
      if (!key) return
      e.preventDefault()
      release(key, `key:${e.code || e.key}`)
      // Also drop the alternate id if code/key differed
      if (e.code && e.key) {
        release(key, `key:${e.code}`)
        release(key, `key:${e.key}`)
      }
    }
    const blur = () => clearPressed()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const continueWave = (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (stateRef.current.phase !== 'waveClear') return
    clearPressed()
    stateRef.current = beginNextWave(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  const onPlayTap = (e: ReactPointerEvent) => {
    if (saveOpenRef.current || pausedRef.current) return
    e.preventDefault()
    const s = stateRef.current
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  return (
    <section
      className={`asteroids asteroids--fullscreen${device === 'tablet' ? ' asteroids--tablet' : ''}${saveOpen || ui.phase === 'waveClear' ? ' asteroids--saving' : ''}`}
      style={{ '--accent': accent } as CSSProperties}
    >
      <div className="asteroids__body">
      <div className="asteroids__play" onPointerDown={onPlayTap}>
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
          fill
        >
          <canvas ref={canvasRef} className="asteroids__viewport" />

          <GamePlayChrome
            slug="asteroids"
            inRun={() => {
              const phase = stateRef.current.phase
              return phase === 'playing' || phase === 'waveClear'
            }}
            paused={paused}
          >
            {(pausable || paused) ? (
              <PauseButton paused={paused} onToggle={togglePause} />
            ) : null}
          </GamePlayChrome>

          <PlayReadout>
            <PlayReadoutScore
              hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
            >
              {ui.score}
            </PlayReadoutScore>
            {ui.phase === 'playing' && !tournament && !isRunAssisted() && glancesRef.current.get(asteroidsWaveTimeRecordId(ui.wave) ?? '') ? (
              <WaveRecordChip
                glance={glancesRef.current.get(asteroidsWaveTimeRecordId(ui.wave) ?? '')!}
                seconds={ui.time}
                name={playerName}
                low={challenge != null}
              />
            ) : null}
            {ui.lives > 0 ? (
              <div
                className="play-readout__left asteroids__lives"
                aria-label={`${ui.lives} ${ui.lives === 1 ? 'life' : 'lives'}`}
              >
                {Array.from({ length: ui.lives }, (_, i) => (
                  <svg
                    key={i}
                    className="play-readout__ship"
                    viewBox="0 0 16 20"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 1.5 L14.5 17.5 L8 13.5 L1.5 17.5 Z"
                      fill="currentColor"
                    />
                  </svg>
                ))}
              </div>
            ) : null}
            {ui.phase === 'playing' &&
            (ui.buffRapid > 0 ||
              ui.buffSpread > 0 ||
              ui.buffShield > 0 ||
              ui.buffSlow > 0) ? (
              <div className="asteroids__buffs" aria-label="Active powerups">
                {(
                  [
                    ['rapid', ui.buffRapid],
                    ['spread', ui.buffSpread],
                    ['shield', ui.buffShield],
                    ['slow', ui.buffSlow],
                  ] as const
                )
                  .filter(([, left]) => left > 0)
                  .map(([kind, left]) => (
                    <span
                      key={kind}
                      className="asteroids__buff"
                      style={
                        {
                          '--hue': String(POWER_HUE[kind as PowerKind]),
                        } as CSSProperties
                      }
                    >
                      <span className="asteroids__buff__name">
                        {POWER_LABEL[kind as PowerKind]}
                      </span>
                      <span className="asteroids__buff__time">
                        {Math.ceil(left)}
                      </span>
                    </span>
                  ))}
              </div>
            ) : null}
          </PlayReadout>

          <div className="asteroids__overlay">
            <GamePauseOverlay
              slug="asteroids"
              personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
              hideBest
              paused={paused}
              onResume={resume}
              extraMeta={
                <>
                  <div className="game-pause-meta__row">
                    <span>Wave</span>
                    <strong>
                      {ui.phase === 'waveClear' ? ui.lastWave : ui.wave}
                    </strong>
                  </div>
                  <div className="game-pause-meta__row">
                    <span>Time</span>
                    <strong>
                      {ui.phase === 'playing' || ui.phase === 'waveClear'
                        ? `${formatWaveTime(ui.time)}s`
                        : '—'}
                    </strong>
                  </div>
                </>
              }
              tools={
                ui.phase === 'playing' || ui.phase === 'waveClear' ? (
                  <AdminWaveSkip
                    unit="wave"
                    wave={ui.phase === 'waveClear' ? ui.lastWave : ui.wave}
                    onSkipNext={() => {
                      const current =
                        ui.phase === 'waveClear' ? ui.lastWave : stateRef.current.wave
                      stateRef.current = jumpToWave(stateRef.current, current + 1)
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                    onJump={(wave) => {
                      stateRef.current = jumpToWave(stateRef.current, wave)
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                  />
                ) : null
              }
            />
            {ui.phase === 'waveClear' && !saveOpen && !paused && (
              <div className="game-card game-card--wave" style={gameAccentStyle('asteroids')}>
                <div className="game-card__head">
                  <span className="game-card__kicker">Asteroids</span>
                  <h2 className="game-card__title">Wave {ui.lastWave} clear</h2>
                  <p className="game-card__figure">{formatWaveTime(ui.lastWaveTime)}s</p>
                </div>
                <div className="game-card__rows">
                  {bookRows.map((row) => (
                    <div
                      key={row.id}
                      className={`panel__row${row.gold ? ' game-card__row--gold' : ''}${row.checking ? ' game-card__row--checking' : ''}`}
                    >
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                  <div className="panel__row">
                    <span>Time bonus</span>
                    <strong>{ui.timeBonus > 0 ? `+${ui.timeBonus}` : 'None'}</strong>
                  </div>
                  {ui.comboBest > 1 ? (
                    <div className="panel__row">
                      <span>Best combo</span>
                      <strong>{ui.comboBest}</strong>
                    </div>
                  ) : null}
                  {ui.lifeBonus ? (
                    <div className="panel__row game-card__row--good" aria-live="polite">
                      <span>Extra life</span>
                      <strong>every 3 waves</strong>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="panel__btn" onPointerDown={continueWave}>
                  Next wave
                </button>
              </div>
            )}
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <GameStartCard
                title="Asteroids"
                slug="asteroids"
                tools={
                  <AdminWaveSkip
                    mode="start"
                    unit="wave"
                    onJump={(wave) => {
                      restart()
                      stateRef.current = jumpToWave(stateRef.current, wave)
                      setUi(toSnapshot(stateRef.current))
                    }}
                  />
                }
              />
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="asteroids"
                  score={ui.score}
                  onDone={toMenu}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="asteroids"
                  score={ui.score}
                  title="Ship down"
                  subtitle={`Wave ${ui.wave}`}
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={toMenu}
                />
              )
            )}
          </div>
        </GameStage>
      </div>

        <div className="asteroids__touch" aria-label="Ship controls">
          <div className="asteroids__turns">
            <button
              type="button"
              className="asteroids__btn"
              aria-label="Turn left"
              {...holdPad('turnLeft')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 3v5h5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="asteroids__btn"
              aria-label="Turn right"
              {...holdPad('turnRight')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 3v5h-5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="asteroids__drive">
            <button
              type="button"
              className="asteroids__btn asteroids__btn--thrust"
              aria-label="Thrust"
              {...holdPad('thrust')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5.5 L12 18.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M7.5 10.5 L12 5.5 L16.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="asteroids__btn asteroids__btn--hyperspace"
              aria-label="Hyperspace"
              {...holdPad('reverse')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2.5 L13.6 9.2 L20.5 12 L13.6 14.8 L12 21.5 L10.4 14.8 L3.5 12 L10.4 9.2 Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
