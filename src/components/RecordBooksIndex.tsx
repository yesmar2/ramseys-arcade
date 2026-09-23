import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { useRecordBooks } from '../hooks/useRecordBooks'
import { rankHref, recordHref, recordsHref, siteRecordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useActiveGroup } from '../lib/groups'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  bookHolders,
  booksHeadline,
  booksHeld,
  closestToInk,
  coverRecord,
  holderCounts,
  latestInk,
  recordValue,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { ordinal } from '../lib/scoreboard'
import { siteRecordUnitWord } from '../lib/siteRecords'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'

/*
 * The record books' front page: who holds the most records, the ones you hold
 * and the ones you're nearest to taking, every book with its best record on
 * the cover, what was set lately, and the house book's records.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

function accentOf(slug: string) {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function nameOf(slug: string) {
  return getGame(slug)?.name ?? slug
}

function dayOf(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function QuillIcon() {
  return (
    <svg className="sb-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 4c-6 1-11 5-13 12l-2 4 4-2c7-2 11-7 12-13z" />
      <path d="M7 16l5-5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="sb-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** One record in a short list: its game's thumb, what it is, and a figure on the right. */
function RecordItem({
  game,
  record,
  sub,
  figure,
  quiet = false,
}: {
  game: string
  record: RecordSummary
  sub: string
  figure: string
  quiet?: boolean
}) {
  const accent = accentOf(game)
  return (
    <li>
      <a className="rbk-item" href={recordHref(game, record.id)}>
        <GameThumbArt slug={game} accent={accent} className="rbk-item__thumb" />
        <span className="rbk-item__text">
          <span className="rbk-item__label">{record.label}</span>
          <span className="rbk-item__sub">{sub}</span>
        </span>
        <span className={`rbk-item__figure${quiet ? ' rbk-item__figure--quiet' : ''}`}>{figure}</span>
      </a>
    </li>
  )
}

