import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { isRankedGame } from '../../data/games'
import { useMyAvatarId } from '../../hooks/useMyAvatarId'
import { ROUTE_EVENT } from '../../hooks/useHashRoute'
import { archiveDayWords, useDailyDays, type ArchiveDay } from '../../lib/archive'
import {
  coursesWord,
  PAST_PAGE,
  PRACTICE_TIP,
  pastDays,
  pastHowTitle,
  pastKindFor,
  usePastViewer,
  verbDone,
  type CourseBoard,
  type CourseFigure,
  type PastSource,
  type PastViewer,
} from '../../lib/dailyPast'
import { BOARD_NAMES, boardTip, dailyWords, type PastBoard, type PastKind } from '../../lib/dailyWords'
import { formatLeaderboardScore } from '../../lib/leaderboardFormat'
import { ordinal } from '../../lib/profileMath'
import { BoardEmpty } from '../BoardChrome'
import { BoardsIcon, PlayIcon } from '../chromeIcons'
import { InfoTip } from '../InfoTip'
import { PastBoardsModal } from '../PastBoardsModal'
import { PastHowModal } from '../PastHowModal'
import { AllTimeIcon, CrownIcon, InfoIcon, PracticeIcon, RankedIcon } from '../pastIcons'
import { PlayerAvatar } from '../PlayerAvatar'
import { PlayerName } from '../PlayerName'
import '../../styles/dailyPast.css'

/*
 * A daily's past courses, the past tab of its page: a card for every course before today's, newest first,
 * four across on a desk and one or two on a phone. A card has the course's picture, name and day, its
 * Ranked line (your place that day, or its 1st) and, for Hot Lap and Ace Chase, its All time line (your
 * place on the course's own board, or its record), and the way to play it. Words are kept off the page:
 * each label's tip says what its board is, the ⓘ beside the title opens "How past tracks work", and a card
 * opens its boards in a panel (PastBoardsModal), the top five and you. A card's picture is drawn only as
 * it comes near the screen, so a long list costs no more to open than a short one.
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

/**
 * What a run on a past course does for the viewer: it goes on the course's All time board, or it's practice.
 * Null while that can't be told: signed in on Ace Chase, whose holes take only a first result, until your
 * results have come.
 */
function kindOf(
  source: PastSource,
  day: string,
  entry: ArchiveDay | undefined,
  board: CourseBoard | undefined,
  daysState: DaysState,
  viewer: PastViewer,
): PastKind | null {
  const { slug, boards, firstResultOnly = false } = source
  const signedIn = viewer.state !== 'out'
  if (signedIn && firstResultOnly && dailyWords(slug).past === 'board') {
    const results = viewer.state === 'in' && daysState !== 'wait' && (!boards || boards.rows !== null || Boolean(boards.failed))
    if (!results) return null
  }
  const had = Boolean(entry?.you || board?.you || source.resultHere?.(day))
  return pastKindFor(slug, signedIn, firstResultOnly, had)
}

/**
 * A board's label on a card, "Ranked" or "All time", dotted under: its tip says what the board is. Its
 * first sentence first, then the rest, quieter: "Each driver’s best lap on this track, any day." "Just
 * for fun: it doesn’t count toward your rank."
 */
function BoardLabel({ board, slug }: { board: PastBoard; slug: string }) {
  const tip = boardTip(board, slug)
  const cut = tip.indexOf('. ')
  const lead = cut < 0 ? tip : tip.slice(0, cut + 1)
  const more = cut < 0 ? '' : tip.slice(cut + 2)
  const mark = board === 'ranked' ? <RankedIcon /> : <AllTimeIcon />
  return (
    <InfoTip
      className={`pc-label pc-label--${board}`}
      tipClassName={`dp-tip dp-tip--${board}`}
      description={tip}
      trigger={
        <>
          {mark}
          <span className="pc-label__word">{BOARD_NAMES[board]}</span>
        </>
      }
    >
      <span className="dp-tip__head">
        {mark}
        {BOARD_NAMES[board]}
      </span>
      <span className="dp-tip__lead">{lead}</span>
      {more ? <span className="dp-tip__more">{more}</span> : null}
    </InfoTip>
  )
}

/** A line's figure while it's asked for. */
function Waiting() {
  return (
    <span className="pc-val pc-val--wait" aria-busy="true">
      <span className="visually-hidden">Loading</span>
    </span>
  )
}

/** A line's figure that couldn't be had: the page says so once, over the cards. */
function Unknown() {
  return (
    <span className="pc-val pc-val--none">
      <span aria-hidden="true">–</span>
      <span className="visually-hidden">Couldn’t load</span>
    </span>
  )
}

/** You on a board: your mark and your place of how many, "14th of 65"; or your result, on a day that kept no places. */
function Yours({ name, avatarId, place, of, figure }: { name: string; avatarId: string | null; place: number | null; of: number; figure: string }) {
  return (
    <span className="pc-val">
      <PlayerAvatar avatarId={avatarId} name={name} size="sm" title="You" className="pc-val__me" />
      {place != null ? (
        <>
          <b>{ordinal(place)}</b>
          <small>of {of.toLocaleString()}</small>
        </>
      ) : (
        <b>{figure}</b>
      )}
    </span>
  )
}

