import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { leaderboardHref } from '../hooks/useHashRoute'
import {
  addLeaderboardScore,
  ApiError,
  checkQualifies,
  getLastPlayerName,
  LEADERBOARD_GAMES,
  PERIOD_LABELS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  title: string
  subtitle?: string
  onDone: () => void
}

const PERIOD_ORDER: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all']
const TOP_TEN = 10

function rankedPeriods(
  ranks?: Partial<Record<LeaderboardPeriod, number>>,
): { period: LeaderboardPeriod; rank: number }[] {
  if (!ranks) return []
  return PERIOD_ORDER.flatMap((period) => {
    const rank = ranks[period]
    return rank != null && rank >= 1 ? [{ period, rank }] : []
  })
}

function RankChips({ ranks }: { ranks?: Partial<Record<LeaderboardPeriod, number>> }) {
  const items = rankedPeriods(ranks)
  if (!items.length) return null
  return (
    <ul className="score-save__ranks" aria-label="Leaderboard ranks">
      {items.map(({ period, rank }) => (
        <li key={period}>
          <span>{PERIOD_LABELS[period]}</span>
          <strong>#{rank}</strong>
        </li>
      ))}
    </ul>
  )
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type Burst = { x: number; y: number; at: number; color: string }

const FIREWORK_COLORS = ['#4aa8e8', '#2eb8a0', '#f5b942', '#e85d75', '#7ab8e8', '#3ecf8e']

function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = true
    const particles: Particle[] = []
    const start = performance.now()
    const bursts: Burst[] = [
      { x: 0.22, y: 0.28, at: 80, color: FIREWORK_COLORS[0] },
      { x: 0.78, y: 0.24, at: 220, color: FIREWORK_COLORS[2] },
      { x: 0.5, y: 0.2, at: 380, color: FIREWORK_COLORS[1] },
      { x: 0.18, y: 0.55, at: 520, color: FIREWORK_COLORS[3] },
      { x: 0.82, y: 0.5, at: 680, color: FIREWORK_COLORS[4] },
      { x: 0.35, y: 0.32, at: 900, color: FIREWORK_COLORS[5] },
      { x: 0.65, y: 0.3, at: 1050, color: FIREWORK_COLORS[2] },
      { x: 0.5, y: 0.42, at: 1280, color: FIREWORK_COLORS[0] },
    ]
    const launched = new Set<number>()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const spawnBurst = (bx: number, by: number, color: string) => {
      const count = 42 + Math.floor(Math.random() * 18)
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2
        const speed = 2.2 + Math.random() * 4.8
        particles.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.7 + Math.random() * 0.7,
          color,
          size: 2 + Math.random() * 2.8,
        })
      }
      // secondary sparkle ring
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 2.2
        particles.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.45 + Math.random() * 0.35,
          color: '#fff8e8',
          size: 1.2 + Math.random() * 1.5,
        })
      }
    }

    let last = performance.now()
    const frame = (now: number) => {
      if (!running) return
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const elapsed = now - start
      const w = window.innerWidth
      const h = window.innerHeight

      bursts.forEach((b, i) => {
        if (!launched.has(i) && elapsed >= b.at) {
          launched.add(i)
          spawnBurst(b.x * w, b.y * h, b.color)
        }
      })

      ctx.clearRect(0, 0, w, h)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt / p.maxLife
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.vy += 18 * dt
        p.vx *= 0.992
        p.vy *= 0.992
        p.x += p.vx * 60 * dt
        p.y += p.vy * 60 * dt
        const alpha = Math.max(0, p.life)
        ctx.beginPath()
        ctx.fillStyle = p.color
        ctx.globalAlpha = alpha * alpha
        ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * alpha), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="score-celeb__fireworks" aria-hidden="true" />
}

