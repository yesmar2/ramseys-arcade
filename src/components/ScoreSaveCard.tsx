import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gameHref } from '../hooks/useHashRoute'
import {
  addLeaderboardScore,
  ApiError,
  fetchPlayerBests,
  getLastPlayerName,
  normalizePlayerName,
  PERIOD_LABELS,
  PLAYER_NAME_MAX,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { describePersonalBest, rememberPersonalBest } from '../lib/personalBest'
import { refreshGlobalRank } from '../lib/globalRank'
import {
  peekRunAchievements,
  takeRunAchievements,
  type RunAchievement,
} from '../lib/runAchievements'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  title: string
  subtitle?: string
  /** Best at the start of this run, before the engine saved a new record. */
  previousBest?: number
  onDone: () => void
}

type BoardHit = { period: LeaderboardPeriod; rank: number }
type PersonalBestHit = { score: number; gain: number | null }

type CelebPayload = {
  boards: BoardHit[]
  personalBest: PersonalBestHit | null
  books: RunAchievement[]
}

const PERIOD_ORDER: LeaderboardPeriod[] = ['all', 'monthly', 'weekly', 'daily']
const TOP_TEN = 10

function rankedPeriods(
  ranks?: Partial<Record<LeaderboardPeriod, number>>,
): BoardHit[] {
  if (!ranks) return []
  return PERIOD_ORDER.flatMap((period) => {
    const rank = ranks[period]
    return rank != null && rank >= 1 && rank <= TOP_TEN ? [{ period, rank }] : []
  })
}

function buildCelebration(
  score: number,
  priorAllTime: number,
  ranks?: Partial<Record<LeaderboardPeriod, number>>,
): CelebPayload | null {
  const boards = rankedPeriods(ranks)
  const personalBest =
    score > priorAllTime
      ? {
          score,
          gain: priorAllTime > 0 ? score - priorAllTime : null,
        }
      : null
  const pendingBooks = peekRunAchievements()
  if (!boards.length && !personalBest && !pendingBooks.length) return null
  return { boards, personalBest, books: takeRunAchievements() }
}

function awardCards(payload: CelebPayload): {
  id: string
  kind: 'board' | 'best' | 'book'
  label: string
  value: string
  detail: string | null
  featured: boolean
}[] {
  const featuredId = (() => {
    const allTimeFirst = payload.boards.find((b) => b.period === 'all' && b.rank === 1)
    if (allTimeFirst) return `board-${allTimeFirst.period}`
    const anyFirst = payload.boards.find((b) => b.rank === 1)
    if (anyFirst) return `board-${anyFirst.period}`
    if (payload.personalBest) return 'best'
    const bestBoard = payload.boards.reduce<BoardHit | null>((best, row) => {
      if (!best || row.rank < best.rank) return row
      return best
    }, null)
    if (bestBoard) return `board-${bestBoard.period}`
    if (payload.books[0]) return `book-0`
    return null
  })()

  const cards = [
    ...payload.boards.map((board) => ({
      id: `board-${board.period}`,
      kind: 'board' as const,
      label: PERIOD_LABELS[board.period],
      value: `#${board.rank}`,
      detail: board.rank === 1 ? 'Top of the board' : 'Top 10',
      featured: featuredId === `board-${board.period}`,
    })),
    ...(payload.personalBest
      ? [
          {
            id: 'best',
            kind: 'best' as const,
            label: 'Personal best',
            value: String(payload.personalBest.score),
            detail:
              payload.personalBest.gain != null
                ? `+${payload.personalBest.gain}`
                : 'New mark',
            featured: featuredId === 'best',
          },
        ]
      : []),
    ...payload.books.map((book, i) => ({
      id: `book-${i}`,
      kind: 'book' as const,
      label: 'Record book',
      value: book.rank != null ? `#${book.rank}` : 'Set',
      detail: book.label,
      featured: featuredId === `book-${i}`,
    })),
  ]

  return cards
}

