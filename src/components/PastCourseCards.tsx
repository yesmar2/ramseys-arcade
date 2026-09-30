import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { getGame } from '../data/games'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { dailyTabHref, gamePlayHref, rankHowHref } from '../hooks/useHashRoute'
import { useRankFor } from '../hooks/useProfileBoards'
import { archiveDayWords } from '../lib/archive'
import { fitCardToSpace } from '../lib/cardFit'
import { usePastViewer } from '../lib/dailyPast'
import { dailyWords, type PastKind } from '../lib/dailyWords'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { leavePlay, type PastFact } from '../lib/pastPlay'
import { ordinal } from '../lib/scoreboard'
import { GamePanelBody } from './PauseControls'
import { RunLabel, runLabelWords } from './RunLabel'
import '../styles/pastCourse.css'

/*
 * The cards of a daily's past course, the same in all five games (spec: the shared row, "Playing a past
 * day"): the one it opens on, which says what a run here does before it starts, and the one after a run,
 * which says where the run went and that today's course is the one that counts. The game fills them in
 * with its own figures; the words come from lib/dailyWords.ts and the labels from RunLabel.tsx.
 */

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** A link out of the play screen: in the app, out of fullscreen first. */
function leaveLink(href: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    leavePlay(href)
  }
}

/** "Past track · Mon, Sep 28": what the course is and the day it was the day's. */
function pastKicker(slug: string, day: string) {
  return `Past ${dailyWords(slug).course} · ${archiveDayWords(day)}`
}

/** Today's course, which counts: its name, and where it's played (today's play page unless said). */
export type TodayCourse = { name?: string; href?: string }

/** One row of a past course's board on the result card. */
export type PastBoardRow = {
  place: number
  name: string
  /** As the board shows it: "1:14.41", "2 tries". */
  result: string
  /** The course's #1: its record. */
  record?: boolean
  you?: boolean
}

/** A past course's board, a few rows of it: "Seneca Glen's board", "15 drivers". */
export type PastBoard = { title: string; count?: string; rows: readonly PastBoardRow[] }

/** A link along the course's neighbours on the start card: "‹ #2 Pine Circuit". */
export type PastWalkLink = { label: string; href: string }

const Play = () => (
  <svg className="past-card__play" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
)

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/**
 * The label, big, with what it means for your result and the way to how ranks work: the start card's
 * answer to "does this count?".
 */
export function PastLabelBox({ slug, kind, sub }: { slug: string; kind: PastKind; sub?: ReactNode }) {
  const href = rankHowHref(undefined, 'weekly')
  return (
    <div className={`past-label run-label--${kind}`}>
      <RunLabel kind={kind} slug={slug} />
      <p className="past-label__sub">{sub ?? runLabelWords(kind, slug).sub}</p>
      <a className="past-label__how" href={href} onPointerDown={holdPress} onClick={leaveLink(href)}>
        How your rank works ›
      </a>
    </div>
  )
}

/** "Today's track is the one that counts: Willow Speedway ›", on both cards. */
function TodayCounts({ slug, today, boxed }: { slug: string; today: TodayCourse; boxed: boolean }) {
  const words = dailyWords(slug)
  const href = today.href ?? gamePlayHref(slug)
  return (
    <a
      className={`past-counts run-label--counts${boxed ? ' past-counts--boxed' : ''}`}
      href={href}
      onPointerDown={holdPress}
      onClick={leaveLink(href)}
    >
      <span className="past-counts__icon">
        <Check />
      </span>
      <span>
        {words.today} is the one that counts{today.name ? ': ' : ''}
        <b>{today.name ? `${today.name} ›` : ' ›'}</b>
      </span>
    </a>
  )
}

/**
 * Where your week and rank stand after a past run: just where they were. "Just as they were: 6th of 16
 * on Hot Lap this week, 4th of 41 overall", places only (ranking-shown-simply), and the way to how.
 * Everyone's, as a daily's page counts them: it has no group or period of its own. Signed out, a past
 * run saved nothing and no tag is yours: it just says they didn't change.
 */
export function PastRankNote({ slug }: { slug: string }) {
  // Signed out, nobody's place is shown as yours (usePastViewer, as the past tab and cards do).
  const { name } = usePastViewer()
  const rank = useRankFor(name, 'weekly', null)
  const game = getGame(slug)?.name ?? 'this game'
  const place = rank?.byGame[slug]
  const onGame = place ? (
    <>
      <b>{place.total ? `${ordinal(place.place)} of ${place.total}` : ordinal(place.place)}</b> on {game} this week
    </>
  ) : null
  const overall = rank?.rank ? (
    <>
      <b>
        {ordinal(rank.rank)} of {rank.totalPlayers}
      </b>{' '}
      overall
    </>
  ) : null
  const href = rankHowHref(undefined, 'weekly')
  return (
    <div className="past-rank">
      <span className="past-rank__k">Your week and rank</span>
      <span className="past-rank__v">
        {onGame || overall ? (
          <>
            Just as they were: {onGame}
            {onGame && overall ? ', ' : null}
            {overall}.
          </>
        ) : (
          'They didn’t change. A past run never counts toward them.'
        )}
      </span>
      <a className="past-rank__how" href={href} onPointerDown={holdPress} onClick={leaveLink(href)}>
        How your rank works ›
      </a>
    </div>
  )
}

