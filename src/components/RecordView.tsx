import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { deviceRequirementLabel, gamePlayableOn, getGame } from '../data/games'
import { useRecordPage } from '../hooks/useRecordPage'
import { gamePlayHref, rankHref, recordHref, recordsHref, recordsIndexHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { cachedMyGroups, groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { recordGap, recordShortLabel, recordValue } from '../lib/recordBook'
import {
  nearbyRecords,
  onTheBoard,
  placeStoryLabels,
  recordDay,
  recordField,
  recordHeadline,
  recordLede,
  recordStanding,
  recordStory,
  recordTakes,
  recordWhen,
  type RecordStanding,
  type RecordStory,
  type RecordTake,
  type StorySeg,
} from '../lib/recordPage'
import type { RecordDef, RecordSummary } from '../lib/records'
import { ordinal, type Stat } from '../lib/scoreboard'
import { resolveGameAccent } from '../lib/theme'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { DeviceIcon } from './DeviceIcon'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerMark } from './PlayerMark'
import { ShareBoardButton } from './ShareBoardButton'

/*
 * One record. The banner is its game at the scale of the page, with the
 * record on the marquee, whose name is on it and for how long. Then where you
 * stand and what the next place takes; every time it was broken, charted and
 * listed; everyone's best; and the records beside it in its book.
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

/** Rows before "show more", and how many more each press shows. */
const FIRST_ROWS = 10
const MORE_ROWS = 25

function Svg({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg className="sb-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const BackIcon = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
const BookIcon = () => (
  <Svg size={14}>
    <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19V5" />
  </Svg>
)
const ArrowIcon = () => (
  <Svg size={18}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
)
const StarIcon = () => (
  <Svg size={18}>
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />
  </Svg>
)
const CheckIcon = () => (
  <Svg size={14}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Svg>
)
const ChevronIcon = () => (
  <Svg size={14}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

function Stats({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null
  return (
    <dl className="sb-stats">
      {stats.map((s) => (
        <div key={s.label} className="sb-stat">
          <dt className="visually-hidden">{s.label}</dt>
          <dd>
            <b>{s.value}</b>
            <span aria-hidden="true">{s.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function PlayLink({ game }: { game: string }) {
  const device = useDeviceType()
  const meta = getGame(game)
  if (!meta || !gamePlayableOn(meta, device)) return null
  return (
    <a className="gb-cta" href={gamePlayHref(game)}>
      Play {meta.name}
    </a>
  )
}

/* ---------- the banner ---------- */

function PeriodTabs({ game, recordId, period }: { game: string; recordId: string; period: LeaderboardPeriod }) {
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
          href={recordHref(game, recordId, p)}
        >
          {PERIOD_LABELS[p]}
        </a>
      ))}
    </div>
  )
}

function Banner({
  game,
  recordId,
  period,
  record,
  entries,
  loading,
  group,
}: {
  game: string
  recordId: string
  period: LeaderboardPeriod
  record: RecordDef | null
  entries: LeaderboardEntry[]
  loading: boolean
  group?: string
}) {
  const device = useDeviceType()
  const meta = getGame(game)!
  const accent = resolveGameAccent(game, meta.accent)
  const canPlay = gamePlayableOn(meta, device)
  const top = entries[0] ?? null
  const head = recordHeadline(top, period)
  const label = record?.label ?? ''
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  return (
    <section className="home-banner gb-banner rcd-banner" style={style} aria-labelledby="rcd-title">
      <div className="home-banner__text gb-banner__text">
        <nav className="gb-crumb rcd-crumb" aria-label="Breadcrumb">
          <a href={recordsIndexHref()}>
            <BackIcon />
            Record books
          </a>
          <span aria-hidden="true">/</span>
          <a href={recordsHref(game, period)}>{meta.name}</a>
          {label ? (
            <>
              <span aria-hidden="true" className="rcd-crumb__here">
                /
              </span>
              <span aria-current="page" className="rcd-crumb__here">
                {label}
              </span>
            </>
          ) : null}
        </nav>
        <p className="home-banner__kicker">
          <BookIcon />
          Record · {recordWhen(period)}
          {group ? ` · ${group}` : ''}
        </p>
        {label ? <p className="rcd-label">{label}</p> : null}
        <h1 id="rcd-title" className="gb-title">
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '12ch' } as CSSProperties} />
          ) : (
            <>
              {head.name ? <span className="gb-title__lead">{head.name}</span> : null}
              {head.rest}
            </>
          )}
        </h1>
        <p className="home-banner__blurb gb-lede">
          {loading || !record ? (
            <span className="skel-line" style={{ '--skel-w': '20rem' } as CSSProperties} />
          ) : (
            recordLede(game, record, period, entries)
          )}
        </p>
        <PeriodTabs game={game} recordId={recordId} period={period} />
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
          <a className="home-banner__ghost" href={recordsHref(game, period)}>
            <BookIcon />
            The {meta.name} book
          </a>
          <ShareBoardButton
            className="home-banner__ghost"
            text="Share"
            label={
              top && record
                ? `${record.label} in ${meta.name}: ${top.name}’s ${recordValue(record, top.score)}. Beat it on ${APP_NAME}.`
                : `${label || 'A record'} in ${meta.name} on ${APP_NAME}. Nobody has set it yet.`
            }
            url={recordHref(game, recordId, period)}
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
        {label ? (
          <span className="gb-marquee rbk-marquee">
            <span>{label}</span>
            <b>{top && record ? recordValue(record, top.score) : '–'}</b>
            <span>{top ? top.name : 'Open'}</span>
          </span>
        ) : null}
      </a>
    </section>
  )
}

/* ---------- you ---------- */

function YouCard({
  game,
  period,
  record,
  standing,
  name,
  avatarId,
}: {
  game: string
  period: LeaderboardPeriod
  record: RecordDef
  standing: RecordStanding | null
  name: string
  avatarId?: string
}) {
  if (!standing) {
    return (
      <div className="sb-card sb-you__card sb-first">
        <p className="sb-kicker">Get in the book</p>
        <h2 className="sb-first__title">{onTheBoard(game, record)} and you’re on it.</h2>
        <p className="sb-first__text">
          Sign in to save your runs. Only your best counts, and the best of all is the record: your name beside it
          until someone beats it.
        </p>
        <div className="sb-you__foot sb-you__foot--acts">
          <PlayLink game={game} />
        </div>
      </div>
    )
  }
  const top = (
    <div className="sb-you__top">
      <PlayerMark name={name} avatarId={avatarId} className="sb-you__mark" />
      <span className="sb-you__kicker">
        {name} · {recordWhen(period)}
      </span>
    </div>
  )
  if (standing.mode === 'off') {
    return (
      <div className="sb-card sb-you__card">
        {top}
        <h2 className="gb-you__title">Not on it yet</h2>
        <p className="sb-you__line">{standing.line}</p>
        <p className="gb-callout gb-callout--quiet">
          <ArrowIcon />
          <span>{standing.callout}</span>
        </p>
        {standing.best ? (
          <p className="rcd-note">
            <StarIcon />
            <span>{standing.best}</span>
          </p>
        ) : null}
        <div className="sb-you__foot sb-you__foot--acts">
          <PlayLink game={game} />
        </div>
      </div>
    )
  }
  const held = standing.mode === 'held'
  return (
    <div className={`sb-card sb-you__card${held ? ' rcd-held' : ''}`}>
      {top}
      <p className="sb-you__big">
        {held ? <StarIcon /> : null}
        <b>{standing.big}</b>
        <span>{standing.of}</span>
      </p>
      <p className="sb-you__line">{standing.line}</p>
      <div className="sb-you__foot">
        <Stats stats={standing.stats} />
        <p className="gb-callout">
          <ArrowIcon />
          <span>{standing.callout}</span>
        </p>
        {standing.mode === 'on' && standing.heldBefore ? (
          <p className="rcd-note">
            <StarIcon />
            <span>{standing.heldBefore}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function TakesCard({ takes, sub }: { takes: RecordTake[]; sub: string }) {
  return (
    <div className="sb-card gb-price rcd-takes">
      <h2 className="sb-card__title">What it takes</h2>
      <p className="gb-card__sub">{sub}</p>
      <ul className="gb-price__rows">
        {takes.map((t) => (
          <li key={t.what} className={`gb-price__row${t.done ? ' rcd-take--done' : ''}`}>
            <span className="gb-price__beat">
              <b>{t.what}</b>
              <span>{t.who}</span>
            </span>
            {/* A rung already reached needs no number: its number is the viewer's own place to beat. */}
            <span className="rcd-take__beat">
              {t.done ? (
                <>
                  <span className="rcd-take__check">
                    <CheckIcon />
                  </span>
                  Done
                </>
              ) : (
                t.beat
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClosestCard({ record, entries }: { record: RecordDef; entries: LeaderboardEntry[] }) {
  const [top, ...rest] = entries
  return (
    <div className="sb-card gb-price rcd-takes">
      <h2 className="sb-card__title">Who’s closest</h2>
      <p className="gb-card__sub">The next three, and how far behind you they are.</p>
      <ul className="gb-price__rows">
        {rest.slice(0, 3).map((e) => (
          <li key={e.id} className="gb-price__row">
            <span className="rcd-closest">
              <PlayerMark name={e.name} avatarId={e.avatarId} className="rcd-closest__mark" />
              <span className="gb-price__beat">
                <b>{e.name}</b>
                <span>set {recordDay(e.at)}</span>
              </span>
            </span>
            <span className="rcd-take__beat rcd-take__beat--stack">
              <b>{recordValue(record, e.score)}</b>
              <span>{recordGap(record, e.score, top.score)} behind</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- the story ---------- */

function Seg({ seg, yours = false }: { seg: StorySeg; yours?: boolean }) {
  const style: CSSProperties & { '--seg': string } = {
    left: `${seg.left}%`,
    bottom: `${seg.bottom}%`,
    '--seg': seg.color,
  }
  if (seg.kind === 'run') style.width = `${seg.width}%`
  else style.height = `${seg.height}%`
  return (
    <span
      className={`rcd-seg rcd-seg--${seg.kind}${yours ? ' rcd-seg--yours' : ''}${seg.mine && !yours ? ' rcd-seg--you' : ''}`}
      style={style}
    />
  )
}

/*
 * The chart's sizes, matching records.css: wide, and compact for a narrow card,
 * where the marks shrink and only the standing record's label and yours are
 * drawn (the list below names every step). Insets are top, right, bottom, left.
 */
const CHART_SIZES = {
  wide: { height: 320, inset: [57.6, 112, 44.8, 28], mark: 28, step: 46.4, labelHeight: 42, valueChar: 9, nameChar: 8.6, pad: 12 },
  compact: { height: 248, inset: [48, 67.2, 38.4, 16], mark: 19.2, step: 40, labelHeight: 34, valueChar: 7.8, nameChar: 7.4, pad: 11 },
} as const

/** Below this width the chart goes compact. */
const COMPACT_CHART = 560

/** An element's width, kept current as it resizes; null until it has one. */
function useWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

function StoryCard({ story }: { story: RecordStory }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartWidth = useWidth(chartRef) ?? 1000
  const compact = chartWidth < COMPACT_CHART
  const size = compact ? CHART_SIZES.compact : CHART_SIZES.wide
  const [top, right, bottom, left] = size.inset
  const spots = placeStoryLabels(
    story.dots,
    {
      width: chartWidth - left - right,
      height: size.height - top - bottom,
      headroom: top - 6,
      footroom: 12,
      mark: size.mark,
      gap: 4.8,
      step: size.step,
      labelHeight: size.labelHeight,
      valueChar: size.valueChar,
      nameChar: size.nameChar,
      pad: size.pad,
    },
    compact ? (d) => d.current || d.mine : undefined,
  )
  return (
    <section className="sb-card rcd-story" aria-labelledby="rcd-story-title">
      <div className="rcd-story__head">
        <h2 id="rcd-story-title" className="rcd-story__title">
          {story.title}
        </h2>
        <span className="rcd-story__chip">{story.chip}</span>
      </div>
      <p className="gb-card__sub rcd-story__sub">{story.sub}</p>
      <div ref={chartRef} className={`rcd-chart${compact ? ' rcd-chart--compact' : ''}`} aria-hidden="true">
        <div className="rcd-chart__plot">
          {story.flat ? (
            <span className="rcd-chart__grid" style={{ bottom: '50%' }} />
          ) : (
            <>
              <span className="rcd-chart__grid" style={{ bottom: '88%' }} />
              <span className="rcd-chart__grid" style={{ bottom: '10%' }} />
              <span className="rcd-chart__axis rcd-chart__axis--best" style={{ bottom: '88%' }}>
                {story.best}
              </span>
              <span className="rcd-chart__axis" style={{ bottom: '10%' }}>
                {story.worst}
              </span>
            </>
          )}
          {story.yours.map((s) => (
            <Seg key={s.key} seg={s} yours />
          ))}
          {story.segs.map((s) => (
            <Seg key={s.key} seg={s} />
          ))}
          {story.dots.map((d) => {
            const spot = spots.get(d.key)
            return (
              <Fragment key={d.key}>
                <span
                  className={`rcd-chart__dot${d.current ? ' rcd-chart__dot--now' : ''}`}
                  style={{ left: `${d.left}%`, bottom: `${d.bottom}%` }}
                >
                  <PlayerMark name={d.name} avatarId={d.avatarId} className="rcd-chart__mark" />
                </span>
                {spot ? (
                  <span
                    className={`rcd-chart__label${spot.below ? ' rcd-chart__label--below' : ''}${d.mine ? ' rcd-chart__label--you' : ''}${
                      d.left < 10 ? ' rcd-chart__label--start' : d.left > 90 ? ' rcd-chart__label--end' : ''
                    }`}
                    style={{ left: `${d.left}%`, bottom: `${d.bottom}%`, '--tier': spot.tier } as CSSProperties}
                  >
                    <b>{d.value}</b>
                    <span>{d.name}</span>
                  </span>
                ) : null}
              </Fragment>
            )
          })}
          <span className="rcd-chart__when">{recordDay(story.start)}</span>
          <span className="rcd-chart__when rcd-chart__when--end">Today</span>
        </div>
      </div>
      <p className="visually-hidden">The record, each time it was broken, oldest first: {story.summary}.</p>
      <p className="rcd-story__legend">{story.legend}</p>
      <div className="rcd-story__cols" aria-hidden="true">
        <span>Set</span>
        <span>Holder</span>
        <span>Record</span>
        <span>Change</span>
        <span>Held</span>
      </div>
      <ol className="rcd-story__rows">
        {story.rows.map((r) => (
          <li key={r.key} className={`rcd-moment${r.mine ? ' rcd-moment--you' : ''}`}>
            <span className="rcd-moment__day">{recordDay(r.at)}</span>
            <span className="rcd-moment__who">
              <PlayerMark name={r.name} avatarId={r.avatarId} className="rcd-moment__mark" />
              <span className="rcd-moment__name">{r.name}</span>
              {r.current ? <span className="rcd-moment__now">Standing</span> : null}
            </span>
            <span className="rcd-moment__value">{r.value}</span>
            <span className="rcd-moment__change">{r.change}</span>
            <span className="rcd-moment__held">{r.held}</span>
            <span className="rcd-moment__meta" aria-hidden="true">
              {recordDay(r.at)} · held {r.held}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- everyone's best ---------- */

function Board({
  game,
  period,
  record,
  entries,
  total,
  loading,
  you,
}: {
  game: string
  period: LeaderboardPeriod
  record: RecordDef | null
  entries: LeaderboardEntry[]
  total: number
  loading: boolean
  you: string
}) {
  const [shown, setShown] = useState(FIRST_ROWS)
  const left = entries.length - shown
  const top = entries[0]
  return (
    <section className="sb-card gb-board rcd-board" aria-labelledby="rcd-board-title">
      <div className="gb-board__head">
        <h2 id="rcd-board-title" className="gb-board__title">
          Everyone’s best
        </h2>
        {!loading && total ? (
          <span className="gb-board__count">
            {total.toLocaleString()} {total === 1 ? 'player' : 'players'}
          </span>
        ) : null}
      </div>
      <p className="gb-board__note">One row per player, at their best. A tie goes to whoever got there first.</p>
      {loading || !record ? (
        <BoardSkeleton rows={FIRST_ROWS} />
      ) : !top ? (
        <div className="gb-board__empty">
          <p className="gb-board__empty-title">
            {groupBoardEmptyTitle(`Nobody’s on it ${period === 'all' ? 'yet' : recordWhen(period)}.`)}
          </p>
          <p className="gb-board__empty-text">{onTheBoard(game, record)} and the record is yours.</p>
          <PlayLink game={game} />
        </div>
      ) : (
        <>
          <div className="gb-board__cols rcd-board__cols" aria-hidden="true">
            <span>Place</span>
            <span />
            <span>Player</span>
            <span className="gb-board__num">Best</span>
            <span className="gb-board__num">Off the record</span>
            <span className="gb-board__num">Set</span>
          </div>
          <ol className="gb-rows">
            {entries.slice(0, shown).map((e, i) => {
              const mine = Boolean(you) && normalizePlayerName(e.name) === you
              const medal = MEDALS[i]
              const off =
                i === 0
                  ? 'Record'
                  : e.score === top.score
                    ? 'Tied'
                    : `${record.unit === 'ms' ? '+' : '−'}${recordGap(record, e.score, top.score)}`
              return (
                <li key={e.id} className={`gb-row rcd-row${medal ? ` gb-row--${medal}` : ''}${mine ? ' gb-row--you' : ''}`}>
                  <a className="gb-row__link" href={rankHref(e.name, period)}>
                    <span className="gb-row__ord">{ordinal(i + 1).toUpperCase()}</span>
                    <PlayerMark name={e.name} avatarId={e.avatarId} className="gb-row__mark" />
                    <span className="gb-row__who">
                      <span className="gb-row__name">
                        <span>{e.name}</span>
                        {mine ? <span className="sb-row__you">You</span> : null}
                      </span>
                      <span className="gb-row__runs rcd-row__when">set {recordDay(e.at)}</span>
                    </span>
                    <span className="gb-row__best">{recordValue(record, e.score)}</span>
                    <span className={`rcd-row__off${i === 0 ? ' rcd-row__off--record' : ''}`}>{off}</span>
                    <span className="gb-row__set rcd-row__set">
                      <DeviceIcon device={e.device} />
                      {recordDay(e.at)}
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
          {left > 0 ? (
            <button type="button" className="gb-board__more" onClick={() => setShown((n) => n + MORE_ROWS)}>
              Show {Math.min(left, MORE_ROWS).toLocaleString()} more {left === 1 ? 'player' : 'players'}
              {left > MORE_ROWS ? <span> · {left.toLocaleString()} to go</span> : null}
            </button>
          ) : null}
          {total > entries.length ? (
            <p className="gb-board__note">The first {entries.length.toLocaleString()} players are shown.</p>
          ) : null}
        </>
      )}
    </section>
  )
}

/* ---------- beside it ---------- */

function FieldCard({ record, entries, you }: { record: RecordDef; entries: LeaderboardEntry[]; you: string }) {
  const field = recordField(record, entries, you)
  return (
    <div className="sb-card gb-field">
      <h2 className="sb-card__title">Where everyone’s best lands</h2>
      <p className="gb-card__sub">{field.sub}</p>
      <div className="gb-field__plot" aria-hidden="true">
        <span className="gb-field__axis" />
        {field.dots.map((d) => (
          <span
            key={d.key}
            className={`gb-field__dot${d.mine ? ' gb-field__dot--you' : d.top ? ' rcd-field__dot--record' : ''}`}
            style={{ left: `${d.left}%`, top: `${0.5 + d.row * 0.45}rem` }}
          />
        ))}
      </div>
      <div className="gb-field__ends" aria-hidden="true">
        <span>{field.low}</span>
        <span className="rcd-field__record">{field.high}</span>
      </div>
    </div>
  )
}

function NearbyCard({
  game,
  recordId,
  period,
  record,
  book,
  you,
}: {
  game: string
  recordId: string
  period: LeaderboardPeriod
  record: RecordDef
  book: RecordSummary[]
  you: string
}) {
  const near = nearbyRecords(record, book)
  if (near.length < 2) return null
  const name = getGame(game)?.name ?? game
  return (
    <div className="sb-card gb-more rcd-near">
      <h2 className="sb-card__title">More in the {name} book</h2>
      <ul className="rcd-near__rows">
        {near.map((r) => {
          const here = r.id === recordId
          const mine = Boolean(you && r.top) && normalizePlayerName(r.top!.name) === you
          const sub = here
            ? 'You are here'
            : r.you
              ? r.you.rank === 1
                ? 'Yours'
                : `You #${r.you.rank.toLocaleString()}`
              : r.top
                ? `set ${recordDay(r.top.at)}`
                : 'Nobody yet'
          return (
            <li key={r.id}>
              <a
                className={`rcd-near__link${here ? ' rcd-near__link--here' : ''}`}
                href={recordHref(game, r.id, period)}
                aria-current={here ? 'page' : undefined}
              >
                <span className="rcd-near__text">
                  <span className="rcd-near__label">{recordShortLabel(game, r)}</span>
                  <span className={`rcd-near__sub${mine || (r.you && !here) ? ' rcd-near__sub--you' : ''}`}>{sub}</span>
                </span>
                <span className="rcd-near__figure">
                  <b>{r.top ? recordValue(r, r.top.score) : '–'}</b>
                  <span>{r.top ? r.top.name : 'Open'}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <a className="sb-link rcd-near__all" href={recordsHref(game, period)}>
        All {book.length} in the {name} book
        <ChevronIcon />
      </a>
    </div>
  )
}

/* ---------- the page ---------- */

export function RecordView({ game, recordId, period }: { game: string; recordId: string; period: LeaderboardPeriod }) {
  const you = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const data = useRecordPage(game, recordId, period, you, groupId)
  const meta = getGame(game)
  if (!meta) return null
  const accent = resolveGameAccent(game, meta.accent)
  const style = { '--gb-accent': accent, '--gb-accent-ink': inkOn(accent) } as CSSProperties
  const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const { record, entries, total } = data

  if (data.error) {
    return (
      <div className="sb gb rcd" style={style}>
        <BoardEmpty
          title={data.missing ? 'That record isn’t in the book' : 'Couldn’t load this record'}
          detail={data.missing ? `The ${meta.name} book has every record the game keeps.` : 'Check your connection and try again.'}
          action={
            <a className="sb-link" href={recordsHref(game, period)}>
              Open the {meta.name} book <ChevronIcon />
            </a>
          }
        />
      </div>
    )
  }

  const standing =
    record && you
      ? recordStanding(game, record, period, { entries, total, you: data.you, progression: data.progression }, you, data.allTimeYou)
      : null
  const story = record ? recordStory(record, data.progression, data.youProgression, period, you) : null
  const when = period === 'all' ? '' : ` ${recordWhen(period)}`
  const takesSub = total
    ? `${total.toLocaleString()} ${total === 1 ? 'player' : 'players'} on it${when}. Only each player’s best counts.`
    : `Nobody is on it ${period === 'all' ? 'yet' : recordWhen(period)}.`

  return (
    <div className="sb gb rcd" style={style}>
      <Banner
        game={game}
        recordId={recordId}
        period={period}
        record={record}
        entries={entries}
        loading={data.loading}
        group={group}
      />

      {!data.loading && record ? (
        <section className="sb-you gb-you" aria-label="You and this record">
          <YouCard
            game={game}
            period={period}
            record={record}
            standing={standing}
            name={you}
            avatarId={data.you?.avatarId}
          />
          {standing?.mode === 'held' ? (
            <ClosestCard record={record} entries={entries} />
          ) : (
            <TakesCard takes={recordTakes(game, record, entries, data.you?.rank ?? null)} sub={takesSub} />
          )}
        </section>
      ) : null}

      {story ? <StoryCard story={story} /> : null}

      <div className="gb-main">
        <Board
          key={`${recordId}-${period}`}
          game={game}
          period={period}
          record={record}
          entries={entries}
          total={total}
          loading={data.loading}
          you={you}
        />
        {!data.loading && record ? (
          <aside className="gb-side" aria-label="More about this record">
            {entries.length >= 3 ? <FieldCard record={record} entries={entries} you={you} /> : null}
            <NearbyCard game={game} recordId={recordId} period={period} record={record} book={data.book} you={you} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
