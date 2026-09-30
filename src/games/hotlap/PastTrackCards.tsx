import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PastCourseResult, PastCourseStart, type PastBoardRow } from '../../components/PastCourseCards'
import { TicketGlyph } from '../../components/prizes/Ticket'
import { ReportSignIn, TagSlots } from '../../components/RunReport'
import { useAccountId } from '../../hooks/useAccountId'
import { useAuth } from '../../hooks/useAuth'
import { prizesHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useSaveWait } from '../../hooks/useSaveWait'
import { useIsAdmin } from '../../lib/admin'
import { linkCurrentNameToAccount, recallAccountTag } from '../../lib/auth'
import type { PastKind } from '../../lib/dailyWords'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../../lib/leaderboard'
import { leavePlay } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import { saveTrackLap, type TrackBoard, type TrackLapResult } from '../../lib/trackBoards'
import { dailyTrack, dayOfTrack, PLANNED_TRACKS, trackDay, trackNumber, trackState } from './daily'
import type { Course } from './lap'
import { driversWords, trackDriveHref, type PastTrackFigures } from './pastTrack'
import { formatHotlapBoardScore, formatLap, formatLapMs } from './score'

/*
 * A past track's cards (/games/hotlap/play?track=<n>, from the Past tracks tab): the one it opens on, and
 * the one after a lap. A past track keeps a board of its own for good (lib/trackBoards.ts): signed in, your
 * best lap goes on it, and never on today's board, your week or your rank. Signed out, a lap is practice:
 * nothing is kept, even if you sign in after it; signing in puts your next laps on its board. The cards
 * themselves are every daily's
 * (components/PastCourseCards.tsx); Hot Lap fills them in.
 */

const SLUG = 'hotlap'
/** What taking a past track's record pays, once a track: the API's tickets.ts RECORD_TICKETS. */
const RECORD_TICKETS = 15

/** A lap on a board, as a time. */
const lapOf = formatHotlapBoardScore

/** A track's name by its number. */
const trackName = (n: number) => dailyTrack(dayOfTrack(n)).name

const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
const monthDayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** When a past track was the day's, from today: "yesterday", "on Monday" in the last week, "on Sep 20" before that. */
function whenItWas(day: string): string {
  const ago = trackNumber(trackDay()) - trackNumber(day)
  const at = new Date(`${day}T12:00:00Z`)
  if (ago === 1) return 'yesterday'
  return ago < 7 ? `on ${weekdayFormat.format(at)}` : `on ${monthDayFormat.format(at)}`
}

/** A lap against the blue car, said as a sentence. */
function paceWords(time: number, pace: number): string {
  const gap = Math.abs(time - pace)
  if (gap < 0.005) return 'You tied with the blue car.'
  return time < pace ? `You beat the blue car by ${gap.toFixed(2)}s.` : `The blue car was ${gap.toFixed(2)}s quicker.`
}

/**
 * A past track's start card: what it is, that a lap here goes on its board and not your rank (or, signed
 * out, is practice), how it went on its day and where its board stands, and the way back to its row. Like
 * the game's own, a tap anywhere but its links starts the lap. The tracks either side are a walk away:
 * the next only while it's a past one too, unless you're an admin, who may test-drive what's to come.
 */
export function PastTrackStart({
  course,
  kind,
  figures,
  board,
}: {
  course: Course
  kind: PastKind
  figures: PastTrackFigures
  board: TrackBoard | null
}) {
  const admin = useIsAdmin()
  const { n, name } = course
  const today = useMemo(() => dailyTrack(trackDay()).name, [])
  const walk = useMemo(
    () => ({
      prev: n > 1 ? { label: `#${n - 1} ${trackName(n - 1)}`, href: trackDriveHref(n - 1) } : null,
      next:
        n < PLANNED_TRACKS && (admin || trackState(n + 1) === 'past')
          ? { label: `#${n + 1} ${trackName(n + 1)}`, href: trackDriveHref(n + 1) }
          : null,
    }),
    [n, admin],
  )
  const pace = `Blue car: ${formatLap(course.paceLap.time)}.`
  const note =
    kind === 'practice'
      ? pace
      : board?.you?.place === 1
        ? `You hold its record. ${pace}`
        : `Taking its record pays ${RECORD_TICKETS} tickets, once. ${pace}`
  return (
    <PastCourseStart
      slug={SLUG}
      course={n}
      day={course.day}
      kind={kind}
      title={name}
      blurb={`Hot Lap track #${n}. It was the day’s track ${whenItWas(course.day)}.`}
      labelSub={
        kind === 'board'
          ? `Your best lap goes on ${name}’s board for good. Today’s board, your week and your rank stay as they are.`
          : undefined
      }
      facts={figures.facts}
      note={note}
      startLabel={figures.played ? 'Race it again' : 'Race it'}
      today={{ name: today }}
      walk={walk}
    >
      {kind === 'practice' ? <p className="hotlap-past__line">Sign in and your laps here go on its board.</p> : null}
    </PastCourseStart>
  )
}

