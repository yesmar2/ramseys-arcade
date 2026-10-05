import type { ReactNode } from 'react'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { raceGapWords, type RaceGame } from '../lib/raceMedals'
import type { ReportLine } from '../lib/runReport'
import type { SeasonRun } from '../lib/season'
import { MedalLadder } from './RaceMedal'
import { SeasonLevelUp } from './season/SeasonRun'

/*
 * A racing daily's run on its report (Hot Lap, Marble Run, Lander), between the score and the way on to the
 * next daily, as Ramsey picked it (2026-10-05, "B · Medal ladder"): the day's four medals as a ladder, with
 * their times and tickets, so the medals explain themselves; the run's tickets in one slim row, the season's
 * pass said in it; and the run's place today in one row, the board a press away. The ladder is worked out
 * from the run and the day's blue, so it's there at once; while the save answers, the rows below it hold
 * their room.
 */
export function RaceReport({
  game,
  paceMs,
  format,
  ms,
  previousMs,
  pending,
  tickets,
  levelUp = null,
  place = null,
  onBoard,
}: {
  game: RaceGame
  /** The day's blue time, from its plan. */
  paceMs: number
  format: (seconds: number) => string
  /** This run's time, and the day's best before it. */
  ms: number
  previousMs: number | null
  /** The save hasn't answered yet. */
  pending: boolean
  /** The run's ticket row (prizes/RunTickets.tsx), the signed-out box, or nothing. */
  tickets?: ReactNode
  /** The season's pass, when the run reached a level on it: its rewards, given then and there. */
  levelUp?: SeasonRun | null
  /** The run's place on today's board, as the report reads it (runReport.ts's board line). */
  place?: ReportLine | null
  onBoard?: () => void
}) {
  return (
    <>
      <MedalLadder game={game} paceMs={paceMs} ms={ms} previousMs={previousMs} format={format} />
      {pending ? (
        <RaceRowsLoading />
      ) : (
        <>
          {tickets}
          {levelUp?.levelUp.length ? <SeasonLevelUp run={levelUp} /> : null}
          {place ? <PlaceRow line={place} onBoard={onBoard} /> : null}
        </>
      )}
    </>
  )
}

/**
 * The line under a racing daily's score: `lead` (the course, or the run's own words), and the run against the
 * day's best before it: "Today's Cave #6 · 1.68s faster than your 1:07.80", "Landed · 0.90s off your best
 * today, 1:06.12". It stands in for the report's Your best line.
 */
export function raceSubWords(lead: string, ms: number, previousMs: number | null, format: (seconds: number) => string): string {
  const versus =
    previousMs == null
      ? null
      : ms < previousMs
        ? `${raceGapWords(previousMs - ms)} faster than your ${format(previousMs / 1000)}`
        : ms > previousMs
          ? `${raceGapWords(ms - previousMs)} off your best today, ${format(previousMs / 1000)}`
          : 'tied your best today'
  return [lead, versus].filter(Boolean).join(' · ')
}

/** "#4 · Lander today · up from 7th, 0.31s behind PILOT for 3rd", and the board. */
function PlaceRow({ line, onBoard }: { line: ReportLine; onBoard?: () => void }) {
  // A run's last presses don't reach the board's button (useDeliberatePress), as with the report's own.
  const allow = useDeliberatePress()
  const detail = line.detail ? line.detail.charAt(0).toUpperCase() + line.detail.slice(1) : null
  return (
    <div className={`race-place race-place--${line.tone}`}>
      <span className="race-place__at">{line.value}</span>
      <span className="race-place__text">
        <span className="race-place__label">{line.label}</span>
        {detail ? <span className="race-place__detail">{detail}</span> : null}
      </span>
      {onBoard ? (
        <button
          type="button"
          className="race-place__go"
          onClick={(e) => {
            if (allow(e)) onBoard()
          }}
        >
          Board ›
        </button>
      ) : null}
    </div>
  )
}

/** The ticket row and the place row's room while the save answers, in their own shapes. */
function RaceRowsLoading() {
  return (
    <div className="race-rows-loading">
      <p className="visually-hidden" role="status">
        Saving your run
      </p>
      <span className="race-rows-loading__tix" aria-hidden="true">
        <span className="report__ghost report__ghost--label" />
        <span className="report__ghost report__ghost--detail" />
      </span>
      <span className="race-place race-place--ghost" aria-hidden="true">
        <span className="race-place__at" />
        <span className="race-place__text">
          <span className="report__ghost report__ghost--label" />
          <span className="report__ghost report__ghost--detail" />
        </span>
      </span>
    </div>
  )
}
