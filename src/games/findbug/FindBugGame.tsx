import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import '../../styles/findbug.css'
import {
  GamePlayChrome,
  PlayReadout,
  PlayReadoutScore,
} from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun } from '../../lib/runSession'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  clampCamera,
  fieldAspect,
  fitField,
  headerHeight,
  homeCamera,
  MAX_ZOOM,
  screenToWorld,
  zoomAbout,
  type Camera,
  type Field,
} from './camera'
import { drawPortrait, faceCentre, THE_BUG } from './critters'
import {
  createInitialState,
  DAZE_MS,
  HINT_NARROW_MS,
  HINT_WIDE_MS,
  hintLevel,
  markReady,
  MISS_MARK_MS,
  ROUNDS,
  SCENE_LIMIT_MS,
  setAspect,
  skipIntro,
  startGame,
  tapAt,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { SceneView, type Overlays } from './render'
import { findbugBoardScore, formatFindbugMs } from './score'

/** Past this, a press that wanders is a drag, not a tap. */
const TAP_SLOP_TOUCH = 10
const TAP_SLOP_MOUSE = 5

type Pointer = { x: number; y: number; startX: number; startY: number; startedAt: number; moved: boolean; mouse: boolean }

type Pinch = { dist: number; midX: number; midY: number; cam: Camera }

type Toast = { text: string; tone: 'good' | 'bad' | 'info'; id: number }

function isLive(phase: Snapshot['phase']) {
  return phase === 'intro' || phase === 'playing' || phase === 'found' || phase === 'timeout'
}

/**
 * The Bug, drawn into a small canvas: the whole of him for the scene card, or
 * just his head and hat for the badge by the clock.
 */
function BugPortrait({ size, crop }: { size: number; crop: 'full' | 'head' }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    if (crop === 'head') {
      // Head and hat fill the circle; the body drops out of the bottom.
      const h = size * 1.55
      drawPortrait(ctx, THE_BUG, size / 2, size / 2 + h * 0.2, h, { pose: 'stand' })
    } else {
      drawPortrait(ctx, THE_BUG, size / 2, size * 0.47, size * 0.9, { pose: 'wave', mood: 'open' })
    }
  }, [size, crop])
  return <canvas ref={ref} className="findbug__portrait" style={{ width: size, height: size }} aria-hidden="true" />
}

/** The Bug's face by the clock, ringed with what is left of the scene's minute. */
function WantedBadge({ left, urgent }: { left: number; urgent: boolean }) {
  const r = 19
  const c = 2 * Math.PI * r
  return (
    <div className={`findbug__badge${urgent ? ' findbug__badge--urgent' : ''}`} aria-hidden="true">
      <BugPortrait size={34} crop="head" />
      <svg className="findbug__badge-ring" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} className="findbug__badge-track" />
        <circle
          cx="22"
          cy="22"
          r={r}
          className="findbug__badge-left"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, left)))}
        />
      </svg>
    </div>
  )
}

function SceneCard({ index, name, ready }: { index: number; name: string; ready: boolean }) {
  const first = index === 0
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  return (
    <div className="game-pause-card findbug__card">
      <span className="findbug__card-kicker">
        Scene {index + 1} of {ROUNDS}
      </span>
      <h2>{name}</h2>
      <div className="findbug__poster">
        <BugPortrait size={first ? 118 : 92} crop="full" />
      </div>
      <p className="findbug__card-line">Find the Bug</p>
      {first ? (
        <p className="findbug__card-note">
          Red and white stripes, red bobble hat, round glasses. Plenty of them have one or two of those.
          Only he has all three. {coarse ? 'Pinch to zoom.' : 'Scroll to zoom.'}
        </p>
      ) : null}
      <span className="game-start-card__cue">{ready ? 'Tap to go' : 'Setting the scene…'}</span>
    </div>
  )
}

