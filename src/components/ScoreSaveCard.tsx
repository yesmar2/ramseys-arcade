import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gameHref, recordsHref, recordsIndexHref } from '../hooks/useHashRoute'
import {
  addLeaderboardScore,
  ApiError,
  fetchGlobalRank,
  fetchPlayerBests,
  getLastPlayerName,
  normalizePlayerName,
  PERIOD_LABELS,
  PLAYER_NAME_MAX,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { describePersonalBest, rememberPersonalBest } from '../lib/personalBest'
import { refreshGlobalRank } from '../lib/globalRank'
import { gameHasRecords } from '../lib/records'
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

export type CelebPayload = {
  boards: BoardHit[]
  personalBest: PersonalBestHit | null
  books: RunAchievement[]
}

export type RankClimb = {
  from: number | null
  to: number
  gained: number | null
}

export function booksCelebrationPayload(books: RunAchievement[]): CelebPayload {
  return { boards: [], personalBest: null, books }
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

/** Global ranking climb (lower place number is better). */
export function pickGlobalRankClimb(
  previous: number | null | undefined,
  next: number | null | undefined,
): RankClimb | null {
  if (next == null || !(next >= 1)) return null
  const from = previous != null && previous >= 1 ? previous : null
  if (from != null && next >= from) return null
  return {
    from,
    to: next,
    gained: from != null ? from - next : null,
  }
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

export function ScoreCelebration({
  payload,
  onDone,
  kicker = 'Nice run',
}: {
  payload: CelebPayload
  onDone: () => void
  kicker?: string
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
        <p className="score-celeb__kicker">{kicker}</p>
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

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function RankUpCelebration({
  climb,
  onDone,
}: {
  climb: RankClimb
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const [settled, setSettled] = useState(false)
  const reelRef = useRef<HTMLDivElement>(null)
  const numberRef = useRef<HTMLElement>(null)
  const startRank =
    climb.from ?? Math.min(99, climb.to + Math.max(4, Math.min(18, climb.gained ?? 8)))
  /** Keep the reel short so long climbs stay smooth. */
  const scrollFrom = Math.min(startRank, climb.to + 24)
  const steps = Math.max(1, scrollFrom - climb.to)
  /** Pad so the first/last ranks can sit centered in the viewport. */
  const pad = 2
  const ranks = useMemo(() => {
    const list: number[] = []
    for (let r = scrollFrom + pad; r >= Math.max(1, climb.to - pad); r--) {
      list.push(r)
    }
    return list
  }, [climb.to, pad, scrollFrom])

  useEffect(() => {
    const reel = reelRef.current
    const numberEl = numberRef.current
    const viewport = reel?.parentElement
    if (!reel || !numberEl || !viewport) return

    const rowH = viewport.clientHeight / 5
    const startIndex = ranks.indexOf(scrollFrom)
    const endIndex = ranks.indexOf(climb.to)
    if (startIndex < 0 || endIndex < 0 || !(rowH > 0)) {
      numberEl.textContent = `#${climb.to}`
      setSettled(true)
      return
    }

    const offsetFor = (index: number) => (2 - index) * rowH

    const apply = (index: number, rank: number) => {
      reel.style.transform = `translate3d(0, ${offsetFor(index)}px, 0)`
      numberEl.textContent = `#${rank}`
    }

    if (prefersReducedMotion() || steps <= 1) {
      apply(endIndex, climb.to)
      setSettled(true)
      return
    }

    apply(startIndex, scrollFrom)
    let raf = 0
    const duration = Math.min(2200, Math.max(1100, 700 + steps * 90))
    const t0 = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const eased = easeOutCubic(t)
      const index = startIndex + (endIndex - startIndex) * eased
      const rank = Math.round(scrollFrom + (climb.to - scrollFrom) * eased)
      apply(index, Math.max(climb.to, Math.min(scrollFrom, rank)))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      apply(endIndex, climb.to)
      setSettled(true)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [climb.to, ranks, scrollFrom, steps])

  const close = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onDone, 320)
  }

  const detail =
    climb.from == null
      ? 'New global ranking'
      : climb.gained != null && climb.gained > 0
        ? `Up ${climb.gained} place${climb.gained === 1 ? '' : 's'}`
        : 'New global ranking'

  return createPortal(
    <div
      className={`score-celeb rank-up${leaving ? ' score-celeb--out' : ''}${settled ? ' rank-up--settled' : ''}`}
      role="dialog"
      aria-label="Global rank up celebration"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FireworksCanvas />
      <div className="score-celeb__shell rank-up__shell">
        <p className="score-celeb__kicker">Global ranking</p>
        <h2 className="score-celeb__title">Rank up</h2>
        <div className="rank-up__stage">
          <div className="rank-up__viewport" aria-hidden="true">
            <div className="rank-up__focus" />
            <div ref={reelRef} className="rank-up__reel">
              {ranks.map((rank) => (
                <div key={rank} className="rank-up__rung">
                  <span>#{rank}</span>
                </div>
              ))}
            </div>
          </div>
          <strong
            ref={numberRef}
            className="rank-up__number"
            aria-live="polite"
          >
            #{scrollFrom}
          </strong>
          <p className="rank-up__detail">{detail}</p>
          {climb.from != null ? (
            <p className="rank-up__from">
              From <span>#{climb.from}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="score-celeb__btn"
          onClick={close}
          disabled={!settled}
        >
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

function recordBooksHref(gameSlug: string) {
  return gameHasRecords(gameSlug) ? recordsHref(gameSlug) : recordsIndexHref()
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
  const [rankClimb, setRankClimb] = useState<RankClimb | null>(null)
  const [celeb, setCeleb] = useState<CelebPayload | null>(null)
  const [celebPending, setCelebPending] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)
  const celebShown = useRef(false)
  const celebTimer = useRef(0)
  const pendingAwards = useRef<CelebPayload | null>(null)
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

  const openAwardCelebration = (payload: CelebPayload | null) => {
    pendingAwards.current = null
    if (!payload) {
      celebShown.current = false
      return
    }
    setCeleb(payload)
  }

  const openCelebration = (
    allTime: number,
    nextRanks?: Partial<Record<LeaderboardPeriod, number>>,
    climb?: RankClimb | null,
  ) => {
    if (celebShown.current) return
    celebShown.current = true
    setCelebPending(true)
    window.clearTimeout(celebTimer.current)
    /* Brief settle so late record-book posts from this run can land. */
    celebTimer.current = window.setTimeout(() => {
      const payload = buildCelebration(score, allTime, nextRanks)
      setCelebPending(false)
      if (climb) {
        pendingAwards.current = payload
        setRankClimb(climb)
        return
      }
      openAwardCelebration(payload)
    }, 400)
  }

  const finishRankClimb = () => {
    setRankClimb(null)
    openAwardCelebration(pendingAwards.current)
  }

  const saveAndCelebrate = async (name: string, isCancelled?: () => boolean) => {
    let priorGlobalRank: number | null = null
    try {
      priorGlobalRank = (await fetchGlobalRank(name)).rank
    } catch {
      /* climb detection best-effort */
    }
    if (isCancelled?.()) return
    const saved = await addLeaderboardScore(gameSlug, name, score)
    if (isCancelled?.()) return
    rememberPersonalBest(gameSlug, Math.max(recordRef.current, score))
    let nextGlobalRank: number | null = null
    try {
      nextGlobalRank = (await fetchGlobalRank(name)).rank
    } catch {
      /* ignore */
    }
    if (isCancelled?.()) return
    void refreshGlobalRank()
    setRanks(saved.ranks)
    savedRef.current = true
    setPhase('saved')
    const climb = pickGlobalRankClimb(priorGlobalRank, nextGlobalRank)
    openCelebration(recordRef.current, saved.ranks, climb)
  }

  useEffect(() => {
    let cancelled = false
    savedRef.current = false
    celebShown.current = false
    pendingAwards.current = null
    window.clearTimeout(celebTimer.current)
    setRankClimb(null)
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
            openCelebration(recordRef.current, undefined, null)
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
        await saveAndCelebrate(name, () => cancelled)
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
      await saveAndCelebrate(name)
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

  const celebrating = Boolean(rankClimb) || Boolean(celeb) || celebPending
  const pending = phase === 'checking' || phase === 'saving' || celebPending
  const showResults = !celebrating && !pending

  return (
    <>
      {rankClimb ? (
        <RankUpCelebration climb={rankClimb} onDone={finishRankClimb} />
      ) : null}
      {celeb && !rankClimb ? (
        <ScoreCelebration payload={celeb} onDone={() => setCeleb(null)} />
      ) : null}
      {pending && !celeb && !rankClimb && (
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
            <a href={boardsHref(gameSlug)}>Boards</a>
            <a href={recordBooksHref(gameSlug)}>Record Books</a>
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
