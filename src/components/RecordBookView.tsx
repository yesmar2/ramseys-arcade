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
  closestToInk,
  coverRecord,
  recordGap,
  recordGroups,
  recordValue,
  type RecordGroup,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { ShareBoardButton } from './ShareBoardButton'

/*
 * One game's record book: its banner, with the game playing on the screen and
 * its best record over it; what you hold here and what you're nearest to
 * taking; then its records in three groups, each with its holder, when it was
 * set, what it leads the runner-up by, and where you stand.
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

function RecordRow({
  game,
  group,
  record,
  period,
  you,
}: {
  game: string
  group: RecordGroup
  record: RecordSummary
  period: LeaderboardPeriod
  you: string
}) {
  const top = record.top
  const holder = top ? normalizePlayerName(top.name) : ''
  const mine = Boolean(you) && holder === you
  const second = record.second
  // A tie leaves the record with whoever set it first.
  const runner = !top
    ? 'Be the first to set it'
    : second
      ? second.score === top.score
        ? `Tied with ${normalizePlayerName(second.name)}`
        : `by ${recordGap(record, second.score, top.score)} over ${normalizePlayerName(second.name)}`
      : record.second === null
        ? 'Nobody else yet'
        : ''
  const standing = record.you
  const youLine = !top || !standing
    ? ''
    : standing.rank === 1
      ? 'Yours'
      : standing.score === top.score
        ? `You #${standing.rank} · tied`
        : `You #${standing.rank} · ${recordGap(record, standing.score, top.score)} off`
  return (
    <li className={`rbk-rec${mine ? ' rbk-rec--you' : ''}${top ? '' : ' rbk-rec--empty'}`}>
      <a className="rbk-rec__link" href={recordHref(game, record.id, period)}>
        <span className="rbk-rec__what">
          <span className="rbk-rec__label">{group.short(record.label)}</span>
          <span className="rbk-rec__set">{top ? `set ${dayOf(top.at)}` : 'no holder yet'}</span>
        </span>
        <span className="rbk-rec__value">{top ? recordValue(record, top.score) : '–'}</span>
        <span className="rbk-rec__holder">
          {top ? (
            <PlayerMark name={holder} avatarId={top.avatarId} className="rbk-rec__mark" />
          ) : (
            <span className="rbk-rec__mark rbk-rec__mark--open" aria-hidden="true" />
          )}
          <span className="rbk-rec__name">{top ? holder : 'Nobody yet'}</span>
        </span>
        <span className="rbk-rec__runner">{runner}</span>
        <span className={`rbk-rec__you${standing?.rank === 1 ? ' rbk-rec__you--on' : ''}`}>{youLine}</span>
      </a>
    </li>
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
  const records = data.records
  const head = bookHeadline(game, records)
  const cover = coverRecord(records)
  const groups = recordGroups(game, records)
  const held = records.filter((r) => you && r.top && normalizePlayerName(r.top.name) === you)
  const knowsYou = records.some((r) => r.you !== undefined)
  const close = knowsYou ? closestToInk([{ game, records }]) : []
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  const when = period === 'all' ? 'all time' : PERIOD_LABELS[period].toLowerCase()

  return (
    <div className="sb gb rbk" style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties}>
      <section className="home-banner gb-banner" style={style} aria-labelledby="rbk-book-title">
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

      {you && !data.loading && (held.length || close.length) ? (
        <section className="sb-you" aria-label="You in this book">
          <div className="sb-card rbk-card">
            <div className="rbk-card__head">
              <PlayerMark name={you} className="rbk-card__mark" />
              <h2 className="sb-card__title">
                {held.length ? `You hold ${held.length} here` : 'None in your name here yet'}
              </h2>
            </div>
            {held.length ? (
              <ul className="rbk-list">
                {held.map((record) => (
                  <li key={record.id}>
                    <a className="rbk-item rbk-item--plain" href={recordHref(game, record.id, period)}>
                      <span className="rbk-item__text">
                        <span className="rbk-item__label">{record.label}</span>
                        <span className="rbk-item__sub">set {dayOf(record.top!.at)}</span>
                      </span>
                      <span className="rbk-item__figure">{recordValue(record, record.top!.score)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rbk-card__note">You’re on {close.length === 1 ? 'one' : 'some'} of them, though.</p>
            )}
          </div>
          {close.length ? (
            <div className="sb-card rbk-card">
              <h2 className="sb-card__title">Closest to ink</h2>
              <p className="rbk-card__sub">The records here you are nearest to taking.</p>
              <ul className="rbk-list">
                {close.map(({ record, off }) => (
                  <li key={record.id}>
                    <a className="rbk-item rbk-item--plain" href={recordHref(game, record.id, period)}>
                      <span className="rbk-item__text">
                        <span className="rbk-item__label">{record.label}</span>
                        <span className="rbk-item__sub">
                          You’re #{record.you!.rank} with {recordValue(record, record.you!.score)}
                        </span>
                      </span>
                      <span className="rbk-item__figure rbk-item__figure--quiet">{off}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
        groups.map((group) => (
          <section key={group.kind} className="sb-card rbk-group" aria-labelledby={`rbk-${group.kind}`}>
            <div className="rbk-group__head">
              <h2 id={`rbk-${group.kind}`} className="rbk-group__title">
                {group.title}
              </h2>
              <span className="rbk-group__count">
                {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <p className="rbk-group__sub">{group.sub}</p>
            <div className="rbk-group__cols" aria-hidden="true">
              <span>Record</span>
              <span>Best</span>
              <span>Held by</span>
              <span>Runner-up</span>
              <span className="rbk-group__you">{you ? 'You' : ''}</span>
            </div>
            <ol className="rbk-recs">
              {group.records.map((record) => (
                <RecordRow key={record.id} game={game} group={group} record={record} period={period} you={you} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
