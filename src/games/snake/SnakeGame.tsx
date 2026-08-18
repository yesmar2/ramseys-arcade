import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, PauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  queueDir,
  snakeLayout,
  startGame,
  tick,
  toSnapshot,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

function currentLayout() {
  return snakeLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

export function SnakeGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('snake')
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState(layout0.cols, layout0.rows, layout0.dir))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('snake'))
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const startGrace = useRef(0)
  const stickWellRef = useRef<HTMLDivElement>(null)
  const stickKnobRef = useRef<HTMLDivElement>(null)
  const lastStickDir = useRef<Dir | null>(null)
  const pausable = ui.phase === 'playing' && !saveOpen
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
        }
      }

      const canvas = canvasRef.current
      if (canvas) {
        const parent = canvas.parentElement
        const w = parent?.clientWidth || 0
        const h = parent?.clientHeight || 0
        if (w > 0 && h > 0) {
          const ctx = canvas.getContext('2d')
          if (ctx) renderGame(ctx, stateRef.current, w, h)
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  useEffect(() => {
    const sync = () => {
      const s = stateRef.current
      if (s.phase !== 'menu') return
      const next = currentLayout()
      if (s.cols === next.cols && s.rows === next.rows) return
      stateRef.current = createInitialState(next.cols, next.rows, next.dir)
      setAspect({ w: next.aspectW, h: next.aspectH })
      setUi(toSnapshot(stateRef.current))
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    const next = currentLayout()
    stateRef.current = startGame({
      ...stateRef.current,
      cols: next.cols,
      rows: next.rows,
    })
    setAspect({ w: next.aspectW, h: next.aspectH })
    previousBestRef.current = getPersonalBest('snake')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
    resetStick()
  }

  const turn = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      stateRef.current = queueDir(stateRef.current, dir)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    stateRef.current = queueDir(s, dir)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        KeyW: 'up',
        KeyS: 'down',
        KeyA: 'left',
        KeyD: 'right',
      }
      const dir = map[e.code]
      if (dir) {
        e.preventDefault()
        turn(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    if (saveOpen || pausedRef.current) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
    if (stateRef.current.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || saveOpen || pausedRef.current) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < 28) return
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 'right' : 'left')
    else turn(dy > 0 ? 'down' : 'up')
  }

  const resetStick = () => {
    lastStickDir.current = null
    if (stickKnobRef.current) stickKnobRef.current.style.transform = 'translate(0px, 0px)'
  }

  const applyStick = (clientX: number, clientY: number) => {
    const well = stickWellRef.current
    if (!well) return
    const r = well.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const maxR = Math.max(12, r.width * 0.34)
    let dx = clientX - cx
    let dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR
      dy = (dy / dist) * maxR
    }
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    }
    const dead = maxR * 0.28
    if (Math.hypot(dx, dy) < dead) {
      lastStickDir.current = null
      return
    }
    const dir: Dir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    if (dir === lastStickDir.current) return
    lastStickDir.current = dir
    turn(dir)
  }

  const onStickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (saveOpen || pausedRef.current) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    applyStick(e.clientX, e.clientY)
    const target = e.currentTarget
    const pointerId = e.pointerId
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      applyStick(ev.clientX, ev.clientY)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      resetStick()
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      target.removeEventListener('lostpointercapture', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
    target.addEventListener('lostpointercapture', onUp)
  }

  return (
    <section className={`snake snake--fullscreen${saveOpen ? ' snake--saving' : ''}`}>
      <GameHud
        slug="snake"
        personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
        extra={
          (pausable || paused) ? (
            <PauseButton paused={paused} onToggle={togglePause} />
          ) : undefined
        }
      >
        <GameHudStat
          label="Score"
          hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
        >
          {ui.score}
        </GameHudStat>
        <GameHudStat label="Length">{ui.length}</GameHudStat>
      </GameHud>
      <div className="snake__body">
      <div
        className="snake__play"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
      >
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
        >
          <canvas ref={canvasRef} className="snake__viewport" />

          <div className="snake__overlay">
            <PauseOverlay paused={paused} onResume={resume} />
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <div className="snake__card" aria-hidden="true">
                <h2>Snake</h2>
                <p>Steer with the arrows. Eat. Grow. Don’t crash.</p>
                <PersonalBestHint slug="snake" />
                <span className="snake__hint snake__hint--keys">Tap an arrow to start</span>
                <span className="snake__hint snake__hint--touch">Slide the stick to steer</span>
              </div>
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="snake"
                  score={ui.score}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="snake"
                  score={ui.score}
                  title="Game over"
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={restart}
                />
              )
            )}
          </div>
        </GameStage>
      </div>

        <div className="snake__touch" aria-label="Steer">
          <div
            className="snake__stick"
            role="group"
            aria-label="Direction stick"
            onPointerDown={onStickDown}
          >
            <div className="snake__stick-well" ref={stickWellRef}>
              <span className="snake__stick-hints" aria-hidden="true">
                <span className="snake__chevron snake__chevron--up" />
                <span className="snake__chevron snake__chevron--right" />
                <span className="snake__chevron snake__chevron--down" />
                <span className="snake__chevron snake__chevron--left" />
              </span>
              <div className="snake__stick-knob" ref={stickKnobRef} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
