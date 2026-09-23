import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { getPersonalBest } from '../../lib/personalBest'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { normalizePlayerName } from '../../lib/leaderboard'
import {
  clearRunAchievements,
  pushRunAchievement,
} from '../../lib/runAchievements'
import { submitPatriotDirectStreak, shouldCelebrateRecordSubmit } from '../../lib/records'
import { STAGE_ASPECT } from '../../lib/stage'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { PALETTE } from '../../data/games'
import {
  createInitialState,
  fire,
  POWER_LABEL,
  POWER_ORDER,
  POWER_SWATCH,
  resizeState,
  setCursor,
  startGame,
  tick,
  toSnapshot,
  activatePower,
  type GameState,
  type PowerKind,
  type Snapshot,
  jumpToWave,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

/**
 * The same four marks the blimps carry on their sides: two shells, a dome, an
 * hourglass, a sight. A power flies off a wreck as its badge and lands here as
 * the same badge.
 */
function PowerMark({ kind }: { kind: PowerKind }) {
  return (
    <svg className="patriot__power-mark" viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'ammo' ? (
        <path className="patriot__power-solid" d="M8.4 4.3 10.8 8.2V19H6V8.2ZM15.6 4.3 18 8.2V19h-4.8V8.2Z" />
      ) : kind === 'shield' ? (
        <path d="M4.8 16a7.2 7.2 0 0 1 14.4 0M3.5 16h17M8.3 12.7a4 4 0 0 1 2.6-1.5" />
      ) : kind === 'slow' ? (
        <>
          <path d="M6.5 4h11M6.5 20h11M7.6 4 12 12l-4.4 8M16.4 4 12 12l4.4 8" />
          <path className="patriot__power-solid" d="M9.3 20 12 15.3l2.7 4.7Z" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="5.4" />
          <path d="M12 3v5.4M12 15.6V21M3 12h5.4M15.6 12H21" />
          <circle className="patriot__power-solid" cx="12" cy="12" r="1.4" />
        </>
      )}
    </svg>
  )
}

/*
 * The wave card, in the arcade's own grammar: a kicker for what happened, the
 * figure it was worth, and the breakdown under it. It used to put a sentence
 * where the figure goes — "3 cities +300" set at 2.4rem — so the one card
 * between waves read as a different game to the four around it.
 */
function waveClearLabel(ui: Snapshot) {
  if (ui.clearBonus?.perfect) return 'Perfect wave'
  if (ui.clearBonus?.rebuilt) return 'City rebuilt'
  return `Wave ${ui.wave} clear`
}

function waveClearTotal(ui: Snapshot) {
  const b = ui.clearBonus
  return b ? b.cityBonus + b.ammoBonus : 0
}

function waveClearDetail(ui: Snapshot) {
  const b = ui.clearBonus
  if (!b) return ''
  const parts = [`${b.cities} ${b.cities === 1 ? 'city' : 'cities'} +${b.cityBonus}`]
  if (b.ammoBonus > 0) parts.push(`unused ammo +${b.ammoBonus}`)
  return parts.join(' · ')
}

/**
 * What the run was, under the score — the wave it ended on, and the streak if
 * there was one worth naming. Every other game names its run this way; this
 * card was showing the number alone.
 */
