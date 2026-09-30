import { useMemo } from 'react'
import { DAILY_EPOCH, dailyNumber } from '../../games/acechase/daily'
import { ACECHASE_SCORE_BASE } from '../../games/acechase/score'
import { useAccountId } from '../../hooks/useAccountId'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dailyDay, PLACE_NAME, todaysHole } from '../../lib/dailyHole'
import type { CourseBoard, CourseFigure, CourseTop, HintFacts, PastSource } from '../../lib/dailyPast'
import { recordSetOn, usePastViewer } from '../../lib/dailyPast'
import { fetchHoleBoard, solvedHere, useHoleRecordsAsked, type HoleFigure } from '../../lib/pastHoles'
import { HolePlan } from '../TodaysHoleCard'
import { PastCourses } from './PastCourses'

const SLUG = 'acechase'

/** A result in tries as the hole's board scores it, from a million less the tries, as the days' boards do. */
function asFigure(e: HoleFigure): CourseFigure {
  return { name: e.name, score: ACECHASE_SCORE_BASE - e.tries, ...(e.avatarId ? { avatarId: e.avatarId } : {}) }
}

const asYou = (you: { tries: number; place: number } | null) => (you ? { score: ACECHASE_SCORE_BASE - you.tries, place: you.place } : null)

const anchor = (day: string) => String(dailyNumber(day))

const playHref = (day: string) => `${gamePlayHref(SLUG)}?hole=day:${day}`

function title(day: string) {
  const hole = todaysHole(day)
  return `#${hole.n} ${hole.def.name}`
}

const sub = (day: string) => `On ${PLACE_NAME[todaysHole(day).pick.style]}`

function art(day: string) {
  return <HolePlan hole={todaysHole(day)} />
}

async function fetchTop(day: string, name: string): Promise<CourseTop> {
  const board = await fetchHoleBoard(day, name)
  return { top: board.entries.map(asFigure), players: board.players, you: asYou(board.you) }
}

function hint({ kind, signedIn }: HintFacts): string | null {
  if (!signedIn) return 'Sign in and your first bullseye here goes on its board.'
  return kind === 'practice' ? 'Your first bullseye here stands.' : 'Your first bullseye goes on its board.'
}

/**
 * Ace Chase's past holes: every hole before today's, newest first. Each keeps a board of its own for good
 * (lib/pastHoles.ts), but takes only a player's first result on it: one from its day stands, and so does
 * the first bullseye after it. With one there, playing the hole again is practice.
 */
export function HoleArchive() {
  const today = dailyDay()
  const viewer = usePastViewer()
  const account = useAccountId()
  const { rows: records, failed, retry } = useHoleRecordsAsked(viewer.name)
  const rows = useMemo(() => {
    if (!records) return null
    const out = new Map<string, CourseBoard>()
    for (const r of records) {
      if (r.day < today) {
        out.set(r.day, { record: r.record ? asFigure(r.record) : null, setOn: recordSetOn(r.record, dailyDay), players: r.players, you: asYou(r.you) })
      }
    }
    return out
  }, [records, today])
  const source = useMemo<PastSource>(
    () => ({
      slug: SLUG,
      today,
      first: DAILY_EPOCH,
      number: dailyNumber,
      anchor,
      playHref,
      title,
      sub,
      art,
      boards: {
        rows,
        failed,
        retry,
        fetchTop,
        rule: 'your first bullseye on one goes on it, if you didn’t play it on its day.',
        legend: 'everyone’s first bullseye, from its day and since',
        player: 'player',
      },
      firstResultOnly: true,
      // A bullseye this device has kept but not sent yet is a result all the same: the next one is practice.
      resultHere: (day: string) => account !== undefined && solvedHere(day, account) != null,
      hint,
    }),
    [today, rows, account, failed, retry],
  )
  return <PastCourses source={source} />
}
