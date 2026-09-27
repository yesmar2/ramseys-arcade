import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { TicketGlyph } from '../../components/prizes/Ticket'
import { ReportSignIn, TagSlots } from '../../components/RunReport'
import { useAuth } from '../../hooks/useAuth'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { gamePlayHref, navigate, prizesHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useSaveWait } from '../../hooks/useSaveWait'
import { linkCurrentNameToAccount } from '../../lib/auth'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../../lib/leaderboard'
import { ordinal } from '../../lib/scoreboard'
import { saveTrackLap, type TrackBoard, type TrackLapResult } from '../../lib/trackBoards'
import { dayWords, PLANNED_TRACKS, trackDay } from './daily'
import type { Course } from './lap'
import { formatLap, hotlapMsFromBoardScore } from './score'

/*
 * The cards of a track driven on another day than its own (/games/hotlap/play?track=<n>): the one it
 * opens on, and the one after a lap. A track still to come is a test drive, to look it over: its laps go
 * on no board and aren't kept past the tab. A track whose day has gone keeps a board of its own for good
 * (lib/trackBoards.ts): a lap on it goes there, signed in, and its cards show the record and your place.
 * The Track Book and the archive link to both.
 */

const SLUG = 'hotlap'
/** What taking a past track's record pays, once a track: the API's tickets.ts RECORD_TICKETS. */
const RECORD_TICKETS = 15

/** A track's test drive, by its number. */
function testDriveHref(n: number) {
  return `${gamePlayHref(SLUG)}?track=${n}`
}

/** When a track is the day's track, in words. */
function whenWords(day: string) {
  const today = trackDay()
  if (day === today) return 'Today’s track'
  return day > today ? `Comes ${dayWords(day)}` : `Was the track ${dayWords(day)}`
}

