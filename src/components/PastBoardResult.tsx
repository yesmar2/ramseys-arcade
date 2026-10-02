import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { prizesHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useSaveWait } from '../hooks/useSaveWait'
import { linkCurrentNameToAccount, recallAccountTag } from '../lib/auth'
import { capitalWord, verbDone } from '../lib/dailyPast'
import { bestWord, BOARD_NAMES, dailyWords, type PastKind } from '../lib/dailyWords'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { allTimeBoardName, playersWords, RECORD_TICKETS } from '../lib/pastBoards'
import { leavePlay } from '../lib/pastPlay'
import { ordinal } from '../lib/scoreboard'
import { saveTrackLap, type TrackBoard, type TrackGame, type TrackLapResult } from '../lib/trackBoards'
import { PastCourseResult, type PastBoardRow, type TodayCourse } from './PastCourseCards'
import { TicketGlyph } from './prizes/Ticket'
import { ReportSignIn, TagSlots } from './RunReport'
import '../styles/pastCourse.css'

/*
 * After a run on a ranked daily's past course (Hot Lap's tracks, Marble Run's courses, Lander's caves): it goes
 * on the course's All time board (lib/trackBoards.ts) when it beats your best there, and never on today's
 * board, your week or your rank. The save goes on under the card, and Again waits on it a moment
 * (useSaveWait). The run goes out under its own run id, taken as it ended, and it's its player's alone: a
 * run played as one account waits for that account (lib/deviceRuns.ts). Played signed out it was practice and
 * stays so; signing in on the card is for the runs after it. Each game fills in its own words and figures.
 */

/** What became of a past course's run: saved to its board, or why not. */
type RunSave =
  | { phase: 'waiting' }
  | { phase: 'saving' }
  | { phase: 'saved'; result: TrackLapResult }
  /** Slower than your best on the board, which stands: nothing to save. */
  | { phase: 'stands' }
  /** Played signed out: practice, never sent, even if its card signs in after. */
  | { phase: 'practice' }
  /** An account's run whose sign-in lapsed: signing in as that account sends it. */
  | { phase: 'signedOut' }
  /** Played under another account than the one signed in now: it waits for that one. */
  | { phase: 'otherAccount' }
  | { phase: 'noTag' }
  | { phase: 'failed'; error: string }

function saveError(slug: string, err: unknown): RunSave {
  const words = dailyWords(slug)
  const run = bestWord(slug)
  const code = err instanceof ApiError ? err.code : (err as { code?: string } | null)?.code
  if (code === 'AUTH_REQUIRED') return { phase: 'signedOut' }
  if (code === 'RATE_LIMITED') return { phase: 'failed', error: `Too many ${run}s too quickly. Give it a minute, and the next one goes on.` }
  if (code === 'TODAYS_TRACK') {
    return { phase: 'failed', error: `This is ${words.today.toLowerCase()} now: its ${run}s go on today’s board, from the game’s page.` }
  }
  if (code?.startsWith('RUN_')) {
    return { phase: 'failed', error: `That ${run} didn’t reach the server as it began, so it can’t go on the board. The next one will.` }
  }
  const message = err instanceof Error && err.message ? err.message : ''
  return { phase: 'failed', error: message || `That ${run} didn’t save. The next one will try again.` }
}

/** Signed in with no tag yet: a tag puts the run on the course's All time board, which the card then does. */
function RunTag({ slug }: { slug: string }) {
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
    <div className="past-save__tag">
      <TagSlots
        id={id}
        value={draft}
        onChange={setDraft}
        onSubmit={() => void submit()}
        lead={`Put your tag on it and it goes on the ${dailyWords(slug).course}’s ${BOARD_NAMES.allTime} board.`}
        error={error}
      />
      <button type="button" className="panel__btn" disabled={!name || busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Put it on the board'}
      </button>
    </div>
  )
}

/**
 * A few rows of the course's board: the top three, or the top two and you when you're further down. Right
 * after a save, before the board's been asked again, the save's own figures: the record and you. For a run
 * that was practice, only the record: the card has signing in to show under it.
 */
