import { useMemo } from 'react'
import type { CourseBoard, CourseTop, PastSource } from '../../lib/dailyPast'
import { BOARD_TOP } from '../../lib/dailyPast'
import { fetchTrackBoard, useTrackRecordsAsked, type TrackGame } from '../../lib/trackBoards'

/**
 * A ranked daily's past courses' All time boards, for its past tab (lib/trackBoards.ts): each course's record,
 * how many are on it and your place, by its day, and one course's top five for its panel. `numberOf` is a
 * day's course number: Hot Lap's track, or Marble Run's or Lander's day number.
 */
export function usePastBoards(game: TrackGame, name: string, today: string, numberOf: (day: string) => number): NonNullable<PastSource['boards']> {
  const { rows: records, failed, retry } = useTrackRecordsAsked(game, name)
  const rows = useMemo(() => {
    if (!records) return null
    const out = new Map<string, CourseBoard>()
    for (const r of records) {
      if (r.day < today) out.set(r.day, { record: r.record, players: r.drivers, you: r.you })
    }
    return out
  }, [records, today])
  return useMemo(
    () => ({
      rows,
      failed,
      retry,
      async fetchTop(day: string, who: string): Promise<CourseTop> {
        const board = await fetchTrackBoard(game, numberOf(day), who, { limit: BOARD_TOP })
        return { top: board.entries, players: board.drivers, you: board.you }
      },
    }),
    [rows, failed, retry, game, numberOf],
  )
}
