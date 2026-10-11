import { isDailyGame } from '../data/games'
import { recordHref, recordsHref } from '../hooks/useHashRoute'
import { recordRows } from '../lib/gameHub'
import { recordKind } from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { ChevronRightIcon, EventsIcon, FlameIcon, SparkleIcon, TimerIcon } from './chromeIcons'

/**
 * The game's record book: one record nobody has set yet, then the ones held and who holds them, the same for
 * everyone (Ramsey, 2026-10-11: the page needs the records, not "Your record books"; a player's own are in the
 * book itself). A daily has none here: its page's Records tab (DailyRecordsTab) is its book.
 */
export function GameHubRecords({
  slug,
  records,
}: {
  slug: string
  /** Null while the book loads. */
  records: RecordSummary[] | null
}) {
  if (isDailyGame(slug) || (records && records.length === 0)) return null
  const rows = records ? recordRows(records, '').rows : []

  return (
    <section className="gh-card gh-records" aria-labelledby="gh-records-title">
      <div className="gh-card__head">
        <h2 id="gh-records-title" className="gh-cap">
          Records
        </h2>
        {records ? (
          <a className="gh-more" href={recordsHref(slug)}>
            All {records.length}
            <ChevronRightIcon />
          </a>
        ) : null}
      </div>
      {records ? (
        <ul className="gh-rec-list">
          {rows.map((row) => {
            const kind = recordKind(row.record)
            const timed = kind === 'clock' || (kind === 'course' && row.record.unit === 'ms')
            const Icon = !row.record.top ? SparkleIcon : kind === 'streaks' ? FlameIcon : timed ? TimerIcon : EventsIcon
            return (
              <li key={row.record.id}>
                <a className={`gh-rec${row.hot ? ' gh-rec--hot' : ''}`} href={recordHref(slug, row.record.id, 'all')}>
                  <span className="gh-rec__mark" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="gh-rec__text">
                    <span className="gh-rec__label">{row.record.label}</span>
                    <span className="gh-rec__note">{row.note}</span>
                  </span>
                  <span className="gh-rec__value">{row.value}</span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="gh-stand__skel" aria-hidden="true">
          <span className="skel-line" />
          <span className="skel-line" />
          <span className="skel-line" />
        </div>
      )}
    </section>
  )
}