function AwardBadge({ kind }: { kind: 'board' | 'best' | 'book' }) {
  if (kind === 'best') {
    return (
      <svg className="score-celeb__badge-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.2 14.4 9l6.1.5-4.6 4 1.5 5.9L12 16.4 6.6 19.4l1.5-5.9-4.6-4L9.6 9 12 3.2z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (kind === 'book') {
    return (
      <svg className="score-celeb__badge-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.2l-5.2-2.4L7.5 19.2V7A2.5 2.5 0 0 1 10 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 4.5H6.8A1.8 1.8 0 0 0 5 6.3V18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg className="score-celeb__badge-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 20h10M8.5 20v-3.2A5.2 5.2 0 0 1 12 12.2a5.2 5.2 0 0 1 3.5 4.6V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 8.2a3.8 3.8 0 1 1 7.6 0c0 2.2-1.8 3.6-3.8 3.6S8.2 10.4 8.2 8.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
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
  payload,
  onDone,
}: {
  payload: CelebPayload
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const cards = awardCards(payload)
  const count = cards.length

  const close = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onDone, 320)
  }

  return createPortal(
    <div
      className={`score-celeb${leaving ? ' score-celeb--out' : ''}`}
      role="dialog"
      aria-label="Run celebration"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FireworksCanvas />
      <div className="score-celeb__shell">
        <p className="score-celeb__kicker">Nice run</p>
        <h2 className="score-celeb__title">
          {count === 1 ? 'You earned this' : `${count} awards`}
        </h2>
        <div
          className={`score-celeb__awards score-celeb__awards--${Math.min(count, 4)}`}
          aria-label="Awards"
        >
          {cards.map((card, i) => (
            <article
              key={card.id}
              className={`score-celeb__award score-celeb__award--${card.kind}${card.featured ? ' score-celeb__award--featured' : ''}`}
              style={{ animationDelay: `${0.08 + i * 0.07}s` }}
            >
              <span className="score-celeb__badge" aria-hidden="true">
                <AwardBadge kind={card.kind} />
              </span>
              <span className="score-celeb__award-label">{card.label}</span>
              <strong className="score-celeb__award-value">{card.value}</strong>
              {card.detail ? (
                <span className="score-celeb__award-detail">{card.detail}</span>
              ) : null}
            </article>
          ))}
        </div>
        <button type="button" className="score-celeb__btn" onClick={close}>
          Continue
        </button>
      </div>
    </div>,
    document.body,
  )
}

function cleanName(raw: string) {
  return normalizePlayerName(raw)
}

function boardsHref(gameSlug: string) {
  return gameHref(gameSlug)
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
  const [celeb, setCeleb] = useState<CelebPayload | null>(null)
  const [celebPending, setCelebPending] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)
  const celebShown = useRef(false)
  const celebTimer = useRef(0)
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
    celebShown.current = true
    setCelebPending(true)
    window.clearTimeout(celebTimer.current)
    /* Brief settle so late record-book posts from this run can land. */
    celebTimer.current = window.setTimeout(() => {
      const payload = buildCelebration(score, allTime, nextRanks)
      setCelebPending(false)
      if (!payload) {
        celebShown.current = false
        return
      }
      setCeleb(payload)
    }, 400)
  }

  useEffect(() => {
    let cancelled = false
    savedRef.current = false
    celebShown.current = false
    window.clearTimeout(celebTimer.current)
    setCeleb(null)
    setCelebPending(false)
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
          const books = peekRunAchievements()
          if (books.length) {
            openCelebration(recordRef.current, undefined)
          } else {
            takeRunAchievements()
          }
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
        void refreshGlobalRank()
        setRanks(saved.ranks)
        savedRef.current = true
        setPhase('saved')
        openCelebration(recordRef.current, saved.ranks)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
          setPhase('needName')
          setError(
            'That gamer tag is taken. Sign in or pick another.',
          )
          return
        }
        setError(err instanceof Error ? err.message : 'Could not save score')
        setPhase('error')
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(celebTimer.current)
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
      void refreshGlobalRank()
      setRanks(saved.ranks)
      savedRef.current = true
      setPhase('saved')
      openCelebration(recordRef.current, saved.ranks)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError(
          'That gamer tag is taken. Sign in or pick another.',
        )
        setPhase('needName')
        return
      }
      setError(err instanceof Error ? err.message : 'Could not save score')
      setPhase('error')
    }
  }

  const celebrating = Boolean(celeb) || celebPending
  const pending = phase === 'checking' || phase === 'saving' || celebPending
  const showResults = !celebrating && !pending

  return (
    <>
      {celeb && (
        <ScoreCelebration payload={celeb} onDone={() => setCeleb(null)} />
      )}
      {pending && !celeb && (
        <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
          <p className="score-save__note">
            {phase === 'checking'
              ? 'Checking boards…'
              : phase === 'saving'
                ? 'Saving…'
                : 'Nice run…'}
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
            <span className="score-save__label">Gamer tag</span>
            <input
              ref={nameInputRef}
              className="score-save__input"
              value={nameDraft}
              maxLength={PLAYER_NAME_MAX}
              placeholder="YOU"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setNameDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))}
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
            <a href={boardsHref(gameSlug)}>Leaderboard</a>
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