export function RecordBooksIndex() {
  const me = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useRecordBooks(me, groupId)
  const all = data.books.flatMap((b) => b.records)
  const head = booksHeadline(all)
  const holders = holderCounts(all)
  const inBooks = booksHeld(data.books)
  const topCount = holders[0]?.count ?? 0
  const avatars = new Map(all.filter((r) => r.top).map((r) => [normalizePlayerName(r.top!.name), r.top!.avatarId]))
  const held = all.filter((r) => r.top).length

  const mine = data.books.flatMap(({ game, records }) =>
    records.filter((r) => me && r.top && normalizePlayerName(r.top.name) === me).map((record) => ({ game, record })),
  )
  // Older API builds don't say where you stand on each record; then there is nothing to be close to.
  const knowsYou = all.some((r) => r.you !== undefined)
  const close = knowsYou ? closestToInk(data.books) : []
  const latest = latestInk(data.books)

  if (data.error) {
    return (
      <div className="sb rbk">
        <BoardEmpty title="Couldn’t load the record books" detail="Check your connection and try again." />
      </div>
    )
  }

  return (
    <div className="sb rbk">
      <section className="sb-hero" aria-labelledby="rbk-title">
        <div className="sb-hero__text">
          <p className="sb-kicker">
            <QuillIcon />
            Hall of fame · all time
          </p>
          <h1 id="rbk-title" className="sb-title">
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '14ch' } as CSSProperties} />
            ) : (
              <>
                {head.name ? <span className="sb-title__lead">{head.name}</span> : null}
                {head.rest}
              </>
            )}
          </h1>
          <p className="sb-lede">
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '22rem' } as CSSProperties} />
            ) : (
              `${held} of them have a name in ink, across ${data.books.length} games. The books keep the best of everything: the fastest clears, the best single runs and the longest streaks, with a name beside each until someone beats it.`
            )}
          </p>
          <div className="rbk-acts">
            <a className="sb-cta" href="#books">
              Open a book
            </a>
            <a className="sb-ghost" href={siteRecordsHref()}>
              The house book
            </a>
          </div>
        </div>

        <div className="sb-card sb-standings">
          <div className="sb-standings__head">
            <h2 className="sb-card__title">Most records held</h2>
            <span className="sb-standings__count">all books</span>
          </div>
          {data.loading ? (
            <ol className="sb-rows" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="sb-row sb-row--skel">
                  <span className="sb-row__link">
                    <span className="skel-line" style={{ '--skel-w': '2rem' } as CSSProperties} />
                    <span className="sb-row__mark sb-row__mark--open" />
                    <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
                    <span className="sb-row__bar" />
                    <span className="skel-line" style={{ '--skel-w': '2rem' } as CSSProperties} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="sb-rows">
              {holders.slice(0, 6).map((h, i) => {
                const mineRow = Boolean(me) && h.name === me
                const medal = MEDALS[i]
                const bookCount = inBooks.get(h.name) ?? 1
                return (
                  <li
                    key={h.name}
                    className={`sb-row${medal ? ` sb-row--${medal}` : ''}${mineRow ? ' sb-row--you' : ''}`}
                  >
                    <a className="sb-row__link" href={rankHref(h.name)}>
                      <span className="sb-row__ord">{ordinal(i + 1).toUpperCase()}</span>
                      <PlayerMark name={h.name} avatarId={avatars.get(h.name)} className="sb-row__mark" />
                      <span className="sb-row__who">
                        <span className="sb-row__name">{h.name}</span>
                        <span className="sb-row__boards">
                          in {bookCount} {bookCount === 1 ? 'book' : 'books'}
                          {mineRow ? <span className="sb-row__you">You</span> : null}
                        </span>
                      </span>
                      <span className="sb-row__bar" aria-hidden="true">
                        <span style={{ width: `${(h.count / Math.max(1, topCount)) * 100}%` }} />
                      </span>
                      <span className="sb-row__pts">{h.count}</span>
                    </a>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </section>

      {me && !data.loading ? (
        <section className="sb-you" aria-label="Your records">
          <div className="sb-card rbk-card">
            <div className="rbk-card__head">
              <PlayerMark name={me} className="rbk-card__mark" />
              <h2 className="sb-card__title">
                {mine.length
                  ? `You hold ${mine.length} ${mine.length === 1 ? 'record' : 'records'}`
                  : 'No records in your name yet'}
              </h2>
            </div>
            {mine.length ? (
              <ul className="rbk-list">
                {mine.map(({ game, record }) => (
                  <RecordItem
                    key={`${game}-${record.id}`}
                    game={game}
                    record={record}
                    sub={`${nameOf(game)} · set ${dayOf(record.top!.at)}`}
                    figure={recordValue(record, record.top!.score)}
                  />
                ))}
              </ul>
            ) : (
              <p className="rbk-card__note">
                Every book has a streak for days played in a row and one for strong runs in a row. They are the
                easiest way into ink.
              </p>
            )}
          </div>
          {close.length ? (
            <div className="sb-card rbk-card">
              <h2 className="sb-card__title">Closest to ink</h2>
              <p className="rbk-card__sub">The records you are nearest to taking.</p>
              <ul className="rbk-list">
                {close.map(({ game, record, off }) => (
                  <RecordItem
                    key={`${game}-${record.id}`}
                    game={game}
                    record={record}
                    sub={`${nameOf(game)} · you’re #${record.you!.rank} with ${recordValue(record, record.you!.score)}`}
                    figure={off}
                    quiet
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section id="books" className="sb-section rbk-books-section" aria-labelledby="rbk-books">
        <div className="sb-head">
          <div>
            <h2 id="rbk-books" className="sb-h2">
              The books
            </h2>
            <p className="sb-sub">One for each game, with its best record on the cover.</p>
          </div>
        </div>
        <ul className="rbk-books">
          {data.books.map(({ game, records }) => {
            const accent = accentOf(game)
            const cover = coverRecord(records)
            const yours = records.filter((r) => me && r.top && normalizePlayerName(r.top.name) === me).length
            return (
              <li key={game}>
                <a
                  className="rbk-book"
                  href={recordsHref(game)}
                  style={{ '--book-accent': accent } as CSSProperties}
                >
                  <span className="rbk-book__top">
                    <GameThumbArt slug={game} accent={accent} className="rbk-book__thumb" />
                    {yours ? <span className="rbk-book__you">You hold {yours}</span> : null}
                  </span>
                  <span className="rbk-book__name">{nameOf(game)}</span>
                  <span className="rbk-book__meta">
                    {records.length} {records.length === 1 ? 'record' : 'records'} · {bookHolders(records)}
                  </span>
                  {cover ? (
                    <span className="rbk-book__cover">
                      <span className="rbk-book__label">{cover.label}</span>
                      <span className="rbk-book__value">
                        <b>{recordValue(cover, cover.top!.score)}</b>
                        <span>{normalizePlayerName(cover.top!.name)}</span>
                      </span>
                    </span>
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rbk-pair" aria-label="Latest records and the house book">
        <div className="sb-card rbk-card">
          <h2 className="rbk-card__big">Latest in ink</h2>
          <p className="rbk-card__sub">The newest names in the books.</p>
          <ul className="rbk-latest">
            {latest.map((entry) => (
              <li key={`${entry.name}-${entry.game}-${entry.at}`}>
                <a className="rbk-latest__row" href={recordsHref(entry.game)}>
                  <span className="rbk-latest__day">{dayOf(entry.at)}</span>
                  <PlayerMark name={entry.name} avatarId={avatars.get(entry.name)} className="rbk-latest__mark" />
                  <span className="rbk-latest__text">
                    <span>
                      <b className={me && entry.name === me ? 'rbk-you' : undefined}>{entry.name}</b> ·{' '}
                      {nameOf(entry.game)}
                    </span>
                    <span className="rbk-latest__what">{entry.text}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="sb-card rbk-card">
          <div className="rbk-card__row">
            <h2 className="rbk-card__big">The house book</h2>
            <a className="sb-link" href={siteRecordsHref()}>
              All of it <ChevronIcon />
            </a>
          </div>
          <p className="rbk-card__sub">
            Not one game: the whole arcade. Turning up, ranging wide, keeping a streak alive.
          </p>
          {data.site ? (
            <ul className="rbk-house">
              {data.site.boards.map((board) => {
                const top = board.entries[0]
                const stand = data.site?.you?.[board.id]
                return (
                  <li key={board.id} className="rbk-house__tile">
                    <span className="rbk-house__label">{board.label}</span>
                    <span className="rbk-house__value">
                      <b>{top ? top.value.toLocaleString() : '–'}</b>
                      {top ? <span>{siteRecordUnitWord(top.value, board.unit)}</span> : null}
                    </span>
                    <span className="rbk-house__who">
                      {top ? (
                        <>
                          <PlayerMark
                            name={top.name}
                            avatarId={avatars.get(normalizePlayerName(top.name))}
                            className="rbk-house__mark"
                          />
                          {top.name}
                        </>
                      ) : (
                        'Nobody yet'
                      )}
                    </span>
                    {stand?.rank ? (
                      <span className="rbk-house__you">
                        You #{stand.rank} with {stand.value.toLocaleString()}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rbk-card__sub">Reading the house book…</p>
          )}
        </div>
      </section>
    </div>
  )
}
