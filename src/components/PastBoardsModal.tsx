import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { dayBoardHref } from '../hooks/useHashRoute'
import { useMyAvatarId } from '../hooks/useMyAvatarId'
import { archiveDayWords } from '../lib/archive'
import {
  BOARD_TOP,
  COURSE_BOARD_ANCHOR,
  fetchDayTop,
  pastPlayNote,
  verbDone,
  type CourseTop,
  type DayTop,
  type PastSource,
} from '../lib/dailyPast'
import { BOARD_NAMES, dailyWords, type PastBoard, type PastKind } from '../lib/dailyWords'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal } from '../lib/profileMath'
import { ChevronRightIcon, PlayIcon } from './chromeIcons'
import { CloseIcon, Panel } from './Panel'
import { AllTimeIcon, PracticeIcon, RankedIcon } from './pastIcons'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerName } from './PlayerName'
import '../styles/dailyPast.css'

/*
 * A past course's boards, opened from its card on the past tab: its picture, name and day, the one line on
 * what playing it now does, and the top five of its Ranked board (the day's final one, which counted) with
 * you under them, or, for Hot Lap and Ace Chase, of its All time board, a switch away. Under them, all of
 * the board on the day's own page, and the way to play it.
 */

/** A board as it comes: the top five and you, or that it couldn't be had. */
type Asked = { top: CourseTop | DayTop | null; failed: boolean }

const MARKS: Record<PastBoard, ReactNode> = {
  ranked: <RankedIcon />,
  allTime: <AllTimeIcon />,
}

export function PastBoardsModal({
  source,
  day,
  players,
  kind,
  name,
  signedIn,
  onClose,
}: {
  source: PastSource
  day: string
  /** How many played it on its day, when that's known: for the line under its name. */
  players: number | null
  /** What a run on it does now. */
  kind: PastKind
  /** The tag whose row the boards show under their top five: none signed out. */
  name: string
  signedIn: boolean
  onClose: () => void
}) {
  const { slug, boards, art: drawArt } = source
  const words = dailyWords(slug)
  const titleId = useId()
  const [side, setSide] = useState<PastBoard>('ranked')
  const [asked, setAsked] = useState<Partial<Record<PastBoard, Asked>>>({})
  const [asks, setAsks] = useState(0)
  const avatarId = useMyAvatarId(name)
  const art = useMemo(() => drawArt(day), [drawArt, day])
  const fetchTop = boards?.fetchTop

  // Both of its boards are asked for as it opens, so the switch between them never waits.
  useEffect(() => {
    let live = true
    const ask = (board: PastBoard, get: () => Promise<CourseTop | DayTop>) => {
      get().then(
        (top) => {
          if (live) setAsked((a) => ({ ...a, [board]: { top, failed: false } }))
        },
        () => {
          if (live) setAsked((a) => ({ ...a, [board]: { top: null, failed: true } }))
        },
      )
    }
    ask('ranked', () => fetchDayTop(slug, day, name))
    if (fetchTop) ask('allTime', () => fetchTop(day, name))
    return () => {
      live = false
    }
  }, [slug, day, name, fetchTop, asks])

  const title = source.title(day)
  const note = pastPlayNote(slug, kind, signedIn)
  const board: PastBoard = boards ? side : 'ranked'
  const fullHref = board === 'allTime' ? `${dayBoardHref(slug, day)}#${COURSE_BOARD_ANCHOR}` : dayBoardHref(slug, day)
  return (
    <Panel wide labelledBy={titleId} onClose={onClose} style={gameAccentStyle(slug)} className="dp-modal pbm">
      <div className="pbm-head">
        <span className="dp-art pbm-art" aria-hidden="true">
          {art}
        </span>
        <div className="pbm-heading">
          <h2 id={titleId} className="pbm-title">
            {title}
          </h2>
          <p className="pbm-date">
            {archiveDayWords(day)}
            {players != null ? ` · ${players.toLocaleString()} ${verbDone(slug)}` : ''}
          </p>
        </div>
        <p className={`pbm-note pbm-note--${note.mark}`}>
          {note.mark === 'allTime' ? <AllTimeIcon /> : <PracticeIcon />}
          <span>{note.text}</span>
        </p>
        <button type="button" className="panel__close pbm-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="panel__body pbm-body">
        {boards ? (
          <div className="pbm-seg" role="group" aria-label="Which board">
            {(['ranked', 'allTime'] as const).map((b) => (
              <button key={b} type="button" className={`pbm-seg__side pbm-seg__side--${b}`} aria-pressed={side === b} onClick={() => setSide(b)}>
                {MARKS[b]}
                {BOARD_NAMES[b]}
              </button>
            ))}
          </div>
        ) : (
          <p className="pbm-board">
            <RankedIcon />
            {BOARD_NAMES.ranked}
          </p>
        )}
        <BoardList
          slug={slug}
          board={board}
          asked={asked[board]}
          name={name}
          avatarId={avatarId}
          onRetry={() => {
            setAsked({})
            setAsks((n) => n + 1)
          }}
        />
      </div>
      <div className="panel__actions pbm-actions">
        <a className="panel__btn panel__btn--ghost" href={fullHref}>
          Full board
          <ChevronRightIcon />
        </a>
        <a className="panel__btn" href={source.playHref(day)}>
          <PlayIcon />
          {words.verb} it
        </a>
      </div>
    </Panel>
  )
}

