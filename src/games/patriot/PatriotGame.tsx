import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  fire,
  resizeState,
  setCursor,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

function useNeedsLandscape() {
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 900px)')
    const sync = () => setPortrait(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return portrait
}

export function PatriotGame() {
  const tournament = useTournamentPlay()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 800, h: 600 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const fireLock = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const needsRotate = useNeedsLandscape()
  const pausedRef = useRef(needsRotate)
  pausedRef.current = needsRotate

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || window.innerWidth
      const h = parent?.clientHeight || window.innerHeight

      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

      // Pause simulation while the phone is in portrait
      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current, dt, w)
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

      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) renderGame(ctx, stateRef.current, w, h)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (pausedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = setCursor(
      stateRef.current,
      e.clientX - rect.left,
      e.clientY - rect.top,
    )
  }

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(stateRef.current, w, h)
    setUi(toSnapshot(stateRef.current))
  }

  const act = () => {
    if (pausedRef.current || saveOpen || infoOpen) return
    if (fireLock.current) return
    fireLock.current = true
    setTimeout(() => {
      fireLock.current = false
    }, 90)

    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      restart()
      return
    }
    if (s.phase === 'waveClear') return
    stateRef.current = fire(s)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && infoOpen) {
        setInfoOpen(false)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (saveOpen || pausedRef.current || infoOpen) return
        e.preventDefault()
        act()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen, infoOpen])

  return (
    <section
      className="patriot patriot--fullscreen"
      onPointerMove={onPointerMove}
      onPointerDown={act}
    >
      <canvas ref={canvasRef} className="patriot__viewport" />

      <div className="patriot__hud" aria-live="polite">
        <div className="patriot__stat">
          <span className="patriot__label">Score</span>
          <strong>{ui.score}</strong>
        </div>
        <div className="patriot__stat">
          <span className="patriot__label">Wave</span>
          <strong>{ui.wave}</strong>
        </div>
        <div className="patriot__stat">
          <span className="patriot__label">Ammo</span>
          <strong>{ui.ammoLeft}</strong>
        </div>
        <button
          type="button"
          className="patriot__info"
          aria-label="Scoring info"
          aria-expanded={infoOpen}
          onPointerDown={(e) => {
            e.stopPropagation()
            setInfoOpen((open) => !open)
          }}
        >
          i
        </button>
      </div>

      {infoOpen && (
        <div
          className="patriot__info-panel"
          role="dialog"
          aria-label="How scoring works"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="patriot__info-head">
            <span className="patriot__label">Scoring</span>
            <button
              type="button"
              className="patriot__info-close"
              aria-label="Close scoring info"
              onClick={() => setInfoOpen(false)}
            >
              ×
            </button>
          </div>
          <ul className="patriot__info-list">
            <li>
              <span>Splash hit</span>
              <strong>+25</strong>
            </li>
            <li>
              <span>Direct hit</span>
              <strong>+100</strong>
            </li>
            <li>
              <span>4 hits in a row</span>
              <strong>+200</strong>
            </li>
            <li>
              <span>City saved (wave clear)</span>
              <strong>+100</strong>
            </li>
            <li>
              <span>Unused ammo (wave clear)</span>
              <strong>+5 each</strong>
            </li>
          </ul>
        </div>
      )}

      <div className="patriot__overlay">
        {ui.phase === 'menu' && !saveOpen && !needsRotate && (
          <div className="patriot__card" aria-hidden="true">
            <h2>Patriot</h2>
            <p>Defend the cities. Aim and tap to fire.</p>
            <span>Tap to start · best in landscape</span>
          </div>
        )}
        {ui.phase === 'waveClear' && !needsRotate && (
          <div className="patriot__card patriot__card--small" aria-hidden="true">
            Wave {ui.wave} clear
          </div>
        )}
        {ui.phase === 'gameover' && saveOpen && !needsRotate && (
          tournament ? (
            <TournamentScoreCard
              tournamentId={tournament.tournamentId}
              gameSlug="patriot"
              score={ui.score}
              onDone={restart}
            />
          ) : (
            <ScoreSaveCard
              gameSlug="patriot"
              score={ui.score}
              title="Cities lost"
              subtitle={`Best ${ui.best}`}
              onDone={restart}
            />
          )
        )}
      </div>

      {needsRotate && (
        <div className="patriot__rotate" role="dialog" aria-label="Rotate your device">
          <div className="patriot__rotate-card">
            <div className="patriot__rotate-icon" aria-hidden="true">
              ⟳
            </div>
            <h2>Turn your phone</h2>
            <p>Patriot plays in landscape.</p>
          </div>
        </div>
      )}
    </section>
  )
}
