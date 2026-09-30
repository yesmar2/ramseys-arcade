import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { useMyAvatarId } from '../../hooks/useMyAvatarId'
import { dayBoardHref, gamePlayHref, rankHowHref, ROUTE_EVENT } from '../../hooks/useHashRoute'
import { archiveDayWords, useDailyDays, type ArchiveDay } from '../../lib/archive'
import {
  capitalWord,
  COURSE_BOARD_ANCHOR,
  coursesWord,
  fetchDayTop,
  PAST_PAGE,
  pastDays,
  pastKindFor,
  setOnWords,
  stripDayWords,
  usePastViewer,
  verbDone,
  weekDays,
  type CourseBoard,
  type CourseFigure,
  type CourseTop,
  type DayTop,
  type PastSource,
  type PastViewer,
} from '../../lib/dailyPast'
import { dailyWords } from '../../lib/dailyWords'
import { formatLeaderboardScore } from '../../lib/leaderboardFormat'
import { ordinal } from '../../lib/profileMath'
import { BoardEmpty } from '../BoardChrome'
import { PlayerAvatar } from '../PlayerAvatar'
import { PlayerName } from '../PlayerName'
import { RunLabel } from '../RunLabel'
import { openSiteMenu } from '../siteNav'
import '../../styles/dailyPast.css'

/*
 * A daily's past courses, the past tab of its page: the rule (what a past course counts toward), the last
 * seven days with your place each day, then every course before today's, newest first. Each row says how
 * its day went (who was 1st, how many played, and you), for Hot Lap and Ace Chase its own board too, what
 * a run on it does now, and the way to play it. Its day's final board, and the course's own, open on the
 * row (the top ten and you) or on the day's page (all of it). A row's drawing (and the line under its date) is worked out
 * only as it comes near the screen, so a long list costs no more to open than a short one.
 */

/** How the days' results stand: still asked, in, or not to be had. */
type DaysState = 'wait' | 'ok' | 'failed'

const COURSE_HASH = '#course-'

/** The course a `#course-<id>` address asks for, if it asks for one. */
function hashCourse(): string | null {
  const hash = window.location.hash
  if (!hash.startsWith(COURSE_HASH)) return null
  try {
    return decodeURIComponent(hash.slice(COURSE_HASH.length))
  } catch {
    return null
  }
}

/** Whether an element has come within a screen of the view: once it has, it stays true. */
function useNear<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setNear(true)
        seen.disconnect()
      },
      { rootMargin: '600px 0px' },
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [near])
  return [ref, near]
}

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
)

/** "14 players", "1 driver". */
function count(n: number, word: string): string {
  return `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`
}