/** A board's 1st, or its record holder, crowned, and their result. */
function Crowned({ who, what, figure }: { who: CourseFigure; what: string; figure: string }) {
  return (
    <span className="pc-val pc-val--first">
      <CrownIcon className="pc-val__crown" />
      <span className="visually-hidden">{what}: </span>
      <PlayerName className="pc-val__who" name={who.name} avatarId={who.avatarId} />
      <small>{figure}</small>
    </span>
  )
}

/** A past course's card: its picture, name and day, its boards' lines, and the way to play it. */
function PastCard({
  source,
  day,
  entry,
  daysState,
  viewer,
  avatarId,
  here,
  onOpen,
}: {
  source: PastSource
  day: string
  entry: ArchiveDay | undefined
  daysState: DaysState
  viewer: PastViewer
  avatarId: string | null
  here: boolean
  onOpen: (day: string) => void
}) {
  const { slug, boards, art: drawArt } = source
  const words = dailyWords(slug)
  const [ref, near] = useNear<HTMLLIElement>()
  const art = useMemo(() => (near ? drawArt(day) : null), [near, drawArt, day])
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const title = source.title(day)
  const board = boards?.rows?.get(day)
  // Yours only once it's known whose they are: not signed out, nor while a session's account isn't known yet.
  const showYou = viewer.state === 'in'
  const kind = kindOf(source, day, entry, board, daysState, viewer)

  // Ranked: your place that day, or who was 1st. On a daily just for fun (data/games.ts Game.ranked), there's
  // no place and no 1st: only your own result, and the card opens no boards.
  const rankedGame = isRankedGame(slug)
  const you = showYou ? (entry?.you ?? null) : null
  let ranked: ReactNode
  if (daysState === 'wait') ranked = <Waiting />
  else if (daysState === 'failed') ranked = <Unknown />
  else if (you) ranked = <Yours name={viewer.name} avatarId={avatarId} place={rankedGame ? you.place : null} of={entry?.players ?? 0} figure={fmt(you.score)} />
  else if (!rankedGame) ranked = <span className="pc-val pc-val--none">{showYou ? 'Not played' : 'Sign in for yours'}</span>
  else if (!entry?.top) ranked = <span className="pc-val pc-val--none">Nobody {verbDone(slug)} it</span>
  else ranked = <Crowned who={entry.top} what="1st" figure={fmt(entry.top.score)} />

  // All time: your place on the course's own board, or who holds its record.
  let allTime: ReactNode = null
  if (boards) {
    const mine = showYou ? (board?.you ?? null) : null
    if (boards.rows === null) allTime = boards.failed ? <Unknown /> : <Waiting />
    else if (!board?.record) allTime = <span className="pc-val pc-val--none">Nobody yet</span>
    else if (mine) allTime = <Yours name={viewer.name} avatarId={avatarId} place={mine.place} of={board.players} figure={fmt(mine.score)} />
    else allTime = <Crowned who={board.record} what="Record" figure={fmt(board.record.score)} />
  }

  // Each card says once how many played its day: in the Ranked line as your place of them, or else under its name.
  const played =
    daysState === 'ok' && entry && !(rankedGame && you && you.place != null) ? ` · ${entry.players.toLocaleString()} ${verbDone(slug)}` : ''

  return (
    <li ref={ref} id={`course-${source.anchor(day)}`} tabIndex={-1} className={`pc${here ? ' pc--here' : ''}`}>
      <div className="pc-stage" aria-hidden="true">
        <span className="dp-art pc-art">{art}</span>
        {rankedGame ? (
          <span className="pc-boards">
            <BoardsIcon />
          </span>
        ) : null}
      </div>
      <div className="pc-name">
        {/* The card's own button: its picture, its name, anywhere on it but its controls, opens its boards. */}
        <h3 className="pc-title">
          {rankedGame ? (
            <button type="button" className="pc-open" aria-haspopup="dialog" aria-label={`${title}: boards`} onClick={() => onOpen(day)}>
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        <p className="pc-date">
          {archiveDayWords(day)}
          {played}
        </p>
      </div>
      <dl className="pc-stats">
        <div className="pc-stat">
          <dt>{rankedGame ? <BoardLabel board="ranked" slug={slug} /> : <span className="pc-label">You</span>}</dt>
          <dd>{ranked}</dd>
        </div>
        {boards ? (
          <div className="pc-stat">
            <dt>
              <BoardLabel board="allTime" slug={slug} />
            </dt>
            <dd>{allTime}</dd>
          </div>
        ) : null}
      </dl>
      <div className="pc-go">
        <a className="pc-play" href={source.playHref(day)} aria-label={`${words.verb} ${title}`}>
          <PlayIcon />
          {words.verb}
        </a>
        {kind === 'practice' ? (
          <InfoTip className="pc-prac" tipClassName="dp-tip" label="Practice" trigger={<PracticeIcon />}>
            {PRACTICE_TIP}
          </InfoTip>
        ) : null}
      </div>
    </li>
  )
}

/** A daily's past courses, as its page's past tab shows them. */
export function PastCourses({ source }: { source: PastSource }) {
  const { slug, today, first, boards } = source
  const words = dailyWords(slug)
  const viewer = usePastViewer()
  const avatarId = useMyAvatarId(viewer.state === 'in' ? viewer.name : '')
  const { days, failed, retry } = useDailyDays(slug, viewer.name)
  const daysState: DaysState = days ? 'ok' : failed ? 'failed' : 'wait'
  const byDay = useMemo(() => new Map((days ?? []).map((d) => [d.day, d])), [days])
  const courses = useMemo(() => pastDays(today, first), [today, first])
  const [shown, setShown] = useState(PAST_PAGE)
  const [target, setTarget] = useState<{ key: string } | null>(null)
  const [here, setHere] = useState<string | null>(null)
  const [how, setHow] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const anchorOf = source.anchor

  // A link to one course's card (the Records tab's, a notification's, a past course's way back) lands on it.
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

  // Page the card in if it's further down than the list goes yet, then bring it into view: once the cards
  // have their results, so it stays where it lands, and after the page's own scroll to the top on arriving
  // (App), which runs after this.
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
        // Today's course has no card: the tab's top is as near as it gets.
        if (target.key === today || target.key === anchorOf(today)) headRef.current?.scrollIntoView({ block: 'start' })
        return
      }
      const day = courses[at]!
      const card = document.getElementById(`course-${anchorOf(day)}`)
      if (!card) return
      card.scrollIntoView({ block: 'start' })
      card.focus({ preventScroll: true })
      setHere(day)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [target, settled, shown, courses, today, anchorOf])

  const count = courses.length
  const listed = courses.slice(0, shown)
  const howTitle = pastHowTitle(slug)
  const signedIn = viewer.state !== 'out'
  // One line over the cards for whatever couldn't be had, with one way to ask again.
  const daysFailed = daysState === 'failed'
  const boardsFailed = Boolean(boards?.failed)
  const openEntry = opened ? byDay.get(opened) : undefined
  const openKind = opened ? kindOf(source, opened, openEntry, boards?.rows?.get(opened), daysState, viewer) : null
  return (
    <div className="dp">
      {/* On a daily just for fun, a bug hunt hiding place, where a ranked one's Records tab was (lib/bugHunt.ts). */}
      <div ref={headRef} className="dp-head" data-hunt={isRankedGame(slug) ? undefined : `r-head-${slug}`}>
        <h2 className="dp-head__title">{words.pastTab}</h2>
        {count ? (
          <span className="dp-head__count">
            <span aria-hidden="true">{count.toLocaleString()}</span>
            <span className="visually-hidden">
              {count.toLocaleString()} {coursesWord(slug, count)}
            </span>
          </span>
        ) : null}
        <button type="button" className="dp-head__how" aria-haspopup="dialog" aria-label={howTitle} title={howTitle} onClick={() => setHow(true)}>
          <InfoIcon />
        </button>
      </div>

      {daysFailed || boardsFailed ? (
        <p className="dp-oops" role="alert">
          {daysFailed && boardsFailed ? 'Couldn’t load the boards.' : daysFailed ? 'Couldn’t load how each day went.' : 'Couldn’t load the All time boards.'}{' '}
          <button
            type="button"
            className="dp-link-btn"
            onClick={() => {
              if (daysFailed) retry()
              if (boardsFailed) boards?.retry?.()
            }}
          >
            Try again
          </button>
        </p>
      ) : null}

      {count ? (
        <>
          <ol className="pc-grid">
            {listed.map((day) => (
              <PastCard
                key={day}
                source={source}
                day={day}
                entry={byDay.get(day)}
                daysState={daysState}
                viewer={viewer}
                avatarId={avatarId}
                here={here === day}
                onOpen={setOpened}
              />
            ))}
          </ol>
          {count > listed.length ? (
            <div className="dp-more">
              <button type="button" className="dp-more__btn" onClick={() => setShown((n) => n + PAST_PAGE)}>
                Show more
              </button>
              <span className="dp-more__count">
                Showing {listed.length.toLocaleString()} of {count.toLocaleString()} {coursesWord(slug)}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <BoardEmpty
          title={`No ${words.pastTab.toLowerCase()} yet`}
          detail={`${words.today} is the first. From tomorrow it’s here to ${words.verb.toLowerCase()} again.`}
        />
      )}

      {how ? <PastHowModal slug={slug} signedIn={signedIn} onClose={() => setHow(false)} /> : null}
      {opened ? (
        <PastBoardsModal
          key={opened}
          source={source}
          day={opened}
          players={openEntry?.players ?? null}
          kind={openKind ?? (signedIn ? 'board' : 'practice')}
          name={viewer.state === 'in' ? viewer.name : ''}
          signedIn={signedIn}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </div>
  )
}
