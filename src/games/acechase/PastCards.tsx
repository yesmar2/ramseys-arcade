import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { TicketGlyph } from '../../components/prizes/Ticket'
import { TagSlots } from '../../components/RunReport'
import { useAuth } from '../../hooks/useAuth'
import { gameArchiveHref, navigate, prizesHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { linkCurrentNameToAccount } from '../../lib/auth'
import { PLACE_NAME, type DailySolved, type TodaysHole } from '../../lib/dailyHole'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../../lib/leaderboard'
import { pastHoleAnswer, sendPastResult, type HoleBoard, type PastHoleResult, type PastProgress } from '../../lib/pastHoles'
import { ordinal } from '../../lib/scoreboard'

/*
 * A past hole's two cards (/games/acechase/play?hole=day:YYYY-MM-DD, from the archive): the one it opens
 * on, and the one a bullseye brings up. Every hole keeps a board of its own for good (lib/pastHoles.ts): a
 * player with no result on it yet plays it for one, and their first bullseye goes on its board, signed in;
 * with one already, from its day or since, it's practice. As on Today's Hole, the buttons are the only way
 * on.
 */

const SLUG = 'acechase'
/** What taking a past hole's record pays, once a hole: the API's tickets.ts RECORD_TICKETS. */
const RECORD_TICKETS = 15

const dayWords = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="game-card acechase-daily"
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

/** "Hole #9 · Thu, Oct 3", the day it was. */
function kicker(hole: TodaysHole): string {
  return `Hole #${hole.n} · ${dayWords.format(new Date(`${hole.day}T12:00:00Z`))}`
}

/** The hole's record, from its board. */
function recordWords(record: { name: string; tries: number } | null | undefined, known: boolean): string {
  if (record) return `${record.name} · ${triesWords(record.tries)}`
  return known ? 'Nobody yet' : '…'
}

function Archive() {
  return (
    <a className="acechase-daily__archive" href={gameArchiveHref(SLUG)}>
      Past holes ›
    </a>
  )
}

/** The card a past hole opens on: its record, where you stand, and how its board works. */
export function PastStartCard({
  hole,
  progress,
  solved,
  board,
  onStart,
  onPractice,
}: {
  hole: TodaysHole
  progress: PastProgress | null
  /** This device's result on it, from its day or since. */
  solved: DailySolved | null
  board: HoleBoard | null
  onStart: () => void
  onPractice: () => void
}) {
  const { signedIn } = useAuth()
  const you = board?.you ?? null
  const done = Boolean(you || solved)
  const tries = progress?.tries ?? 0
  return (
    <Card label={`${hole.def.name}, a past hole`}>
      <div className="game-card__head">
        <span className="game-card__kicker">{kicker(hole)} · past hole</span>
        <h2 className="game-card__title game-card__title--big">{hole.def.name}</h2>
        <p className="game-card__blurb">
          On {PLACE_NAME[hole.pick.style]}. {hole.def.note}
        </p>
      </div>
      <p className="acechase-daily__rules">
        {done
          ? 'Your result here stands. Play it again for practice: that doesn’t count.'
          : `Its board stays open. Every try counts, even if you leave and come back, and your first bullseye goes on it. Taking its record pays ${RECORD_TICKETS} tickets.`}
      </p>
      <div className="game-pause-meta">
        <Row label="Hole record">{recordWords(board?.entries[0], board !== null)}</Row>
        <Row label="You">
          {you
            ? `${triesWords(you.tries)} · ${ordinal(you.place)} of ${board!.players}`
            : solved
              ? `Bullseye in ${solved.tries}`
              : tries > 0
                ? `${triesWords(tries)} so far`
                : 'Not played yet'}
        </Row>
      </div>
      {!signedIn && !done ? <p className="game-card__hint">Sign in to put your result on its board.</p> : null}
      <div className="game-card__actions">
        {done ? (
          <button type="button" className="panel__btn" onClick={onPractice}>
            Play it again · doesn&rsquo;t count
          </button>
        ) : (
          <button type="button" className="panel__btn" onClick={onStart}>
            {tries > 0 ? 'Carry on' : 'Start'}
          </button>
        )}
      </div>
      <Archive />
    </Card>
  )
}

/** What became of a past hole's result: on its board, or why not yet. */
type Send =
  | { phase: 'waiting' }
  | { phase: 'sending' }
  | { phase: 'done'; answer: PastHoleResult }
  | { phase: 'signedOut' }
  | { phase: 'noTag' }
  | { phase: 'failed'; error: string }

/** Signed in with no tag yet: a tag puts the result on the hole's board, which the card then does. */
function HoleTag() {
  const id = useId()
  const [draft, setDraft] = useState(() => getLastPlayerName())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = normalizePlayerName(draft)
  const submit = async () => {
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await linkCurrentNameToAccount(name)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'That tag didn’t work. Try another.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="acechase-daily__tag">
      <TagSlots id={id} value={draft} onChange={setDraft} onSubmit={() => void submit()} lead="Put your tag on it and it goes on the hole’s board." error={error} />
      <button type="button" className="panel__btn" disabled={!name || busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Put it on the board'}
      </button>
    </div>
  )
}

/**
 * The card a past hole's bullseye brings up. The first one's result goes on the hole's board, signed in
 * with a tag, sent from here (once: lib/pastHoles.ts); after that, a bullseye is practice.
 */
export function PastResultCard({
  hole,
  tries,
  practice,
  solved,
  board,
  onSent,
  onPractice,
  onLeave,
}: {
  hole: TodaysHole
  /** The bullseye's tries. */
  tries: number
  practice: boolean
  /** The hole's result on this device, to send if it hasn't gone. */
  solved: (DailySolved & { sent?: boolean }) | null
  board: HoleBoard | null
  onSent: () => void
  onPractice: () => void
  onLeave: () => void
}) {
  const { signedIn, loading } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const [send, setSend] = useState<Send>(() => {
    const answer = pastHoleAnswer(hole.day)
    return answer ? { phase: 'done', answer } : { phase: 'waiting' }
  })
  const shown = useRef(true)
  const sentRef = useRef(onSent)
  sentRef.current = onSent

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (practice || loading || send.phase === 'done' || send.phase === 'sending') return
    if (!solved || solved.sent) return
    if (!signedIn) {
      setSend({ phase: 'signedOut' })
      return
    }
    if (!name) {
      setSend({ phase: 'noTag' })
      return
    }
    setSend({ phase: 'sending' })
    sendPastResult(hole.day, solved).then(
      (answer) => {
        if (answer) sentRef.current()
        if (!shown.current) return
        setSend(answer ? { phase: 'done', answer } : { phase: 'noTag' })
      },
      (err: unknown) => {
        if (!shown.current) return
        const code = err instanceof ApiError ? err.code : undefined
        if (code === 'AUTH_REQUIRED') setSend({ phase: 'signedOut' })
        else setSend({ phase: 'failed', error: err instanceof Error && err.message ? err.message : 'That result didn’t go on the board. It tries again next time.' })
      },
    )
    // The send's own phase changes aren't a reason to send again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, loading, signedIn, name, solved, hole.day])

  const answer = send.phase === 'done' ? send.answer : null
  const record = answer ? answer.record : (board?.entries[0] ?? null)
  const you = answer ? answer.you : (board?.you ?? null)
  const players = answer ? answer.players : (board?.players ?? 0)
  const title = practice ? 'That one didn’t count' : tries === 1 ? 'First try!' : `Bullseye in ${tries}`

  let status: ReactNode = null
  if (practice) status = null
  else if (send.phase === 'sending' || (send.phase === 'waiting' && solved && !solved.sent)) status = <p className="game-card__hint">Putting it on the hole’s board…</p>
  else if (answer?.tookRecord) status = <p className="acechase-past__news">Hole record! Nobody has done it in fewer.</p>
  else if (answer && !answer.kept) status = <p className="game-card__hint">You had a result here already, which stands.</p>
  else if (answer && you) status = <p className="game-card__hint">On the hole’s board: {ordinal(you.place)} of {players}.</p>
  else if (send.phase === 'signedOut')
    status = (
      <div className="acechase-daily__signin">
        <p>Sign in and this result goes on the hole’s board.</p>
        <GoogleSignInButton />
      </div>
    )
  else if (send.phase === 'noTag') status = <HoleTag />
  else if (send.phase === 'failed') status = <p className="panel__error">{send.error}</p>

  return (
    <Card label={`${hole.def.name}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">{kicker(hole)} · past hole</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">
          {practice && you ? `Your result here stands: ${triesWords(you.tries)}.` : `${hole.def.name}, on ${PLACE_NAME[hole.pick.style]}.`}
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Hole record">{recordWords(record, answer !== null || board !== null)}</Row>
        <Row label="You">{you ? `${triesWords(you.tries)} · ${ordinal(you.place)} of ${players}` : '–'}</Row>
      </div>
      {status}
      {answer?.tickets?.earned ? (
        <p className="acechase-daily__tix">
          <TicketGlyph size={20} />
          <span>
            <b>+{answer.tickets.earned} tickets</b> for the hole record.{' '}
            <a
              href={prizesHref()}
              onClick={(e) => {
                e.preventDefault()
                navigate(prizesHref())
              }}
            >
              Prize counter ›
            </a>
          </span>
        </p>
      ) : null}
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onPractice}>
          Play it again · doesn&rsquo;t count
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to the archive
        </button>
      </div>
    </Card>
  )
}
