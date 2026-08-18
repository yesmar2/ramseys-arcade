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
import { STAGE_ASPECT } from '../../lib/stage'
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
  const apiBest = usePersonalBest('patriot')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 800, h: 450 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const fireLock = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('patriot'))
  const needsRotate = useNeedsLandscape()
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen || infoOpen
  const pausable = (ui.phase === 'playing' || ui.phase === 'waveClear') && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
  const pausedRef = useRef(false)
  pausedRef.current = needsRotate || paused

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

      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

      // Freeze while rotated or user-paused
      if (!pausedRef.current && w > 0) {
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

  const aimFromEvent = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = setCursor(
      stateRef.current,
      e.clientX - rect.left,
      e.clientY - rect.top,
    )
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (pausedRef.current) return
    aimFromEvent(e)
  }

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(stateRef.current, w, h)
    previousBestRef.current = getPersonalBest('patriot')
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

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (pausedRef.current || saveOpen || infoOpen) return
    // Touch often skips pointermove — aim at the tap first.
    aimFromEvent(e)
    act()
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
    <section className="patriot patriot--fullscreen">
      <GameHud
        slug="patriot"
        personalBest={
          ui.phase === 'playing' || ui.phase === 'waveClear'
            ? previousBestRef.current
            : apiBest
        }
        extra={
          <>
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
            {(pausable || paused) && !needsRotate && (
              <PauseButton paused={paused} onToggle={togglePause} />
            )}
          </>
        }
      >
        <GameHudStat
          label="Score"
          hot={
            (ui.phase === 'playing' || ui.phase === 'waveClear') &&
            ui.score > previousBestRef.current
          }
        >
          {ui.score}
        </GameHudStat>
        <GameHudStat label="Wave">{ui.wave}</GameHudStat>
        <GameHudStat label="Ammo">{ui.ammoLeft}</GameHudStat>
      </GameHud>
      <div className="game-play">
      <GameStage
        aspectWidth={STAGE_ASPECT.patriot.w}
        aspectHeight={STAGE_ASPECT.patriot.h}
      >
        <div
          className="patriot__play"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
        >
          <canvas ref={canvasRef} className="patriot__viewport" />

          <div className="patriot__overlay">
            <PauseOverlay paused={paused && !needsRotate} onResume={resume} />
            {ui.phase === 'menu' && !saveOpen && !needsRotate && !paused && (
              <div className="patriot__card" aria-hidden="true">
                <h2>Patriot</h2>
                <p>Defend the cities. Aim and tap to fire.</p>
                <PersonalBestHint slug="patriot" />
                <span>Bombers some waves · missiles hit cities and turrets</span>
              </div>
            )}
            {ui.phase === 'waveClear' && !needsRotate && !paused && (
              <div
                className={`patriot__card patriot__card--clear${ui.clearBonus?.perfect ? ' patriot__card--perfect' : ''}${ui.clearBonus?.rebuilt ? ' patriot__card--rebuilt' : ''}`}
                aria-hidden="true"
              >
                {ui.clearBonus?.perfect ? (
                  <>
                    <h2>Perfect wave</h2>
                    <p className="patriot__bonus">+{ui.clearBonus.cityBonus}</p>
                  </>
                ) : ui.clearBonus?.rebuilt ? (
                  <>
                    <h2>City rebuilt</h2>
                    <p className="patriot__bonus">
                      {ui.clearBonus.cities} {ui.clearBonus.cities === 1 ? 'city' : 'cities'} +{ui.clearBonus.cityBonus}
                    </p>
                  </>
                ) : (
                  <>
                    <h2>Wave {ui.wave} clear</h2>
                    <p className="patriot__bonus">
                      {ui.clearBonus
                        ? `${ui.clearBonus.cities} ${ui.clearBonus.cities === 1 ? 'city' : 'cities'} +${ui.clearBonus.cityBonus}`
                        : null}
                    </p>
                  </>
                )}
                {ui.clearBonus && ui.clearBonus.ammoBonus > 0 && (
                  <span>Unused ammo +{ui.clearBonus.ammoBonus}</span>
                )}
                {ui.clearBonus &&
                  !ui.clearBonus.rebuilt &&
                  !ui.clearBonus.perfect &&
                  ui.clearBonus.cleanStreak === 1 &&
                  ui.clearBonus.cities < 6 && (
                    <span>One more clean wave to rebuild</span>
                  )}
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
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={restart}
                />
              )
            )}
          </div>
        </div>
      </GameStage>
      </div>

      {infoOpen && (
        <div
          className="patriot__info-backdrop"
          onPointerDown={(e) => {
            e.stopPropagation()
            setInfoOpen(false)
          }}
        >
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
                <span>City saved (wave clear)</span>
                <strong>+100</strong>
              </li>
              <li>
                <span>Perfect wave</span>
                <strong>all 6 cities</strong>
              </li>
              <li>
                <span>Unused ammo (wave clear)</span>
                <strong>+5 each</strong>
              </li>
              <li>
                <span>Two clean waves</span>
                <strong>rebuild a city</strong>
              </li>
              <li>
                <span>Plane shot down</span>
                <strong>+200</strong>
              </li>
              <li>
                <span>Violet missile</span>
                <strong>splits halfway</strong>
              </li>
              <li>
                <span>Incoming fire</span>
                <strong>cities, turrets, misses</strong>
              </li>
            </ul>
          </div>
        </div>
      )}

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