/** What became of a past track's lap: saved to its board, or why not. */
type LapSave =
  | { phase: 'waiting' }
  | { phase: 'saving' }
  | { phase: 'saved'; result: TrackLapResult }
  /** Slower than your best on the board, which stands: nothing to save. */
  | { phase: 'stands' }
  /** Driven signed out: practice, never sent, even if its card signs in after. */
  | { phase: 'practice' }
  /** An account's lap whose sign-in lapsed: signing in as that account sends it. */
  | { phase: 'signedOut' }
  /** Driven under another account than the one signed in now: it waits for that one. */
  | { phase: 'otherAccount' }
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
 * A few rows of the track's board: the top three, or the top two and you when you're further down. Right
 * after a save, before the board's been asked again, the save's own figures: the record and you. For a
 * lap that was practice, only the record: the card has signing in to show under it.
 */
function boardRows(board: TrackBoard | null, result: TrackLapResult | null, me: string | null, practice: boolean): PastBoardRow[] {
  if (result && board?.you?.score !== result.best) {
    const rows: PastBoardRow[] = [
      { place: 1, name: result.record.name, result: lapOf(result.record.score), record: true, you: result.place === 1 },
    ]
    if (result.place > 1) rows.push({ place: result.place, name: result.name, result: lapOf(result.best), you: true })
    return rows
  }
  if (!board) return []
  const you = me ? board.you : null
  const below = you !== null && you.place > 3
  const rows: PastBoardRow[] = board.entries.slice(0, practice ? 1 : below ? 2 : 3).map((e, i) => ({
    place: i + 1,
    name: e.name,
    result: lapOf(e.score),
    record: i === 0,
    you: e.name === me,
  }))
  if (below && me && !practice) rows.push({ place: you.place, name: me, result: lapOf(you.score), you: true })
  return rows
}

/**
 * After a lap of a past track: its time, and where it went. Signed in, it goes on the track's board when it
 * beats your best there; the save goes on under the card, and Race again waits on it a moment
 * (useSaveWait). The lap goes out under its own run, taken as it ended, and it's its driver's alone: a lap
 * driven as one account waits for that account (lib/deviceRuns.ts). Driven signed out it was practice and
 * stays so; signing in on the card is for the laps after it.
 */
