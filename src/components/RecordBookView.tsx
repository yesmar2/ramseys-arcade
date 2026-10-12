import type { CSSProperties } from 'react'
import { gamePlayableOn, getGame } from '../data/games'
import { useRecordBook } from '../hooks/useRecordBooks'
import { gamePlayHref, recordHref, recordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { useDeviceType } from '../lib/device'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS, VISIBLE_LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  bookHeadline,
  bookRecords,
  closestToInk,
  lowerIsBetter,
  recordGroups,
  recordValue,
  type RecordGroup,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { RecordPlaque, shareOf, type PlaqueYou } from './RecordPlaque'
import { openSiteMenu } from './siteNav'

/*
 * One game's records: its page's Records tab (Ramsey picked B of the "Game page: board and records" canvas,
 * 2026-10-11, in place of a record book page of its own). Who holds most of them, with the period's tabs; a
 * line on what's up for grabs and what you're nearest to; then the records nobody holds yet, and the rest in
 * their groups, each a brass plaque with its holder, when it was set, how close you are, and the way to go and
 * beat it (RecordPlaque.tsx; Ramsey picked "C with A's plaques" from the "Record books, redesigned" canvas,
 * 2026-10-11).
 */

function dayOf(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function PeriodTabs({ game, period }: { game: string; period: LeaderboardPeriod }) {
  return (
    <div
      className="seg sb-periods gb-periods"
      role="tablist"
      aria-label="Period"
      style={{ '--seg-count': VISIBLE_LEADERBOARD_PERIODS.length } as CSSProperties}
    >
      {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
        <a
          key={p}
          role="tab"
          aria-selected={p === period}
          className={`seg__item${p === period ? ' seg__item--active' : ''}`}
          href={recordsHref(game, p)}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </div>
  )
}

/** Where you stand on a record, for its plaque: undefined when there's nobody to ask about, or the API didn't say. */
function plaqueYou(record: RecordSummary, you: string): PlaqueYou | undefined {
  if (!you || record.you === undefined) return undefined
  const top = record.top
  if (top && normalizePlayerName(top.name) === you) return { kind: 'mine' }
  const standing = record.you
  if (!top || !standing) return { kind: 'none' }
  return {
    kind: 'on',
    value: recordValue(record, standing.score),
    share: shareOf(lowerIsBetter(record), standing.score, top.score),
    rank: standing.rank,
  }
}

function Plaque({
  game,
  group,
  record,
  period,
  you,
  big,
  playHref,
}: {
  game: string
  group: RecordGroup
  record: RecordSummary
  period: LeaderboardPeriod
  you: string
  big: boolean
  playHref: string | null
}) {
  const top = record.top
  return (
    <RecordPlaque
      label={group.short(record.label)}
      value={top ? recordValue(record, top.score) : null}
      holder={top ? { name: normalizePlayerName(top.name), avatarId: top.avatarId } : null}
      when={top ? `set ${dayOf(top.at)}` : undefined}
      href={recordHref(game, record.id, period)}
      you={plaqueYou(record, you)}
      big={big}
      action={playHref ? { href: playHref, label: top ? 'Beat it' : 'Set it' } : null}
    />
  )
}

export function RecordBookView({ game, period }: { game: string; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const device = useDeviceType()
  const data = useRecordBook(game, period, you, groupId)
  const meta = getGame(game)
  if (!meta) return null
  const accent = resolveGameAccent(game, meta.accent)
  const canPlay = gamePlayableOn(meta, device)
  // A daily's page has its own Records tab (DailyRecordsTab), but should one get here its courses stay out.
  const records = bookRecords(game, data.records)
  const head = bookHeadline(game, records)
  const groups = recordGroups(game, records)
  // Nobody's name on these yet: they lead the tab, and come out of their groups.
  const open = groups.flatMap((group) => group.records.filter((r) => !r.top).map((record) => ({ group, record })))
  const heldGroups = groups.map((group) => ({ ...group, records: group.records.filter((r) => r.top) })).filter((g) => g.records.length)
  const playHref = canPlay ? gamePlayHref(game) : null
  const held = records.filter((r) => you && r.top && normalizePlayerName(r.top.name) === you)
  const knowsYou = records.some((r) => r.you !== undefined)
  const close = knowsYou ? closestToInk([{ game, records }]) : []

  return (
    <div className="sb gb rbk rbk--tab" style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties}>
      {/* Who holds most of them, and the period's tabs: where the book's banner was, a bug hunt hiding place (lib/bugHunt.ts). */}
      <div className="rbk-tabhead" data-hunt={`r-head-${game}`}>
        <h2 className="rbk-tabhead__title">
          {data.loading ? (
            <span className="skel-line" style={{ '--skel-w': '16ch' } as CSSProperties} />
          ) : (
            <>
              {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
              {head.rest}
            </>
          )}
        </h2>
        <PeriodTabs game={game} period={period} />
      </div>

      {!data.loading && records.length ? (
        <section className="rbk-sum" aria-label="This book at a glance">
          {open.length ? (
            <a className="rbk-sum__tile rbk-sum__tile--open" href="#up-for-grabs">
              <span className="rbk-sum__kicker">Up for grabs</span>
              <span className="rbk-sum__line">
                {open.length === 1 ? 'A record nobody holds yet' : `${open.length} records nobody holds yet`}
              </span>
            </a>
          ) : null}
          {you ? (
            held.length ? (
              <div className="rbk-sum__tile rbk-sum__tile--you">
                <span className="rbk-sum__kicker">Yours</span>
                <span className="rbk-sum__line">
                  You hold {held.length} {held.length === 1 ? 'record' : 'records'} here
                </span>
              </div>
            ) : close.length ? (
              <a className="rbk-sum__tile rbk-sum__tile--you" href={recordHref(game, close[0]!.record.id, period)}>
                <span className="rbk-sum__kicker">Closest for you</span>
                <span className="rbk-sum__line">
                  {close[0]!.record.label}: {close[0]!.off}
                </span>
              </a>
            ) : null
          ) : (
            <button type="button" className="rbk-sum__tile rbk-sum__tile--you" onClick={openSiteMenu}>
              <span className="rbk-sum__kicker">How close are you?</span>
              <span className="rbk-sum__line">Sign in to see your best beside every record</span>
            </button>
          )}
        </section>
      ) : null}

      {data.loading ? (
        <div className="sb-card rbk-group">
          <BoardSkeleton rows={6} />
        </div>
      ) : data.error ? (
        <BoardEmpty title="Couldn’t load records" detail="Check your connection and try again." />
      ) : !records.length ? (
        <BoardEmpty title={groupBoardEmptyTitle('No records yet')} />
      ) : (
        <>
          {open.length ? (
            <section id="up-for-grabs" className="rbk-wall rbk-wall--open" aria-labelledby="rbk-open">
              <div className="rbk-group__head">
                <h2 id="rbk-open" className="rbk-group__title">
                  Up for grabs
                </h2>
                <span className="rbk-group__count">
                  {open.length} {open.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <p className="rbk-group__sub">Nobody holds these yet: the first to do it puts their name in the book.</p>
              <ol className="rbk-plqs">
                {open.map(({ group, record }) => (
                  <Plaque key={record.id} game={game} group={group} record={record} period={period} you={you} big={false} playHref={playHref} />
                ))}
              </ol>
            </section>
          ) : null}
          {heldGroups.map((group) => (
            <section key={group.kind} className="rbk-wall" aria-labelledby={`rbk-${group.kind}`}>
              <div className="rbk-group__head">
                <h2 id={`rbk-${group.kind}`} className="rbk-group__title">
                  {group.title}
                </h2>
                <span className="rbk-group__count">
                  {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <p className="rbk-group__sub">{group.sub}</p>
              <ol className="rbk-plqs">
                {group.records.map((record, i) => (
                  <Plaque
                    key={record.id}
                    game={game}
                    group={group}
                    record={record}
                    period={period}
                    you={you}
                    // The best single run is the book's headline: its plaque is two wide.
                    big={group.kind === 'run' && i === 0}
                    playHref={playHref}
                  />
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
