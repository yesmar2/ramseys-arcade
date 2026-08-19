import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { leaderboardHref } from '../hooks/useHashRoute'
import {
  addLeaderboardScore,
  ApiError,
  fetchPlayerBests,
  getLastPlayerName,
  LEADERBOARD_GAMES,
  PERIOD_LABELS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { describePersonalBest, rememberPersonalBest } from '../lib/personalBest'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  title: string
  subtitle?: string
  /** Best at the start of this run, before the engine saved a new record. */
  previousBest?: number
  onDone: () => void
}

type RankHit = { kind: 'rank'; period: LeaderboardPeriod; rank: number }
type RecordHit = { kind: 'record'; score: number; gain: number | null }
type CelebHit = RankHit | RecordHit

const PERIOD_ORDER: LeaderboardPeriod[] = ['all', 'monthly', 'weekly', 'daily']
const TOP_TEN = 10

function rankedPeriods(
  ranks?: Partial<Record<LeaderboardPeriod, number>>,
): { period: LeaderboardPeriod; rank: number }[] {
  if (!ranks) return []
  return PERIOD_ORDER.flatMap((period) => {
    const rank = ranks[period]
    return rank != null && rank >= 1 && rank <= TOP_TEN ? [{ period, rank }] : []
  })
}

function celebrationHits(
  ranks?: Partial<Record<LeaderboardPeriod, number>>,
): RankHit[] {
  return rankedPeriods(ranks).map(({ period, rank }) => ({
    kind: 'rank' as const,
    period,
    rank,
  }))
}

function recordHit(score: number, allTime: number): RecordHit | null {
  if (score <= allTime) return null
  return {
    kind: 'record',
    score,
    gain: allTime > 0 ? score - allTime : null,
  }
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

function ScoreCelebration({
  hits,
  onDone,
}: {
  hits: CelebHit[]
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const hit = hits[index]
  const isLast = index >= hits.length - 1

  useEffect(() => {
    if (!hits.length) onDone()
  }, [hits, onDone])

  if (!hit) return null

  const advance = () => {
    if (leaving) return
    if (!isLast) {
      setLeaving(true)
      window.setTimeout(() => {
        setIndex((i) => i + 1)
        setLeaving(false)
      }, 280)
      return
    }
    setLeaving(true)
    window.setTimeout(onDone, 320)
  }

  const isRecord = hit.kind === 'record'
  const fireworkKey = isRecord ? 'record' : hit.period
  const eyebrow = isRecord
    ? hit.gain != null
      ? 'New personal best'
      : 'Personal best'
    : PERIOD_LABELS[hit.period]
  const headline = isRecord ? String(hit.score) : `#${hit.rank}`
  const detail = isRecord
    ? hit.gain != null
      ? `+${hit.gain}`
      : hits.length > 1
        ? `${index + 1} of ${hits.length}`
        : 'Nice run'
    : hits.length > 1
      ? `${index + 1} of ${hits.length}`
      : 'Nice run'

  return createPortal(
    <div
      className={`score-celeb${leaving ? ' score-celeb--out' : ''}${isRecord ? ' score-celeb--record' : ''}`}
      role="dialog"
      aria-label={isRecord ? 'Personal best celebration' : `${PERIOD_LABELS[hit.period]} top 10 celebration`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FireworksCanvas key={fireworkKey} />
      <div className="score-celeb__card">
        <span className="score-celeb__eyebrow">{eyebrow}</span>
        <strong className="score-celeb__headline">{headline}</strong>
        <p className="score-celeb__detail">{detail}</p>
        <button type="button" className="score-celeb__btn" onClick={advance}>
          {isLast ? 'Continue' : 'Next'}
        </button>
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

type Phase = 'checking' | 'needName' | 'saving' | 'saved' | 'error'

export function ScoreSaveCard({
  gameSlug,
  score,
  title,
  subtitle,
  previousBest,
  onDone,
}: ScoreSaveProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [ranks, setRanks] = useState<Partial<Record<LeaderboardPeriod, number>>>()
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [celebHits, setCelebHits] = useState<CelebHit[] | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)
  const celebShown = useRef(false)
  const recordRef = useRef(previousBest ?? 0)
  const [record, setRecord] = useState(previousBest ?? 0)

  const pb = describePersonalBest(score, record)
  const isBestRun = pb?.kind === 'new' || (pb?.kind === 'first' && score > 0)
  const eyebrow =
    pb?.headline ?? (phase === 'needName' ? 'Board score' : title)
  const subParts = [pb?.detail, subtitle].filter(Boolean) as string[]

  useEffect(() => {
    if (phase === 'needName') nameInputRef.current?.focus()
  }, [phase])

  const openCelebration = (
    allTime: number,
    nextRanks?: Partial<Record<LeaderboardPeriod, number>>,
  ) => {
    if (celebShown.current) return
    const hits: CelebHit[] = [...celebrationHits(nextRanks)]
    const allTimeFirst = hits.some(
      (hit) => hit.kind === 'rank' && hit.period === 'all' && hit.rank === 1,
    )
    if (!allTimeFirst) {
      const rec = recordHit(score, allTime)
      if (rec) hits.push(rec)
    }
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
        const name = getLastPlayerName().trim().toUpperCase()
        if (name) {
          try {
            const bests = await fetchPlayerBests(name)
            if (cancelled) return
            const allTime = bests[gameSlug] ?? 0
            recordRef.current = allTime
            setRecord(allTime)
          } catch {
            /* keep fallback from this device’s cache */
          }
        }
        if (cancelled) return

        if (score <= 0) {
          setPhase('saved')
          return
        }

        if (!name) {
          setPhase('needName')
          return
        }

        setPhase('saving')
        const saved = await addLeaderboardScore(gameSlug, name, score)
        if (cancelled) return
        rememberPersonalBest(gameSlug, Math.max(recordRef.current, score))
        setRanks(saved.ranks)
        savedRef.current = true
        setPhase('saved')
        openCelebration(recordRef.current, saved.ranks)
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
      rememberPersonalBest(gameSlug, Math.max(recordRef.current, score))
      setRanks(saved.ranks)
      savedRef.current = true
      setPhase('saved')
      openCelebration(recordRef.current, saved.ranks)
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

  const celebrating = Boolean(celebHits && celebHits.length)
  const pending = phase === 'checking' || phase === 'saving'
  const showResults = !celebrating && !pending

  return (
    <>
      {celebHits && (
        <ScoreCelebration hits={celebHits} onDone={() => setCelebHits(null)} />
      )}
      {pending && !celebrating && (
        <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
          <p className="score-save__note">
            {phase === 'checking' ? 'Checking boards…' : 'Saving…'}
          </p>
        </div>
      )}
      {showResults && (
    <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
      <div className="score-save__hero">
        <span
          className={`score-save__eyebrow${isBestRun ? ' score-save__eyebrow--best' : ''}`}
        >
          {eyebrow}
        </span>
        <strong className="score-save__score">{score}</strong>
        {pb?.gain != null && (
          <span className="score-save__gain">+{pb.gain}</span>
        )}
        {subParts.length > 0 && (
          <p className="score-save__sub">{subParts.join(' · ')}</p>
        )}
      </div>

      {(phase === 'saved' || phase === 'needName') && (
        <RankChips ranks={ranks} />
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

      {phase === 'error' && (
        <>
          <p className="score-save__note score-save__note--error">{error}</p>
          <button type="button" className="score-save__btn" onClick={onDone}>
            Play again
          </button>
        </>
      )}
    </div>
      )}
    </>
  )
}
