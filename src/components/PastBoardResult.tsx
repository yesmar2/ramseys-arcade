import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { dailyTabHref, gamePlayHref, navigate, prizesHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useSaveWait } from '../hooks/useSaveWait'
import { linkCurrentNameToAccount, recallAccountTag } from '../lib/auth'
import { inArchive } from '../lib/archive'
import { archivedWhy, capitalWord, verbDone, verbHasDone } from '../lib/dailyPast'
import { bestWord, BOARD_NAMES, dailyWords, type PastKind } from '../lib/dailyWords'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { allTimeBoardName, playersWords, RECORD_TICKETS } from '../lib/pastBoards'
import { leavePlay } from '../lib/pastPlay'
import { boardTime, isRaceGame, MEDAL_NAMES, medalBeats, medalFor } from '../lib/raceMedals'
import type { ReportBoardCard, ReportBoardRow, ReportRibbon, ReportTier } from '../lib/runReport'
import { ordinal } from '../lib/scoreboard'
import { saveTrackLap, type TrackBoard, type TrackGame, type TrackLapResult } from '../lib/trackBoards'
import type { PastWalkLink, TodayCourse } from './PastCourseCards'
import { TicketStub } from './prizes/Ticket'
import { MedalLadder } from './RaceMedal'
import { RunLabel } from './RunLabel'
import { ReportSignIn, TagSlots, type ReportAction, type ReportLink } from './RunReport'
import { ReelButton, reelSteps, RunReel, type ReelBadge } from './RunReel'
import '../styles/pastCourse.css'

/*
 * After a run on a ranked daily's past course (Hot Lap's tracks, Marble Run's courses, Lander's caves): it goes
 * on the course's All time board (lib/trackBoards.ts) when it beats your best there, and never on today's
 * board, your week or your rank. The save goes on under the card, and Again waits on it a moment
 * (useSaveWait). The run goes out under its own run id, taken as it ended, and it's its player's alone: a
 * run played as one account waits for that account (lib/deviceRuns.ts). Played signed out it was practice and
 * stays so; signing in on the card is for the runs after it. A course in the archive, older than a week
 * (lib/archive.ts), has its board closed: every run there is practice. Each game fills in its own words and figures.
 *
 * It ends as today's run does, on the whole screen (RunReel.tsx), after Ramsey found the old card wanting
 * (2026-10-26: "it doesn't show what medal you get, and you have to go back to do the next/prev track. it's also
 * not using the full screen celebrations we have"): the time with the course's medal ladder and its board beside
 * it, a new medal big under the time and a record lit up; the record's tickets; then Race again, the next
 * course, the one before, the past tab and today's.
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
 * that was practice, only the record: the reel has signing in to show after it.
 */
function boardRows(
  board: TrackBoard | null,
  result: TrackLapResult | null,
  me: string | null,
  practice: boolean,
  fmt: (score: number) => string,
): ReportBoardRow[] {
  const record = (place: number) => (place === 1 ? 'Record' : null)
  if (result && board?.you?.score !== result.best) {
    const rows: ReportBoardRow[] = [{ place: 1, name: result.record.name, score: fmt(result.record.score), you: result.place === 1, note: record(1) }]
    if (result.place > 1) rows.push({ place: result.place, name: result.name, score: fmt(result.best), you: true })
    return rows
  }
  if (!board) return []
  const you = me ? board.you : null
  const below = you !== null && you.place > 3
  const rows: ReportBoardRow[] = board.entries.slice(0, practice ? 1 : below ? 2 : 3).map((e, i) => ({
    place: i + 1,
    name: e.name,
    score: fmt(e.score),
    you: e.name === me,
    note: record(i + 1),
    ...(e.avatarId ? { avatarId: e.avatarId } : {}),
  }))
  if (below && me && !practice) rows.push({ place: you.place, name: me, score: fmt(you.score), you: true })
  return rows
}