export function FindBugGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('findbug')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  if (!stateRef.current) {
    const aspect = typeof window === 'undefined' ? 1.4 : fieldAspect(window.innerWidth, window.innerHeight)
    stateRef.current = createInitialState(aspect)
  }
  const camRef = useRef<Camera>(homeCamera(stateRef.current.scene.w, stateRef.current.scene.h))
  const viewRef = useRef<SceneView | null>(null)
  const fieldRef = useRef<Field | null>(null)
  const reticleRef = useRef<{ x: number; y: number } | null>(null)
  const pointers = useRef(new Map<number, Pointer>())
  const pinchRef = useRef<Pinch | null>(null)
  const wheelAt = useRef(0)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current!))
  const [zoomed, setZoomed] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef(0)
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('findbug'))
  const startGrace = useRef(0)
  const pausable = isLive(ui.phase) && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const say = (text: string, tone: Toast['tone'], ms = 1300) => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, tone, id: performance.now() })
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    let lastPhase = stateRef.current!.phase
    let lastScene = stateRef.current!.scene
    if (!viewRef.current) viewRef.current = new SceneView()

    const loop = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      const canvas = canvasRef.current
      const host = canvas?.parentElement
      const w = host?.clientWidth || 0
      const h = host?.clientHeight || 0

      if (w > 0 && h > 0) {
        stateRef.current = setAspect(stateRef.current!, fieldAspect(w, h))
        // The readout strip is the canvas's header: tell the page where its
        // middle is so the clock and the buttons share one line.
        const middle = Math.round(headerHeight(h) / 2)
        if (host && host.dataset.readoutMiddle !== String(middle)) {
          host.dataset.readoutMiddle = String(middle)
          host.style.setProperty('--readout-middle', `${middle}px`)
          host.style.setProperty('--findbug-header', `${middle * 2}px`)
        }
      }

      if (!pausedRef.current) stateRef.current = tick(stateRef.current!, dt)
      const s = stateRef.current!

      // A new scene starts zoomed out; so does being shown where he was.
      if (s.scene !== lastScene) {
        lastScene = s.scene
        camRef.current = homeCamera(s.scene.w, s.scene.h)
        reticleRef.current = null
        setZoomed(false)
      }
      if (s.phase !== lastPhase) {
        if (s.phase === 'timeout') {
          camRef.current = homeCamera(s.scene.w, s.scene.h)
          setZoomed(false)
          say('Time! There he was.', 'info', 2200)
        }
        lastPhase = s.phase
        setUi(toSnapshot(s))
      }

      if (s.phase === 'gameover') {
        const score = findbugBoardScore(s.bankedMs)
        if (offeredScore.current !== score) {
          offeredScore.current = score
          saveOpenRef.current = true
          setSaveOpen(true)
          setUi(toSnapshot(s))
          startGrace.current = performance.now() + 400
        }
      }

      uiAcc += dt
      if (uiAcc > 80) {
        uiAcc = 0
        setUi(toSnapshot(s))
      }

      if (canvas && w > 0 && h > 0) {
        const dpr = Math.min(3, window.devicePixelRatio || 1)
        const bw = Math.round(w * dpr)
        const bh = Math.round(h * dpr)
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw
          canvas.height = bh
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const field = fitField(w, h, s.scene.w, s.scene.h)
          fieldRef.current = field
          camRef.current = clampCamera(camRef.current, s.scene.w, s.scene.h)
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          const moving = pointers.current.size > 0 || now - wheelAt.current < 160
          // Painting gets a slice of every frame: a thin one while somebody is
          // searching, so the view stays smooth, and a fat one behind the cards.
          const budget = s.phase === 'playing' || s.phase === 'found' || s.phase === 'timeout' ? 6 : 14
          const view = viewRef.current!
          view.frame(ctx, w, h, s.scene, field, camRef.current, dpr, overlaysFor(s, now), moving, now, budget)
          if (!s.ready && view.ready(s.scene)) {
            stateRef.current = markReady(s)
            setUi(toSnapshot(stateRef.current))
          }
        }
      }

      raf = requestAnimationFrame(loop)
    }

    const overlaysFor = (s: GameState, now: number): Overlays => {
      const t = s.scene.target
      const face = faceCentre(t)
      const cover = pausedRef.current || s.phase === 'menu' || s.phase === 'intro' || s.phase === 'gameover'
      let veil: Overlays['veil'] = null
      let ring: Overlays['ring'] = null
      if (s.phase === 'playing') {
        const level = hintLevel(s)
        if (level > 0) {
          const hint = s.hints[level - 1]
          const since = s.sceneMs - (level === 1 ? HINT_WIDE_MS : HINT_NARROW_MS)
          veil = { x: hint.x, y: hint.y, r: hint.r, alpha: 0.4 * Math.min(1, since / 700) }
        }
      } else if (s.phase === 'found' || s.phase === 'timeout') {
        const p = Math.min(1, s.phaseMs / 320)
        veil = { x: face.x, y: face.y + t.size * 0.12, r: t.size * (1.9 - 0.7 * p), alpha: 0.55 * p }
        ring = {
          x: face.x,
          y: face.y + t.size * 0.12,
          r: t.size * (0.7 + 0.04 * Math.sin(now / 110)),
          alpha: p,
          colour: s.phase === 'found' ? '#3ecf8e' : '#ffd84a',
        }
      }
      return {
        cover,
        dim: s.phase === 'playing' && s.dazeMs > 0 ? (s.dazeMs / DAZE_MS) * 0.55 : 0,
        veil,
        ring,
        misses: s.marks.map((m) => ({ x: m.x, y: m.y, age: m.ageMs / MISS_MARK_MS })),
        reticle: s.phase === 'playing' ? reticleRef.current : null,
      }
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  // Dev only: lets a script read the scene and the view to drive a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __findbug?: () => { state: GameState; camera: Camera; field: Field | null }
      __findbugTick?: (ms: number) => void
    }
    w.__findbug = () => ({ state: stateRef.current!, camera: camRef.current, field: fieldRef.current })
    // Run the game clock forward without waiting for frames.
    w.__findbugTick = (ms) => {
      stateRef.current = tick(stateRef.current!, ms)
    }
    return () => {
      delete w.__findbug
      delete w.__findbugTick
    }
  }, [])

  const currentAspect = () => {
    const host = canvasRef.current?.parentElement
    if (host && host.clientWidth > 0 && host.clientHeight > 0) return fieldAspect(host.clientWidth, host.clientHeight)
    return stateRef.current!.aspect
  }

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    const aspect = currentAspect()
    if (intoMenu) {
      stateRef.current = createInitialState(aspect)
    } else {
      beginRun('findbug')
      stateRef.current = startGame(stateRef.current!, aspect)
    }
    const s = stateRef.current
    camRef.current = homeCamera(s.scene.w, s.scene.h)
    reticleRef.current = null
    setZoomed(false)
    setToast(null)
    previousBestRef.current = getPersonalBest('findbug')
    startGrace.current = performance.now() + 250
    setUi(toSnapshot(s))
  }

  /**
   * Done with the run: back to the start card rather than into another one.
   * That card is where the numbers a run just changed are shown, and dropping
   * the player straight back into play skips past all of it. No run is opened,
   * so nothing counts until they actually start one.
   */
  const toMenu = () => restart(true)

  const syncZoomed = () => setZoomed(camRef.current.zoom > 1.01)

  /** A tap on the canvas, in CSS px from its top left. */
  const handleTap = (sx: number, sy: number) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current!
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase === 'intro') {
      stateRef.current = skipIntro(s)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    const field = fieldRef.current
    if (!field) return
    if (sx < field.x || sx > field.x + field.w || sy < field.y || sy > field.y + field.h) return
    const p = screenToWorld(sx, sy, camRef.current, field)
    tapWorld(p.x, p.y)
  }

  const tapWorld = (x: number, y: number) => {
    const s = stateRef.current!
    const { state, result } = tapAt(s, x, y)
    stateRef.current = state
    if (result === 'found') {
      const took = state.times[state.times.length - 1] ?? 0
      say(`Found him! ${formatFindbugMs(took)}`, 'good', 1500)
    } else if (result === 'miss') {
      say('Not him!', 'bad', 900)
    }
    setUi(toSnapshot(state))
  }

  const localPoint = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const canZoom = () => {
    const phase = stateRef.current!.phase
    return phase === 'playing' || phase === 'found'
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    const p = localPoint(e)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety */
    }
    pointers.current.set(e.pointerId, {
      x: p.x,
      y: p.y,
      startX: p.x,
      startY: p.y,
      startedAt: performance.now(),
      moved: false,
      mouse: e.pointerType === 'mouse',
    })
    if (pointers.current.size === 2 && canZoom()) {
      const [a, b] = [...pointers.current.values()]
      for (const pt of pointers.current.values()) pt.moved = true
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        cam: { ...camRef.current },
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const pt = pointers.current.get(e.pointerId)
    const p = localPoint(e)
    if (!pt) {
      // A mouse moving over the scene takes over from the keyboard cursor.
      if (e.pointerType === 'mouse') reticleRef.current = null
      return
    }
    const dx = p.x - pt.x
    const dy = p.y - pt.y
    pt.x = p.x
    pt.y = p.y
    const s = stateRef.current!
    const field = fieldRef.current
    if (!field) return

    const pinch = pinchRef.current
    if (pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.cam.zoom * (dist / pinch.dist)))
      // Keep the point that was under the fingers under them.
      const anchor = screenToWorld(pinch.midX, pinch.midY, pinch.cam, field)
      const k = field.scale * zoom
      camRef.current = clampCamera(
        {
          zoom,
          cx: anchor.x - (midX - field.x - field.w / 2) / k,
          cy: anchor.y - (midY - field.y - field.h / 2) / k,
        },
        s.scene.w,
        s.scene.h,
      )
      syncZoomed()
      return
    }

    const slop = pt.mouse ? TAP_SLOP_MOUSE : TAP_SLOP_TOUCH
    if (!pt.moved && Math.hypot(p.x - pt.startX, p.y - pt.startY) > slop) pt.moved = true
    if (pt.moved && camRef.current.zoom > 1.001 && canZoom()) {
      const k = field.scale * camRef.current.zoom
      camRef.current = clampCamera(
        { ...camRef.current, cx: camRef.current.cx - dx / k, cy: camRef.current.cy - dy / k },
        s.scene.w,
        s.scene.h,
      )
    }
  }

  const endPointer = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const pt = pointers.current.get(e.pointerId)
    if (!pt) return
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    // The finger left over from a pinch must not land as a tap when it lifts.
    if (pinchRef.current === null && pointers.current.size === 1) {
      for (const other of pointers.current.values()) other.moved = true
    }
    if (cancelled || pt.moved) return
    if (performance.now() - pt.startedAt > 900) return
    handleTap(pt.startX, pt.startY)
  }

  // Wheel and trackpad zoom. Added by hand: React's wheel listener is passive,
  // and a scroll that zooms must not also scroll the page.
  useEffect(() => {
    const el = playRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!canZoom() || pausedRef.current || saveOpenRef.current) return
      const field = fieldRef.current
      if (!field) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const s = stateRef.current!
      // Pinching a trackpad arrives as a wheel with ctrl held and small steps.
      const step = e.ctrlKey ? 0.012 : 0.0022
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      camRef.current = zoomAbout(camRef.current, field, Math.exp(-delta * step), e.clientX - rect.left, e.clientY - rect.top, s.scene.w, s.scene.h)
      wheelAt.current = performance.now()
      syncZoomed()
    }
    // Safari's trackpad pinch comes as gesture events instead.
    let gestureBase = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureBase = camRef.current.zoom
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      if (!canZoom()) return
      const field = fieldRef.current
      if (!field) return
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      const rect = el.getBoundingClientRect()
      const s = stateRef.current!
      const target = gestureBase * g.scale
      camRef.current = zoomAbout(camRef.current, field, target / camRef.current.zoom, g.clientX - rect.left, g.clientY - rect.top, s.scene.w, s.scene.h)
      wheelAt.current = performance.now()
      syncZoomed()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
    }
  }, [])

  const zoomOut = () => {
    const s = stateRef.current!
    camRef.current = homeCamera(s.scene.w, s.scene.h)
    syncZoomed()
  }

  // Keyboard: arrows steer a cursor round the scene, space or enter taps where
  // it is, plus and minus zoom about it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      const s = stateRef.current!
      const field = fieldRef.current

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (s.phase === 'menu') {
          if (performance.now() < startGrace.current) return
          restart()
          return
        }
        if (s.phase === 'intro') {
          stateRef.current = skipIntro(s)
          setUi(toSnapshot(stateRef.current))
          return
        }
        if (s.phase !== 'playing') return
        const cam = camRef.current
        if (!reticleRef.current) {
          // The first press only brings the cursor up, where the view is looking.
          reticleRef.current = { x: cam.cx, y: cam.cy }
          return
        }
        tapWorld(reticleRef.current.x, reticleRef.current.y)
        return
      }

      if (!field || (s.phase !== 'playing' && s.phase !== 'found')) return

      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0') {
        e.preventDefault()
        if (e.key === '0') {
          zoomOut()
          return
        }
        const factor = e.key === '-' || e.key === '_' ? 1 / 1.5 : 1.5
        const r = reticleRef.current ?? { x: camRef.current.cx, y: camRef.current.cy }
        const k = field.scale * camRef.current.zoom
        const sx = field.x + field.w / 2 + (r.x - camRef.current.cx) * k
        const sy = field.y + field.h / 2 + (r.y - camRef.current.cy) * k
        camRef.current = zoomAbout(camRef.current, field, factor, sx, sy, s.scene.w, s.scene.h)
        wheelAt.current = performance.now()
        syncZoomed()
        return
      }

      const dir: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        KeyA: [-1, 0],
        KeyD: [1, 0],
        KeyW: [0, -1],
        KeyS: [0, 1],
      }
      const move = dir[e.code]
      if (!move || s.phase !== 'playing') return
      e.preventDefault()
      const cam = camRef.current
      const step = (s.scene.unit * 0.45) / Math.sqrt(cam.zoom)
      const r = reticleRef.current ?? { x: cam.cx, y: cam.cy }
      const next = {
        x: Math.max(0, Math.min(s.scene.w, r.x + move[0] * step)),
        y: Math.max(0, Math.min(s.scene.h, r.y + move[1] * step)),
      }
      reticleRef.current = next
      // Zoomed in, the view follows the cursor out to its edges.
      if (cam.zoom > 1.001) {
        const halfW = s.scene.w / (2 * cam.zoom)
        const halfH = s.scene.h / (2 * cam.zoom)
        let { cx, cy } = cam
        if (next.x < cx - halfW * 0.8) cx = next.x + halfW * 0.8
        if (next.x > cx + halfW * 0.8) cx = next.x - halfW * 0.8
        if (next.y < cy - halfH * 0.8) cy = next.y + halfH * 0.8
        if (next.y > cy + halfH * 0.8) cy = next.y - halfH * 0.8
        camRef.current = clampCamera({ ...cam, cx, cy }, s.scene.w, s.scene.h)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const s = stateRef.current!
  const finalScore = ui.phase === 'gameover' ? findbugBoardScore(s.bankedMs) : 0
  const urgent = ui.phase === 'playing' && ui.sceneLeftMs < 10_000
  const leftShare = ui.phase === 'menu' ? 1 : ui.sceneLeftMs / SCENE_LIMIT_MS

  return (
    <section className="findbug findbug--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={3} aspectHeight={4} fill>
          <div
            ref={playRef}
            className={`findbug__play${zoomed ? ' findbug__play--zoomed' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endPointer(e, false)}
            onPointerCancel={(e) => endPointer(e, true)}
          >
            <canvas ref={canvasRef} className="findbug__viewport" />

            <GamePlayChrome slug="findbug" inRun={() => isLive(stateRef.current!.phase)} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore className="findbug__clock">{formatFindbugMs(ui.runMs)}</PlayReadoutScore>
              <PlayReadoutStats>
                <WantedBadge left={leftShare} urgent={urgent} />
                <PlayStat label="Scene" value={`${Math.min(ROUNDS, ui.index + 1)}/${ROUNDS}`} />
              </PlayReadoutStats>
            </PlayReadout>

            {toast && !paused ? (
              <div key={toast.id} className={`findbug__toast findbug__toast--${toast.tone}`} role="status">
                {toast.text}
              </div>
            ) : null}

            {ui.phase === 'playing' && ui.hintLevel > 0 && !paused ? (
              <div className="findbug__hint-note">He’s in the circle</div>
            ) : null}

            {zoomed && (ui.phase === 'playing' || ui.phase === 'found') && !paused ? (
              <button
                type="button"
                className="findbug__unzoom"
                aria-label="Zoom out"
                title="Zoom out"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  zoomOut()
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.5 15.5 21 21M7.5 10.5h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}

            <div className="findbug__overlay">
              <GamePauseOverlay
                slug="findbug"
                personalBest={isLive(ui.phase) ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
              />
              {ui.phase === 'menu' && !saveOpen && !paused && <GameStartCard title="Find the Bug" slug="findbug" />}
              {ui.phase === 'intro' && !paused ? (
                <SceneCard index={ui.index} name={ui.sceneName} ready={ui.ready} />
              ) : null}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="findbug"
                    score={finalScore}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="findbug"
                    score={finalScore}
                    title={ui.found === ROUNDS ? 'Found him every time' : 'Run over'}
                    subtitle={`Found ${ui.found} of ${ROUNDS} · ${ui.misses} wrong tap${ui.misses === 1 ? '' : 's'}`}
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
