import type { CSSProperties, ReactNode } from 'react'
import { acechaseTriesFromBoardScore, formatTries } from '../games/acechase/score'
import { findbugMsFromBoardScore, formatFindbugMs } from '../games/findbug/score'
import { formatBoard } from '../games/halffull/boardFigure'
import { tierFor } from '../games/halffull/score'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords, useDailyDays } from '../lib/archive'
import { normalizePlayerName } from '../lib/leaderboard'
import { addDays, boardDay } from '../lib/rankHow'
import { openSiteMenu } from './siteNav'
import '../styles/yourDays.css'

/*
 * A daily just for fun's Today tab, under today's card (data/games.ts Game.ranked): the player's own days on
 * it, and how today went for them, part by part. Nobody else is on either: these games place nobody, so the
 * page is the player's record, the way a word game keeps your stats. The left card is this file's; the right
 * one is each game's, beside its Today card (TodaysHoleCard, TodaysWantedCard, TodaysPourCard), built from
 * the cards here.
 */

export type FunDaily = 'acechase' | 'findbug' | 'halffull'

type Kind = {
  /** The card's title. */
  title: string
  /** What one is, for "once you've played one". */
  one: string
  /** The game's day #1 (Ace Chase's DAILY_EPOCH, the others' FIRST_DAY), for a day's number. */
  first: string
  /** A board score as what it means: tries, milliseconds or a percentage. */
  value: (score: number) => number
  /** Whether more is better. */
  higher: boolean
  /** One day's result: "3 tries", "41.2s", "89.6%". */
  show: (value: number) => string
  /** An average of them. */
  mean: (value: number) => string
  /** A word for a day's result, where the game has one: its tier, an ace. */
  word?: (value: number) => string | null
}

const KINDS: Record<FunDaily, Kind> = {
  acechase: {
    title: 'Your holes',
    one: 'a hole',
    first: '2026-09-25',
    value: acechaseTriesFromBoardScore,
    higher: false,
    show: formatTries,
    mean: (tries) => formatTries(Math.round(tries * 10) / 10),
    word: (tries) => (tries === 1 ? 'An ace' : null),
  },
  findbug: {
    title: 'Your days',
    one: 'a day',
    first: '2026-09-27',
    value: findbugMsFromBoardScore,
    higher: false,
    show: formatFindbugMs,
    mean: formatFindbugMs,
  },
  halffull: {
    title: 'Your pours',
    one: 'a pour',
    first: '2026-09-28',
    // The board's figure is hundredths of a point (91.2% is 9120).
    value: (score) => score / 100,
    higher: true,
    show: (percent) => formatBoard(Math.round(percent * 100)),
    // To a tenth, rounded down, as a day's own figure is.
    mean: (percent) => `${(Math.floor(percent * 10) / 10).toFixed(1)}%`,
    word: (percent) => tierFor(percent),
  },
}

/** A day's number in its game: #1 on its first day. */
function dayNumber(first: string, day: string): number {
  const at = (d: string) => Date.parse(`${d}T12:00:00Z`)
  return Math.round((at(day) - at(first)) / 86_400_000) + 1
}

/** Days in a row with a result: counting today if there is one, or up to yesterday while there isn't. */
function daysInARow(played: ReadonlySet<string>, today: string): number {
  let day = played.has(today) ? today : addDays(today, -1)
  let n = 0
  while (played.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/**
 * A card of the player's own, as these pages have them: who it's about, what, then its lines. `hunt` is the
 * daily bug hunt's hiding place on it (lib/bugHunt.ts).
 */
export function YourCard({ title, children, labelledBy, hunt }: { title: string; children: ReactNode; labelledBy: string; hunt?: string }) {
  return (
    <section className="gh-card yd" aria-labelledby={labelledBy} data-hunt={hunt}>
      <div className="yd__head">
        <p className="gh-cap">Just you</p>
        <h2 id={labelledBy} className="yd__title">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

/**
 * One part of today (a glass, a scene, a kind of try): its mark, its name, how it went on a bar (`fill`, out
 * of 100), and in words. `color` is its mark's, and its bar's.
 */
export function YourRow({ mark, name, fill, value, color }: { mark?: ReactNode; name: string; fill: number | null; value: string; color?: string }) {
  return (
    <li className="yd-row" style={color ? ({ '--yd-fill': color } as CSSProperties) : undefined}>
      {mark ?? <span className="yd-mark" aria-hidden="true" />}
      <span className="yd-row__name">{name}</span>
      <span className="yd-row__bar" aria-hidden="true">
        {fill != null ? <span style={{ width: `${Math.max(2, Math.min(100, fill))}%` }} /> : null}
      </span>
      <span className="yd-row__value">{value}</span>
    </li>
  )
}

/** The player's days on a daily just for fun: how many, in a row, their best, their average, and the last few. */
export function YourDaysCard({ slug }: { slug: FunDaily }) {
  const kind = KINDS[slug]
  const { signedIn } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const id = `yd-days-${slug}`
  return (
    <YourCard title={kind.title} labelledBy={id} hunt={`g-board-${slug}`}>
      {signedIn && name ? (
        <YourDaysBody slug={slug} kind={kind} name={name} />
      ) : (
        <p className="yd__note">
          Playing needs no account.{' '}
          <button type="button" className="yd__link" onClick={openSiteMenu}>
            Sign in
          </button>{' '}
          to keep your days here: how many you've played, how many in a row, your best and your average.
        </p>
      )}
    </YourCard>
  )
}

function YourDaysBody({ slug, kind, name }: { slug: FunDaily; kind: Kind; name: string }) {
  const { days, failed, retry } = useDailyDays(slug, name)
  if (!days) {
    return failed ? (
      <p className="yd__note">
        Your days didn't load.{' '}
        <button type="button" className="yd__link" onClick={retry}>
          Try again
        </button>
      </p>
    ) : (
      <div className="yd__skel" aria-busy="true">
        <span className="skel-line" />
        <span className="skel-line" />
      </div>
    )
  }
  // Newest first, as the API lists them.
  const mine = days.flatMap((d) => (d.you ? [{ day: d.day, value: kind.value(d.you.score) }] : []))
  if (!mine.length) return <p className="yd__note">Your days show here once you've played {kind.one}.</p>
  const values = mine.map((d) => d.value)
  const best = kind.higher ? Math.max(...values) : Math.min(...values)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const inARow = daysInARow(new Set(mine.map((d) => d.day)), boardDay())
  return (
    <>
      <ul className="yd-figs">
        <li>
          <b>{mine.length}</b>
          <span>played</span>
        </li>
        <li>
          <b>{inARow}</b>
          <span>{inARow === 1 ? 'day in a row' : 'days in a row'}</span>
        </li>
        <li>
          <b>{kind.show(best)}</b>
          <span>your best</span>
        </li>
        <li>
          <b>{kind.mean(mean)}</b>
          <span>your average</span>
        </li>
      </ul>
      <ol className="yd-days">
        {mine.slice(0, 5).map((d) => {
          const word = kind.word?.(d.value) ?? null
          return (
            <li key={d.day} className="yd-day">
              <span className="yd-day__when">
                #{dayNumber(kind.first, d.day)} · {archiveDayWords(d.day)}
              </span>
              <b className="yd-day__result">{kind.show(d.value)}</b>
              <span className="yd-day__word">{word ?? ''}</span>
            </li>
          )
        })}
      </ol>
    </>
  )
}
