import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { SignInButton } from '../../components/SignInWays'
import { PastCourseResult, PastCourseStart, type PastBoard, type PastBoardRow } from '../../components/PastCourseCards'
import { TicketGlyph } from '../../components/prizes/Ticket'
import { TagSlots } from '../../components/RunReport'
import { useAccountId } from '../../hooks/useAccountId'
import { useAuth } from '../../hooks/useAuth'
import { gamePlayHref, prizesHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { archiveDayWords, dayBefore } from '../../lib/archive'
import { linkCurrentNameToAccount } from '../../lib/auth'
import { dailyDay, PLACE_NAME, todaysHole, type DailySolved, type TodaysHole } from '../../lib/dailyHole'
import { BOARD_NAMES, type PastKind } from '../../lib/dailyWords'
import { SIGNED_OUT } from '../../lib/deviceRuns'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../../lib/leaderboard'
import { pastHoleAnswer, sendPastResult, type HoleBoard, type PastHoleResult, type PastProgress } from '../../lib/pastHoles'
import { leavePlay, type PastFact } from '../../lib/pastPlay'
import { ordinal } from '../../lib/scoreboard'
import { DAILY_EPOCH } from './daily'
import { PlayedAs } from './DailyCards'
import { playersWords, triesWords, type PastHoleFigures } from './pastFigures'

/*
 * A past hole's two cards (/games/acechase/play?hole=day:YYYY-MM-DD, from its row on Past holes): the one
 * it opens on, and the one a bullseye brings up, in the shared cards every daily's past course uses
 * (components/PastCourseCards.tsx). Every hole keeps its All time board for good (lib/pastHoles.ts), but
 * takes only a player's first result on it. So a run here goes on its board only for a player signed in
 * with no result on it yet, from its day or since; for anyone else it's practice, and nothing is saved.
 */

const SLUG = 'acechase'
/** What taking a past hole's record pays, once a hole: the API's tickets.ts RECORD_TICKETS. */
const RECORD_TICKETS = 15

/** The hole's own board, every first bullseye on it since its day, as it's called on the cards. */
const ALL_TIME = BOARD_NAMES.allTime

const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })

/** "Monday" in the last week, "Sep 22" before it: the day a hole was the day's. */
function whenWords(day: string): string {
  const today = dailyDay()
  let back = 0
  for (let d = today; d > day && back < 7; d = dayBefore(d)) back++
  if (back < 7) return weekday.format(new Date(`${day}T12:00:00Z`))
  return archiveDayWords(day).split(', ')[1]!
}

/** The day after a day, both as YYYY-MM-DD. */
function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)
}

const holeHref = (day: string) => `${gamePlayHref(SLUG)}?hole=day:${day}`

/** The past holes either side, for the start card's "‹ #3 Blizzard Bumps": none before the first, none of today's. */
function walkFrom(hole: TodaysHole) {
  const link = (day: string) => {
    const h = todaysHole(day)
    return { label: `#${h.n} ${h.def.name}`, href: holeHref(day) }
  }
  const before = dayBefore(hole.day)
  const after = dayAfter(hole.day)
  return { prev: before >= DAILY_EPOCH ? link(before) : null, next: after < dailyDay() ? link(after) : null }
}

/** Today's hole, the one that counts, for the line and button that go to it. */
const todayCourse = () => ({ name: todaysHole().def.name })

function SignIn({ children }: { children: ReactNode }) {
  return (
    <div className="acechase-daily__signin">
      <p>{children}</p>
      <SignInButton />
    </div>
  )
}

