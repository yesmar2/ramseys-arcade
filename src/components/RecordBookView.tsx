import type { CSSProperties } from 'react'
import { deviceRequirementLabel, gamePlayableOn, getGame } from '../data/games'
import { useRecordBook } from '../hooks/useRecordBooks'
import { gameBoardHref, gamePlayHref, recordHref, recordsHref, recordsIndexHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import {
  LEADERBOARD_GAMES,
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  bookHeadline,
  bookLede,
  bookRecords,
  closestToInk,
  coverRecord,
  lowerIsBetter,
  recordGroups,
  recordValue,
  type RecordGroup,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { RecordPlaque, shareOf, type PlaqueYou } from './RecordPlaque'
import { ShareBoardButton } from './ShareBoardButton'
import { openSiteMenu } from './siteNav'

/*
 * One game's record book: its banner, with the game playing on the screen and
 * its best record over it; a line on what's up for grabs and what you're
 * nearest to; then the records nobody holds yet, and the rest in their groups,
 * each a brass plaque with its holder, when it was set, how close you are, and
 * the way to go and beat it (RecordPlaque.tsx; Ramsey picked "C with A's
 * plaques" from the "Record books, redesigned" canvas, 2026-10-11).
 */

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

function dayOf(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function BackIcon() {
  return (
    <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="sb-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </svg>
  )
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
  // A daily's page takes its book's place (RecordsPage), but should one get here its courses stay out.
  const records = bookRecords(game, data.records)
  const head = bookHeadline(game, records)
  const cover = coverRecord(records)
  const groups = recordGroups(game, records)
  // Nobody's name on these yet: they lead the book, and come out of their groups.
  const open = groups.flatMap((group) => group.records.filter((r) => !r.top).map((record) => ({ group, record })))
  const heldGroups = groups.map((group) => ({ ...group, records: group.records.filter((r) => r.top) })).filter((g) => g.records.length)
  const playHref = canPlay ? gamePlayHref(game) : null
  const held = records.filter((r) => you && r.top && normalizePlayerName(r.top.name) === you)
  const knowsYou = records.some((r) => r.you !== undefined)
  const close = knowsYou ? closestToInk([{ game, records }]) : []
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  const when = period === 'all' ? 'all time' : PERIOD_LABELS[period].toLowerCase()

  return (
    <div className="sb gb rbk" style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties}>
      <section className="home-banner gb-banner" style={style} aria-labelledby="rbk-book-title" data-hunt={`r-head-${game}`}>
        <div className="home-banner__text gb-banner__text">
          <nav className="gb-crumb" aria-label="Breadcrumb">
            <a href={recordsIndexHref()}>
              <BackIcon />
              Record books
            </a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{meta.name}</span>
          </nav>
          <p className="home-banner__kicker">
            <BookIcon />
            Record book · {when}
          </p>
          <h1 id="rbk-book-title" className="gb-title">
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '12ch' } as CSSProperties} />
            ) : (
              <>
                {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
                {head.rest}
              </>
            )}
          </h1>
          <p className="home-banner__blurb gb-lede">
            {data.loading ? (
              <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />
            ) : (
              bookLede(game, records)
            )}
          </p>
          <PeriodTabs game={game} period={period} />
          <div className="home-banner__acts">
            {canPlay ? (
              <a className="home-banner__cta" href={gamePlayHref(game)}>
                Play {meta.name}
              </a>
            ) : (
              <p className="gb-device" role="note">
                {deviceRequirementLabel(meta)}
              </p>
            )}
            {isBoardGame(game) ? (
              <a className="home-banner__ghost" href={gameBoardHref(game, period)}>
                Top scores
              </a>
            ) : null}
            <ShareBoardButton
              className="home-banner__ghost"
              text="Share"
              label={`${meta.name} record book on ${APP_NAME}. Somebody's name is in ink.`}
              url={recordsHref(game, period)}
            />
          </div>
        </div>
        <a className="home-banner__art gb-banner__art" href={gamePlayHref(game)} tabIndex={-1} aria-hidden="true">
          <GameThumbArt slug={game} accent={accent} />
          {hasGamePreview(game) ? (
            <>
              <GamePreview slug={game} className="home-banner__screen" autoplay />
              <span className="home-banner__fade" />
              <span className="home-banner__start">Press start</span>
            </>
          ) : null}
          {cover?.top ? (
            <span className="gb-marquee rbk-marquee">
              <span>{cover.label}</span>
              <b>{recordValue(cover, cover.top.score)}</b>
              <span>{normalizePlayerName(cover.top.name)}</span>
            </span>
          ) : null}
        </a>
      </section>

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
