import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { dailyTabHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import {
  coursesHeldRecord,
  daysWonRecord,
  goldStreakRecord,
  podiumDaysRecord,
  streakRecord,
  useDailyRecords,
  useStreakBook,
  type DayRecord,
} from '../lib/dailyRecords'
import { useHeldHeight } from '../lib/heldShape'
import { normalizePlayerName } from '../lib/leaderboard'
import { isRaceGame } from '../lib/raceMedals'
import { resolveGameAccent } from '../lib/theme'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'

/** How many of its records a ranked daily's page shows beside today's board. */
const PEEK_RECORDS = 3

/** The dailies whose records count the courses held (a track's or hole's own record): Hot Lap's tracks. */
const HELD_COURSES: readonly string[] = ['hotlap']

/**
 * Three of a ranked daily's records made over the days, beside today's board on its page (B of the "Game page,
 * simpler" canvas; Ramsey, 2026-11-17: "Yes, do dailies"): Days played in a row, Most days won, and Hot Lap's
 * tracks held or a race's longest run of golds (else days on the podium). Each its number and who holds it, yours
 * in gold; then all of them a tap away, at the records' own address (GameHubPage). Its words are the Records list's
 * (lib/dailyRecords.ts), as a game's records beside its board are its book's (RecordBookView RecordsPeek).
 */
export function DailyRecordsPeek({ slug }: { slug: string }) {
  const account = useAccountId()
  const tag = normalizePlayerName(usePlayerName())
  // Signed out, nothing is saved, so there's no "you": the tag on this device may be anyone's (DailyRecordsTab).
  const viewer = { name: account === null ? '' : tag, signedIn: account !== null }
  const records = useDailyRecords(slug, viewer.name)
  const streak = useStreakBook(slug, viewer.name)
  const loading = (!streak.data && !streak.failed) || (!records.data && !records.failed)
  const held = useHeldHeight<HTMLElement>(`daily-records-peek-${slug}`, loading)
  const game = getGame(slug)
  const accent = resolveGameAccent(slug, game?.accent ?? '#2eb8a0')

  const third: DayRecord | null = HELD_COURSES.includes(slug)
    ? coursesHeldRecord(slug, records.data?.courseRecords ?? null, viewer)
    : isRaceGame(slug) && records.data?.goldStreak != null
      ? goldStreakRecord(records.data.goldStreak, viewer)
      : records.data?.podiumDays != null
        ? podiumDaysRecord(records.data.podiumDays, viewer)
        : null
  const rows = [streakRecord(slug, streak.data, viewer), daysWonRecord(records.data?.daysWon ?? null, viewer), ...(third ? [third] : [])].slice(
    0,
    PEEK_RECORDS,
  )
  const failed = streak.failed && records.failed
  const href = dailyTabHref(slug, 'records')
  const line = (w: string) => <span className="skel-line" style={{ '--skel-w': w } as CSSProperties} />

  return (
    <section
      ref={held.ref}
      className="gh-card gh-peek gh-peek--records sb-scope"
      style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent), ...held.style } as CSSProperties}
      aria-labelledby="gh-peek-records"
      aria-busy={loading || undefined}
      // A blip hunt hiding place, where the page's tabs were (lib/bugHunt.ts).
      data-hunt={`g-board-${slug}`}
    >
      <div className="gh-peek__head">
        <h2 id="gh-peek-records" className="gh-peek__title">
          Records
        </h2>
      </div>
      {loading ? (
        <ol className="gh-recs" aria-hidden="true">
          {Array.from({ length: PEEK_RECORDS }, (_, i) => (
            <li key={i} className="gh-rec">
              <span className="gh-rec__link">
                <span className="gh-rec__what">{line('7rem')}</span>
                <span className="gh-rec__num">{line('3rem')}</span>
                <span className="gh-rec__who">
                  <span className="pmark pmark--empty gh-rec__mark" />
                  {line('4.5rem')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : failed ? (
        <div className="gh-peek__empty">
          <p className="gh-peek__empty-title">Couldn’t load the records.</p>
        </div>
      ) : (
        <ol className="gh-recs">
          {rows.map((record) => {
            const first = record.holders?.marks[0] ?? null
            const mine = record.you?.kind === 'mine'
            return (
              <li key={record.key} className={`gh-rec${mine ? ' gh-rec--yours' : ''}${record.value ? '' : ' gh-rec--open'}`}>
                <a className="gh-rec__link" href={href}>
                  <span className="gh-rec__what">{record.title}</span>
                  <span className="gh-rec__num">{record.value ?? '–'}</span>
                  <span className="gh-rec__who">
                    {first ? <PlayerMark name={first.name} avatarId={first.avatarId} className="gh-rec__mark" /> : null}
                    <span className="gh-rec__tag">
                      {record.holders && record.holders.marks.length === 1 && first ? (
                        <PlayerName name={first.name} avatarId={first.avatarId} />
                      ) : (
                        (record.holders?.names ?? 'Be the first')
                      )}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
      <a className="gh-peek__all" href={href}>
        All records
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}
