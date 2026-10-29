import { useEffect, useRef, useState } from 'react'
import { medalTimes, paceMsOf, type RaceGame } from '../lib/raceMedals'
import { sendSetLap, setPlatinumFor, useSetPlatinums } from '../lib/setPlatinum'

/*
 * The course's platinum on an admin's test-run cards (lib/setPlatinum.ts). On the start card it says what platinum
 * is now: set by their own lap, or worked out. On the card after a run, `ms` is the run's time: it goes to the API
 * as soon as the card opens, which keeps it if it's their best there, and the row says what platinum is after it.
 */

type Sent = { lapMs: number; improved: boolean; platinumMs: number | null } | 'sending' | { error: string }

export function SetPlatinumRow({
  game,
  course,
  pace,
  planned = null,
  ms,
  format,
}: {
  game: RaceGame
  /** The course's day number, as its test run has it. */
  course: number
  /** The blue's time, in seconds, as the day's plan has it. */
  pace: number
  /** The course's worked-out platinum, where it has one of its own (Hot Lap's tracks). */
  planned?: number | null
  /** A finished run's time, in ms: sent as a set lap. */
  ms?: number
  format: (seconds: number) => string
}) {
  useSetPlatinums()
  const paceMs = paceMsOf(pace)
  const [sent, setSent] = useState<Sent | null>(null)
  const sentFor = useRef<number | null>(null)
  useEffect(() => {
    if (ms == null || sentFor.current === ms) return
    sentFor.current = ms
    setSent('sending')
    sendSetLap(game, course, ms).then(setSent, (err: unknown) => setSent({ error: err instanceof Error ? err.message : 'Not sent' }))
  }, [game, course, ms])

  const set = setPlatinumFor(game, paceMs)
  const platinum = medalTimes(game, paceMs, planned).platinum
  // Short, as a tile's label: the whole of it in the tile's title.
  let note: string
  let title: string
  if (sent === 'sending') [note, title] = ['setting…', 'Sending this run as your lap here']
  else if (sent && 'error' in sent) [note, title] = ['not set', `Not set: ${sent.error}`]
  else if (sent?.improved) [note, title] = ['this run + 0.5s', 'Set by this run, and half a second']
  else if (sent) [note, title] = ['your best + 0.5s', `Your best here, ${format(sent.lapMs / 1000)}, and half a second`]
  else if (set != null) [note, title] = ['your best + 0.5s', 'Set by your best here, and half a second']
  else [note, title] = ['worked out', 'Worked out: a test run here sets it']
  return (
    <div className="game-pause-meta__row" title={title}>
      <span>Platinum · {note}</span>
      <strong>{format(platinum / 1000)}</strong>
    </div>
  )
}