/** Taking a course's record pays once: its tickets, as a page of the reel. */
function RecordTickets({ earned, course }: { earned: number; course: string }) {
  return (
    <div className="reel-split reel-split--solo reel-tix">
      <div className="reel-split__main">
        <div className="reel-tix__top">
          <p className="reel__kick">Tickets</p>
          <div className="reel-tix__stub">
            <TicketStub amount={earned} width={208} fan={earned >= 15 ? 2 : earned >= 8 ? 1 : 0} />
          </div>
          <p className="reel-tix__first">For the {course} record. A record pays once.</p>
          <a
            className="reel-link"
            href={prizesHref()}
            onClick={(e) => {
              e.preventDefault()
              leavePlay(prizesHref())
            }}
          >
            Spend them at the prize counter ›
          </a>
        </div>
      </div>
    </div>
  )
}

export function PastBoardResult({
  slug,
  n,
  day,
  name: courseName,
  kicker,
  figure,
  score,
  medals,
  walk,
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
  figure: string
  /** The run as the board keeps it: a million less its ms. */
  score: number
  /**
   * The course's medals (lib/raceMedals.ts): its blue's time, and its own platinum where it has one (Hot Lap's
   * tracks). Shown as its ladder beside the time, a new one big under it.
   */
  medals?: { paceMs: number; platinumMs?: number | null }
  /** The courses either side, to race next without going back to the past tab. */
  walk?: { prev?: PastWalkLink | null; next?: PastWalkLink | null }
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
  const { signedIn, signedOut, loading } = useAuth()
  const accountId = useAccountId()
  const otherAccount = typeof owner === 'string' && accountId !== owner
  const name = normalizePlayerName(usePlayerName())
  const known = signedIn ? (board?.you?.score ?? null) : null
  const archived = inArchive(day)
  const [save, setSave] = useState<RunSave>(() => (owner === null || archived ? { phase: 'practice' } : { phase: 'waiting' }))
  const sent = useRef(false)
  const shown = useRef(true)
  const savedRef = useRef(onSaved)
  savedRef.current = onSaved
  /** Your place and best on the board as the run went out: what it moved you up from. */
  const beforeRef = useRef<TrackBoard['you']>(null)
  /** Your best here before this run, in ms, as the card opened: what a medal is new against. */
  const [previousMs] = useState(() => (known != null ? 1_000_000 - known : null))
  const words = dailyWords(slug)
  const runWord = bestWord(slug)
  const titleId = useId()
  const playRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (sent.current || loading) return
    // Played signed out, or on a course whose board is closed: practice, kept nowhere, even once its card signs in.
    if (owner === null || archived) {
      setSave({ phase: 'practice' })
      return
    }
    // An account's run, signed out under it: signing in as them sends it. A session whose account couldn't be
    // asked for sends it all the same: the API knows whose it is, and a 401 then is signed out.
    if (signedOut) {
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
  }, [loading, archived, otherAccount, owner, accountId, signedOut, name, known, score, run, slug, n, board])

  const pending = save.phase === 'waiting' || save.phase === 'saving'
  const waited = useSaveWait(pending)
  const holding = pending && !signedOut && !waited

  const result = save.phase === 'saved' ? save.result : null
  const kind: PastKind = save.phase === 'practice' ? 'practice' : 'board'
  const me = result?.name ?? (signedIn && !otherAccount && name ? name : null)
  const boardName = allTimeBoardName(courseName)

  // The run's medal on the course (lib/raceMedals.ts): the one your best here now holds, and whether this run won it.
  const ms = 1_000_000 - score
  const race = medals && isRaceGame(slug) ? { game: slug, ...medals } : null
  const medalHeld = race ? medalFor(race.game, race.paceMs, Math.min(ms, previousMs ?? ms), race.platinumMs) : null
  const medalNew = race && medalHeld && medalBeats(medalHeld, medalFor(race.game, race.paceMs, previousMs, race.platinumMs)) ? medalHeld : null

  // Where the run went on the course's All time board, and what it did there: the board's card beside the time.
  const improved = result != null && result.best === score
  let place: number | null = null
  let value = ''
  let move: string | null = null
  let detail: string | null = null
  /** What the reel asks before the run can go on the board: the sign-in, or a tag. */
  let ask: ReactNode = null
  /** A word on a run that isn't going on the board. */
  let status: ReactNode = null
  if (result) {
    place = result.place
    value = ordinal(result.place)
    const before = beforeRef.current
    if (!improved) detail = `Your best here, ${fmt(result.best)}, is still quicker.`
    else if (result.tookRecord) detail = `Nobody has ${verbHasDone(slug)} ${courseName} faster.`
    else if (before && before.score < score) {
      if (before.place > result.place) move = `Up from ${ordinal(before.place)}`
      detail = `${gap(score - before.score)} quicker than your old best here, ${fmt(before.score)}.`
    } else {
      move = 'New on the board'
      detail = `Your first ${runWord} on its ${BOARD_NAMES.allTime} board.`
    }
  } else if (save.phase === 'stands' && board?.you) {
    place = board.you.place
    value = ordinal(board.you.place)
    detail = `Your best here, ${fmt(board.you.score)}, stands: this ${runWord} was ${gap(board.you.score - score)} slower.`
  } else if (save.phase === 'practice') {
    value = 'Practice'
    detail = archived ? archivedWhy(slug) : 'Nothing was saved.'
    // Signing in is for the runs to come, where the board is open.
    if (!archived && signedOut) status = <ReportSignIn lead={`Sign in and your next ${runWord}s here go on ${boardName}.`} onSignedIn={() => undefined} />
  } else if (!pending) {
    value = 'Not on it yet'
    if (save.phase === 'signedOut') {
      ask = <ReportSignIn lead={`Sign in and this ${runWord} goes on ${boardName}.`} onSignedIn={() => undefined} />
    } else if (save.phase === 'otherAccount') {
      const tag = typeof owner === 'string' ? recallAccountTag(owner) : ''
      const did = capitalWord(verbDone(slug))
      status = (
        <p className="past-save__line">
          {tag ? `${did} as ${tag}. Sign in as ${tag} to put it on ${boardName}.` : `${did} as another account. Sign in as that account to put it on ${boardName}.`}
        </p>
      )
    } else if (save.phase === 'noTag') ask = <RunTag slug={slug} />
    else if (save.phase === 'failed') status = <p className="panel__error">{save.error}</p>
  }

  // How far off the record your best is, and what taking it pays.
  const record = result ? result.record : (board?.entries[0] ?? null)
  const best = Math.max(score, result?.best ?? 0, known ?? 0)
  let note: string | null = null
  if (record && !result?.tookRecord) {
    if (me && record.name === me && record.score >= best) note = 'You hold its record.'
    else if (record.score === best) note = `Tied with ${record.name}’s record, ${fmt(record.score)}: only a quicker ${runWord} takes it.`
    else if (record.score > best) {
      note = `${record.name}’s record is ${gap(record.score - best)} away.${kind === 'board' ? ` Taking it pays ${RECORD_TICKETS} tickets, once.` : ''}`
    } else if (kind === 'practice') note = `That’s quicker than ${record.name}’s record, ${fmt(record.score)}.`
  }

  const rows = boardRows(board, result, me, kind === 'practice', fmt)
  const players = result?.drivers ?? board?.drivers ?? 0
  const boardCard: ReportBoardCard | null =
    value && (rows.length > 0 || place != null)
      ? {
          label: `${BOARD_NAMES.allTime} · ${courseName}`,
          value,
          gold: place === 1,
          move,
          detail: [detail, players > 0 ? playersWords(slug, players) : null].filter(Boolean).join(' · ') || null,
          rows,
        }
      : null

  // How the run's page lights up: a record the loudest, then a new top medal; a new best or a new medal lit.
  const tookRecord = Boolean(result?.tookRecord)
  const ribbon: ReportRibbon | null = tookRecord
    ? { icon: 'crown', text: `${capitalWord(words.course)} record!`, tone: 'gold' }
    : improved && beforeRef.current
      ? { icon: 'up', text: 'New best here', tone: 'accent' }
      : null
  const tier: ReportTier = tookRecord || medalNew === 'platinum' ? 'big' : ribbon || medalNew ? 'lit' : 'quiet'
  const earned = result?.tickets?.earned ?? 0
  const format = (seconds: number) => boardTime(slug, seconds)

  const pastHref = dailyTabHref(slug, 'past', slug === 'hotlap' ? n : day)
  const again: ReportAction = { label: holding ? 'Saving…' : `${words.verb} again`, busy: holding, onClick: onAgain, buttonRef: playRef }
  const next: ReportAction | null = walk?.next ? { label: `Next: ${walk.next.label}`, href: walk.next.href } : null
  const links: ReportLink[] = [
    ...(walk?.prev ? [{ label: `‹ ${walk.prev.label}`, onClick: () => navigate(walk.prev!.href) }] : []),
    { label: words.pastTab, onClick: () => leavePlay(pastHref) },
    { label: today.name ? `${words.today}: ${today.name}` : words.today, onClick: () => leavePlay(today.href ?? gamePlayHref(slug)) },
  ]
  const recap: ReelBadge[] = [{ key: 'score', kind: 'score', value: figure, label: improved ? 'New best here' : courseName, icon: improved ? 'up' : 'target' }]
  if (medalHeld) recap.push({ key: 'medal', kind: 'medal', medal: medalHeld, value: MEDAL_NAMES[medalHeld], label: 'Your medal here' })
  if (place != null) recap.push({ key: 'place', kind: 'place', value: ordinal(place), label: `${BOARD_NAMES.allTime} · ${courseName}` })
  if (earned > 0) recap.push({ key: 'tickets', kind: 'tickets', value: `+${earned}`, label: 'Tickets' })
  const block = [status, note ? <p className="past-save__line">{note}</p> : null, <RunLabel kind={kind} slug={slug} />].filter(Boolean)

  const steps = reelSteps({
    phase: pending ? 'pending' : ask ? 'ask' : 'saved',
    slow: waited,
    wait: { said: `Putting it on ${boardName}…`, slow: `Still putting it on ${boardName}…` },
    run: {
      titleId,
      tier,
      ribbon,
      eyebrow: kicker ?? `Past ${words.course} #${n} · ${courseName}`,
      score: figure,
      unit: '',
      sub: pace,
      scoreTone: tookRecord ? 'gold' : improved ? 'accent' : 'plain',
      medal: medalNew,
      ladder: race ? (
        <MedalLadder game={race.game} paceMs={race.paceMs} platinumMs={race.platinumMs} ms={ms} previousMs={previousMs} format={format} past />
      ) : null,
    },
    board: boardCard,
    boardCompact: Boolean(race),
    boardLoading: pending && !signedOut,
    tickets: earned > 0 ? <RecordTickets earned={earned} course={words.course} /> : null,
    ask,
    askGoLabel: save.phase === 'noTag' ? 'Skip' : 'Not now',
    recap,
    block: block.map((bit, i) => <Fragment key={i}>{bit}</Fragment>),
    // Race again, and the next course under it, as big: the way on without going back to the past tab.
    poster: (
      <div className="reel-next__plain">
        <ReelButton action={again} />
        {next ? <ReelButton action={next} variant="ghost" /> : null}
      </div>
    ),
    primary: again,
    links,
  })
  const accentStyle = gameAccentStyle(slug)
  const accent = String((accentStyle as Record<string, string>)['--celeb-accent'] ?? '#2eb8a0')
  return (
    <RunReel
      label={`${ribbon?.text ?? courseName}, ${figure}`}
      style={accentStyle}
      accent={accent}
      game={getGame(slug)?.name ?? slug}
      tier={tier}
      steps={steps}
      primaryRef={playRef}
      leave={{ label: 'Leave', onClick: () => leavePlay(pastHref) }}
      onEscape={save.phase === 'noTag' ? undefined : onAgain}
    />
  )
}
