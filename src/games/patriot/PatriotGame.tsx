import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHudStat, GamePlayChrome, GameStageHud } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
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
  POWER_HUE,
  POWER_LABEL,
  POWER_ORDER,
  resizeState,
  setCursor,
  startGame,
  tick,
  toSnapshot,
  activatePower,
  type GameState,
  type PowerKind,
  type Snapshot,
} from './game'
import { renderGame } from './render'

function PowerMark({ kind }: { kind: PowerKind }) {
  return (
    <svg className="patriot__power-mark" viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'ammo' ? (
        <path d="M12 5v14M5 12h14" />
      ) : kind === 'shield' ? (
        <path d="M7 15c0-3.4 2.2-7 5-7s5 3.6 5 7" />
      ) : kind === 'slow' ? (
        <>
          <path d="M6 12h12" />
          <path d="M9 8 5 12l4 4M15 8l4 4-4 4" />
        </>
      ) : (
        <circle cx="12" cy="12" r="4.2" />
      )}
    </svg>
  )
}

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
  const fireLock = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('patriot'))
  const needsRotate = useNeedsLandscape()
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen
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
    if (pausedRef.current || saveOpen) return
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

  const activate = (kind: PowerKind) => {
    if (pausedRef.current || saveOpen) return
    stateRef.current = activatePower(stateRef.current, kind)
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (pausedRef.current || saveOpen) return
    // Touch often skips pointermove — aim at the tap first.
    aimFromEvent(e)
    act()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const powerAt = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      const padAt = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(e.code)
      const slot = powerAt >= 0 ? powerAt : padAt
      if (slot >= 0) {
        e.preventDefault()
        activate(POWER_ORDER[slot])
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        act()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  return (
    <section className="patriot patriot--fullscreen">
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

          <GamePlayChrome>
            {(pausable || paused) && !needsRotate ? (
              <PauseButton paused={paused} onToggle={togglePause} />
            ) : null}
          </GamePlayChrome>

          <GameStageHud>
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
          </GameStageHud>

          {(ui.phase === 'playing' || ui.phase === 'waveClear') &&
            !needsRotate &&
            POWER_ORDER.some((kind) => (ui.pack?.[kind] ?? 0) > 0) && (
            <div
              className="patriot__powers"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {POWER_ORDER.flatMap((kind) => {
                const count = ui.pack?.[kind] ?? 0
                const hot =
                  (kind === 'shield' && ui.shieldT > 0) ||
                  (kind === 'slow' && ui.slowT > 0) ||
                  (kind === 'burst' && ui.burstArmed)
                return Array.from({ length: count }, (_, n) => (
                  <button
                    key={`${kind}-${n}`}
                    type="button"
                    className={`patriot__power${hot ? ' patriot__power--hot' : ''}`}
                    style={{ '--hue': String(POWER_HUE[kind]) } as CSSProperties}
                    disabled={ui.phase !== 'playing' || paused}
                    aria-label={POWER_LABEL[kind]}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      activate(kind)
                    }}
                  >
                    <PowerMark kind={kind} />
                  </button>
                ))
              })}
            </div>
          )}

          <div className="patriot__overlay">
            <GamePauseOverlay
              slug="patriot"
              personalBest={
                ui.phase === 'playing' || ui.phase === 'waveClear'
                  ? previousBestRef.current
                  : apiBest
              }
              paused={paused && !needsRotate}
              onResume={resume}
            />
            {ui.phase === 'menu' && !saveOpen && !needsRotate && !paused && (
              <div className="patriot__card" aria-hidden="true">
                <h2>Patriot</h2>
                <p>Defend the cities. Aim and tap to fire.</p>
                <PersonalBestHint slug="patriot" />
                <span>Shoot drones. Tap a circle to use it</span>
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