/** A board's top five, and you under them after a break when you're further down. */
function BoardList({
  slug,
  board,
  asked,
  name,
  avatarId,
  onRetry,
}: {
  slug: string
  board: PastBoard
  asked: Asked | undefined
  name: string
  avatarId: string | null
  onRetry: () => void
}) {
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  if (!asked) {
    return (
      <ol className="pbm-list" aria-busy="true" aria-label={`Loading the ${BOARD_NAMES[board]} board`}>
        {Array.from({ length: BOARD_TOP }, (_, i) => (
          <li key={i} className="pbm-row pbm-row--wait">
            <span className="pbm-skel" />
          </li>
        ))}
      </ol>
    )
  }
  if (!asked.top) {
    return (
      <p className="pbm-empty" role="alert">
        Couldn’t load this board.{' '}
        <button type="button" className="dp-link-btn" onClick={onRetry}>
          Try again
        </button>
      </p>
    )
  }
  const { top, you } = asked.top
  if (!top.length) {
    return <p className="pbm-empty">{board === 'ranked' ? `Nobody ${verbDone(slug)} it that day.` : 'Nobody on this board yet.'}</p>
  }
  // A day before the game's days counted (Ace Chase's first two) kept a board all the same.
  const early = 'counted' in asked.top && !asked.top.counted
  return (
    <>
      <ol className="pbm-list" aria-label={`${BOARD_NAMES[board]}: the top ${top.length}`}>
        {top.map((e, i) => {
          const place = e.place ?? i + 1
          const mine = Boolean(name) && e.name === name
          return (
            <li key={e.name} className={`pbm-row${mine ? ' pbm-row--you' : ''}`}>
              <span className={`pbm-place pbm-place--${place}`}>{ordinal(place)}</span>
              <PlayerAvatar avatarId={e.avatarId} name={e.name} size="sm" />
              <span className="pbm-who">
                <PlayerName className="pbm-name" name={e.name} avatarId={e.avatarId} />
                {mine ? <span className="pbm-you">You</span> : null}
              </span>
              <b className="pbm-figure">{fmt(e.score)}</b>
            </li>
          )
        })}
        {you && name && you.place > top.length ? (
          <li className="pbm-row pbm-row--you pbm-row--gap">
            <span className="pbm-place">{ordinal(you.place)}</span>
            <PlayerAvatar avatarId={avatarId} name={name} size="sm" />
            <span className="pbm-who">
              <span className="pbm-name">{name}</span>
              <span className="pbm-you">You</span>
            </span>
            <b className="pbm-figure">{fmt(you.score)}</b>
          </li>
        ) : null}
      </ol>
      {early ? <p className="pbm-aside">Before the daily’s days counted toward rank.</p> : null}
    </>
  )
}
