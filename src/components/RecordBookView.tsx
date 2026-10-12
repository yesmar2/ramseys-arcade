import type { ComponentType, CSSProperties } from 'react'
import { gamePlayableOn, getGame } from '../data/games'
import { useRecordBook } from '../hooks/useRecordBooks'
import { gamePlayHref, recordHref, recordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { useHeldHeight } from '../lib/heldShape'
import { useDeviceType } from '../lib/device'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS, VISIBLE_LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  bookHead,
  bookItems,
  bookRecords,
  closestToInk,
  lowerIsBetter,
  openWords,
  recordGap,
  recordGroups,
  recordValue,
  type RecordGroup,
  type RecordKind,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { ordinal } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { ChevronRightIcon, FlameIcon, SparkleIcon, TimerIcon } from './chromeIcons'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'
import { openSiteMenu } from './siteNav'

/*
 * One game's records: its page's Records tab (Ramsey picked B of the "Game page: board and records" canvas,
 * 2026-10-11, in place of a record book page of its own). Since the "Records, more ideas" canvas (Ramsey: "go
 * with what you think is best ... make it look good but easy to read", 2026-10-11) it's A, one list, in the
 * Board tab's rows: who holds the most and how you stand, in a line; then each group's records, a row apiece
 * with the best, who holds it and since when, and your best with how far off it is. Yours are lit gold. A run
 * of a clock's milestones nobody has reached folds into one line ("Wave 9 to 20"). Each row opens its record.
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

/** The best in a single run: a star. */
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
    </svg>
  )
}

/** A record that's yours. */
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18.5h16M5 16l-1.2-9 5 4 3.2-6 3.2 6 5-4-1.2 9z" />
    </svg>
  )
}

const GROUP_ICONS: Record<RecordKind, ComponentType> = {
  course: TimerIcon,
  streaks: FlameIcon,
  run: StarIcon,
  clock: TimerIcon,
}

/** Whoever a record is tied with, if anyone: the best of the others, at the same number on show. */
function tiedWith(record: RecordSummary) {
  const top = record.top!
  const second = record.second
  return second && recordValue(record, second.score) === recordValue(record, top.score) ? second : null
}

/**
 * Who holds a record: their mark and tag, and under it when they set it and whoever it's tied with. The tag
 * gets the line to itself, so it's never the thing cut short. `chip` marks the holder as you, for a list
 * with no You column to say so.
 */
function Holder({ record, you, chip }: { record: RecordSummary; you: string; chip: boolean }) {
  const top = record.top!
  const name = normalizePlayerName(top.name)
  const tied = tiedWith(record)
  const tiedName = tied ? normalizePlayerName(tied.name) : ''
  return (
    <span className="rbl-who">
      {tied ? (
        <span className="rbl-who__marks">
          <PlayerMark name={tiedName} avatarId={tied.avatarId} className="rbl-who__mark rbl-who__mark--back" />
          <PlayerMark name={name} avatarId={top.avatarId} className="rbl-who__mark" />
        </span>
      ) : (
        <PlayerMark name={name} avatarId={top.avatarId} className="rbl-who__mark" />
      )}
      <span className="rbl-who__text">
        <span className="rbl-who__name">
          <span className="rbl-who__tag">
            <PlayerName name={name} avatarId={top.avatarId} />
          </span>
          {chip ? <span className="sb-row__you">You</span> : null}
        </span>
        <span className="rbl-who__sub">
          {dayOf(top.at)}
          {tied ? ` · tied with ${you && tiedName === you ? 'you' : tiedName}` : ''}
        </span>
      </span>
    </span>
  )
}

/** Your best on a record: yours, how near it is, or not on it yet. */
function You({
  record,
  kind,
  mine,
  nearest,
  you,
}: {
  record: RecordSummary
  kind: RecordKind
  mine: boolean
  nearest: boolean
  you: string
}) {
  if (mine) {
    return (
      <span className="rbl-you">
        <span className="rbl-yours">
          <CrownIcon />
          Yours
        </span>
      </span>
    )
  }
  const standing = record.you
  const top = record.top!
  if (!standing) {
    // On no record's board: a milestone you haven't reached, or a record your runs haven't made the list of.
    return (
      <span className="rbl-you">
        <span className="rbl-you__none">{kind === 'clock' ? 'Not reached yet' : 'Not on it yet'}</span>
      </span>
    )
  }
  const tied = recordValue(record, standing.score) === recordValue(record, top.score)
  // The holder's cell already says "tied with you".
  const tieShown = tied && normalizePlayerName(tiedWith(record)?.name ?? '') === you
  const gap = tied
    ? tieShown
      ? ''
      : 'Tied for it'
    : `${recordGap(record, standing.score, top.score)} ${lowerIsBetter(record) ? 'off' : 'short'}`
  const note = [gap, nearest ? 'your nearest' : ''].filter(Boolean).join(' · ')
  return (
    <span className="rbl-you">
      <span className="rbl-you__best">
        <span className="rbl-you__pre">You </span>
        <b>{recordValue(record, standing.score)}</b>
        <span className="rbl-you__place"> · {ordinal(standing.rank)}</span>
      </span>
      {note ? <span className={`rbl-you__gap${nearest ? ' rbl-you__gap--near' : ''}`}>{note}</span> : null}
    </span>
  )
}

