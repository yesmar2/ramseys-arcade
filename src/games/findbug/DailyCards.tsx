import { useEffect, useState, type ReactNode } from 'react'
import { copyText } from '../../components/ShareBoardButton'
import { gameArchiveHref, todayShareHref } from '../../hooks/useHashRoute'
import { archiveDayWords } from '../../lib/archive'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { ordinal } from '../../lib/profileMath'
import {
  dayNumber,
  DAY_SCENES,
  msUntilNextDay,
  sceneMark,
  shareText,
  type DayResult,
  type DayRun,
} from './daily'
import { BugPortrait } from './Portrait'
import { formatFindbugBoardScore, formatFindbugMs } from './score'
import type { TodayBoard } from './todayBoard'
import type { WantedBug } from './wanted'

/*
 * Today's Wanted's cards, in the panel kit like every game's start and score cards: the one the day
 * opens on (Start, Carry on, or how the day went), and the ones for playing a day again as practice,
 * today's or a past one's from the archive. Their buttons are the only way on; a tap elsewhere on them
 * does nothing, since there's more than one thing to do. The day's first run ends on the usual save card.
 */

const SLUG = 'findbug'

function untilNext(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** When the next day's scenes come, kept fresh. */
function NextDay() {
  const [ms, setMs] = useState(() => msUntilNextDay())
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilNextDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return <p className="game-card__hint findbug-daily__next">New scenes in {untilNext(ms)}</p>
}

/** Each square as the share line has it: its look here, and what it says. */
const MARKS: Record<ReturnType<typeof sceneMark>, { kind: string; words: string }> = {
  '🟩': { kind: 'clean', words: 'found before any hint' },
  '🟨': { kind: 'wide', words: 'found with the wide hint' },
  '🟧': { kind: 'tight', words: 'found with the tight hint' },
  '🟥': { kind: 'miss', words: 'not found' },
}

/** A square a scene, with its time: found before any hint, with the wide one, with the tight one, or not at all. */
export function SceneSquares({ times }: { times: readonly number[] }) {
  if (!times.length) return null
  return (
    <div
      className="findbug-daily__squares"
      role="img"
      aria-label={times.map((ms, i) => `Scene ${i + 1}: ${MARKS[sceneMark(ms)].words}`).join(', ')}
    >
      {times.map((ms, i) => (
        <span key={i} className={`findbug-daily__square findbug-daily__square--${MARKS[sceneMark(ms)].kind}`}>
          {ms >= 60_000 ? '–' : formatFindbugMs(ms)}
        </span>
      ))}
    </div>
  )
}

/** Who's wanted on the day: five faces, each with its name. */
export function WantedLineup({ wanted, size = 44 }: { wanted: readonly WantedBug[]; size?: number }) {
  return (
    <ul className="findbug-daily__lineup" aria-label={`Wanted: ${wanted.map((w) => w.name).join(', ')}`}>
      {wanted.map((w, i) => (
        <li key={`${w.id}-${i}`}>
          <BugPortrait look={w.look} size={size} crop="head" className="findbug-daily__face" />
          <span>{w.name.replace(/^the /, '')}</span>
        </li>
      ))}
    </ul>
  )
}

/** Send the day on: the phone's own share sheet, or copied to paste anywhere. */
export function ShareDay({ day, result, className = 'panel__btn' }: { day: string; result: DayResult; className?: string }) {
  const [copied, setCopied] = useState(false)
  const share = () => {
    // The day's own link, which unfurls into the day's card and opens at today's ticket.
    const text = `${shareText(day, result)}\n${window.location.origin}${todayShareHref(day)}`
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      navigator.share({ text }).catch(() => {})
      return
    }
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => copyText(text) && done())
    else if (copyText(text)) done()
  }
  return (
    <button type="button" className={className} onClick={share}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      ref={fitCardToSpace}
      className="game-card findbug-daily"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="game-pause-meta__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

/** Where today stands for everyone, and for you once you're on it. */
function todayWords(board: TodayBoard | null): string | null {
  if (!board) return null
  if (board.you) return `${ordinal(board.you.place)} of ${board.count}`
  if (!board.leader) return 'Nobody yet'
  return `${board.leader.name} leads, ${formatFindbugBoardScore(board.leader.score)}`
}

function resultWords(result: DayResult): string {
  const found = result.found != null ? ` · found ${result.found} of ${DAY_SCENES}` : ''
  return `${formatFindbugMs(result.ms)}${found}`
}

/** The card the day opens on: who's wanted and Start; Carry on for a run left halfway; how the day went once it's done. */
export function TodayCard({
  day,
  wanted,
  run,
  board,
  onStart,
  onPractice,
  onSave,
}: {
  day: string
  wanted: readonly WantedBug[]
  run: DayRun | null
  board: TodayBoard | null
  onStart: () => void
  onPractice: () => void
  /** Put a finished first run on the board, when it isn't: it was played signed out, or its save didn't land. */
  onSave: () => void
}) {
  const n = dayNumber(day)
  const result = run?.result
  const at = !result ? run?.at : undefined
  const started = Boolean(run && !result)
  const offBoard = result && board && !board.you && result.found != null
  return (
    <Card label={`Today's Wanted #${n}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Today&rsquo;s Wanted #{n} · {archiveDayWords(day)}
        </span>
        <h2 className="game-card__title game-card__title--big">Find the Bug</h2>
      </div>
      <WantedLineup wanted={wanted} />
      <p className="findbug-daily__rules">
        {started
          ? 'Your run today is waiting where you left it. The clock picks up where it stopped.'
          : result
            ? 'That’s your result for today. Play the day again as much as you like: it won’t count.'
            : 'Five scenes and a bug wanted in each, the same for everyone today. Your first run is your result, and the clock waits if you leave.'}
      </p>
      <div className="game-pause-meta">
        <Row label="You">
          {result ? resultWords(result) : at ? `Scene ${Math.min(DAY_SCENES, at.index + 1)} of ${DAY_SCENES} · ${formatFindbugMs(at.bankedMs + at.sceneMs)} so far` : started ? 'Started' : 'Not played yet'}
        </Row>
        {todayWords(board) ? <Row label="Today">{todayWords(board)}</Row> : null}
      </div>
      {result?.times ? <SceneSquares times={result.times} /> : null}
      <div className="game-card__actions">
        {result ? (
          <>
            {offBoard ? (
              <button type="button" className="panel__btn" onClick={onSave}>
                Put it on today&rsquo;s board
              </button>
            ) : null}
            <ShareDay day={day} result={result} className={offBoard ? 'panel__btn panel__btn--ghost' : 'panel__btn'} />
            <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice}>
              Play it again · doesn&rsquo;t count
            </button>
          </>
        ) : (
          <button type="button" className="panel__btn" onClick={onStart} autoFocus>
            {started ? 'Carry on' : 'Start'}
          </button>
        )}
      </div>
      <NextDay />
      <a className="findbug-daily__archive" href={gameArchiveHref(SLUG)}>
        Past days ›
      </a>
    </Card>
  )
}

/** The card a past day opens on, from the archive: who was wanted, and Start. */
export function PastDayCard({ day, wanted, onStart, onLeave }: { day: string; wanted: readonly WantedBug[]; onStart: () => void; onLeave: () => void }) {
  const n = dayNumber(day)
  return (
    <Card label={`Wanted #${n}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Wanted #{n} · {archiveDayWords(day)} · from the archive
        </span>
        <h2 className="game-card__title game-card__title--big">Find the Bug</h2>
      </div>
      <WantedLineup wanted={wanted} />
      <p className="findbug-daily__rules">
        A past day&rsquo;s five scenes, to play again. Nothing here is kept, so it counts for no board or tickets.
      </p>
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onStart} autoFocus>
          Start
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to the archive
        </button>
      </div>
    </Card>
  )
}

/** The end of a run that doesn't count: today's played again, or a past day's. */
export function PracticeCard({
  day,
  today,
  run,
  standing,
  onAgain,
  onLeave,
}: {
  day: string
  /** Today's scenes played again, rather than a past day's. */
  today: boolean
  run: DayResult
  /** Today's result, which this one doesn't change. */
  standing: DayResult | null
  onAgain: () => void
  onLeave: () => void
}) {
  const n = dayNumber(day)
  const found = run.found ?? 0
  const title = found === DAY_SCENES ? 'Found every one' : `Found ${found} of ${DAY_SCENES}`
  return (
    <Card label={`${today ? 'Today’s ' : ''}Wanted #${n}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          {today ? `Today’s Wanted #${n} · practice` : `Wanted #${n} · ${archiveDayWords(day)} · from the archive`}
        </span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">
          {formatFindbugMs(run.ms)} this time.{' '}
          {today ? (standing ? `Your result today stands: ${formatFindbugMs(standing.ms)}.` : 'It doesn’t count.') : 'Nothing here is kept.'}
        </p>
      </div>
      {run.times ? <SceneSquares times={run.times} /> : null}
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onAgain} autoFocus>
          Play again
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          {today ? 'Back to today’s' : 'Back to the archive'}
        </button>
      </div>
    </Card>
  )
}
