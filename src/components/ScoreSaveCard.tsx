import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { gameBoardHref, gameHref, navigate, recordsHref } from '../hooks/useHashRoute'
import { linkCurrentNameToAccount } from '../lib/auth'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { scoreText, scoreUnit } from '../lib/gameBoard'
import {
  ApiError,
  fetchPlayerBests,
  getLastPlayerName,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import {
  isRunAssisted,
  takeRunAchievements,
  whenRunAchievementsSettled,
  type RunAchievement,
} from '../lib/runAchievements'
import {
  composeReport,
  readBookFacts,
  saveRunForReport,
  wouldPlaceOnBoard,
  type RunReportData,
} from '../lib/runReport'
import { periodCopy } from '../lib/scoreboard'
import { medalKind, PodiumMedal } from './PodiumMedal'
import { ReportSignIn, ReportWho, RunReport, TagSlots, type ReportAction, type ReportLink } from './RunReport'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  /** The run's own words for how it ended: Ship down, Run over. */
  title: string
  subtitle?: string
  /** Best at the start of this run, before the engine saved a new record. */
  previousBest?: number
  onDone: () => void
}

type Phase = 'checking' | 'needAuth' | 'needName' | 'saving' | 'saved' | 'assisted' | 'error'

/** Where a failed save leaves the card, and what it says. */
function afterFailure(err: unknown): { phase: Phase; error: string | null } {
  // Signed out after all: the sign-in's own words already say it.
  if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') return { phase: 'needAuth', error: null }
  if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
    return { phase: 'needName', error: 'That gamer tag is taken. Pick another.' }
  }
  return { phase: 'error', error: err instanceof Error ? err.message : 'Could not save score' }
}

/** Leave the play overlay and open an in-app route. */
function leavePlayTo(href: string) {
  navigate(href)
}

function boardsHref(gameSlug: string, period: LeaderboardPeriod) {
  if ((LEADERBOARD_GAMES as readonly string[]).includes(gameSlug)) {
    return gameBoardHref(gameSlug as LeaderboardGame, period)
  }
  return gameHref(gameSlug)
}

/**
 * The end of a run: one report, saved and told in the same card.
 *
 * The card opens on the score at once, with Play again ready; the save goes
 * on underneath and the lines fill in when it lands. Signed out, it says what
 * the run would win and offers the sign-in; signed in without a tag, it takes
 * one in slots. A run that used the admin stage jump is not saved at all.
 */