function Group({
  game,
  group,
  period,
  you,
  knowsYou,
  nearest,
  firstOpen,
  playHref,
}: {
  game: string
  group: RecordGroup
  period: LeaderboardPeriod
  you: string
  knowsYou: boolean
  nearest: string | null
  /** The first record nobody holds, on the whole tab: its line is #up-for-grabs, where the Records home's "Show me one" lands. */
  firstOpen: string | null
  playHref: string | null
}) {
  const Icon = GROUP_ICONS[group.kind]
  const id = `rbl-${group.kind}`
  return (
    <section className="rbl-group" aria-labelledby={id}>
      <h3 id={id} className="rbl-group__head">
        <span className="rbl-group__icon">
          <Icon />
        </span>
        {group.title}
        {group.aside ? <span className="rbl-group__aside">{group.aside}</span> : null}
      </h3>
      <ol className="rbl-rows">
        {bookItems(group).map((item) => {
          if (item.kind === 'open') {
            const first = item.records[0]!
            return (
              <li key={first.id} id={first.id === firstOpen ? 'up-for-grabs' : undefined} className="rbl-row rbl-row--open">
                <div className="rbl-row__link">
                  <span className="rbl-row__label">{item.label}</span>
                  <span className="rbl-open">
                    <SparkleIcon />
                    <span>{openWords(group.kind, period)}</span>
                    {playHref ? (
                      <a className="rbl-open__go" href={playHref}>
                        Be the first
                        <ChevronRightIcon />
                      </a>
                    ) : null}
                  </span>
                </div>
              </li>
            )
          }
          const { record } = item
          const mine = Boolean(you) && normalizePlayerName(record.top!.name) === you
          return (
            <li key={record.id} className={`rbl-row${mine ? ' rbl-row--mine' : ''}`}>
              <a className="rbl-row__link" href={recordHref(game, record.id, period)}>
                <span className="rbl-row__label">{group.short(record.label)}</span>
                <span className="rbl-row__best">{recordValue(record, record.top!.score)}</span>
                {/* With a You column, a gold row and "Yours" say it's yours: the holder needs no You chip too. */}
                <Holder record={record} you={you} chip={mine && !knowsYou} />
                {knowsYou ? <You record={record} kind={group.kind} mine={mine} nearest={record.id === nearest} you={you} /> : null}
                <span className="rbl-row__go" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/*
 * How the list was laid out, a count of lines per group, by game, period and whether it had a You column:
 * its loading rows take that shape, so the list lands in place rather than pushing the page down (pages load
 * in place). The tab also holds the height it had last time on this device (useHeldHeight). A first look
 * gets the book's usual shape: its groups as they stand, with the milestones nobody has reached on one line.
 */
const shapes = new Map<string, number[]>()
const USUAL_SHAPE: Record<string, number[]> = {
  asteroids: [2, 1, 9],
  snake: [2, 1, 6],
  crosswalk: [2, 3, 5],
  frenzy: [2, 3, 1],
  pileup: [2, 4],
  crumbtrail: [3, 2],
  pop: [3],
  pellets: [3],
  stacker: [3],
  patriot: [3],
  fireflies: [2],
}
const TYPICAL_SHAPE = [2, 2, 4]

function ListSkeleton({ shape, anon }: { shape: number[]; anon: boolean }) {
  return (
    <div className={`sb-card rbl rbl--skel${anon ? ' rbl--anon' : ''}`} aria-busy="true" aria-label="Loading records">
      <div className="rbl-cols" aria-hidden="true">
        <span>Record</span>
        <span>Best</span>
        <span>Held by</span>
        {anon ? null : <span>You</span>}
        <span />
      </div>
      {shape.map((rows, g) => (
        <div key={g} className="rbl-group" aria-hidden="true">
          <div className="rbl-group__head">
            <span className="rbl-group__icon" />
            <span className="skel-line" style={{ '--skel-w': '7rem' } as CSSProperties} />
          </div>
          <ol className="rbl-rows">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className="rbl-row">
                <div className="rbl-row__link">
                  <span className="rbl-row__label">
                    <span className="skel-line" style={{ '--skel-w': '9rem' } as CSSProperties} />
                  </span>
                  <span className="rbl-row__best">
                    <span className="skel-line" style={{ '--skel-w': '4rem' } as CSSProperties} />
                  </span>
                  <span className="rbl-who">
                    <span className="pmark pmark--empty rbl-who__mark" />
                    <span className="skel-line" style={{ '--skel-w': '5rem' } as CSSProperties} />
                  </span>
                  {anon ? null : (
                    <span className="rbl-you">
                      <span className="skel-line" style={{ '--skel-w': '5.5rem' } as CSSProperties} />
                    </span>
                  )}
                  <span />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

export function RecordBookView({ game, period }: { game: string; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const device = useDeviceType()
  const data = useRecordBook(game, period, you, groupId)
  const held = useHeldHeight<HTMLDivElement>(`records-${game}-${period}-${you ? 'in' : 'out'}`, data.loading)
  const meta = getGame(game)
  if (!meta) return null
  const accent = resolveGameAccent(game, meta.accent)
  const canPlay = gamePlayableOn(meta, device)
  // A daily's page has its own Records tab (DailyRecordsTab), but should one get here its courses stay out.
  const records = bookRecords(game, data.records)
  const head = bookHead(game, records, you, period)
  const groups = recordGroups(game, records)
  const playHref = canPlay ? gamePlayHref(game) : null
  // The API says where you stand only when it was asked about you: signed out, there's no You column.
  const knowsYou = Boolean(you) && records.some((r) => r.you !== undefined)
  const nearest = knowsYou ? (closestToInk([{ game, records }], 1)[0]?.record.id ?? null) : null
  const firstOpen = groups.flatMap((g) => g.records).find((r) => !r.top)?.id ?? null
  const shapeKey = `${game}|${period}|${you ? 'you' : 'anon'}`
  if (!data.loading && !data.error && groups.length) shapes.set(shapeKey, groups.map((g) => bookItems(g).length))

  return (
    <div
      ref={held.ref}
      className="sb gb rbk rbk--tab"
      style={{ '--gb-accent': accent, '--gb-accent-ink': inkOn(accent), ...held.style } as CSSProperties}
    >
      {/* Who holds most of them, and the period's tabs: where the book's banner was, a bug hunt hiding place (lib/bugHunt.ts). */}
      <div className="rbk-tabhead" data-hunt={`r-head-${game}`}>
        <div className="rbk-tabhead__text">
          {data.loading ? (
            <>
              <h2 className="rbk-tabhead__title rbk-tabhead__title--skel">
                <span className="skel-line" style={{ '--skel-w': '16ch' } as CSSProperties} />
              </h2>
              <p className="rbk-tabhead__line">
                <span className="skel-line" style={{ '--skel-w': '22ch' } as CSSProperties} />
              </p>
            </>
          ) : data.error ? (
            <h2 className="rbk-tabhead__title">{meta.name} records</h2>
          ) : (
            <>
              <h2 className="rbk-tabhead__title">
                {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
                {head.rest}
              </h2>
              {head.line.length ? (
                <p className="rbk-tabhead__line">{head.line.join(' · ')}</p>
              ) : !you ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Sign in
                  </button>{' '}
                  to see how close you are
                </p>
              ) : null}
            </>
          )}
        </div>
        <PeriodTabs game={game} period={period} />
      </div>

      {data.loading ? (
        <ListSkeleton shape={shapes.get(shapeKey) ?? USUAL_SHAPE[game] ?? TYPICAL_SHAPE} anon={!you} />
      ) : data.error ? (
        <BoardEmpty title="Couldn’t load records" detail="Check your connection and try again." />
      ) : !records.length ? (
        <BoardEmpty title={groupBoardEmptyTitle('No records yet')} />
      ) : (
        <div className={`sb-card rbl${knowsYou ? '' : ' rbl--anon'}`}>
          <div className="rbl-cols" aria-hidden="true">
            <span>Record</span>
            <span>Best</span>
            <span>Held by</span>
            {knowsYou ? <span>You</span> : null}
            <span />
          </div>
          {groups.map((group) => (
            <Group
              key={group.kind}
              game={game}
              group={group}
              period={period}
              you={you}
              knowsYou={knowsYou}
              nearest={nearest}
              firstOpen={firstOpen}
              playHref={playHref}
            />
          ))}
        </div>
      )}
    </div>
  )
}