/** "6th", "6th and 15th", "1st, 6th and 15th". */
function listWords(words: string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * When a course's record came, beside its board: still its day's 1st result, or set since. Null when
 * there's no telling.
 */
function recordWhen(board: CourseBoard, record: CourseFigure, entry: ArchiveDay | undefined, day: string, today: string): string | null {
  if (entry && record.score === entry.top.score) return 'Unbeaten since its day'
  if (board.setOn && board.setOn > day) return `Set ${setOnWords(board.setOn, today)}, after its day`
  if (entry && !board.setOn) return 'Set after its day'
  return null
}

/** One player and their result, with what it is: "LATTE 1st 1:15.31", "DAD record 1:14.41". */
function Lead({ figure, what, fmt }: { figure: { name: string; score: number; avatarId?: string }; what: string; fmt: (score: number) => string }) {
  return (
    <p className="dp-fact__lead">
      <PlayerAvatar avatarId={figure.avatarId} name={figure.name} size="sm" className="dp-fact__avatar" />
      <PlayerName className="dp-fact__name" name={figure.name} avatarId={figure.avatarId} />
      <span className="dp-fact__what">{what}</span>
      <b className="dp-fact__figure">{fmt(figure.score)}</b>
    </p>
  )
}

/** What the past tab is: the label a past course's runs wear here, and the rule in words. */
function RuleBox({ source, signedIn }: { source: PastSource; signedIn: boolean }) {
  const { slug, boards } = source
  const words = dailyWords(slug)
  const onBoards = words.past === 'board' && boards
  const kind = onBoards && signedIn ? 'board' : 'practice'
  return (
    <section className={`dp-rule dp-rule--${kind}`} aria-label={`What ${words.pastTab.toLowerCase()} count toward`}>
      <RunLabel kind={kind} slug={slug} className="dp-rule__label" />
      <p className="dp-rule__text">
        {onBoards ? (
          <>
            <b>{words.pastTab} don’t count toward your rank.</b>{' '}
            {signedIn
              ? `Each keeps a board of its own: ${onBoards.rule}`
              : `Signed in, each keeps a board of its own: ${onBoards.rule} Signed out, they’re practice.`}
          </>
        ) : (
          <>
            <b>{words.pastTab} are practice:</b> {words.verb.toLowerCase()} any again, nothing is saved. Only today’s counts toward
            your rank.
          </>
        )}
      </p>
      <a className="dp-rule__how" href={rankHowHref()}>
        How your rank works ›
      </a>
    </section>
  )
}

/** A day on the week strip: its course drawn, and where you finished that day. */
function StripDay({
  source,
  day,
  entry,
  daysState,
  viewer,
  onJump,
}: {
  source: PastSource
  day: string
  entry: ArchiveDay | undefined
  daysState: DaysState
  viewer: PastViewer
  onJump: (day: string) => (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const { slug, art: drawArt } = source
  const [ref, near] = useNear<HTMLAnchorElement>()
  const art = useMemo(() => (near ? drawArt(day) : null), [near, drawArt, day])
  const isToday = day === source.today
  const done = verbDone(slug)
  let you: ReactNode = '…'
  if (daysState === 'failed') you = ' '
  else if (daysState === 'ok') {
    if (viewer.state === 'in') {
      if (entry?.you) {
        // A day before the game's days counted has your result but no place.
        you =
          entry.you.place != null ? (
            <>
              <b>{ordinal(entry.you.place)}</b> of {entry.players.toLocaleString()}
              {isToday ? ' so far' : ''}
            </>
          ) : (
            <b>{capitalWord(done)}</b>
          )
      } else you = isToday ? `Not ${done} yet` : `Didn’t ${dailyWords(slug).verb.toLowerCase()}`
    } else if (viewer.state === 'out') {
      you = entry ? `${entry.players.toLocaleString()} ${done} it${isToday ? ' so far' : ''}` : isToday ? 'Nobody yet' : `Nobody ${done} it`
    } else you = ' '
  }
  const missed = daysState === 'ok' && viewer.state === 'in' && !isToday && !entry?.you
  return (
    <li className="dp-week__item">
      <a
        ref={ref}
        className={`dp-day${isToday ? ' dp-day--today' : ''}${missed ? ' dp-day--missed' : ''}`}
        href={isToday ? gamePlayHref(slug) : `${COURSE_HASH}${encodeURIComponent(source.anchor(day))}`}
        onClick={isToday ? undefined : onJump(day)}
      >
        {/* Today's pill sits beside its date; on a phone, over its result (dailyPast.css), so the date keeps to a line. */}
        <span className="dp-day__top">
          <span className="dp-day__date">{stripDayWords(day)}</span>
          {isToday ? <span className="dp-day__pill dp-day__pill--top">Today</span> : null}
          <span className={`dp-day__n${isToday ? ' dp-day__n--today' : ''}`}>#{source.number(day)}</span>
        </span>
        <span className="dp-art dp-day__art" aria-hidden="true">
          {art}
        </span>
        <span className="dp-day__you">
          {isToday ? <span className="dp-day__pill dp-day__pill--you">Today</span> : null}
          {you}
        </span>
      </a>
    </li>
  )
}

/** Which board a row's peek shows: its day's final board, or (Hot Lap, Ace Chase) the course's own. */
type PeekSide = 'day' | 'course'

type Peek = { top: CourseTop | DayTop | null; failed: boolean }

/** The day's page with all of a board on it: its day's final board, or opened at the course's own. */
function fullBoardHref(slug: string, day: string, side: PeekSide): string {
  return side === 'course' ? `${dayBoardHref(slug, day)}#${COURSE_BOARD_ANCHOR}` : dayBoardHref(slug, day)
}

/** "Final · the top 10 of 14 players", "Track board · all 3 drivers": what a peek's list is. */
function peekHead(source: PastSource, side: PeekSide, board: CourseTop | DayTop): string {
  const course = side === 'course'
  const player = course ? (source.boards?.player ?? 'player') : 'player'
  const many =
    board.players > board.top.length ? `the top ${board.top.length} of ${count(board.players, player)}` : `all ${count(board.players, player)}`
  if (course) return `${capitalWord(dailyWords(source.slug).course)} board · ${many}`
  // A day before the game's days counted (Ace Chase's first two) kept a board all the same.
  const early = 'counted' in board && !board.counted ? ' · before the daily’s days counted' : ''
  return `Final · ${many}${early}`
}

/**
 * A row's board, opened on it: the top ten of its day's final board, and you under them if you were further
 * down, with a link to all of it. Where the course keeps a board of its own, a switch shows that one's
 * top ten instead, and the link goes to all of that one. Each is asked for the first time it's shown.
 */
function BoardPeek({
  source,
  day,
  name,
  id,
  side,
  onSide,
  label,
}: {
  source: PastSource
  day: string
  name: string
  id: string
  side: PeekSide
  onSide: (side: PeekSide) => void
  /** The row's course and day, for the link's name: "#3 Seneca Glen, Mon, Sep 28". */
  label: string
}) {
  const { slug, boards } = source
  const fetchTop = boards?.fetchTop
  const [asks, setAsks] = useState(0)
  const [peeks, setPeeks] = useState<Partial<Record<PeekSide, Peek>>>({})
  const myAvatar = useMyAvatarId(name)
  const peek = peeks[side]
  const loaded = Boolean(peek?.top)
  useEffect(() => {
    if (loaded) return
    const ask = side === 'day' ? () => fetchDayTop(slug, day, name) : fetchTop ? () => fetchTop(day, name) : null
    if (!ask) return
    let live = true
    ask()
      .then((top) => {
        if (live) setPeeks((p) => ({ ...p, [side]: { top, failed: false } }))
      })
      .catch(() => {
        if (live) setPeeks((p) => ({ ...p, [side]: { top: null, failed: true } }))
      })
    return () => {
      live = false
    }
  }, [side, loaded, slug, day, name, fetchTop, asks])
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const board = peek?.top ?? null
  const courseWord = dailyWords(slug).course
  const course = capitalWord(courseWord)
  return (
    <div className={`dp-board dp-board--${side}`} id={id}>
      <div className="dp-board__bar">
        {boards ? (
          <div className="dp-board__switch" role="group" aria-label="Which board">
            <button type="button" className="dp-board__side" aria-pressed={side === 'day'} onClick={() => onSide('day')}>
              On its day
            </button>
            <button
              type="button"
              className="dp-board__side dp-board__side--course"
              aria-pressed={side === 'course'}
              onClick={() => onSide('course')}
            >
              <FlagIcon />
              {course} board
            </button>
          </div>
        ) : null}
        {board ? <p className="dp-board__head">{peekHead(source, side, board)}</p> : null}
        <a
          className="dp-board__full"
          href={fullBoardHref(slug, day, side)}
          aria-label={side === 'course' ? `Full ${courseWord} board of ${label}` : `Full board of ${label}`}
        >
          {side === 'course' ? `Full ${courseWord} board ›` : 'Full board ›'}
        </a>
      </div>
      {board ? (
        board.top.length ? (
          <ol className="dp-board__list">
            {board.top.map((e, i) => (
              <li key={e.name} className={`dp-board__row${e.name === name ? ' dp-board__row--you' : ''}`}>
                <span className="dp-board__place">{ordinal(e.place ?? i + 1)}</span>
                <PlayerAvatar avatarId={e.avatarId} name={e.name} size="sm" />
                <PlayerName className="dp-board__name" name={e.name} avatarId={e.avatarId} />
                <b className="dp-board__figure">{fmt(e.score)}</b>
              </li>
            ))}
            {board.you && board.you.place > board.top.length ? (
              <li className="dp-board__row dp-board__row--you dp-board__row--gap">
                <span className="dp-board__place">{ordinal(board.you.place)}</span>
                <PlayerAvatar avatarId={myAvatar} name={name} size="sm" />
                <span className="dp-board__name">{name}</span>
                <b className="dp-board__figure">{fmt(board.you.score)}</b>
              </li>
            ) : null}
          </ol>
        ) : (
          <p className="dp-board__note">{side === 'day' ? `Nobody ${verbDone(slug)} it on its day.` : 'Nobody on its board yet.'}</p>
        )
      ) : peek?.failed ? (
        <p className="dp-board__note">
          Couldn’t load its board.{' '}
          <button
            type="button"
            className="dp-link-btn"
            onClick={() => {
              setPeeks((p) => ({ ...p, [side]: undefined }))
              setAsks((n) => n + 1)
            }}
          >
            Try again
          </button>
        </p>
      ) : (
        <p className="dp-board__note" aria-busy="true">
          Loading its board…
        </p>
      )}
    </div>
  )
}

/** A past course: what it is, how its day went, its board if it keeps one, and the way to play it. */
function PastRow({
  source,
  day,
  entry,
  daysState,
  viewer,
  here,
}: {
  source: PastSource
  day: string
  entry: ArchiveDay | undefined
  daysState: DaysState
  viewer: PastViewer
  here: boolean
}) {
  const { slug, boards, title, sub: describeSub, art: drawArt } = source
  const words = dailyWords(slug)
  const verb = words.verb.toLowerCase()
  const done = verbDone(slug)
  const [ref, near] = useNear<HTMLLIElement>()
  const sub = useMemo(() => (near ? describeSub(day) : null), [near, describeSub, day])
  const art = useMemo(() => (near ? drawArt(day) : null), [near, drawArt, day])
  const [open, setOpen] = useState<PeekSide | null>(null)
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const anchor = source.anchor(day)
  const signedIn = viewer.state !== 'out'
  const showYou = viewer.state === 'in'
  const board: CourseBoard | undefined = boards?.rows?.get(day)
  // Whether what a run here does, and whether you've played it, can be told yet: straight away signed out;
  // signed in, once the days and (for a game whose courses keep boards) the boards have come. Until then
  // the row says neither. Days that couldn't be had still leave it told, from the boards.
  const known = viewer.state === 'out' || (viewer.state === 'in' && daysState !== 'wait' && (!boards || boards.rows !== null))
  const hadResult = Boolean(entry?.you || board?.you || source.resultHere?.(day))
  const kind = pastKindFor(slug, signedIn, Boolean(source.firstResultOnly), hadResult)
  const hint = known ? (source.hint?.({ kind, signedIn, board }) ?? null) : null
  const played = known && showYou && hadResult
  const record = board?.record ?? null
  const when = board && record ? recordWhen(board, record, entry, day, source.today) : null
  const panelId = `dp-board-${anchor}`
  const label = `${title(day)}, ${archiveDayWords(day)}`
  // Each card's Board opens the peek at its own board; again, it closes it.
  const opener = (side: PeekSide) => (
    <button
      type="button"
      className="dp-link-btn dp-fact__open"
      aria-expanded={open === side}
      aria-controls={open ? panelId : undefined}
      onClick={() => setOpen((o) => (o === side ? null : side))}
    >
      {open === side ? 'Hide board' : 'Board ›'}
    </button>
  )
  return (
    <li
      ref={ref}
      id={`course-${anchor}`}
      tabIndex={-1}
      className={`dp-row${boards ? ' dp-row--board' : ''}${here ? ' dp-row--here' : ''}`}
    >
      <a className="dp-art dp-row__art" href={source.playHref(day)} tabIndex={-1} aria-hidden="true">
        {art}
      </a>
      <div className="dp-row__name">
        <h3 className="dp-row__title">{title(day)}</h3>
        <p className="dp-row__date">{archiveDayWords(day)}</p>
        <p className="dp-row__sub">{sub ?? ' '}</p>
      </div>
      <div className="dp-row__facts">
        <div className="dp-fact">
          <div className="dp-fact__top">
            <p className="dp-fact__kicker">On its day</p>
            <a className="dp-fact__full" href={dayBoardHref(slug, day)} aria-label={`Full board of ${label}`}>
              Full board ›
            </a>
          </div>
          {daysState === 'wait' ? (
            <p className="dp-fact__wait" aria-busy="true">
              …
            </p>
          ) : daysState === 'failed' ? (
            <p className="dp-fact__none">Couldn’t load its day.</p>
          ) : entry ? (
            <>
              <Lead figure={entry.top} what="1st" fmt={fmt} />
              {showYou ? (
                entry.you ? (
                  <p className="dp-fact__you">
                    You {entry.you.place != null ? `${ordinal(entry.you.place)} of ${entry.players.toLocaleString()}` : `${done} it`}
                    <span className="dp-fact__figure">{fmt(entry.you.score)}</span>
                  </p>
                ) : (
                  <p className="dp-fact__you dp-fact__you--none">You didn’t {verb} it on its day</p>
                )
              ) : null}
              <p className="dp-fact__note">
                {count(entry.players, 'player')} {done} it that day
                {opener('day')}
              </p>
            </>
          ) : (
            <p className="dp-fact__none">Nobody {done} it on its day</p>
          )}
        </div>
        {boards ? (
          <div className="dp-fact dp-fact--board">
            <div className="dp-fact__top">
              <p className="dp-fact__kicker">
                <FlagIcon />
                {capitalWord(words.course)} board
              </p>
              <a className="dp-fact__full" href={fullBoardHref(slug, day, 'course')} aria-label={`Full ${words.course} board of ${label}`}>
                Full board ›
              </a>
            </div>
            {boards.rows === null ? (
              boards.failed ? (
                <p className="dp-fact__none">
                  Couldn’t load its board.{' '}
                  <button type="button" className="dp-link-btn" onClick={boards.retry}>
                    Try again
                  </button>
                </p>
              ) : (
                <p className="dp-fact__wait" aria-busy="true">
                  …
                </p>
              )
            ) : record && board ? (
              <>
                <Lead figure={record} what="record" fmt={fmt} />
                {showYou ? (
                  board.you ? (
                    <p className="dp-fact__you">
                      You {ordinal(board.you.place)} of {board.players.toLocaleString()}
                      <span className="dp-fact__figure">{fmt(board.you.score)}</span>
                    </p>
                  ) : (
                    <p className="dp-fact__you dp-fact__you--none">You’re not on it yet</p>
                  )
                ) : null}
                <p className="dp-fact__note">
                  {when ? `${when} · ` : ''}
                  {count(board.players, boards.player)}
                  {opener('course')}
                </p>
              </>
            ) : (
              <p className="dp-fact__none">Nobody on its board yet</p>
            )}
          </div>
        ) : null}
      </div>
      <div className="dp-row__go">
        {known ? (
          <>
            <RunLabel kind={kind} slug={slug} className="dp-row__label dp-wide" />
            <RunLabel kind={kind} slug={slug} short className="dp-row__label dp-narrow" />
          </>
        ) : (
          <p className="dp-fact__wait dp-row__label dp-row__label--wait" aria-busy="true">
            …
          </p>
        )}
        <a className={`dp-go dp-go--${kind}`} href={source.playHref(day)}>
          {words.verb} it{played ? ' again' : ''}
        </a>
        {hint ? <p className="dp-row__hint">{hint}</p> : null}
      </div>
      {open ? (
        <BoardPeek
          key={viewer.name}
          source={source}
          day={day}
          name={viewer.name}
          id={panelId}
          side={boards ? open : 'day'}
          onSide={setOpen}
          label={label}
        />
      ) : null}
    </li>
  )
}

/** A daily's past courses, as its page's past tab shows them. */
export function PastCourses({ source }: { source: PastSource }) {
  const { slug, today, first, boards } = source
  const words = dailyWords(slug)
  const viewer = usePastViewer()
  const signedIn = viewer.state !== 'out'
  const { days, failed, retry } = useDailyDays(slug, viewer.name)
  const daysState: DaysState = days ? 'ok' : failed ? 'failed' : 'wait'
  const byDay = useMemo(() => new Map((days ?? []).map((d) => [d.day, d])), [days])
  const courses = useMemo(() => pastDays(today, first), [today, first])
  const week = useMemo(() => weekDays(today, first), [today, first])
  const [shown, setShown] = useState(PAST_PAGE)
  const [target, setTarget] = useState<{ key: string } | null>(null)
  const [here, setHere] = useState<string | null>(null)
  const weekRef = useRef<HTMLElement>(null)
  const stripRef = useRef<HTMLOListElement>(null)
  const anchorOf = source.anchor

  // A link to one course's row (the Records tab's, a past course's way back) lands on it.
  useEffect(() => {
    const read = () => {
      const key = hashCourse()
      if (key) setTarget({ key })
    }
    read()
    window.addEventListener('hashchange', read)
    window.addEventListener('popstate', read)
    window.addEventListener(ROUTE_EVENT, read)
    return () => {
      window.removeEventListener('hashchange', read)
      window.removeEventListener('popstate', read)
      window.removeEventListener(ROUTE_EVENT, read)
    }
  }, [])

  // Page the row in if it's further down than the list goes yet, then bring it into view: once the rows
  // above it have their results, so it stays where it lands, and after the page's own scroll to the top
  // on arriving (App), which runs after this.
  const settled = daysState !== 'wait' && (!boards || boards.rows !== null || Boolean(boards.failed))
  useEffect(() => {
    if (!target || !settled) return
    const at = courses.findIndex((day) => day === target.key || anchorOf(day) === target.key)
    if (at >= shown) {
      setShown(Math.ceil((at + 1) / PAST_PAGE) * PAST_PAGE)
      return
    }
    const timer = window.setTimeout(() => {
      setTarget(null)
      if (at < 0) {
        // Today's course has no row: its day on the strip is where it is.
        if (target.key === today || target.key === anchorOf(today)) weekRef.current?.scrollIntoView({ block: 'start' })
        return
      }
      const day = courses[at]!
      const row = document.getElementById(`course-${anchorOf(day)}`)
      if (!row) return
      row.scrollIntoView({ block: 'start' })
      row.focus({ preventScroll: true })
      setHere(day)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [target, settled, shown, courses, today, anchorOf])

  // On a phone the strip scrolls sideways: start it at today's end.
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (strip) strip.scrollLeft = strip.scrollWidth
  }, [week.length])

  const jump = (day: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const key = anchorOf(day)
    window.history.replaceState(window.history.state, '', `${COURSE_HASH}${encodeURIComponent(key)}`)
    setTarget({ key })
  }

  // Yours across every past course: how many you played on their day, your best place, the boards you're
  // on, and the record you're nearest (of those you don't hold) on a board you can climb.
  const summary = useMemo(() => {
    if (viewer.state !== 'in' || !days || courses.length === 0) return null
    let played = 0
    let best: { day: string; place: number } | null = null
    for (const day of courses) {
      const you = byDay.get(day)?.you
      if (!you) continue
      played += 1
      // A day before the game's days counted has no place to be best.
      if (you.place != null && (!best || you.place < best.place)) best = { day, place: you.place }
    }
    const rows = boards?.rows
    if (!rows) return { played, best, onBoards: null, nearest: null }
    const on = courses.filter((day) => rows.get(day)?.you)
    const places = on.map((day) => ordinal(rows.get(day)!.you!.place))
    let nearest: { day: string; off: number; holder: string; score: number; record: number } | null = null
    for (const day of on) {
      const { you, record } = rows.get(day)!
      if (!you || !record || you.place === 1) continue
      const off = record.score - you.score
      if (!nearest || off < nearest.off) nearest = { day, off, holder: record.name, score: you.score, record: record.score }
    }
    return { played, best, onBoards: { count: on.length, places: places.length <= 3 ? places : null }, nearest }
  }, [viewer.state, days, courses, byDay, boards?.rows])
  const gap = boards?.gap

  const course = words.course
  const listed = courses.slice(0, shown)
  return (
    <div className="dp">
      <RuleBox source={source} signedIn={signedIn} />

      {daysState === 'failed' ? (
        <p className="dp-oops" role="alert">
          Couldn’t load how each day went.{' '}
          <button type="button" className="dp-link-btn" onClick={retry}>
            Try again
          </button>
        </p>
      ) : null}

      <section ref={weekRef} className="dp-week" aria-labelledby="dp-week-title">
        <div className="dp-week__main">
          <div className="dp-week__head">
            <h2 id="dp-week-title" className="dp-week__title">
              Last 7 days
            </h2>
            <p className="dp-week__lede">
              {[
                courses.length ? (course === 'day' ? 'Pick a day to jump to it.' : `Pick a day to jump to its ${course}.`) : '',
                viewer.state === 'in' ? 'Your place is where you finished on the day itself.' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          </div>
          <ol ref={stripRef} className="dp-week__days">
            {week.map((day) => (
              <StripDay key={day} source={source} day={day} entry={byDay.get(day)} daysState={daysState} viewer={viewer} onJump={jump} />
            ))}
          </ol>
          {viewer.state === 'out' ? (
            <p className="dp-signin">
              <button type="button" className="dp-link-btn" onClick={openSiteMenu}>
                Sign in
              </button>{' '}
              to see how you did.
            </p>
          ) : null}
        </div>
        {summary ? (
          <div className="dp-sum">
            <p className="dp-sum__kicker">Your {words.pastTab.toLowerCase()}</p>
            <div className="dp-sum__stats">
              <p className="dp-stat">
                <b>
                  {summary.played} of {courses.length}
                </b>
                <span>{verbDone(slug)} on their day</span>
              </p>
              {summary.best ? (
                <p className="dp-stat">
                  <b>{ordinal(summary.best.place)}</b>
                  <span>best finish on its day · {source.title(summary.best.day)}</span>
                </p>
              ) : null}
              {summary.onBoards ? (
                <p className="dp-stat">
                  <b>{summary.onBoards.count}</b>
                  <span>
                    {course} {summary.onBoards.count === 1 ? 'board' : 'boards'} you’re on
                    {summary.onBoards.places?.length ? ` · ${listWords(summary.onBoards.places)}` : ''}
                  </span>
                </p>
              ) : null}
              {summary.nearest && gap ? (
                <p className="dp-stat">
                  <b>{gap(summary.nearest.score, summary.nearest.record)}</b>
                  <span>
                    off a record · {summary.nearest.holder} on {source.title(summary.nearest.day)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {courses.length ? (
        <section className="dp-list" aria-labelledby="dp-list-title">
          <div className="dp-list__head">
            <h2 id="dp-list-title" className="dp-list__title">
              {words.pastTab}
            </h2>
            <span className="dp-list__count">
              Newest first · {courses.length.toLocaleString()} {coursesWord(slug, courses.length)}
            </span>
            <p className="dp-legend">
              <span>
                <b>On its day</b> how it went the day it counted
              </span>
              {boards ? (
                <span>
                  <b className="dp-legend__board">{capitalWord(course)} board</b> {boards.legend}
                </span>
              ) : null}
            </p>
          </div>
          <ol className="dp-list__rows">
            {listed.map((day) => (
              <PastRow key={day} source={source} day={day} entry={byDay.get(day)} daysState={daysState} viewer={viewer} here={here === day} />
            ))}
          </ol>
          {courses.length > listed.length ? (
            <div className="dp-more">
              <button type="button" className="dp-more__btn" onClick={() => setShown((n) => n + PAST_PAGE)}>
                Show more
              </button>
              <span className="dp-more__count">
                Showing {listed.length.toLocaleString()} of {courses.length.toLocaleString()} {coursesWord(slug)}
              </span>
            </div>
          ) : null}
        </section>
      ) : (
        <BoardEmpty
          title={`No ${words.pastTab.toLowerCase()} yet`}
          detail={`${words.today} is the first. From tomorrow it’s here to ${words.verb.toLowerCase()} again.`}
        />
      )}
    </div>
  )
}