export function ScoreSaveCard({ gameSlug, score, title, subtitle, previousBest, onDone }: ScoreSaveProps) {
  const { signedIn, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  const canSaveScores = signedIn || Boolean(impersonation)
  const period = useDefaultPeriod()
  const [phase, setPhase] = useState<Phase>('checking')
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [report, setReport] = useState<RunReportData | null>(null)
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [wouldPlace, setWouldPlace] = useState<number | null>(null)
  const recordRef = useRef(previousBest ?? 0)
  const playRef = useRef<HTMLButtonElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const tagId = useId()

  const game = getGame(gameSlug)?.name ?? gameSlug
  const copy = periodCopy(period)
  const accentStyle = gameAccentStyle(gameSlug)
  const accent = String((accentStyle as Record<string, string>)['--celeb-accent'] ?? '#2eb8a0')

  useEffect(() => {
    if (phase === 'needName') tagRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    let cancelled = false
    setPhase('checking')
    setError(null)
    setReport(null)

    async function run() {
      if (authLoading) return
      const name = normalizePlayerName(getLastPlayerName())
      if (name) {
        try {
          const bests = await fetchPlayerBests(name)
          if (cancelled) return
          recordRef.current = bests[gameSlug] ?? 0
        } catch {
          /* keep this device's best */
        }
      }
      if (cancelled) return

      // Stage-jumped runs never reach a board or a record book: the score was
      // not earned, and nor were the record-book wins queued along the way.
      if (isRunAssisted()) {
        takeRunAchievements()
        setPhase('assisted')
        return
      }

      if (score <= 0) {
        // Nothing to save, but a record the run set still gets said.
        await whenRunAchievementsSettled()
        const hits: RunAchievement[] = takeRunAchievements()
        const books = name && hits.length ? await readBookFacts(gameSlug, name, hits) : []
        if (cancelled) return
        setReport(
          composeReport({
            slug: gameSlug,
            score,
            name,
            period,
            priorBest: recordRef.current,
            allTimeRank: null,
            priorAllTimeRank: null,
            board: null,
            overall: { before: null, after: null },
            books,
          }),
        )
        setPhase('saved')
        return
      }

      if (!canSaveScores) {
        setPhase('needAuth')
        return
      }
      if (!name) {
        setPhase('needName')
        return
      }
      setPhase('saving')
      const facts = await saveRunForReport({ slug: gameSlug, name, score, period, priorBest: recordRef.current })
      if (cancelled) return
      setSavedAs(facts.name)
      setReport(composeReport(facts))
      setPhase('saved')
    }

    run().catch((err: unknown) => {
      if (cancelled) return
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    })
    return () => {
      cancelled = true
    }
  }, [gameSlug, score, period, authLoading, canSaveScores])

  // Signed out or tagless: what the run would win, to lead the ask with.
  useEffect(() => {
    if (phase !== 'needAuth' && phase !== 'needName') return
    let cancelled = false
    void wouldPlaceOnBoard(gameSlug, period, score).then((place) => {
      if (!cancelled) setWouldPlace(place)
    })
    return () => {
      cancelled = true
    }
  }, [phase, gameSlug, period, score])

  const submitName = async () => {
    const name = normalizePlayerName(nameDraft)
    if (!name || phase === 'saving') return
    if (!canSaveScores) {
      setPhase('needAuth')
      return
    }
    setPhase('saving')
    setError(null)
    try {
      if (signedIn && !impersonation) await linkCurrentNameToAccount(name)
      const facts = await saveRunForReport({ slug: gameSlug, name, score, period, priorBest: recordRef.current })
      setSavedAs(facts.name)
      setReport(composeReport(facts))
      setPhase('saved')
    } catch (err) {
      const next = afterFailure(err)
      setError(next.error)
      setPhase(next.phase)
    }
  }

  const pending = phase === 'checking' || phase === 'saving'
  const data = phase === 'saved' ? report : null
  const tier = data?.tier ?? 'quiet'
  const ribbon = data?.ribbon ?? null
  const figure = formatLeaderboardScore(gameSlug, score)
  const unit = scoreUnit(gameSlug, score)
  const place = wouldPlace
  const winLead = place ? (
    <>
      Right now that’s{' '}
      <strong className={place === 1 ? 'report__win report__win--gold' : 'report__win'}>
        #{place} on {game} {copy.phrase}
      </strong>
      .
    </>
  ) : null

  const playAgain: ReportAction = { label: 'Play again', onClick: onDone, buttonRef: playRef }
  let primary = playAgain
  let secondary: ReportAction | null = null
  let block: ReactNode = null
  let who: ReactNode = null
  let links: ReportLink[] = []

  if (phase === 'needAuth') {
    block = (
      <ReportSignIn
        lead={
          <>
            Sign in and {scoreText(gameSlug, score)} goes on the boards. {winLead}
          </>
        }
        error={error}
        onSignedIn={() => {
          setError(null)
          setPhase('checking')
        }}
      />
    )
    who = <ReportWho text="Not saved yet" />
  } else if (phase === 'needName') {
    primary = {
      label: 'Save to the board',
      onClick: () => void submitName(),
      disabled: !normalizePlayerName(nameDraft),
    }
    secondary = { label: 'Skip', onClick: onDone }
    block = (
      <TagSlots
        id={tagId}
        value={nameDraft}
        onChange={setNameDraft}
        onSubmit={() => void submitName()}
        inputRef={tagRef}
        error={error}
        lead={
          place ? (
            <>
              {scoreText(gameSlug, score)} is{' '}
              <strong className={place === 1 ? 'report__win report__win--gold' : 'report__win'}>
                #{place} on {game} {copy.phrase}
              </strong>
              . Put your name on it.
            </>
          ) : (
            'Put your name on the boards.'
          )
        }
      />
    )
    who = <ReportWho text="Signed in, no tag yet" />
  } else if (phase === 'assisted') {
    block = <p className="report__note">Stage skip used, so this run wasn’t saved to the boards or the record books.</p>
    who = <ReportWho text="Not saved" />
  } else if (phase === 'error') {
    block = <p className="panel__error">{error}</p>
    who = <ReportWho text="Not saved" />
  } else if (pending) {
    who = <ReportWho name={getLastPlayerName() || null} text="Saving…" />
  } else if (savedAs) {
    who = <ReportWho name={savedAs} avatarId={data?.avatarId} text={`Saved as ${savedAs}`} />
  }

  if (phase === 'saved' || phase === 'assisted' || phase === 'error') {
    links = [{ label: `${game} board`, onClick: () => leavePlayTo(boardsHref(gameSlug, period)) }]
    if (gameHasRecords(gameSlug)) {
      links.push({ label: 'Record book', onClick: () => leavePlayTo(recordsHref(gameSlug)) })
    }
  }

  const lines = pending ? null : (data?.lines ?? [])
  const heading = ribbon?.text ?? title
  return (
    <RunReport
      label={`${heading}, ${scoreText(gameSlug, score)}`}
      titleId={titleId}
      style={accentStyle}
      accent={accent}
      initialFocus={phase === 'needName' ? tagRef : playRef}
      // Esc goes back to the start card, except while a tag is being typed.
      onEscape={phase === 'needName' ? undefined : onDone}
      tier={tier}
      ribbon={ribbon}
      eyebrow={title}
      score={figure}
      unit={unit}
      sub={ribbon ? [title, subtitle].filter(Boolean).join(' · ') : (subtitle ?? null)}
      scoreTone={data?.scoreTone ?? 'plain'}
      lines={phase === 'needAuth' || phase === 'needName' || phase === 'assisted' || phase === 'error' ? [] : lines}
      race={data?.race ?? null}
      primary={primary}
      secondary={secondary}
      who={who}
      links={links}
    >
      {block}
    </RunReport>
  )
}

/* ==========================================================================
   An event won away from the game: the bracket catch-up's overlay. The event
   takeover replaces it next.
   ========================================================================== */

export type CelebPayload = {
  /** Bracket match / tournament wins (fireworks overlay). */
  bracket: {
    champion: boolean
    matchWon: boolean
    opponent?: string | null
    eventTitle?: string
  } | null
}

export function bracketCelebrationPayload(opts: {
  champion: boolean
  matchWon: boolean
  opponent?: string | null
  eventTitle?: string
}): CelebPayload | null {
  if (!opts.champion && !opts.matchWon) return null
  return {
    bracket: {
      champion: opts.champion,
      matchWon: opts.matchWon,
      opponent: opts.opponent ?? null,
      eventTitle: opts.eventTitle,
    },
  }
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
  style,
}: {
  payload: CelebPayload
  onDone: () => void
  /** The game's colour for the shell; the overlay portals out of the game's tree and cannot inherit it. */
  style?: CSSProperties
}) {
  const [leaving, setLeaving] = useState(false)
  const b = payload.bracket
  const medal = b?.champion ? medalKind(1) : null

  const close = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onDone, 320)
  }

  return createPortal(
    <div
      className={`score-celeb${leaving ? ' score-celeb--out' : ''}`}
      style={style}
      role="dialog"
      aria-label="Run celebration"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FireworksCanvas />
      <div className="score-celeb__shell">
        <div className="score-celeb__awards score-celeb__awards--1" aria-label="Awards">
          {b ? (
            <article className="score-celeb__award score-celeb__award--tourney score-celeb__award--featured">
              {medal ? (
                <span className="score-celeb__award-icon">
                  <PodiumMedal kind={medal} size="md" />
                </span>
              ) : null}
              <span className="score-celeb__award-label">
                {b.champion ? b.eventTitle?.trim() || 'Tournament' : 'Match won'}
              </span>
              <strong className="score-celeb__award-value">{b.champion ? 'Champion' : 'Advance'}</strong>
              <span className="score-celeb__award-detail">
                {b.champion ? 'You won the bracket' : b.opponent ? `beat ${b.opponent}` : 'On to the next round'}
              </span>
            </article>
          ) : null}
        </div>
        <button type="button" className="score-celeb__btn" onClick={close}>
          Continue
        </button>
      </div>
    </div>,
    document.body,
  )
}