/** The card a past hole opens on: what a run here does, its Ranked and All time boards, and the way back to its row. */
export function PastStartCard({
  hole,
  kind,
  facts,
  progress,
  hadResult,
  onStart,
}: {
  hole: TodaysHole
  /** What the run it starts does. */
  kind: PastKind
  facts: readonly PastFact[]
  /** The player's own play at it on this device (lib/deviceRuns.ts), which a run on its board carries on. */
  progress: PastProgress | null
  /** The player has a result on it already. */
  hadResult: boolean
  onStart: () => void
}) {
  const { signedIn } = useAuth()
  const viewer = useAccountId()
  const tries = kind === 'board' ? (progress?.tries ?? 0) : 0
  // Ace Chase is just for fun (data/games.ts Game.ranked): a past hole keeps no board, so a run here is practice.
  const labelSub =
    kind === 'practice'
      ? 'Play it as often as you like: it’s practice, and nothing is saved.'
      : `Your first bullseye here goes on this hole’s ${ALL_TIME} board, and every try counts, even if you leave and come back. Today’s board, your week and your rank stay as they are.`
  return (
    <PastCourseStart
      slug={SLUG}
      course={hole.n}
      day={hole.day}
      kind={kind}
      title={hole.def.name}
      blurb={`Ace Chase hole #${hole.n}, on ${PLACE_NAME[hole.pick.style]}. It was the day’s hole on ${whenWords(hole.day)}.`}
      labelSub={labelSub}
      facts={facts}
      note={kind === 'board' ? `Taking its record pays ${RECORD_TICKETS} tickets, once.` : undefined}
      startLabel={tries > 0 ? 'Carry on' : hadResult ? 'Play it again' : 'Play it'}
      onStart={onStart}
      // A run for its board is its player's, so it waits until the account signed in is known. Practice doesn't.
      startDisabled={kind === 'board' && viewer === undefined}
      today={todayCourse()}
      walk={walkFrom(hole)}
    >
      {!signedIn && kind === 'board' ? (
        <div className="acechase-daily__signin">
          <SignInButton />
        </div>
      ) : null}
      {tries > 0 ? <p className="past-card__note">You&rsquo;re {triesWords(tries)} in. Every try counts, so they carry on.</p> : null}
    </PastCourseStart>
  )
}

/** What became of a past hole's result: on its board, or why not yet. */
type Send =
  | { phase: 'waiting' }
  | { phase: 'sending' }
  | { phase: 'done'; answer: PastHoleResult }
  | { phase: 'signedOut' }
  | { phase: 'noTag' }
  | { phase: 'otherAccount' }
  | { phase: 'failed'; error: string }

/** Signed in with no tag yet: a tag puts the result on the hole's All time board, which the card then does. */
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
      <TagSlots
        id={id}
        value={draft}
        onChange={setDraft}
        onSubmit={() => void submit()}
        lead={`Put your tag on it and it goes on the hole’s ${ALL_TIME} board.`}
        error={error}
      />
      <button type="button" className="panel__btn" disabled={!name || busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Put it on the board'}
      </button>
    </div>
  )
}

/** A few rows of the hole's All time board, yours marked: the top three, and yours under them if it's lower. */
function boardRows(hole: TodaysHole, board: HoleBoard | null, players: number, name: string, you: HoleBoard['you']): PastBoard | null {
  if (!board || board.entries.length === 0) return null
  const rows: PastBoardRow[] = board.entries.slice(0, 3).map((e, i) => ({
    place: i + 1,
    name: e.name,
    result: triesWords(e.tries),
    record: i === 0,
    you: Boolean(name) && e.name === name,
  }))
  if (you && name && !rows.some((r) => r.you)) {
    // A result just sent that the board, asked again, hasn't caught up with: the rows wait for it.
    if (you.place <= board.entries.length && !board.entries.some((e) => e.name === name)) return null
    rows.push({ place: you.place, name, result: triesWords(you.tries), you: true })
  }
  return { title: `${ALL_TIME} · ${hole.def.name}`, count: playersWords(players), rows }
}

/**
 * The card a past hole's bullseye brings up: where it went, the hole's board, and that your week and rank
 * are as they were. A run for the board sends its first bullseye from here, signed in with a tag (once:
 * lib/pastHoles.ts), as its own player's (lib/deviceRuns.ts): played as an account, only once that account
 * is signed in. Practice sends nothing.
 */