/**
 * A past course's start card: what it is and when it was the day's, the label that says what a run here
 * does, its figures (on its day, and on its board where it keeps one), the sound and rules as on every
 * start card, the start button and the way back to its row.
 *
 * With `onStart`, the start button starts the run and the card keeps its presses. Without it, it starts
 * the way the game's own start card does: a tap anywhere on the stage, which the start button passes on.
 */
export function PastCourseStart({
  slug,
  course,
  day,
  kind,
  title,
  kicker,
  blurb,
  art,
  labelSub,
  facts,
  note,
  extraMeta,
  tools,
  startLabel,
  onStart,
  startDisabled = false,
  today,
  walk,
  back,
  children,
}: {
  slug: string
  /** The course on the past tab: a track's or hole's number, or a day (YYYY-MM-DD). */
  course: string | number
  /** The day it was the day's course, YYYY-MM-DD. */
  day: string
  /** What a run here does: 'board' goes on the course's own board; 'practice' saves nothing. */
  kind: PastKind
  /** The course's name, big: "Seneca Glen". */
  title: string
  /** In place of "Past track · Mon, Sep 28": "Wanted #2 · Mon, Sep 28 · Past day". */
  kicker?: string
  /** Under the title: "Hot Lap track #3. It was the day's track on Monday." */
  blurb?: ReactNode
  /** Under the heading: the day's five bugs, its glasses. */
  art?: ReactNode
  /** In place of the label's own line: "Your first bullseye here stands." */
  labelSub?: ReactNode
  /** "On its day", then its board's line where it keeps one. */
  facts: readonly PastFact[]
  /** A small line under the figures: "Taking its record pays 15 tickets, once. Blue car: 1:29.78." */
  note?: ReactNode
  /** Tiles in the figures' grid, as on the game's own start card. */
  extraMeta?: ReactNode
  /** The admin's tools, where the game's start card has them. */
  tools?: ReactNode
  /** The start button: "Race it", "Race it again". The game's verb + "it" when left out. */
  startLabel?: string
  onStart?: () => void
  /**
   * The start button waits, and says why: a run for the board is its player's, so it can't start until
   * the account signed in is known.
   */
  startDisabled?: boolean
  /** Today's course, which counts: "Today's track is the one that counts: Willow Speedway ›". */
  today?: TodayCourse
  /** The courses either side: "‹ #2 Pine Circuit", and the next one while it's a past one. */
  walk?: { prev?: PastWalkLink | null; next?: PastWalkLink | null }
  /** Where "Back to past tracks" goes, when not this course's row. */
  back?: string
  /** Under the figures: a sign-in line, a notice. */
  children?: ReactNode
}) {
  const words = dailyWords(slug)
  const backHref = back ?? dailyTabHref(slug, 'past', course)
  const tapThrough = !onStart
  const said = kicker ?? pastKicker(slug, day)
  return (
    <div
      ref={fitCardToSpace}
      className={`game-card past-card${tapThrough ? ' game-card--start' : ''}`}
      style={gameAccentStyle(slug)}
      role={tapThrough ? undefined : 'dialog'}
      aria-label={`${title}: ${said}`}
      onPointerDown={tapThrough ? undefined : holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">{said}</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        {blurb ? <p className="game-card__blurb">{blurb}</p> : null}
      </div>
      {art}
      <PastLabelBox slug={slug} kind={kind} sub={labelSub} />
      <GamePanelBody
        slug={slug}
        personalBest={0}
        past={{ href: backHref, kind, facts }}
        extraMeta={extraMeta}
        tools={
          note || tools ? (
            <>
              {note ? <p className="past-card__note">{note}</p> : null}
              {tools}
            </>
          ) : undefined
        }
      />
      {children}
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn game-card__start"
          onClick={onStart}
          disabled={startDisabled}
          autoFocus={!tapThrough && !startDisabled}
        >
          {startDisabled ? null : <Play />}
          {startDisabled ? 'Checking who’s signed in…' : (startLabel ?? `${words.verb} it`)}
        </button>
        <a className="panel__btn panel__btn--ghost past-card__link" href={backHref} onPointerDown={holdPress} onClick={leaveLink(backHref)}>
          Back to {words.pastTab.toLowerCase()}
        </a>
      </div>
      {walk?.prev || walk?.next ? (
        <nav className="past-card__walk" aria-label={`Other ${words.pastTab.toLowerCase()}`}>
          {walk.prev ? (
            <a href={walk.prev.href} onPointerDown={holdPress}>
              ‹ {walk.prev.label}
            </a>
          ) : (
            <span />
          )}
          {walk.next ? (
            <a href={walk.next.href} onPointerDown={holdPress}>
              {walk.next.label} ›
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      {today ? <TodayCounts slug={slug} today={today} boxed={false} /> : null}
    </div>
  )
}

/**
 * After a run on a past course: the result, where it went ("3rd on Seneca Glen's board", or practice,
 * saved nowhere), the course's board where it keeps one, that your week and rank are as they were, and
 * the ways on: again, back to its row, or today's course.
 */
export function PastCourseResult({
  slug,
  course,
  day,
  kind,
  kicker,
  figure,
  headline,
  line,
  board,
  note,
  today,
  againLabel,
  againBusy = false,
  onAgain,
  back,
  children,
}: {
  slug: string
  /** The course on the past tab: a track's or hole's number, or a day (YYYY-MM-DD). */
  course: string | number
  /** The day it was the day's course, YYYY-MM-DD. */
  day: string
  /** What the run did: went on the course's board, or practice. */
  kind: PastKind
  /** In place of "Past track · Mon, Sep 28". */
  kicker?: string
  /** The run's result, big: "1:19.80". */
  figure: ReactNode
  /**
   * Where it went: "3rd on Seneca Glen's board". Practice says "Practice: nothing was saved" when left out,
   * in the label's place.
   */
  headline?: ReactNode
  /** Under it: "Up from 6th: 2.11s quicker than your old best here." */
  line?: ReactNode
  /** The course's board, a few rows of it, yours marked. */
  board?: PastBoard | null
  /** A small line under the board: "DAD's record is 5.39s away. Taking it pays 15 tickets, once." */
  note?: ReactNode
  /** Today's course, which counts: a line, and a button. */
  today?: TodayCourse
  /** The again button: "Race again". The game's verb + "again" when left out. */
  againLabel?: string
  /** While the run is still saving: the again button waits, and says so. */
  againBusy?: boolean
  onAgain: () => void
  /** Where the past tab button goes, when not this course's row. */
  back?: string
  /** Under the board: the save's news, a sign-in line, tickets paid. */
  children?: ReactNode
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const words = dailyWords(slug)
  const backHref = back ?? dailyTabHref(slug, 'past', course)
  const todayHref = today?.href ?? gamePlayHref(slug)
  const said = headline ?? (kind === 'practice' ? 'Practice: nothing was saved' : null)
  const heading = kicker ?? pastKicker(slug, day)
  return (
    <div
      ref={fitCardToSpace}
      className="game-card past-card past-card--result"
      style={gameAccentStyle(slug)}
      role="dialog"
      aria-label={`${heading}: ${typeof figure === 'string' ? figure : 'done'}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">{heading}</span>
        <p className="past-card__figure">{figure}</p>
        {said ? <p className={`past-card__headline run-label--${kind}`}>{said}</p> : null}
        {line ? <p className="game-card__blurb past-card__line">{line}</p> : null}
      </div>
      {/* Practice's own headline already says it, in its colour: the label would say it twice. */}
      {headline != null || kind !== 'practice' ? <RunLabel kind={kind} slug={slug} className="past-card__label" /> : null}
      {board && board.rows.length > 0 ? (
        <div className="past-board">
          <p className="past-board__head">
            <span>{board.title}</span>
            {board.count ? <span>{board.count}</span> : null}
          </p>
          <ol>
            {board.rows.map((row) => (
              <li key={`${row.place}-${row.name}`} className={row.you ? 'is-you' : undefined}>
                <span className="past-board__n">{row.place}</span>
                <span className="past-board__name">
                  {row.name}
                  {row.you ? <i> · you</i> : null}
                </span>
                {row.record ? <span className="past-board__tag run-label--board">Record</span> : null}
                <span className="past-board__t">{row.result}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {note ? <p className="past-card__note">{note}</p> : null}
      {children}
      <PastRankNote slug={slug} />
      {today ? <TodayCounts slug={slug} today={today} boxed /> : null}
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          disabled={againBusy}
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          <Play />
          {againBusy ? 'Saving…' : (againLabel ?? `${words.verb} again`)}
        </button>
        <div className="past-card__pair">
          <a
            className="panel__btn panel__btn--ghost"
            href={backHref}
            onClick={(e) => {
              e.preventDefault()
              if (allow(e)) leavePlay(backHref)
            }}
          >
            {words.pastTab}
          </a>
          <a
            className="panel__btn panel__btn--ghost past-card__today run-label--counts"
            href={todayHref}
            onClick={(e) => {
              e.preventDefault()
              if (allow(e)) leavePlay(todayHref)
            }}
          >
            {words.today}
          </a>
        </div>
      </div>
    </div>
  )
}
