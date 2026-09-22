import { useEffect, useState } from 'react'
import { EventArt } from '../components/EventCard'
import { ListRow } from '../components/ListRow'
import { PageBackLink } from '../components/PageBackLink'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref, recordsIndexHref, type Route } from '../hooks/useHashRoute'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  fetchSiteRecords,
  formatDayKey,
  formatSiteRecordValue,
  siteRecordUnitWord,
  type SiteRecordBoard,
  type SiteRecordStanding,
} from '../lib/siteRecords'

/**
 * The book about the arcade itself.
 *
 * Every other record book belongs to a cabinet and asks how well somebody
 * played it. This one asks how they played: how often they turned up, how far
 * they ranged, how long they kept a streak alive. None of it is scored during
 * a run — it is all read back out of the scores already on the boards, which
 * is why a quiet player with a long habit can top it.
 */
/** Stable identity, so the meta effect does not re-run on every render. */
const SITE_RECORDS_ROUTE: Route = { name: 'siteRecords' }

export function SiteRecordsPage() {
  const playerName = usePlayerName()
  const [boards, setBoards] = useState<SiteRecordBoard[] | null>(null)
  const [you, setYou] = useState<SiteRecordStanding | null>(null)
  const [failed, setFailed] = useState(false)

  usePageMeta(SITE_RECORDS_ROUTE)

  useEffect(() => {
    let live = true
    setFailed(false)
    fetchSiteRecords(playerName)
      .then((result) => {
        if (!live) return
        setBoards(result.boards)
        setYou(result.you)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [playerName])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev rb page-stack">
        <PageBackLink href={recordsIndexHref()} label="Record books" />
        <PageBanner
          ariaLabel="Whole-arcade records"
          kicker={
            <>
              <span className="ev-kicker__bit">Hall of fame</span>
              <span className="ev-kicker__bit">The whole arcade</span>
            </>
          }
          title="House records"
          blurb="Not one cabinet — all of them. Who keeps turning up, who plays the widest, and whose streak is still alive. Nobody scores these on purpose."
          art={<EventArt games={['snake', 'asteroids', 'pellets', 'putt']} />}
        />

        {failed && <p className="lb-empty">Couldn’t load the house records.</p>}
        {!failed && boards == null && <p className="lb-empty">Reading the ledgers…</p>}
        {!failed && boards?.length === 0 && (
          <p className="lb-empty">Nothing in the house books yet.</p>
        )}

        {boards?.map((board) => {
          const standing = you?.[board.id]
          const listed = standing?.rank != null
          return (
            <section className="lst-block" key={board.id}>
              <div className="lst-block__head">
                <h2 className="lst-block__title">{board.label}</h2>
                <p className="lst-block__note">{board.blurb}</p>
              </div>

              {board.entries.length === 0 ? (
                <p className="lb-empty">No one yet.</p>
              ) : (
                <ol className="lst">
                  {board.entries.map((entry, index) => (
                    <ListRow
                      key={`${board.id}:${entry.name}`}
                      rank={index + 1}
                      name={entry.name}
                      href={rankHref(entry.name)}
                      mine={entry.name === playerName}
                      sub={formatDayKey(entry.at) ?? undefined}
                      score={entry.value}
                      unit={siteRecordUnitWord(entry.value, board.unit)}
                    />
                  ))}
                </ol>
              )}

              {/*
                Only when they are not already in the list above — repeating a
                row directly under itself reads as a bug.
              */}
              {standing && !listed && standing.value > 0 && (
                <p className="lst-block__note">
                  You: {formatSiteRecordValue(standing.value, board.unit)} — not in the
                  top {board.entries.length} yet.
                </p>
              )}
            </section>
          )
        })}
      </div>
    </PageShell>
  )
}
