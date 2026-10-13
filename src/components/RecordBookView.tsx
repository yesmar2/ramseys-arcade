import type { CSSProperties, ReactNode } from 'react'
import { gamePlayableOn, getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { useRecordBook } from '../hooks/useRecordBooks'
import { gamePlayHref, recordHref, recordsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { useHeldHeight } from '../lib/heldShape'
import { useDeviceType } from '../lib/device'
import { groupBoardEmptyTitle, useActiveGroup, useScope } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS, VISIBLE_LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  bookHead,
  bookItems,
  bookRecords,
  clockAside,
  closestToInk,
  lowerIsBetter,
  openWords,
  recordBrief,
  recordGap,
  recordGroups,
  recordValue,
  type RecordGroup,
} from '../lib/recordBook'
import type { RecordSummary } from '../lib/records'
import { ordinal } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty } from './BoardChrome'
import { ChevronRightIcon, SparkleIcon } from './chromeIcons'
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
 *
 * Since the "Board and records, new looks" canvas (Ramsey: "let's do A and C", 2026-10-13), a player it knows
 * gets C: each record a bar of how close their best is to it, full and gold where it's theirs, their nearest lit
 * in the site's colour, and their place and how far off at the end. Signed out it's the list as it was, with
 * no You column.
 */

function dayOf(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** The records at each period: links, so a nav with the one you're on marked (lib/choiceKeys.ts). */
function PeriodTabs({ game, period }: { game: string; period: LeaderboardPeriod }) {
  return (
    <nav
      className="seg sb-periods gb-periods"
      aria-label="Period"
      style={{ '--seg-count': VISIBLE_LEADERBOARD_PERIODS.length } as CSSProperties}
    >
      {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
        <a
          key={p}
          aria-current={p === period ? 'page' : undefined}
          className={`seg__item${p === period ? ' seg__item--active' : ''}`}
          href={recordsHref(game, p)}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </nav>
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

/** How close a best is to a record, from nothing to all of it: its share of the record, or the record's of it for a time. */
function closeness(record: RecordSummary, yours: number, top: number): number {
  if (yours <= 0 || top <= 0) return 0
  return Math.min(1, lowerIsBetter(record) ? top / yours : yours / top)
}

/**
 * A record as a bar (C): what it is, its best and who holds it; your best along a bar as long as the share of the
 * record it makes; and your place and how far off, or Yours.
 */
function BarRow({
  game,
  group,
  record,
  period,
  you,
  nearest,
}: {
  game: string
  group: RecordGroup
  record: RecordSummary
  period: LeaderboardPeriod
  you: string
  nearest: boolean
}) {
  const top = record.top!
  const name = normalizePlayerName(top.name)
  const mine = Boolean(you) && name === you
  const tied = tiedWith(record)
  const tiedName = tied ? normalizePlayerName(tied.name) : ''
  const standing = record.you
  // Times that print the same are tied, whatever the milliseconds under them.
  const level = standing ? recordValue(record, standing.score) === recordValue(record, top.score) : false
  const share = mine || level ? 1 : standing ? closeness(record, standing.score, top.score) : 0
  let end: ReactNode
  if (mine) {
    end = (
      <span className="rbl-yours">
        <CrownIcon />
        Yours
      </span>
    )
  } else if (!standing) {
    // On no record's board: a milestone you haven't reached, or a record your runs haven't made the list of.
    end = <span className="rbc-end__none">{group.kind === 'clock' ? 'Not reached yet' : 'Not on it yet'}</span>
  } else {
    // The dot keeps to the line it ends, should the words wrap.
    end = level
      ? `${ordinal(standing.rank)}\u00a0· tied`
      : `${ordinal(standing.rank)}\u00a0· ${recordGap(record, standing.score, top.score)} ${lowerIsBetter(record) ? 'off' : 'short'}`
  }
  return (
    <li className={`rbl-row rbc-row${mine ? ' rbl-row--mine' : ''}${nearest ? ' rbc-row--near' : ''}`}>
      <a className="rbl-row__link" href={recordHref(game, record.id, period)}>
        <span className="rbc-what">
          <span className="rbl-row__label">
            {group.short(record.label)}
            {nearest ? <span className="rbc-near">Your nearest</span> : null}
          </span>
          <span className={`rbc-held${tied ? ' rbc-held--tie' : ''}`}>
            <b className="rbc-held__best">{recordValue(record, top.score)}</b>
            <span>by</span>
            <PlayerMark name={name} avatarId={top.avatarId} className="rbc-held__mark" />
            <span className="rbc-held__tag">
              <PlayerName name={name} avatarId={top.avatarId} />
            </span>
            {tied ? (
              <span className="rbc-held__tied">
                <span className="rbc-held__dot">· </span>tied with {you && tiedName === you ? 'you' : tiedName}
              </span>
            ) : null}
          </span>
        </span>
        <span className="rbc-bar">
          <span className="rbc-bar__track" aria-hidden="true">
            {share > 0 ? <span className="rbc-bar__fill" style={{ '--rbc-share': `${(share * 100).toFixed(1)}%` } as CSSProperties} /> : null}
          </span>
          <span className="rbc-bar__you">
            {standing ? (
              <>
                <span className="visually-hidden">You: </span>
                {recordBrief(record, standing.score)}
              </>
            ) : null}
          </span>
        </span>
        <span className="rbc-end">{end}</span>
      </a>
    </li>
  )
}

function Group({
  game,
  group,
  period,
  you,
  bars,
  nearest,
  firstOpen,
  playHref,
}: {
  game: string
  group: RecordGroup
  period: LeaderboardPeriod
  you: string
  /** A player it knows: each record a bar of how close they are (BarRow). */
  bars: boolean
  nearest: string | null
  /** The first record nobody holds, on the whole tab: its line is #up-for-grabs, where the Records home's "Show me one" lands. */
  firstOpen: string | null
  playHref: string | null
}) {
  const id = `rbl-${group.kind}`
  // With a group's boards, an open record is one nobody in the group holds.
  const { nobody } = useScope()
  return (
    <section className="rbl-group" aria-labelledby={id}>
      <h3 id={id} className="rbl-group__head">
        <span className="rbl-group__title">{group.title}</span>
        {group.aside ? <span className="rbl-group__aside">{group.aside}</span> : null}
      </h3>
      <ol className="rbl-rows">
        {bookItems(group).map((item) => {
          if (item.kind === 'open') {
            const first = item.records[0]!
            if (bars) {
              return (
                <li key={first.id} id={first.id === firstOpen ? 'up-for-grabs' : undefined} className="rbl-row rbl-row--open rbc-row">
                  <div className="rbl-row__link">
                    <span className="rbc-what">
                      <span className="rbl-row__label">{item.label}</span>
                      <span className="rbc-held">{openWords(group.kind, period, nobody)}</span>
                    </span>
                    <span className="rbc-bar" aria-hidden="true">
                      <span className="rbc-bar__track" />
                      <span className="rbc-bar__you" />
                    </span>
                    <span className="rbc-end">
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
            return (
              <li key={first.id} id={first.id === firstOpen ? 'up-for-grabs' : undefined} className="rbl-row rbl-row--open">
                <div className="rbl-row__link">
                  <span className="rbl-row__label">{item.label}</span>
                  <span className="rbl-open">
                    <SparkleIcon />
                    <span>{openWords(group.kind, period, nobody)}</span>
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
          if (bars) {
            return <BarRow key={record.id} game={game} group={group} record={record} period={period} you={you} nearest={record.id === nearest} />
          }
          const mine = Boolean(you) && normalizePlayerName(record.top!.name) === you
          return (
            <li key={record.id} className={`rbl-row${mine ? ' rbl-row--mine' : ''}`}>
              <a className="rbl-row__link" href={recordHref(game, record.id, period)}>
                <span className="rbl-row__label">{group.short(record.label)}</span>
                <span className="rbl-row__best">{recordValue(record, record.top!.score)}</span>
                <Holder record={record} you={you} chip={mine} />
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
 * How the list was laid out, a count of lines per group and whether its name had words by it (a line of their own
 * on a phone), by game, period and whether it had bars: its loading rows take that shape, so the list lands in
 * place rather than pushing the page down (pages load in place). The tab also holds the height it had last time
 * on this device (useHeldHeight). A first look gets the book's usual shape: its groups as they stand, with the
 * milestones nobody has reached on one line, and a game's clock records (its last group) with their words.
 */
type Shape = { rows: number[]; asides: boolean[] }
const shapes = new Map<string, Shape>()
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

function usualShape(game: string): Shape {
  const rows = USUAL_SHAPE[game] ?? TYPICAL_SHAPE
  const clock = Boolean(clockAside(game))
  return { rows, asides: rows.map((_, g) => clock && g === rows.length - 1) }
}

function ListSkeleton({ shape, anon }: { shape: Shape; anon: boolean }) {
  const line = (w: string) => <span className="skel-line" style={{ '--skel-w': w } as CSSProperties} />
  return (
    <div className={`sb-card rbl rbl--skel${anon ? ' rbl--anon' : ' rbl--bars'}`} aria-busy="true" aria-label="Loading records">
      {anon ? (
        <div className="rbl-cols" aria-hidden="true">
          <span>Record</span>
          <span>Best</span>
          <span>Held by</span>
          <span />
        </div>
      ) : null}
      {shape.rows.map((rows, g) => (
        <div key={g} className="rbl-group" aria-hidden="true">
          {/* Spaces with no width: each line as tall as its words will be. */}
          <div className="rbl-group__head">
            <span className="rbl-group__title">
              {line('7rem')}
              {'\u200b'}
            </span>
            {shape.asides[g] ? <span className="rbl-group__aside">{line('10rem')}</span> : null}
          </div>
          <ol className="rbl-rows">
            {Array.from({ length: rows }, (_, i) =>
              anon ? (
                <li key={i} className="rbl-row">
                  <div className="rbl-row__link">
                    <span className="rbl-row__label">{line('9rem')}</span>
                    <span className="rbl-row__best">{line('4rem')}</span>
                    <span className="rbl-who">
                      <span className="pmark pmark--empty rbl-who__mark" />
                      {line('5rem')}
                    </span>
                    <span />
                  </div>
                </li>
              ) : (
                <li key={i} className="rbl-row rbc-row">
                  <div className="rbl-row__link">
                    <span className="rbc-what">
                      <span className="rbl-row__label">
                        {line('8rem')}
                        {'\u200b'}
                      </span>
                      <span className="rbc-held">
                        {line('3rem')}
                        <span className="pmark pmark--empty rbc-held__mark" />
                        {line('4rem')}
                      </span>
                    </span>
                    <span className="rbc-bar">
                      <span className="rbc-bar__track" />
                      <span className="rbc-bar__you">{line('3.5rem')}</span>
                    </span>
                    <span className="rbc-end">{line('6rem')}</span>
                  </div>
                </li>
              ),
            )}
          </ol>
        </div>
      ))}
    </div>
  )
}

export function RecordBookView({ game, period }: { game: string; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  // With a group's boards the records are the group's, and the head says whose.
  const scope = useScope()
  const { signedIn, signedOut } = useAuth()
  const device = useDeviceType()
  const data = useRecordBook(game, period, you, groupId)
  const held = useHeldHeight<HTMLDivElement>(`records-${game}-${period}-${you ? 'in' : 'out'}`, data.loading)
  const meta = getGame(game)
  if (!meta) return null
  const accent = resolveGameAccent(game, meta.accent)
  const canPlay = gamePlayableOn(meta, device)
  // A daily's page has its own Records tab (DailyRecordsTab), but should one get here its courses stay out.
  const records = bookRecords(game, data.records)
  const head = bookHead(game, records, you, period, scope.id ? scope.where : undefined)
  const groups = recordGroups(game, records)
  const playHref = canPlay ? gamePlayHref(game) : null
  // The API says where you stand only when it was asked about you: signed out, it's the plain list, no bars.
  const bars = Boolean(you) && records.some((r) => r.you !== undefined)
  const nearest = bars ? (closestToInk([{ game, records }], 1)[0]?.record.id ?? null) : null
  const firstOpen = groups.flatMap((g) => g.records).find((r) => !r.top)?.id ?? null
  const shapeKey = `${game}|${period}|${you ? 'you' : 'anon'}`
  if (!data.loading && !data.error && groups.length) {
    shapes.set(shapeKey, { rows: groups.map((g) => bookItems(g).length), asides: groups.map((g) => Boolean(g.aside)) })
  }

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
              {/* Signed in, the line says how close you are as well: two lines on a phone (records.css). */}
              <p className={`rbk-tabhead__line${you ? ' rbk-tabhead__line--two' : ''}`}>
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
              {head.line.length || bars ? (
                <p className="rbk-tabhead__line">
                  {head.line.join(' · ')}
                  {bars ? `${head.line.length ? '. ' : ''}Each bar is how close you are.` : null}
                </p>
              ) : signedOut ? (
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Sign in
                  </button>{' '}
                  to see how close you are
                </p>
              ) : signedIn && !you ? (
                // Signed in with no tag: the menu is where you pick one. Neither line while the account isn't known yet.
                <p className="rbk-tabhead__line">
                  <button type="button" className="rbk-tabhead__signin" onClick={openSiteMenu}>
                    Pick a gamer tag
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
        <ListSkeleton shape={shapes.get(shapeKey) ?? usualShape(game)} anon={!you} />
      ) : data.error ? (
        <BoardEmpty title="Couldn’t load records" detail="Check your connection and try again." />
      ) : !records.length ? (
        <BoardEmpty title={groupBoardEmptyTitle('No records yet')} />
      ) : (
        <div className={`sb-card rbl${bars ? ' rbl--bars' : ' rbl--anon'}`}>
          {bars ? null : (
            <div className="rbl-cols" aria-hidden="true">
              <span>Record</span>
              <span>Best</span>
              <span>Held by</span>
              <span />
            </div>
          )}
          {groups.map((group) => (
            <Group
              key={group.kind}
              game={game}
              group={group}
              period={period}
              you={you}
              bars={bars}
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
