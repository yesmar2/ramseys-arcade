import { recordHref, recordsHref } from '../hooks/useHashRoute'
import { recordRows } from '../lib/gameHub'
import { recordKind } from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { ChevronRightIcon, EventsIcon, FlameIcon, SparkleIcon, TimerIcon } from './chromeIcons'

/**
 * The game's record book, from the viewer's side: the records they are tied
 * with (one better takes them), the ones they hold, the nearest, and one that
 * nobody has set. Someone not in the book sees the unset ones and the best.
 */
export function GameHubRecords({
  slug,
  gameName,
  records,
  me,
}: {
  slug: string
  gameName: string
  /** Null while the book loads. */
  records: RecordSummary[] | null
  me: string
}) {
  if (records && records.length === 0) return null
  const { rows, yours } = records ? recordRows(records, me) : { rows: [], yours: false }

  return (
    <section className="gh-card gh-records" aria-labelledby="gh-records-title">
      <div className="gh-card__head">
        <h2 id="gh-records-title" className="gh-cap">
          {yours ? 'Your record books' : `${gameName}’s record books`}
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
            const Icon = !row.record.top ? SparkleIcon : kind === 'streaks' ? FlameIcon : kind === 'clock' ? TimerIcon : EventsIcon
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
