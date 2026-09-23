import '../../styles/fireflies.css'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { beginRun } from '../../lib/runSession'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  FIRST_TUNE,
  MAX_FLIES,
  setScale,
  startGame,
  tapAt,
  tapFly,
  tick,
  toSnapshot,
  type GameState,
  type Phase,
  type Snapshot,
} from './game'
import { renderGame } from './render'

/**
 * Where the page's own score and buttons end, measured from the top of the
 * play area, so the lanterns can hang below them. They move with the safe
 * area on a notched phone, which the canvas has no other way to know.
 */
function measureTop(play: HTMLElement): number | undefined {
  const top = play.getBoundingClientRect().top
  let bottom = 0
  play.querySelectorAll('.play-readout__score, .play-stats, .game-play-chrome').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.height > 0 && r.bottom - top < play.clientHeight * 0.4) bottom = Math.max(bottom, r.bottom - top)
  })
  return bottom > 0 ? Math.round(bottom + 8) : undefined
}

function inRun(phase: Phase) {
  return phase === 'intro' || phase === 'watch' || phase === 'input' || phase === 'win' || phase === 'fail'
}

export function FirefliesGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('fireflies')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 390, h: 700 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('fireflies'))
  const startGrace = useRef(0)
  // A slip is its own ending; pausing through it would only hold the card back.
  const pausable = inRun(ui.phase) && ui.phase !== 'fail' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (parent && w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = setScale(stateRef.current, w, h, measureTop(parent))
      }

      if (!pausedRef.current) stateRef.current = tick(stateRef.current, dt)

      const snap = toSnapshot(stateRef.current)
      // Open the score card the moment the night ends, so a stray tap can't start another first.
      if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
        offeredScore.current = snap.score
        saveOpenRef.current = true
        setSaveOpen(true)
        setUi(snap)
        startGrace.current = performance.now() + 400
      }

      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(snap)
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

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    if (!intoMenu) beginRun('fireflies')
    const { w, h } = sizeRef.current
    const fresh = startGame(setScale(stateRef.current, w, h))
    previousBestRef.current = getPersonalBest('fireflies')
    startGrace.current = performance.now() + 220
    // Back at the start card the pond waits, its four fireflies already out.
    stateRef.current = intoMenu
      ? { ...createInitialState(w, h), time: fresh.time, stageTop: fresh.stageTop, best: fresh.best }
      : fresh
    setUi(toSnapshot(stateRef.current))
  }

  /**
   * Done with the night: back to the start card rather than into another one.
   * That card is where the numbers a run just changed are shown, and dropping
   * the player straight back into play skips past all of it. No run is opened,
   * so nothing counts until they actually start one.
   */
  const toMenu = () => restart(true)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    e.preventDefault()
    const s = stateRef.current
    // Only the menu starts a night from a tap; the end of one waits for the score card.
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (!inRun(s.phase)) return
    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = tapAt(s, e.clientX - rect.left, e.clientY - rect.top)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (stateRef.current.phase === 'menu' && performance.now() >= startGrace.current) restart()
        return
      }
      // Each firefly keeps its number wherever it flies: 1 to 6, on the digits or the keypad.
      const match = /^(?:Digit|Numpad)([1-6])$/.exec(e.code)
      if (!match) return
      const id = Number(match[1]) - 1
      if (id >= MAX_FLIES || stateRef.current.phase !== 'input') return
      e.preventDefault()
      stateRef.current = tapFly(stateRef.current, id)
      setUi(toSnapshot(stateRef.current))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const longest = ui.round > 0 ? FIRST_TUNE + ui.round - 1 : 0

  return (
    <section className="fireflies fireflies--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={3} aspectHeight={4} fill>
          <div className="fireflies__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="fireflies__viewport" />

            <GamePlayChrome slug="fireflies" inRun={() => inRun(stateRef.current.phase)} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore hot={inRun(ui.phase) && ui.score > previousBestRef.current}>
                {ui.score}
              </PlayReadoutScore>
              <PlayReadoutStats>
                <PlayStat label="Tune" value={ui.tune || FIRST_TUNE} />
              </PlayReadoutStats>
            </PlayReadout>

            <div className="fireflies__overlay">
              <GamePauseOverlay
                slug="fireflies"
                personalBest={inRun(ui.phase) ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
              />
              {ui.phase === 'menu' && !saveOpen && !paused && <GameStartCard title="Fireflies" slug="fireflies" />}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="fireflies"
                    score={ui.score}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="fireflies"
                    score={ui.score}
                    title="The tune slipped"
                    subtitle={longest > 0 ? `Longest tune: ${longest} notes` : undefined}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={toMenu}
                  />
                ))}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}