function gameOverNote(ui: Snapshot) {
  const parts = [`Wave ${ui.wave}`]
  if (ui.directStreakBest >= 2) {
    parts.push(`${ui.directStreakBest} direct hits in a row`)
  }
  return parts.join(' · ')
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
  const playerName = normalizePlayerName(usePlayerName())
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 800, h: 450 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const fireLock = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const streakRecordKey = useRef<string | null>(null)
  const previousBestRef = useRef(getPersonalBest('patriot'))
  const needsRotate = useNeedsLandscape()
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen
  /** A run is on screen: mid-wave, or on the card between waves. */
  const inPlay = ui.phase === 'playing' || ui.phase === 'waveClear'
  const pausable = inPlay && !saveOpen
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

  useEffect(() => {
    if (tournament || !playerName) return
    if (ui.phase !== 'playing' && ui.phase !== 'waveClear' && ui.phase !== 'gameover') {
      return
    }
    const streak = ui.directStreakBest
    if (streak < 2) return
    const key = `direct:${streak}`
    if (streakRecordKey.current === key) return
    streakRecordKey.current = key
    void (async () => {
      const result = await submitPatriotDirectStreak(streak, playerName)
      if (shouldCelebrateRecordSubmit(result)) {
        pushRunAchievement({
          id: 'patriot:direct-streak',
          label: 'Perfect hits in a row',
          value: String(streak),
          rank: result.rank,
        })
      }
    })()
  }, [ui.phase, ui.directStreakBest, playerName, tournament])

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

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    streakRecordKey.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('patriot')
    const { w, h } = sizeRef.current
    stateRef.current = startGame(stateRef.current, w, h)
    previousBestRef.current = getPersonalBest('patriot')
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
    if (pausedRef.current || saveOpen) return
    e.preventDefault()
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

  // The canvas draws its own sight while a wave is on, so the system one steps aside.
  const aiming = ui.phase === 'playing' && !paused && !saveOpen && !needsRotate

  return (
    <section className={`patriot patriot--fullscreen${aiming ? ' patriot--aiming' : ''}`}>
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

          <GamePlayChrome
            slug="patriot"
            inRun={() => {
              const phase = stateRef.current.phase
              return phase === 'playing' || phase === 'waveClear'
            }}
            paused={paused}
          >
            {(pausable || paused) && !needsRotate ? (
              <PauseButton paused={paused} onToggle={togglePause} />
            ) : null}
          </GamePlayChrome>

          <PlayReadout>
            <PlayReadoutScore
              hot={
                inPlay &&
                ui.score > previousBestRef.current
              }
            >
              {ui.score}
            </PlayReadoutScore>
            {inPlay && !needsRotate && (
              <PlayReadoutStats>
                <PlayStat label="Wave" value={ui.wave} />
                <PlayStat label="Cities" value={ui.citiesLeft} urgent={ui.citiesLeft <= 2} />
                <PlayStat label="Ammo" value={ui.ammoLeft} urgent={ui.ammoLeft <= 5} />
              </PlayReadoutStats>
            )}
          </PlayReadout>

          {/* A column down the left edge, under the run's figures. */}
          {inPlay &&
            !needsRotate &&
            POWER_ORDER.some((kind) => (ui.pack?.[kind] ?? 0) > 0) && (
            <div
              className="patriot__powers"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {POWER_ORDER.filter((kind) => (ui.pack?.[kind] ?? 0) > 0).map((kind) => {
                const count = ui.pack?.[kind] ?? 0
                const hot =
                  (kind === 'shield' && ui.shieldT > 0) ||
                  (kind === 'slow' && ui.slowT > 0)
                return (
                  <button
                    // Keyed on the count, so the badge pops each time one lands or is spent.
                    key={`${kind}-${count}`}
                    type="button"
                    className={`patriot__power${hot ? ' patriot__power--hot' : ''}`}
                    style={{ '--power': PALETTE[POWER_SWATCH[kind]] } as CSSProperties}
                    disabled={ui.phase !== 'playing' || paused}
                    aria-label={count > 1 ? `${POWER_LABEL[kind]}, ${count} held` : POWER_LABEL[kind]}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      activate(kind)
                    }}
                  >
                    <PowerMark kind={kind} />
                    {count > 1 ? (
                      <span className="patriot__power-count" aria-hidden="true">
                        ×{count}
                      </span>
                    ) : null}
                    <span className="patriot__power-key" aria-hidden="true">
                      {POWER_ORDER.indexOf(kind) + 1}
                    </span>
                  </button>
                )
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
              tools={
                ui.phase === 'playing' || ui.phase === 'waveClear' ? (
                  <AdminWaveSkip
                    unit="wave"
                    wave={ui.wave}
                    onSkipNext={() => {
                      const { w } = sizeRef.current
                      stateRef.current = jumpToWave(
                        stateRef.current,
                        stateRef.current.wave + 1,
                        w,
                      )
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                    onJump={(wave) => {
                      const { w } = sizeRef.current
                      stateRef.current = jumpToWave(stateRef.current, wave, w)
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                  />
                ) : null
              }
            />
            {ui.phase === 'menu' && !saveOpen && !needsRotate && !paused && (
              <GameStartCard
                title="Patriot"
                slug="patriot"
                tools={
                  <AdminWaveSkip
                    mode="start"
                    unit="wave"
                    onJump={(wave) => {
                      restart()
                      const { w } = sizeRef.current
                      stateRef.current = jumpToWave(stateRef.current, wave, w)
                      setUi(toSnapshot(stateRef.current))
                    }}
                  />
                }
              />
            )}
            {ui.phase === 'waveClear' && !needsRotate && !paused && (
              <div
                className={`game-card game-card--notice${ui.clearBonus?.perfect ? ' game-card--gold' : ''}${ui.clearBonus?.rebuilt ? ' game-card--good' : ''}`}
                style={gameAccentStyle('patriot')}
                aria-hidden="true"
              >
                <span className="game-card__kicker">{waveClearLabel(ui)}</span>
                <p className="game-card__figure">+{waveClearTotal(ui)}</p>
                <p className="game-card__blurb">{waveClearDetail(ui)}</p>
              </div>
            )}
            {ui.phase === 'gameover' && saveOpen && !needsRotate && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="patriot"
                  score={ui.score}
                  onDone={toMenu}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="patriot"
                  score={ui.score}
                  title="Cities lost"
                  subtitle={gameOverNote(ui)}
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={toMenu}
                />
              )
            )}
          </div>
        </div>
      </GameStage>
      </div>

      {needsRotate && (
        <div
          className="patriot__rotate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patriot-rotate-title"
          style={gameAccentStyle('patriot')}
        >
          <div className="panel patriot__rotate-panel">
            <div className="panel__body patriot__rotate-body">
              <span className="patriot__rotate-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M11 18.5h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <h2 id="patriot-rotate-title" className="panel__title">
                Turn your phone
              </h2>
              <p className="panel__text">Patriot plays in landscape.</p>
            </div>
            {/*
              A way back out. This panel covers the whole stage, back control
              included, so without it the only exit from a portrait phone was
              the browser's own gesture. Same leave flow the pause panel uses.
            */}
            <div className="panel__actions">
              <button
                type="button"
                className="panel__btn panel__btn--ghost"
                onClick={() => window.dispatchEvent(new Event('arcade:leave-confirm'))}
              >
                {tournament ? 'Back to event' : 'Leave Patriot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