/** A lap on a board, as a time. */
const lapOf = (score: number) => formatLap(hotlapMsFromBoardScore(score) / 1000)

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** The tracks either side, and back to today's. A tap here isn't a tap to start. */
function TrackNav({ n }: { n: number }) {
  return (
    <nav className="hotlap-test__nav" aria-label="Other tracks">
      {n > 1 ? (
        <a href={testDriveHref(n - 1)} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={gamePlayHref(SLUG)} onPointerDown={holdPress}>
        Today’s track
      </a>
      {n < PLANNED_TRACKS ? (
        <a href={testDriveHref(n + 1)} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** A figure on a card; `wide` goes across it, for a record's holder and time. */
function Row({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`game-pause-meta__row${wide ? ' hotlap-test__wide' : ''}`}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

/** A past track's record and where you stand on its board: the record across the card, then your best and place. */
function Standing({
  record,
  you,
  drivers,
  known,
}: {
  record: { name: string; score: number } | null | undefined
  you: { score: number; place: number } | null | undefined
  drivers: number
  /** Whether the board has come, so nothing on it means nobody. */
  known: boolean
}) {
  return (
    <>
      <Row label="Track record" wide>
        {record ? `${record.name} · ${lapOf(record.score)}` : known ? 'Nobody yet' : '…'}
      </Row>
      <Row label="Your best">{you ? lapOf(you.score) : '–'}</Row>
      <Row label="Your place">{you ? `${ordinal(you.place)} of ${drivers}` : '–'}</Row>
    </>
  )
}

/**
 * A track's start card, driven on another day than its own: like the game's own, it starts on a tap
 * anywhere but its links. With `board`, the track's day has gone and a lap here goes on its board.
 */
export function TestStartCard({
  course,
  ghost,
  past,
}: {
  course: Course
  ghost: number
  past?: { board: TrackBoard | null; signedIn: boolean } | null
}) {
  const rows = past ? (
    <Standing record={past.board?.entries[0]} you={past.board?.you} drivers={past.board?.drivers ?? 0} known={past.board !== null} />
  ) : (
    <>
      <Row label="Blue car">{formatLap(ghost)}</Row>
      <Row label="Pace car">{formatLap(course.paceLap.time)}</Row>
    </>
  )
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start hotlap-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          {past ? `Past track · #${course.n}` : `Test drive · track ${course.n} of ${PLANNED_TRACKS}`}
        </span>
        <h2 className="game-card__title game-card__title--big">{course.name}</h2>
        <p className="game-card__blurb">
          {past
            ? `${whenWords(course.day)}. Its board stays open: your best lap here goes on it for good, and taking its record pays ${RECORD_TICKETS} tickets.`
            : `${whenWords(course.day)}. Laps here aren’t saved: they go on no board, and your best here is gone when you close the tab.`}
        </p>
      </div>
      <GamePanelBody slug={SLUG} personalBest={0} hideBest hideRecord extraMeta={rows} />
      {past && !past.signedIn ? <p className="game-card__hint">Sign in to put your laps on its board.</p> : null}
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <TrackNav n={course.n} />
    </div>
  )
}

/** After a test lap: its time, against your best here and the pace car's. */
export function TestResultCard({
  course,
  time,
  splits,
  best,
  improved,
  onAgain,
  onDone,
}: {
  course: Course
  time: number
  splits: number[]
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the lap ends: the lap's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  return (
    <div
      ref={fitCardToSpace}
      className="game-card hotlap-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${course.name}: ${formatLap(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test drive · #{course.n} {course.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatLap(time)}</h2>
        <p className="game-card__blurb">Sectors {sectorWords(splits)}</p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This lap' : formatLap(best)}</Row>
        <Row label="Pace car">{formatLap(course.paceLap.time)}</Row>
      </div>
      <p className="game-card__hint">A test lap: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Drive it again
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={(e) => {
            if (allow(e)) onDone()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function sectorWords(splits: number[]) {
  return splits.map((at, k) => (at - (k === 0 ? 0 : splits[k - 1]!)).toFixed(2)).join(' · ')
}

/** What became of a past track's lap: saved to its board, or why not. */
type LapSave =
  | { phase: 'waiting' }
  | { phase: 'saving' }
  | { phase: 'saved'; result: TrackLapResult }
  /** Slower than your best on the board, which stands: nothing to save. */
  | { phase: 'stands' }
  | { phase: 'signedOut' }
  | { phase: 'noTag' }
  | { phase: 'failed'; error: string }

function saveError(err: unknown): LapSave {
  const code = err instanceof ApiError ? err.code : (err as { code?: string } | null)?.code
  if (code === 'AUTH_REQUIRED') return { phase: 'signedOut' }
  if (code === 'RATE_LIMITED') return { phase: 'failed', error: 'Too many laps too quickly. Give it a minute, and the next one goes on.' }
  if (code === 'TODAYS_TRACK') return { phase: 'failed', error: 'This is today’s track now: its laps go on today’s board, from the game’s page.' }
  if (code?.startsWith('RUN_')) return { phase: 'failed', error: 'That lap didn’t reach the server as it began, so it can’t go on the board. The next one will.' }
  const message = err instanceof Error && err.message ? err.message : ''
  return { phase: 'failed', error: message || 'That lap didn’t save. The next one will try again.' }
}

/** Signed in with no tag yet: a tag puts the lap on the track's board, which the card then does. */
function LapTag() {
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
    <div className="hotlap-test__tag">
      <TagSlots id={id} value={draft} onChange={setDraft} onSubmit={() => void submit()} lead="Put your tag on it and it goes on the track’s board." error={error} />
      <button type="button" className="panel__btn" disabled={!name || busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Put it on the board'}
      </button>
    </div>
  )
}

/**
 * After a lap of a past track: its time, and it goes on the track's board, signed in, when it beats your
 * best there. The save goes on under the card; Drive it again waits on it a moment (useSaveWait), and the
 * lap goes out under its own run, taken as it ended, whatever comes after.
 */
export function PastResultCard({
  course,
  time,
  score,
  splits,
  run,
  board,
  onSaved,
  onAgain,
  onDone,
}: {
  course: Course
  time: number
  /** The lap as the board keeps it. */
  score: number
  splits: number[]
  /** The run the lap was driven in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
  onDone: () => void
}) {
  const allow = useDeliberatePress()
  const { signedIn, loading } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const known = board?.you?.score ?? null
  const [save, setSave] = useState<LapSave>({ phase: 'waiting' })
  const sent = useRef(false)
  const shown = useRef(true)
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (sent.current || loading) return
    if (!signedIn) {
      setSave({ phase: 'signedOut' })
      return
    }
    if (!name) {
      setSave({ phase: 'noTag' })
      return
    }
    if (known != null && score <= known) {
      setSave({ phase: 'stands' })
      return
    }
    if (!run) {
      setSave(saveError({ code: 'RUN_REQUIRED' }))
      return
    }
    sent.current = true
    setSave({ phase: 'saving' })
    // Saved even if the card goes first: the board takes it, and the next card asks again.
    saveTrackLap(course.n, name, score, run).then(
      (result) => {
        savedRef.current(result)
        if (shown.current) setSave({ phase: 'saved', result })
      },
      (err: unknown) => {
        const next = saveError(err)
        // Signed out under it (an old session): signing in sends it again.
        if (next.phase === 'signedOut') sent.current = false
        if (shown.current) setSave(next)
      },
    )
  }, [loading, signedIn, name, known, score, run, course.n])

  const pending = save.phase === 'waiting' || save.phase === 'saving'
  const waited = useSaveWait(pending)
  const holding = pending && signedIn && !waited

  const result = save.phase === 'saved' ? save.result : null
  const record = result ? result.record : (board?.entries[0] ?? null)
  const beatsRecord = !record || score > record.score
  let status: ReactNode
  if (save.phase === 'waiting' || save.phase === 'saving') status = <p className="game-card__hint">Putting it on the track’s board…</p>
  else if (result?.tookRecord) status = <p className="hotlap-test__news">Track record! Nobody has driven it faster.</p>
  else if (result) status = <p className="game-card__hint">{result.best === score ? 'Your best here, on the track’s board.' : 'Saved. Your best here is still faster.'}</p>
  else if (save.phase === 'stands') status = <p className="game-card__hint">Not faster than your best here, which stays on the board.</p>
  else if (save.phase === 'signedOut')
    status = (
      <ReportSignIn
        lead={beatsRecord && board ? 'Sign in and this lap goes on the track’s board, as its record.' : 'Sign in and this lap goes on the track’s board.'}
        onSignedIn={() => undefined}
      />
    )
  else if (save.phase === 'noTag') status = <LapTag />
  else if (save.phase === 'failed') status = <p className="panel__error">{save.error}</p>
  // Taking a track's record pays, once a track.
  const paid = result?.tickets?.earned ? (
    <p className="hotlap-test__tix">
      <TicketGlyph size={20} />
      <span>
        <b>+{result.tickets.earned} tickets</b> for the track record.{' '}
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
  ) : null

  return (
    <div
      ref={fitCardToSpace}
      className="game-card hotlap-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${course.name}: ${formatLap(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Past track · #{course.n} {course.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatLap(time)}</h2>
        <p className="game-card__blurb">Sectors {sectorWords(splits)}</p>
      </div>
      <div className="game-pause-meta">
        {result ? (
          <Standing record={result.record} you={{ score: result.best, place: result.place }} drivers={result.drivers} known />
        ) : (
          <Standing record={record} you={board?.you} drivers={board?.drivers ?? 0} known={board !== null} />
        )}
      </div>
      {status}
      {paid}
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          disabled={holding}
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          {holding ? 'Saving…' : 'Drive it again'}
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={(e) => {
            if (allow(e)) onDone()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