function TopTenCelebration({
  hits,
  onDone,
}: {
  hits: { period: LeaderboardPeriod; rank: number }[]
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const hide = window.setTimeout(() => setLeaving(true), 3400)
    const done = window.setTimeout(onDone, 3900)
    return () => {
      window.clearTimeout(hide)
      window.clearTimeout(done)
    }
  }, [onDone])

  const dismiss = () => {
    setLeaving(true)
    window.setTimeout(onDone, 320)
  }

  const best = Math.min(...hits.map((h) => h.rank))

  return createPortal(
    <div
      className={`score-celeb${leaving ? ' score-celeb--out' : ''}`}
      role="dialog"
      aria-label="Top 10 celebration"
      onPointerDown={(e) => {
        e.stopPropagation()
        dismiss()
      }}
    >
      <FireworksCanvas />
      <div className="score-celeb__card">
        <span className="score-celeb__eyebrow">Top 10</span>
        <strong className="score-celeb__headline">#{best}</strong>
        <ul className="score-celeb__list">
          {hits.map(({ period, rank }) => (
            <li key={period}>
              <strong>#{rank}</strong>
              <span>{PERIOD_LABELS[period]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

function cleanName(raw: string) {
  return raw.trim().slice(0, 12).toUpperCase()
}

function boardsHref(gameSlug: string) {
  const game = (LEADERBOARD_GAMES as readonly string[]).includes(gameSlug)
    ? (gameSlug as LeaderboardGame)
    : 'stacker'
  return leaderboardHref(game, 'daily')
}

type Phase = 'checking' | 'needName' | 'saving' | 'saved' | 'noQualify' | 'error'

export function ScoreSaveCard({
  gameSlug,
  score,
  title,
  subtitle,
  onDone,
}: ScoreSaveProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [ranks, setRanks] = useState<Partial<Record<LeaderboardPeriod, number>>>()
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [celebHits, setCelebHits] = useState<
    { period: LeaderboardPeriod; rank: number }[] | null
  >(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)
  const celebShown = useRef(false)

  useEffect(() => {
    if (phase === 'needName') nameInputRef.current?.focus()
  }, [phase])

  const openCelebration = (nextRanks?: Partial<Record<LeaderboardPeriod, number>>) => {
    if (celebShown.current) return
    const hits = rankedPeriods(nextRanks).filter((h) => h.rank <= TOP_TEN)
    if (!hits.length) return
    celebShown.current = true
    setCelebHits(hits)
  }

  useEffect(() => {
    let cancelled = false
    savedRef.current = false
    celebShown.current = false
    setCelebHits(null)
    setPhase('checking')
    setError(null)

    async function run() {
      try {
        const result = await checkQualifies(gameSlug, score)
        if (cancelled) return
        setRanks(result.ranks)

        if (!result.qualifies) {
          setPhase('noQualify')
          return
        }

        const name = getLastPlayerName().trim().toUpperCase()
        if (!name) {
          setPhase('needName')
          return
        }

        setPhase('saving')
        const saved = await addLeaderboardScore(gameSlug, name, score)
        if (cancelled) return
        setRanks(saved.ranks)
        savedRef.current = true
        setPhase('saved')
        openCelebration(saved.ranks)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
          setPhase('needName')
          setError('That name is taken — pick another')
          return
        }
        setError(err instanceof Error ? err.message : 'Could not save score')
        setPhase('error')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [gameSlug, score])

  const submitName = async () => {
    const name = cleanName(nameDraft)
    if (!name || savedRef.current) return
    setPhase('saving')
    setError(null)
    try {
      const saved = await addLeaderboardScore(gameSlug, name, score)
      setRanks(saved.ranks)
      savedRef.current = true
      setPhase('saved')
      openCelebration(saved.ranks)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That name is taken — pick another')
        setPhase('needName')
        return
      }
      setError(err instanceof Error ? err.message : 'Could not save score')
      setPhase('error')
    }
  }

  return (
    <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
      {celebHits && (
        <TopTenCelebration hits={celebHits} onDone={() => setCelebHits(null)} />
      )}

      <div className="score-save__hero">
        <span className="score-save__eyebrow">
          {phase === 'needName' ? 'Board score' : title}
        </span>
        <strong className="score-save__score">{score}</strong>
        {phase === 'noQualify' && subtitle && (
          <p className="score-save__sub">{subtitle}</p>
        )}
      </div>

      {(phase === 'saved' || phase === 'needName' || phase === 'noQualify') && (
        <RankChips ranks={ranks} />
      )}

      {(phase === 'checking' || phase === 'saving') && (
        <p className="score-save__note">
          {phase === 'checking' ? 'Checking boards…' : 'Saving…'}
        </p>
      )}

      {phase === 'needName' && (
        <>
          <label className="score-save__field">
            <span className="score-save__label">Name</span>
            <input
              ref={nameInputRef}
              className="score-save__input"
              value={nameDraft}
              maxLength={12}
              placeholder="YOU"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setNameDraft(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitName()
                }
              }}
            />
          </label>
          {error && <p className="score-save__note score-save__note--error">{error}</p>}
          <div className="score-save__actions">
            <button
              type="button"
              className="score-save__btn"
              disabled={!cleanName(nameDraft)}
              onClick={() => void submitName()}
            >
              Continue
            </button>
            <button type="button" className="score-save__btn score-save__btn--ghost" onClick={onDone}>
              Skip
            </button>
          </div>
        </>
      )}

      {phase === 'saved' && (
        <>
          <button type="button" className="score-save__btn" onClick={onDone}>
            Play again
          </button>
          <div className="score-save__links">
            <a href={boardsHref(gameSlug)}>Boards</a>
            <a href="#/tournaments">Events</a>
          </div>
        </>
      )}

      {phase === 'noQualify' && (
        <>
          {error && <p className="score-save__note score-save__note--error">{error}</p>}
          <button type="button" className="score-save__btn" onClick={onDone}>
            Play again
          </button>
          <div className="score-save__links">
            <a href={boardsHref(gameSlug)}>Boards</a>
            <a href="#/tournaments">Events</a>
          </div>
        </>
      )}

      {phase === 'error' && (
        <>
          <p className="score-save__note score-save__note--error">{error}</p>
          <button type="button" className="score-save__btn" onClick={onDone}>
            Play again
          </button>
        </>
      )}
    </div>
  )
}