function boardRows(
  board: TrackBoard | null,
  result: TrackLapResult | null,
  me: string | null,
  practice: boolean,
  fmt: (score: number) => string,
): PastBoardRow[] {
  if (result && board?.you?.score !== result.best) {
    const rows: PastBoardRow[] = [{ place: 1, name: result.record.name, result: fmt(result.record.score), record: true, you: result.place === 1 }]
    if (result.place > 1) rows.push({ place: result.place, name: result.name, result: fmt(result.best), you: true })
    return rows
  }
  if (!board) return []
  const you = me ? board.you : null
  const below = you !== null && you.place > 3
  const rows: PastBoardRow[] = board.entries.slice(0, practice ? 1 : below ? 2 : 3).map((e, i) => ({
    place: i + 1,
    name: e.name,
    result: fmt(e.score),
    record: i === 0,
    you: e.name === me,
  }))
  if (below && me && !practice) rows.push({ place: you.place, name: me, result: fmt(you.score), you: true })
  return rows
}

export function PastBoardResult({
  slug,
  n,
  day,
  name: courseName,
  kicker,
  figure,
  score,
  pace,
  fmt,
  gap,
  run,
  board,
  owner,
  today,
  onSaved,
  onAgain,
}: {
  slug: TrackGame
  /** The course's number: a track's, or a course's or cave's day number. */
  n: number
  /** The day it was the day's course, YYYY-MM-DD. */
  day: string
  /** The course's name: "Seneca Glen". */
  name: string
  kicker?: string
  /** The run's result, big: "1:19.80". */
  figure: ReactNode
  /** The run as the board keeps it. */
  score: number
  /** The run against the blue one, a sentence: "You beat the blue car by 1.20s." */
  pace: string
  /** A board score as the board shows it: "1:19.80". */
  fmt: (score: number) => string
  /** How far apart two board scores are, the first the larger: "1.20s". */
  gap: (diff: number) => string
  /** The run it was played in. */
  run: Promise<string | undefined> | null
  board: TrackBoard | null
  /** Whose the run is: an account's id, saved only while it's signed in; null played signed out, practice and never saved. */
  owner?: string | null
  today: TodayCourse
  onSaved: (result: TrackLapResult) => void
  onAgain: () => void
}) {
  const { signedIn, loading } = useAuth()
  const accountId = useAccountId()
  const otherAccount = typeof owner === 'string' && accountId !== owner
  const name = normalizePlayerName(usePlayerName())
  const known = signedIn ? (board?.you?.score ?? null) : null
  const [save, setSave] = useState<RunSave>(() => (owner === null ? { phase: 'practice' } : { phase: 'waiting' }))
  const sent = useRef(false)
  const shown = useRef(true)
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved
  /** Your place and best on the board as the run went out: what it moved you up from. */
  const beforeRef = useRef<TrackBoard['you']>(null)
  const words = dailyWords(slug)
  const runWord = bestWord(slug)

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (sent.current || loading) return
    // Played signed out: practice, kept nowhere, even once its card signs in.
    if (owner === null) {
      setSave({ phase: 'practice' })
      return
    }
    // An account's run, signed out under it: signing in as them sends it.
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
      setSave(saveError(slug, { code: 'RUN_REQUIRED' }))
      return
    }
    sent.current = true
    beforeRef.current = board?.you ?? null
    setSave({ phase: 'saving' })
    // Saved even if the card goes first: the board takes it, and the next card asks again.
    saveTrackLap(slug, n, name, score, run).then(
      (result) => {
        savedRef.current(result)
        if (shown.current) setSave({ phase: 'saved', result })
      },
      (err: unknown) => {
        const next = saveError(slug, err)
        // Signed out under it (an old session): signing in sends it again.
        if (next.phase === 'signedOut') sent.current = false
        if (shown.current) setSave(next)
      },
    )
  }, [loading, otherAccount, owner, accountId, signedIn, name, known, score, run, slug, n, board])

  const pending = save.phase === 'waiting' || save.phase === 'saving'
  const waited = useSaveWait(pending)
  const holding = pending && signedIn && !waited

  const result = save.phase === 'saved' ? save.result : null
  const kind: PastKind = save.phase === 'practice' ? 'practice' : 'board'
  const me = result?.name ?? (signedIn && !otherAccount && name ? name : null)
  const boardName = allTimeBoardName(courseName)
  /** "3rd All time on Seneca Glen": a place on the course's All time board. */
  const placed = (place: number) => `${ordinal(place)} ${BOARD_NAMES.allTime} on ${courseName}`

  // Where the run went, and what it did there.
  let headline: ReactNode | undefined
  let line: ReactNode = pace
  let status: ReactNode = null
  if (pending) {
    status = (
      <p className="past-save__line" role="status">
        Putting it on {boardName}…
      </p>
    )
  } else if (result && result.best === score) {
    const before = beforeRef.current
    headline = placed(result.place)
    if (result.tookRecord) line = `${capitalWord(words.course)} record! Nobody has ${verbDone(slug)} ${courseName} faster. ${pace}`
    else if (before && before.score < score) {
      line = (
        <>
          {before.place > result.place ? `Up from ${ordinal(before.place)}: ` : null}
          <b>{gap(score - before.score)} quicker</b> than your old best here, {fmt(before.score)}. {pace}
        </>
      )
    } else {
      line = `Your first ${runWord} on its ${BOARD_NAMES.allTime} board. ${pace}`
    }
  } else if (result) {
    headline = `Still ${placed(result.place)}`
    line = `Your best here, ${fmt(result.best)}, is still quicker.`
  } else if (save.phase === 'stands' && board?.you) {
    headline = `Still ${placed(board.you.place)}`
    line = `Your best here, ${fmt(board.you.score)}, stands: this ${runWord} was ${gap(board.you.score - score)} slower.`
  } else if (save.phase === 'practice') {
    // Its own headline says nothing was saved; signing in is for the runs to come.
    status = signedIn ? null : <ReportSignIn lead={`Sign in and your next ${runWord}s here go on ${boardName}.`} onSignedIn={() => undefined} />
  } else {
    headline = `Not on its ${BOARD_NAMES.allTime} board yet`
    if (save.phase === 'signedOut') {
      status = <ReportSignIn lead={`Sign in and this ${runWord} goes on ${boardName}.`} onSignedIn={() => undefined} />
    } else if (save.phase === 'otherAccount') {
      const tag = typeof owner === 'string' ? recallAccountTag(owner) : ''
      const did = capitalWord(verbDone(slug))
      status = (
        <p className="past-save__line">
          {tag ? `${did} as ${tag}. Sign in as ${tag} to put it on ${boardName}.` : `${did} as another account. Sign in as that account to put it on ${boardName}.`}
        </p>
      )
    } else if (save.phase === 'noTag') status = <RunTag slug={slug} />
    else if (save.phase === 'failed') status = <p className="panel__error">{save.error}</p>
  }

  // How far off the record your best is, and what taking it pays.
  const record = result ? result.record : (board?.entries[0] ?? null)
  const best = Math.max(score, result?.best ?? 0, known ?? 0)
  let note: ReactNode = null
  if (record && !result?.tookRecord) {
    if (me && record.name === me && record.score >= best) note = 'You hold its record.'
    else if (record.score === best) note = `Tied with ${record.name}’s record, ${fmt(record.score)}: only a quicker ${runWord} takes it.`
    else if (record.score > best) {
      note = `${record.name}’s record is ${gap(record.score - best)} away.${kind === 'board' ? ` Taking it pays ${RECORD_TICKETS} tickets, once.` : ''}`
    } else if (kind === 'practice') note = `That’s quicker than ${record.name}’s record, ${fmt(record.score)}.`
  }

  // Taking a course's record pays, once a course.
  const paid = result?.tickets?.earned ? (
    <p className="past-save__tix">
      <TicketGlyph size={20} />
      <span>
        <b>+{result.tickets.earned} tickets</b> for the {words.course} record.{' '}
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

  const rows = boardRows(board, result, me, kind === 'practice', fmt)
  const players = result?.drivers ?? board?.drivers ?? 0
  return (
    <PastCourseResult
      slug={slug}
      course={slug === 'hotlap' ? n : day}
      day={day}
      kind={kind}
      kicker={kicker}
      figure={figure}
      headline={headline}
      line={line}
      board={rows.length > 0 ? { title: `${BOARD_NAMES.allTime} · ${courseName}`, count: playersWords(slug, players), rows } : null}
      note={note}
      today={today}
      againBusy={holding}
      onAgain={onAgain}
    >
      {status}
      {paid}
    </PastCourseResult>
  )
}