export function PastTrackResult({
  course,
  time,
  score,
  run,
  board,
  owner,
  onSaved,
  onAgain,
}: {
  course: Course
  time: number
  /** The lap as the board keeps it. */
  score: number
  /** The run the lap was driven in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the lap is: an account's id, saved only while it's signed in; null driven signed out, practice and never saved. */
  owner?: string | null
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  const { signedIn, loading } = useAuth()
  const accountId = useAccountId()
  const otherAccount = typeof owner === 'string' && accountId !== owner
  const name = normalizePlayerName(usePlayerName())
  const known = signedIn ? (board?.you?.score ?? null) : null
  const [save, setSave] = useState<LapSave>(() => (owner === null ? { phase: 'practice' } : { phase: 'waiting' }))
  const sent = useRef(false)
  const shown = useRef(true)
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved
  /** Your place and best on the board as the lap went out: what it moved you up from. */
  const beforeRef = useRef<TrackBoard['you']>(null)
  const today = useMemo(() => dailyTrack(trackDay()).name, [])

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (sent.current || loading) return
    // Driven signed out: practice, kept nowhere, even once its card signs in (spec decision 3).
    if (owner === null) {
      setSave({ phase: 'practice' })
      return
    }
    // An account's lap, signed out under it: signing in as them sends it.
    if (!signedIn) {
      setSave({ phase: 'signedOut' })
      return
    }
    // A new session's account not said yet: wait for it, never sending it or calling it someone else's.
    if (typeof owner === 'string' && accountId === undefined) return
    // Never on the board as someone else's: it goes once its own account is signed in again.
    if (otherAccount) {
      setSave({ phase: 'otherAccount' })
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
    beforeRef.current = board?.you ?? null
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
  }, [loading, otherAccount, owner, accountId, signedIn, name, known, score, run, course.n, board])

  const pending = save.phase === 'waiting' || save.phase === 'saving'
  const waited = useSaveWait(pending)
  const holding = pending && signedIn && !waited

  const result = save.phase === 'saved' ? save.result : null
  const kind: PastKind = save.phase === 'practice' ? 'practice' : 'board'
  const me = result?.name ?? (signedIn && !otherAccount && name ? name : null)
  const pace = paceWords(time, course.paceLap.time)
  const boardName = `${course.name}’s board`

  // Where the lap went, and what it did there.
  let headline: ReactNode | undefined
  let line: ReactNode = pace
  let status: ReactNode = null
  if (pending) {
    status = (
      <p className="hotlap-past__line" role="status">
        Putting it on {boardName}…
      </p>
    )
  } else if (result && result.best === score) {
    const before = beforeRef.current
    headline = `${ordinal(result.place)} on ${boardName}`
    if (result.tookRecord) line = `Track record! Nobody has driven ${course.name} faster. ${pace}`
    else if (before && before.score < score) {
      line = (
        <>
          {before.place > result.place ? `Up from ${ordinal(before.place)}: ` : null}
          <b>{formatLapMs(score - before.score)} quicker</b> than your old best here, {lapOf(before.score)}. {pace}
        </>
      )
    } else {
      line = `Your first lap on its board. ${pace}`
    }
  } else if (result) {
    headline = `Still ${ordinal(result.place)} on ${boardName}`
    line = `Your best here, ${lapOf(result.best)}, is still quicker.`
  } else if (save.phase === 'stands' && board?.you) {
    headline = `Still ${ordinal(board.you.place)} on ${boardName}`
    line = `Your best here, ${lapOf(board.you.score)}, stands: this lap was ${formatLapMs(board.you.score - score)} slower.`
  } else if (save.phase === 'practice') {
    // Its own headline says nothing was saved; signing in is for the laps to come.
    status = signedIn ? null : <ReportSignIn lead={`Sign in and your next laps here go on ${boardName}.`} onSignedIn={() => undefined} />
  } else {
    headline = 'Not on its board yet'
    if (save.phase === 'signedOut') {
      status = <ReportSignIn lead={`Sign in and this lap goes on ${boardName}.`} onSignedIn={() => undefined} />
    } else if (save.phase === 'otherAccount') {
      const tag = typeof owner === 'string' ? recallAccountTag(owner) : ''
      status = (
        <p className="hotlap-past__line">
          {tag ? `Raced as ${tag}. Sign in as ${tag} to put it on ${boardName}.` : `Raced as another account. Sign in as that account to put it on ${boardName}.`}
        </p>
      )
    } else if (save.phase === 'noTag') status = <LapTag />
    else if (save.phase === 'failed') status = <p className="panel__error">{save.error}</p>
  }

  // How far off the record your best is, and what taking it pays.
  const record = result ? result.record : (board?.entries[0] ?? null)
  const best = Math.max(score, result?.best ?? 0, known ?? 0)
  let note: ReactNode = null
  if (record && !result?.tookRecord) {
    if (me && record.name === me && record.score >= best) note = 'You hold its record.'
    else if (record.score === best) note = `Tied with ${record.name}’s record, ${lapOf(record.score)}: only a quicker lap takes it.`
    else if (record.score > best) {
      note = `${record.name}’s record is ${formatLapMs(record.score - best)} away.${kind === 'board' ? ` Taking it pays ${RECORD_TICKETS} tickets, once.` : ''}`
    } else if (kind === 'practice') note = `That’s quicker than ${record.name}’s record, ${lapOf(record.score)}.`
  }

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
            leavePlay(prizesHref())
          }}
        >
          Prize counter ›
        </a>
      </span>
    </p>
  ) : null

  const rows = boardRows(board, result, me, kind === 'practice')
  const drivers = result?.drivers ?? board?.drivers ?? 0
  return (
    <PastCourseResult
      slug={SLUG}
      course={course.n}
      day={course.day}
      kind={kind}
      figure={formatLap(time)}
      headline={headline}
      line={line}
      board={rows.length > 0 ? { title: boardName, count: driversWords(drivers), rows } : null}
      note={note}
      today={{ name: today }}
      againBusy={holding}
      onAgain={onAgain}
    >
      {status}
      {paid}
    </PastCourseResult>
  )
}
