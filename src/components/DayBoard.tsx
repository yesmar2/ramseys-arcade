import { SkinMark } from './season/SkinMark'
import { useEffect, useState, type CSSProperties } from 'react'
import { deviceRequirementLabel, gamePlayableOn, getGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useDayCourse, usePagedBoard, type PagedBoard } from '../hooks/useDayBoard'
import { dailyTabHref, dayBoardHref, gameBoardHref, leaderboardHref, navigate, plusHref, rankHref } from '../hooks/useHashRoute'
import { useMyAvatarId } from '../hooks/useMyAvatarId'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords, dayBefore, inArchive, useArchiveOpen, useDailyDays } from '../lib/archive'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { archivedWhy, archiveTip, capitalWord, COURSE_BOARD_ANCHOR, pastKindFor, stripDayWords, usePastViewer, verbDone } from '../lib/dailyPast'
import { BOARD_NAMES, boardTip, dailyWords } from '../lib/dailyWords'
import { dateOf, dayAfter, timeOfDay, type DayCourse } from '../lib/dayBoard'
import { useDeviceType } from '../lib/device'
import { FIRST_RUN_DAILIES, firstResultWord, firstRunWord, gapBetween } from '../lib/gameBoard'
import { hasGamePreview } from '../lib/gamePreviews'
import { groupBoardEmptyTitle, scopeName, useActiveGroup } from '../lib/groups'
import { useHeldHeight } from '../lib/heldShape'
import { ApiError, getDayBoard, normalizePlayerName, type DayBoardEntry, type LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { boardToday, ordinal } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { DeviceIcon } from './DeviceIcon'
import { ArrowIcon, BackIcon, PeriodTabs, TrophyIcon } from './GameBoard'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'
import { RunLabel } from './RunLabel'
import { ShareBoardButton } from './ShareBoardButton'
import { openSiteMenu } from './siteNav'
import '../styles/dayBoard.css'

/*
 * A daily's board on one past day (/leaderboards/<game>/day/<YYYY-MM-DD>): its Ranked board, the one its
 * places counted from, in full, as the day finished, with the day before and after a tap away (the day
 * after the newest is today's live board). Where you finished that day, the way to play the course again
 * with what that run counts toward, and for Hot Lap and Ace Chase the course's All time board beside the
 * Ranked one: every lap or first bullseye on it since, which isn't anyone's rank. The two boards' names
 * are lib/dailyWords.ts's BOARD_NAMES, as every page has them.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

/** Rows before "show more", and how many more each press shows: as the game's own board. */
const FIRST_ROWS = 10
const MORE_ROWS = 25

/** Days listed beside the board: the week around the one on show. */
const NEAR_DAYS = 7

type DayMeta = { counted: boolean; final: boolean; you: { score: number; place: number } | null }
type CourseMeta = { you: { score: number; place: number } | null }

/** One row of either board: the day's, or the course's own. */
type Row = { place: number; name: string; score: number; at?: number; avatarId?: string; device?: DayBoardEntry['device']; skin?: string }

function ChevronIcon({ back = false }: { back?: boolean }) {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="sb-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l12.5-7.5z" />
    </svg>
  )
}