export function PastResultCard({
  hole,
  tries,
  practice,
  solved,
  own,
  owner,
  figures,
  next,
  onSent,
  onAgain,
}: {
  hole: TodaysHole
  /** The bullseye's tries. */
  tries: number
  practice: boolean
  /** The run's result on this device, to send if it hasn't gone. */
  solved: (DailySolved & { sent?: boolean }) | null
  /** The player's own bullseye on the hole on this device, which a practice run stands beside. */
  own: DailySolved | null
  /** Whose the run is: its stamp (lib/deviceRuns.ts); null for practice. */
  owner: string | null
  figures: PastHoleFigures
  /** What the next run here does, for the again button. */
  next: PastKind
  onSent: (answer: PastHoleResult) => void
  onAgain: () => void
}) {
  const { signedIn, loading } = useAuth()
  const viewer = useAccountId()
  const name = normalizePlayerName(usePlayerName())
  const [send, setSend] = useState<Send>(() => {
    const answer = pastHoleAnswer(hole.day, viewer)
    return answer ? { phase: 'done', answer } : { phase: 'waiting' }
  })
  const shown = useRef(true)
  const sentRef = useRef(onSent)
  sentRef.current = onSent
  // The play loop draws the card afresh several times a second, with a new `solved` each time: the send
  // goes by what it is, not by that.
  const solvedRef = useRef(solved)
  solvedRef.current = solved
  const solvedAt = solved?.at ?? null
  const solvedSent = solved?.sent === true
  // Played as one account, and another (or nobody) signed in now: it waits for its own player.
  const otherAccount = owner != null && owner !== SIGNED_OUT && viewer !== undefined && owner !== viewer

  useEffect(() => {
    shown.current = true
    return () => {
      shown.current = false
    }
  }, [])

  useEffect(() => {
    if (practice || loading || send.phase === 'done' || send.phase === 'sending') return
    const result = solvedRef.current
    if (!result || solvedSent || !owner) return
    if (otherAccount) {
      setSend({ phase: 'otherAccount' })
      return
    }
    if (!signedIn) {
      setSend({ phase: 'signedOut' })
      return
    }
    // Signed in, but whose account it is isn't known yet: asked again once it is.
    if (viewer === undefined) return
    if (!name) {
      setSend({ phase: 'noTag' })
      return
    }
    setSend({ phase: 'sending' })
    sendPastResult(hole.day, owner, result).then(
      (answer) => {
        if (answer) sentRef.current(answer)
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
  }, [practice, loading, signedIn, viewer, otherAccount, name, solvedAt, solvedSent, owner, hole.day])

  const board = figures.board
  const answer = send.phase === 'done' ? send.answer : null
  const you = answer?.you ?? board?.you ?? null
  const players = answer?.players ?? board?.players ?? 0
  const record = answer?.record ?? board?.entries[0] ?? null
  // What the run did: went on the board, or saved nothing (practice, or a result there already stands).
  const kind: PastKind = practice || (answer && !answer.kept) ? 'practice' : 'board'
  const saving = !practice && (send.phase === 'sending' || (send.phase === 'waiting' && solved != null && !solved.sent))
  const holeBoard = `${hole.def.name}’s ${ALL_TIME} board`

  let headline: ReactNode = undefined
  let line: ReactNode = null
  let status: ReactNode = null
  if (practice) {
    const stands = you ?? (own ? { tries: own.tries, place: null } : null)
    if (stands) {
      line = stands.place
        ? `Your first bullseye here stands: ${triesWords(stands.tries)}, ${ordinal(stands.place)} of ${players} on its ${ALL_TIME} board.`
        : `Your first bullseye here stands: ${triesWords(stands.tries)}.`
    }
  } else if (answer && !answer.kept) {
    headline = 'Your first bullseye here stands'
    line = you
      ? `It’s ${triesWords(you.tries)}, ${ordinal(you.place)} of ${players} on its ${ALL_TIME} board. This one wasn’t saved.`
      : 'This one wasn’t saved.'
  } else if (answer) {
    // "3rd All time on Blizzard Bumps", as a past track's card says it.
    headline = you ? `${ordinal(you.place)} ${ALL_TIME} on ${hole.def.name}` : `On ${holeBoard}`
    if (answer.tookRecord) status = <p className="acechase-past__news">Hole record! Nobody has done it in fewer.</p>
    else if (record && you && record.tries === you.tries) line = `Tied with ${record.name}’s record, ${triesWords(record.tries)}. They got there first.`
    else if (record) line = `The record is ${record.name}’s, in ${triesWords(record.tries)}.`
  } else if (saving) {
    headline = `Putting it on ${holeBoard}…`
  } else {
    headline = `Not on its ${ALL_TIME} board yet`
    if (send.phase === 'otherAccount') status = <PlayedAs owner={owner} signedIn={signedIn} />
    else if (send.phase === 'signedOut') status = <SignIn>Sign in and this result goes on the hole&rsquo;s {ALL_TIME} board.</SignIn>
    else if (send.phase === 'noTag') status = <HoleTag />
    else if (send.phase === 'failed') status = <p className="panel__error">{send.error}</p>
  }

  return (
    <PastCourseResult
      slug={SLUG}
      course={hole.n}
      day={hole.day}
      kind={kind}
      figure={triesWords(tries)}
      headline={headline}
      line={line}
      board={boardRows(hole, board, players, answer?.name ?? name, you)}
      today={todayCourse()}
      againLabel={next === 'board' && kind === 'practice' ? 'Play it for its board' : undefined}
      againBusy={saving}
      onAgain={onAgain}
    >
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
                leavePlay(prizesHref())
              }}
            >
              Prize counter ›
            </a>
          </span>
        </p>
      ) : null}
    </PastCourseResult>
  )
}