/** A day in the archive: Plus's to play (lib/archive.ts). */
function LockIcon() {
  return (
    <svg className="sb-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/** "14 players", "1 driver". */
function count(n: number, word: string): string {
  return `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`
}

/** "LATTE", "LATTE and GUS", "LATTE, GUS and DAD". */
function listWords(words: string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** What a player's day result is, said plainly: "best lap", "first result", "first bullseye". */
function dayResultWords(slug: string): string {
  return FIRST_RUN_DAILIES.has(slug) ? `first ${firstResultWord(slug)}` : `best ${firstRunWord(slug)}`
}

/**
 * Who was 1st that day, the name apart so it can wear the gold; ties go to whoever got there first. A group's
 * 1st says it's the group's, beside the whole day's 1st under Other days.
 */
function dayHeadline(slug: string, rows: Row[], group?: string): { name: string; rest: string } {
  const [first, second] = rows
  if (!first) return { name: '', rest: `Nobody ${verbDone(slug)} it that day.` }
  if (!second) return { name: first.name, rest: ` was the only one${group ? ` in ${group}` : ''} to ${dailyWords(slug).verb.toLowerCase()} it.` }
  if (second.score === first.score) {
    const tied = rows.filter((r) => r.score === first.score).map((r) => r.name)
    const names = tied.length > 3 ? `${first.name} and ${tied.length - 1} others` : listWords(tied)
    return { name: '', rest: `${names} tied at the top: ${first.name} got there first.` }
  }
  return { name: first.name, rest: ` was 1st${group ? ` in ${group}` : ''}, ${gapBetween(slug, first.score, second.score)} clear of ${second.name}.` }
}

/** Whether a result on a course's board was set on the course's own day, on the boards' clock: one set since says so on its row. */
function setOnItsDay(at: number | undefined, day: string): boolean {
  return typeof at === 'number' && Number.isFinite(at) && new Date(boardToday(at)).toISOString().slice(0, 10) === day
}

/* ---------- the banner ---------- */

/** The day before and after, as a board to step to: before the first there's none; after the newest, today's. */
function DaySteps({ slug, day, course, group }: { slug: LeaderboardGame; day: string; course: DayCourse | null; group?: string }) {
  const today = course?.today() ?? null
  const before = dayBefore(day)
  const after = dayAfter(day)
  const toToday = today != null && after >= today
  // Each step's name starts with the words it shows ("Sun 27"), so saying what's on screen finds it.
  return (
    <nav className="db-steps" aria-label="Other days">
      {course && before >= course.first ? (
        <a className="db-step" href={dayBoardHref(slug, before)} aria-label={`${stripDayWords(before)}, the day before`}>
          <ChevronIcon back />
          <span>{stripDayWords(before)}</span>
        </a>
      ) : (
        <span className="db-step db-step--off" aria-hidden="true">
          <ChevronIcon back />
        </span>
      )}
      <p className="home-banner__kicker db-steps__day">
        {BOARD_NAMES.ranked} · {archiveDayWords(day)}
        {group ? ` · ${group}` : ''}
      </p>
      {course ? (
        <a
          className="db-step"
          href={toToday ? gameBoardHref(slug, 'daily') : dayBoardHref(slug, after)}
          aria-label={toToday ? 'Today’s board' : `${stripDayWords(after)}, the day after`}
        >
          <span>{toToday ? 'Today' : stripDayWords(after)}</span>
          <ChevronIcon />
        </a>
      ) : (
        <span className="db-step db-step--off" aria-hidden="true">
          <ChevronIcon />
        </span>
      )}
    </nav>
  )
}

function Banner({
  slug,
  day,
  course,
  board,
  group,
}: {
  slug: LeaderboardGame
  day: string
  course: DayCourse | null
  board: PagedBoard<Row, DayMeta>
  group?: string
}) {
  const game = getGame(slug)!
  const accent = resolveGameAccent(slug, game.accent)
  const words = dailyWords(slug)
  const loading = board.loading
  // Not "nobody played it": the day just didn't come.
  const failed = Boolean(board.error) && !board.rows.length
  const head = failed ? { name: '', rest: `Couldn’t load the ${BOARD_NAMES.ranked} board.` } : dayHeadline(slug, board.rows, group)
  const leader = board.rows[0]
  const counted = board.meta?.counted !== false
  const dayWords = archiveDayWords(day)
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  // They wrap with the names and numbers in them: held at last time's height while those load (lib/heldShape.ts),
  // as the daily's other boards hold theirs (GameBoard), so the board under them doesn't move when they come.
  const titleHeld = useHeldHeight<HTMLHeadingElement>('db-title', loading)
  const ledeHeld = useHeldHeight<HTMLParagraphElement>('db-lede', loading)
  return (
    <section className="home-banner gb-banner db-banner" style={style} aria-labelledby="gb-title">
      <div className="home-banner__text gb-banner__text">
        <nav className="gb-crumb" aria-label="Breadcrumb">
          <a href={leaderboardHref()}>
            <BackIcon />
            Boards
          </a>
          <span aria-hidden="true">/</span>
          <a href={gameBoardHref(slug, 'daily')}>{game.name}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{dayWords}</span>
        </nav>
        <DaySteps slug={slug} day={day} course={course} group={group} />
        <h1 id="gb-title" className="gb-title" ref={titleHeld.ref} style={titleHeld.style}>
          {loading ? (
            // The sentence it most often is (dayHeadline), the names and the gap shimmering, so it wraps where the
            // real one will, even the first time.
            <>
              <span className="skel-line" style={{ '--skel-w': '3.6em' } as CSSProperties} /> was 1st,{' '}
              <span className="skel-line" style={{ '--skel-w': '3.4em' } as CSSProperties} /> clear of{' '}
              <span className="skel-line" style={{ '--skel-w': '3.6em' } as CSSProperties} />.
            </>
          ) : (
            <>
              {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
              {head.rest}
            </>
          )}
        </h1>
        <p className="home-banner__blurb gb-lede" ref={ledeHeld.ref} style={ledeHeld.style}>
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />
          ) : failed ? (
            'Check your connection and try again.'
          ) : (
            <>
              {board.total ? `${count(board.total, 'player')}${group ? ` in ${group}` : ''} · ` : ''}
              {/* A day before the daily's days counted paid nobody's rank (Ace Chase's first two). A group's places
                  never did: the day paid by places over everyone. */}
              {!counted ? 'before the daily’s days counted' : group ? 'places over everyone are what counted toward rank' : 'it counted toward rank'}
            </>
          )}
        </p>
        <PeriodTabs slug={slug} />
        <div className="home-banner__acts">
          <a className="home-banner__ghost" href={dailyTabHref(slug, 'past', course ? course.anchor(day) : day)}>
            {words.pastTab}
          </a>
          <ShareBoardButton
            className="home-banner__ghost"
            text="Share"
            label={`${game.name}, ${dayWords}: the ${BOARD_NAMES.ranked} board on ${APP_NAME}.`}
            url={dayBoardHref(slug, day)}
          />
        </div>
        <p className="gb-closes">
          <TrophyIcon />
          <span>Closed at midnight, New York time.</span>
        </p>
      </div>
      <a className="home-banner__art gb-banner__art" href={dailyTabHref(slug, 'past', course ? course.anchor(day) : day)} tabIndex={-1} aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
        {hasGamePreview(slug) ? (
          <>
            <GamePreview slug={slug} className="home-banner__screen" autoplay />
            <span className="home-banner__fade" />
          </>
        ) : null}
        {leader ? (
          <span className="gb-marquee">
            {/* A day's #1 is 1st that day: a record is a course's best across all time. A group's #1 is the
                group's (the kicker names it: a group's name is too long to fit here). */}
            <span>{group ? '1st in the group' : '1st that day'}</span>
            <b>{formatLeaderboardScore(slug, leader.score)}</b>
            <span>{leader.name}</span>
          </span>
        ) : null}
      </a>
    </section>
  )
}

/* ---------- you, and playing it again ---------- */

function YouThatDay({
  slug,
  day,
  name,
  board,
  group,
}: {
  slug: LeaderboardGame
  day: string
  name: string
  board: PagedBoard<Row, DayMeta>
  group?: string
}) {
  const avatarId = useMyAvatarId(name)
  const verb = dailyWords(slug).verb.toLowerCase()
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  if (!name) {
    return (
      <div className="sb-card sb-you__card sb-first">
        <p className="sb-kicker">{archiveDayWords(day)}</p>
        <h2 className="sb-first__title">Where did you finish?</h2>
        <p className="sb-first__text">Sign in and your place that day shows here, beside everyone’s.</p>
        <div className="sb-you__foot sb-you__foot--acts">
          <button type="button" className="sb-ghost db-signin" onClick={openSiteMenu}>
            Sign in
          </button>
        </div>
      </div>
    )
  }
  const you = board.meta?.you ?? null
  const [first, second] = board.rows
  const of = `${board.total.toLocaleString()}${group ? ` in ${group}` : ''}`
  let line: string | null = null
  let callout: string | null = null
  if (you) {
    line = `Your ${dayResultWords(slug)}: ${fmt(you.score)}`
    if (you.place === 1) {
      if (second && second.score === you.score) callout = `Tied with ${second.name}: you got there first.`
      else if (second) callout = `${gapBetween(slug, you.score, second.score)} clear of ${second.name}.`
    } else if (first) {
      // The same result as the one just above is a later place: they got there first, as the live card says.
      const above = board.rows.find((r) => r.place === you.place - 1)
      const gap = `${gapBetween(slug, first.score, you.score)} off ${first.name}’s 1st.`
      callout =
        first.score === you.score
          ? `Tied with ${first.name}, who got there first.`
          : above && above.score === you.score
            ? `Tied with ${above.name}, who got there first. ${gap}`
            : gap
    }
  }
  return (
    <div className="sb-card sb-you__card">
      <div className="sb-you__top">
        <PlayerMark name={name} avatarId={avatarId} className="sb-you__mark" />
        <span className="sb-you__kicker">
          {name} · {archiveDayWords(day)}
        </span>
      </div>
      {board.loading ? (
        <p className="gb-you__title" aria-busy="true">
          <span className="skel-line" style={{ '--skel-w': '14ch' } as CSSProperties} />
        </p>
      ) : board.error && !board.rows.length ? (
        <p className="sb-you__line db-quiet">Couldn’t load where you finished that day.</p>
      ) : you ? (
        <>
          <h2 className="gb-you__title">
            You were {ordinal(you.place)} of {of} that day
          </h2>
          <p className="sb-you__line">{line}</p>
          {callout ? (
            <p className="gb-callout">
              <ArrowIcon />
              <span>{callout}</span>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="gb-you__title">You didn’t {verb} it that day</h2>
          <p className="sb-you__line db-quiet">
            {board.total ? `${count(board.total, 'player')}${group ? ` in ${group}` : ''} ${verbDone(slug)} it.` : `Nobody ${verbDone(slug)} it.`}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * The way to play the course again, and what that run counts toward, as its row on the past tab says it:
 * a track's or (without a result on it yet) a hole's All time board, or practice.
 */
function PlayAgain({
  slug,
  day,
  course,
  courseFailed,
  dayBoard,
  courseBoard,
}: {
  slug: LeaderboardGame
  day: string
  course: DayCourse | null
  courseFailed: boolean
  dayBoard: PagedBoard<Row, DayMeta>
  courseBoard: PagedBoard<Row, CourseMeta>
}) {
  const game = getGame(slug)!
  const device = useDeviceType()
  const words = dailyWords(slug)
  const viewer = usePastViewer()
  const account = useAccountId()
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const keepsBoard = Boolean(course?.board)
  const signedIn = viewer.state !== 'out'
  const hadResult = Boolean(dayBoard.meta?.you || courseBoard.meta?.you || course?.resultHere?.(day, account))
  // What a run here does can be told straight away signed out; signed in, once you're known on its boards.
  const known =
    course != null &&
    (viewer.state === 'out' || (viewer.state === 'in' && !dayBoard.loading && (!keepsBoard || !courseBoard.loading)))
  const firstOnly = FIRST_RUN_DAILIES.has(slug)
  // A day older than a week is in the archive (lib/archive.ts): practice for everyone, and Plus's to play.
  const archived = inArchive(day)
  const archiveOpen = useArchiveOpen()
  const locked = archived && archiveOpen === false
  const kind = pastKindFor(slug, signedIn, firstOnly, hadResult, archived)
  // A course that keeps a board is practice for three reasons, and the line under the label says which.
  const run = firstRunWord(slug)
  const practiceWhy =
    kind !== 'practice' || words.past !== 'board'
      ? null
      : archived
        ? archivedWhy(slug)
        : signedIn
        ? `Your first ${run} here stands.`
        : `Signed out, nothing is kept. Sign in and ${firstOnly ? `your first ${run} here goes` : `your ${run}s here go`} on its ${BOARD_NAMES.allTime} board.`
  const record = courseBoard.rows[0]
  const player = slug === 'hotlap' ? 'driver' : 'player'
  return (
    <div className="sb-card sb-you__card db-play">
      <p className="db-play__kicker">
        Past {words.course} · {archiveDayWords(day)}
      </p>
      <h2 className="db-play__title">
        {course ? course.title(day) : courseFailed ? capitalWord(words.course) : <span className="skel-line" style={{ '--skel-w': '10ch' } as CSSProperties} />}
      </h2>
      {keepsBoard ? (
        <p className="db-play__fact">
          <span className="db-play__fact-kicker" title={boardTip('allTime', slug)}>
            {BOARD_NAMES.allTime}
          </span>
          {courseBoard.loading ? (
            <span aria-busy="true">…</span>
          ) : record ? (
            <span>
              <b>
                {record.name} {fmt(record.score)}
              </b>
              {' · '}
              {count(courseBoard.total, player)}
              {courseBoard.meta?.you ? (
                <>
                  {' · '}
                  <b className="db-play__you">You {ordinal(courseBoard.meta.you.place)}</b>
                </>
              ) : null}
            </span>
          ) : courseBoard.error ? (
            <span>Couldn’t load it.</span>
          ) : (
            <span>Nobody on it yet</span>
          )}
        </p>
      ) : null}
      <div className="db-play__label">
        {known && practiceWhy ? (
          <span className="run-label-block">
            <RunLabel kind={kind} slug={slug} />
            <span className="run-label-block__sub">{practiceWhy}</span>
          </span>
        ) : known ? (
          <RunLabel kind={kind} slug={slug} withSub />
        ) : (
          <span className="db-quiet" aria-busy="true">
            …
          </span>
        )}
      </div>
      <div className="sb-you__foot sb-you__foot--acts">
        {course && locked ? (
          <a className="gb-cta db-play__go" href={plusHref()} title={archiveTip(slug)}>
            <LockIcon />
            See Plus
          </a>
        ) : course && gamePlayableOn(game, device) ? (
          <a className="gb-cta db-play__go" href={course.playHref(day)}>
            <PlayIcon />
            {words.verb} it{hadResult ? ' again' : ''}
          </a>
        ) : !gamePlayableOn(game, device) ? (
          <p className="gb-device db-quiet">{deviceRequirementLabel(game)}</p>
        ) : null}
        <a className="db-play__today" href={dailyTabHref(slug)}>
          {words.today} ›
        </a>
      </div>
    </div>
  )
}

/* ---------- the board ---------- */

function DayRow({
  slug,
  row,
  mine,
  when,
  sub,
  gap = false,
}: {
  slug: string
  row: Row
  mine: boolean
  /** The last column: the time in its day, or the date it was set. */
  when: string
  sub?: string
  gap?: boolean
}) {
  const medal = MEDALS[row.place - 1]
  return (
    <li className={`gb-row${medal ? ` gb-row--${medal}` : ''}${mine ? ' gb-row--you' : ''}${gap ? ' db-row--gap' : ''}`}>
      {/* The name is the row's link, stretched over it (boards.css); the skin beside it opens its own card. */}
      <div className="gb-row__link">
        <span className="gb-row__ord">{ordinal(row.place).toUpperCase()}</span>
        <PlayerMark name={row.name} avatarId={row.avatarId} className="gb-row__mark" />
        <span className="gb-row__who">
          <span className="gb-row__name">
            <a className="gb-row__go" href={rankHref(row.name)}>
              <PlayerName name={row.name} avatarId={row.avatarId} />
            </a>
            <SkinMark skin={row.skin} />
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
          {sub ? <span className="gb-row__runs">{sub}</span> : null}
        </span>
        <span className="gb-row__best">{formatLeaderboardScore(slug, row.score)}</span>
        <span className="gb-row__set">
          {row.device ? <DeviceIcon device={row.device} /> : null}
          {when}
        </span>
      </div>
    </li>
  )
}

function Board({
  slug,
  day,
  name,
  course,
  dayBoard,
  courseBoard,
  shown,
  onMore,
  group,
}: {
  slug: LeaderboardGame
  day: string
  name: string
  course: DayCourse | null
  dayBoard: PagedBoard<Row, DayMeta>
  courseBoard: PagedBoard<Row, CourseMeta>
  shown: { day: number; course: number }
  onMore: (tab: 'day' | 'course') => void
  group?: string
}) {
  // A past row's All time link opens this page on that side (#course-board).
  const [tab, setTab] = useState<'day' | 'course'>(() =>
    window.location.hash === `#${COURSE_BOARD_ANCHOR}` ? 'course' : 'day',
  )
  const myAvatar = useMyAvatarId(name)
  const words = dailyWords(slug)
  const keepsBoard = Boolean(course?.board)
  const onCourse = tab === 'course' && keepsBoard
  const board = onCourse ? courseBoard : dayBoard
  const boardName = onCourse ? BOARD_NAMES.allTime : BOARD_NAMES.ranked
  const limit = onCourse ? shown.course : shown.day
  const rows = board.rows.slice(0, limit)
  const you = (onCourse ? courseBoard.meta?.you : dayBoard.meta?.you) ?? null
  const left = board.total - Math.max(limit, rows.length)
  const player = onCourse && slug === 'hotlap' ? 'driver' : 'player'
  const counted = dayBoard.meta?.counted !== false
  const firstOnly = FIRST_RUN_DAILIES.has(slug)
  // What's on the board on show, in a line; each side's button says more when it's pointed at (boardTip).
  // A group's places never paid anything: the day paid by places over everyone, as Other days has them.
  const note = onCourse
    ? `Each ${player}’s ${firstOnly ? `first ${firstRunWord(slug)} on this ${words.course}, whenever it came` : `best ${firstRunWord(slug)} on this ${words.course}, any day`}${group ? ', over everyone' : ''}. It doesn’t count toward rank.`
    : `Each player’s ${dayResultWords(slug)} that day${group ? `, among ${group}` : ''}. ${
        !counted ? 'It came before the daily’s days counted.' : group ? 'Places over everyone counted toward rank.' : 'It counted toward rank.'
      }`
  const waiting = board.more && rows.length < Math.min(limit, board.total)
  return (
    <section id={COURSE_BOARD_ANCHOR} className="sb-card gb-board gb-board--five db-board" aria-labelledby="gb-board-title">
      <div className="gb-board__head">
        <h2 id="gb-board-title" className="gb-board__title">
          {boardName} board
        </h2>
        {!board.loading && !board.error && board.total ? <span className="gb-board__count">{count(board.total, player)}</span> : null}
        {keepsBoard ? (
          <div className="gb-tog" role="group" aria-label="Board">
            {(['day', 'course'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                className={`gb-tog__b${tab === t ? ' gb-tog__b--on' : ''}`}
                title={boardTip(t === 'day' ? 'ranked' : 'allTime', slug)}
                onClick={() => setTab(t)}
              >
                {t === 'day' ? BOARD_NAMES.ranked : BOARD_NAMES.allTime}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="gb-board__note">{note}</p>
      {board.loading ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : board.error && !board.rows.length ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">Couldn’t load the {boardName} board.</p>
          <button type="button" className="sb-ghost" onClick={board.retry}>
            Try again
          </button>
        </div>
      ) : !board.rows.length ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">
            {onCourse ? 'Nobody’s on it yet.' : groupBoardEmptyTitle(`Nobody ${verbDone(slug)} it that day.`)}
          </p>
        </div>
      ) : (
        <>
          <div className="gb-board__cols" aria-hidden="true">
            <span>Place</span>
            <span />
            <span>Player</span>
            <span className="gb-board__num">{firstOnly ? 'Result' : 'Best'}</span>
            <span className="gb-board__set">Set</span>
          </div>
          <ol className="gb-rows">
            {rows.map((r) => (
              <DayRow
                key={r.name}
                slug={slug}
                row={r}
                mine={Boolean(name) && r.name === name}
                when={r.at == null ? '' : onCourse ? dateOf(r.at) : timeOfDay(r.at)}
                sub={onCourse && r.at != null && !setOnItsDay(r.at, day) ? `Set ${dateOf(r.at)}, after its day` : undefined}
              />
            ))}
            {/* You, further down than the rows shown. */}
            {you && you.place > rows.length ? (
              <DayRow
                slug={slug}
                row={{ place: you.place, name, score: you.score, avatarId: myAvatar ?? undefined }}
                mine
                when=""
                gap={you.place > rows.length + 1}
              />
            ) : null}
          </ol>
        </>
      )}
      {!board.loading && board.rows.length && board.error ? (
        <p className="gb-board__note">
          Couldn’t load the rest.{' '}
          <button type="button" className="db-link" onClick={board.retry}>
            Try again
          </button>
        </p>
      ) : !board.loading && left > 0 ? (
        <button type="button" className="gb-board__more" onClick={() => onMore(onCourse ? 'course' : 'day')} disabled={waiting}>
          {waiting ? (
            'Loading…'
          ) : (
            <>
              Show {Math.min(left, MORE_ROWS).toLocaleString()} more {left === 1 ? player : `${player}s`}<span> · {left.toLocaleString()} to go</span>
            </>
          )}
        </button>
      ) : null}
    </section>
  )
}

/** The week around the day on show, each day's 1st and your place, to step to any of them. */
function OtherDays({
  slug,
  day,
  name,
  course,
  group,
}: {
  slug: LeaderboardGame
  day: string
  name: string
  course: DayCourse | null
  group?: string
}) {
  const { days } = useDailyDays(slug, name)
  const words = dailyWords(slug)
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  if (!course) return null
  const today = course.today()
  // The week around the day on show, newest first, found from the day itself: up to three days on (never
  // past today), then back to seven, or on past it when the first day comes sooner.
  let end = day
  for (let i = 0; i < Math.floor(NEAR_DAYS / 2) && end < today; i++) end = dayAfter(end)
  const near: string[] = []
  for (let d = end; d >= course.first && near.length < NEAR_DAYS; d = dayBefore(d)) near.push(d)
  for (let d = end; near.length < NEAR_DAYS && d < today; ) {
    d = dayAfter(d)
    near.unshift(d)
  }
  const byDay = new Map((days ?? []).map((d) => [d.day, d]))
  return (
    <div className="sb-card gb-more db-days">
      <h2 className="sb-card__title">Other days</h2>
      {/* Each day's 1st and your place are the whole arcade's, as the past tab has them. */}
      {group ? <p className="gb-card__sub">Over everyone, not just {group}.</p> : null}
      <ul className="db-days__rows">
        {near.map((d) => {
          const entry = byDay.get(d)
          const isToday = d === today
          const here = d === day
          const you = entry?.you
          return (
            <li key={d}>
              <a
                className={`db-days__link${here ? ' db-days__link--here' : ''}`}
                href={isToday ? gameBoardHref(slug, 'daily') : dayBoardHref(slug, d)}
                aria-current={here ? 'page' : undefined}
              >
                <span className="db-days__text">
                  <span className="db-days__when">
                    {archiveDayWords(d)}
                    {isToday ? <span className="db-days__pill">Today</span> : null}
                  </span>
                  <span className="db-days__lead">
                    {!days
                      ? '…'
                      : entry?.top
                        ? `${entry.top.name} 1st${isToday ? ' today' : ''} · ${fmt(entry.top.score)}`
                        : isToday
                          ? 'Nobody yet'
                          : `Nobody ${verbDone(slug)} it`}
                  </span>
                </span>
                {/* A day before the daily's days counted has your result but no place. */}
                <span className="gb-more__you">{you ? (you.place != null ? `You ${ordinal(you.place)}` : `You ${verbDone(slug)}`) : ''}</span>
                <span className="gb-more__go" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <a className="db-days__all" href={dailyTabHref(slug, 'past')}>
        All {words.pastTab.toLowerCase()} ›
      </a>
    </div>
  )
}

/* ---------- the page ---------- */

/** A daily's board on a past day, as it finished. A day that isn't past yet is today's live board. */
export function DayBoard({ slug, day }: { slug: LeaderboardGame; day: string }) {
  const name = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const group = scopeName(groupId)
  const { course, failed: courseFailed } = useDayCourse(slug)
  const [shown, setShown] = useState({ day: FIRST_ROWS, course: FIRST_ROWS })

  const dayBoard = usePagedBoard<Row, DayMeta>(
    `${slug}|${day}|${name}|${groupId ?? ''}`,
    (offset, limit) =>
      getDayBoard(slug, day, name, { offset, limit }).then((b) => ({
        rows: b.entries,
        total: b.total,
        meta: { counted: b.counted, final: b.final, you: b.you },
      })),
    shown.day,
  )
  const code = dayBoard.error instanceof ApiError ? dayBoard.error.code : undefined
  const before = code === 'BEFORE_FIRST_DAY' || (course != null && day < course.first)
  // Today's board, or one to come: today's is the live one, which says so.
  const ahead = code === 'DAY_AHEAD' || dayBoard.meta?.final === false || (course != null && day >= course.today())

  const courseBoard = usePagedBoard<Row, CourseMeta>(
    course?.board && !before && !ahead ? `${slug}|${day}|${name}|course` : null,
    (offset, limit) =>
      course!.board!(day, name, { offset, limit }).then((b) => ({
        rows: b.entries,
        total: b.total,
        meta: { you: b.you },
      })),
    shown.course,
  )

  useEffect(() => {
    if (ahead) navigate(gameBoardHref(slug, 'daily'), { replace: true })
  }, [ahead, slug])

  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  const style = { '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties

  if (ahead) return null

  if (before) {
    return (
      <div className="sb gb db" style={style}>
        <BoardEmpty
          title="No board that day"
          detail={
            course
              ? `${getGame(slug)?.name ?? 'Its'}’s days began on ${archiveDayWords(course.first)}.`
              : 'That day came before this game’s days began.'
          }
          action={
            <>
              {course ? (
                <a className="gb-cta" href={dayBoardHref(slug, course.first)}>
                  See its first day
                </a>
              ) : null}
              <a className="sb-ghost" href={gameBoardHref(slug, 'daily')}>
                Today’s board
              </a>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="sb gb db" style={style}>
      <Banner slug={slug} day={day} course={course} board={dayBoard} group={group} />

      {/* The board first under the banner, Race it under it; Other days beside it, where you finished under that,
          as a game's board has More boards and your place (GameBoard). */}
      <div className="gb-main">
        <div className="gb-lead">
          <Board
            slug={slug}
            day={day}
            name={name}
            course={course}
            dayBoard={dayBoard}
            courseBoard={courseBoard}
            shown={shown}
            onMore={(tab) => setShown((s) => ({ ...s, [tab]: s[tab] + MORE_ROWS }))}
            group={group}
          />
          {/* Once the board has settled: drawn while it loads, it'd move as its rows came. */}
          {!dayBoard.loading ? (
            <PlayAgain slug={slug} day={day} course={course} courseFailed={courseFailed} dayBoard={dayBoard} courseBoard={courseBoard} />
          ) : null}
        </div>
        {/* Both at once, once the board and the day's course are in, so neither pushes the other down. */}
        {!dayBoard.loading && (course || courseFailed) ? (
          <aside className="gb-side" aria-label="More about this day">
            <OtherDays slug={slug} day={day} name={name} course={course} group={group} />
            <div className="gb-side__you">
              <YouThatDay slug={slug} day={day} name={name} board={dayBoard} group={group} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
