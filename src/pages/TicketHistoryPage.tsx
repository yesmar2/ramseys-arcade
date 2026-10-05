import { useEffect, useMemo, useRef, useState } from 'react'
import { GameArt } from '../components/GameArt'
import { PageShell } from '../components/PageShell'
import { PrizeArt } from '../components/prizes/PrizeArt'
import { TicketGlyph } from '../components/prizes/Ticket'
import { openSiteMenu } from '../components/siteNav'
import { games, isListedGame } from '../data/games'
import { prizeById } from '../data/prizes'
import { useAuth } from '../hooks/useAuth'
import { prizesHref } from '../hooks/useHashRoute'
import { useMyAvatarId } from '../hooks/useMyAvatarId'
import { usePlayerName } from '../hooks/usePlayerName'
import { resolveAvatar, type Avatar } from '../lib/avatars'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  boardDayKey,
  dayHeading,
  dayTotals,
  fetchTicketHistory,
  historyRows,
  joinDays,
  lineTime,
  type HistoryDay,
  type HistoryKind,
  type HistoryRow,
  type LineIcon,
} from '../lib/ticketHistory'
import { useTickets } from '../lib/tickets'
import '../styles/ticketHistory.css'

/**
 * Your tickets (/prizes/tickets): every ticket in and out, newest first, a
 * day at a time, as Ramsey picked from three mocks (2026-10-05, "B"). A day
 * has its totals and, today, the runs' 200 a day; a run that paid for more
 * than one thing is one line with a part for each. The two latest days are
 * open and older ones fold to a line, a week of them at a time.
 */

const KINDS: { id: HistoryKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'runs', label: 'Runs' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'trades', label: 'Trades' },
]

const GAME_CHOICES = games.filter((g) => isListedGame(g)).sort((a, b) => a.name.localeCompare(b.name))

/** How many of a page's days start open: today and yesterday, as a rule. */
const OPEN_DAYS = 2

const ICON_PATHS: Record<Exclude<LineIcon, 'ticket' | 'prize'>, string> = {
  bug: 'M12 7.5a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4zM12 7.5V5.5M9.2 4l1.6 2M14.8 4l-1.6 2M8 12H4.5M19.5 12H16M8 16H5.5M18.5 16H16',
  calendar: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM16 3v4M8 3v4M4 10h16',
  season: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
}

type Load = { days: HistoryDay[]; next: number | null; status: 'loading' | 'ready' | 'error'; more: 'idle' | 'loading' | 'error' }

const LOADING: Load = { days: [], next: null, status: 'loading', more: 'idle' }

function n(value: number): string {
  return value.toLocaleString()
}

/** "+12", "−1,500": a line's tickets, in or out. */
function signed(value: number): string {
  return value < 0 ? `−${n(-value)}` : `+${n(value)}`
}

export function TicketHistoryPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const tickets = useTickets()
  const name = normalizePlayerName(usePlayerName())
  const avatarId = useMyAvatarId(name)
  const avatar = useMemo(() => resolveAvatar(avatarId, name || 'YOU'), [avatarId, name])
  const tag = name || 'YOU'
  const [kind, setKind] = useState<HistoryKind>('all')
  const [game, setGame] = useState<string | null>(null)
  const [load, setLoad] = useState<Load>(LOADING)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const [attempt, setAttempt] = useState(0)
  // A page asked for under other filters, or before a retry, is dropped when it comes.
  const asked = useRef(0)

  useEffect(() => {
    if (!signedIn) return
    const ask = ++asked.current
    setLoad(LOADING)
    fetchTicketHistory({ kind, game })
      .then((page) => {
        if (ask !== asked.current) return
        setLoad({ days: page.days, next: page.next, status: 'ready', more: 'idle' })
        setOpen(new Set(page.days.slice(0, OPEN_DAYS).map((d) => d.day)))
      })
      .catch(() => {
        if (ask === asked.current) setLoad({ ...LOADING, status: 'error' })
      })
  }, [signedIn, kind, game, attempt])

  const showOlder = () => {
    if (!load.next || load.more === 'loading') return
    const ask = asked.current
    setLoad((s) => ({ ...s, more: 'loading' }))
    fetchTicketHistory({ before: load.next, kind, game })
      .then((page) => {
        if (ask !== asked.current) return
        setLoad((s) => ({ ...s, days: joinDays(s.days, page.days), next: page.next, more: 'idle' }))
      })
      .catch(() => {
        if (ask === asked.current) setLoad((s) => ({ ...s, more: 'error' }))
      })
  }

  const today = boardDayKey()
  const filtered = kind !== 'all' || game !== null
  const traded = Math.max(0, tickets.earned - tickets.balance)

  return (
    <PageShell innerClassName="lb-page__inner tixh-page">
      <nav className="tixh-crumbs" aria-label="Breadcrumb">
        <a href={prizesHref()}>Prize counter</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Your tickets</span>
      </nav>

      <section className="tixh-head" aria-labelledby="tixh-title">
        <div className="tixh-head__text">
          <h1 className="tixh-title" id="tixh-title">
            Your tickets
          </h1>
          <p className="tixh-lede">Every ticket in and out, newest first. A run that paid for more than one thing shows each part.</p>
        </div>
        {signedIn ? (
          <dl className="tixh-stats">
            <div className="tixh-stat tixh-stat--balance">
              <dt>Balance</dt>
              <dd>
                <TicketGlyph size={26} />
                {tickets.loaded ? n(tickets.balance) : '…'}
              </dd>
            </div>
            <div className="tixh-stat">
              <dt>Earned</dt>
              <dd>{tickets.loaded ? n(tickets.earned) : '…'}</dd>
            </div>
            <div className="tixh-stat">
              <dt>Traded</dt>
              <dd>{tickets.loaded ? n(traded) : '…'}</dd>
            </div>
            <div className="tixh-stat tixh-stat--today">
              <dt>Today</dt>
              <dd>{tickets.loaded ? `+${n(tickets.today.earned)}` : '…'}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      {!signedIn && !authLoading ? (
        <section className="tixh-signin" aria-label="Sign in">
          <p>Tickets are kept on your account, with your scores, so sign in to see yours. Playing is free.</p>
          <button type="button" className="tixh-signin__btn" onClick={openSiteMenu}>
            Sign in to see your tickets
          </button>
        </section>
      ) : (
        <>
          <div className="tixh-tools">
            <div className="tixh-chips" role="group" aria-label="Show">
              {KINDS.map((k) => (
                <button key={k.id} type="button" className="tixh-chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            <label className="tixh-game">
              <span>Game</span>
              <select value={game ?? ''} onChange={(e) => setGame(e.target.value || null)}>
                <option value="">All games</option>
                {GAME_CHOICES.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {load.status === 'loading' || !signedIn ? (
            <HistorySkeleton />
          ) : load.status === 'error' ? (
            <section className="tixh-note" role="alert">
              <p>Your tickets didn’t load.</p>
              <button type="button" className="tixh-btn" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
            </section>
          ) : load.days.length === 0 ? (
            <section className="tixh-note">
              {filtered ? (
                <>
                  <p>Nothing here for what you picked.</p>
                  <button
                    type="button"
                    className="tixh-btn"
                    onClick={() => {
                      setKind('all')
                      setGame(null)
                    }}
                  >
                    Show everything
                  </button>
                </>
              ) : (
                <p>No tickets yet. Every saved run pays some, so play a game and they’ll show up here.</p>
              )}
            </section>
          ) : (
            <>
              {load.days.map((day) =>
                open.has(day.day) ? (
                  <DayCard
                    key={day.day}
                    day={day}
                    today={today}
                    cap={day.day === today && tickets.loaded ? tickets.today : null}
                    avatar={avatar}
                    tag={tag}
                  />
                ) : (
                  <DayFold key={day.day} day={day} today={today} onOpen={() => setOpen((s) => new Set(s).add(day.day))} />
                ),
              )}
              {load.next ? (
                <div className="tixh-more">
                  <button type="button" className="tixh-btn" onClick={showOlder} disabled={load.more === 'loading'}>
                    {load.more === 'loading' ? 'Loading…' : 'Show older days'}
                  </button>
                  {load.more === 'error' ? <p role="alert">Those days didn’t load. Try again.</p> : null}
                </div>
              ) : (
                <p className="tixh-end">{filtered ? 'That’s all of them.' : 'That’s every ticket since your first.'}</p>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  )
}

/** What a day came to, in its head or on its fold: "+83", or "+63 earned · −1,500 traded". */
function DaySums({ day }: { day: HistoryDay }) {
  const { earned, traded } = dayTotals(day.lines)
  return (
    <>
      {earned > 0 ? (
        <span className="tixh-sum">
          <b className="tixh-plus">+{n(earned)}</b>
          {traded > 0 ? ' earned' : null}
        </span>
      ) : null}
      {traded > 0 ? (
        <span className="tixh-sum">
          <b className="tixh-minus">−{n(traded)}</b> traded
        </span>
      ) : null}
    </>
  )
}

function DayCard({
  day,
  today,
  cap,
  avatar,
  tag,
}: {
  day: HistoryDay
  today: number
  cap: { runs: number; cap: number } | null
  avatar: Avatar
  tag: string
}) {
  const rows = useMemo(() => historyRows(day.lines), [day.lines])
  const heading = dayHeading(day.day, today)
  const id = `tixh-day-${day.day}`
  return (
    <section className="tixh-day" aria-labelledby={id}>
      <header className="tixh-day__head">
        <h2 className="tixh-day__name" id={id}>
          {heading.name}
          {heading.date ? <span> · {heading.date}</span> : null}
        </h2>
        <div className="tixh-day__sums">
          {day.day === today ? (
            // Today's runs against the day's cap: its room is kept while your tickets come, so nothing moves.
            <span className={`tixh-cap${cap ? '' : ' tixh-cap--waiting'}`} aria-hidden={cap ? undefined : true}>
              Runs {cap ? n(Math.min(cap.runs, cap.cap)) : '0'} of {n(cap?.cap ?? 200)}
              <span className="tixh-cap__bar" aria-hidden="true">
                <i style={{ width: cap ? `${Math.min(100, (100 * cap.runs) / Math.max(1, cap.cap))}%` : '0%' }} />
              </span>
            </span>
          ) : null}
          <DaySums day={day} />
        </div>
      </header>
      <ul className="tixh-rows">
        {rows.map((row) => (
          <Row key={row.key} row={row} avatar={avatar} tag={tag} />
        ))}
      </ul>
    </section>
  )
}

function DayFold({ day, today, onOpen }: { day: HistoryDay; today: number; onOpen: () => void }) {
  const count = useMemo(() => historyRows(day.lines).length, [day.lines])
  const heading = dayHeading(day.day, today)
  return (
    <button type="button" className="tixh-fold" aria-expanded="false" onClick={onOpen}>
      <span className="tixh-fold__text">
        <span className="tixh-fold__name">
          {heading.name}
          {heading.date ? ` · ${heading.date}` : ''}
          <span>
            {' '}
            · {count} {count === 1 ? 'line' : 'lines'}
          </span>
        </span>
        <span className="tixh-day__sums">
          <DaySums day={day} />
        </span>
      </span>
      <svg className="tixh-fold__chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

function Row({ row, avatar, tag }: { row: HistoryRow; avatar: Avatar; tag: string }) {
  const time = lineTime(row.at)
  return (
    <li className="tixh-row">
      <RowIcon row={row} avatar={avatar} tag={tag} />
      <div className="tixh-row__main">
        <span className="tixh-row__title">
          {row.title}
          {row.sub ? <span className="tixh-row__sub"> · {row.sub}</span> : null}
        </span>
        {row.parts.length ? (
          <span className="tixh-row__parts">
            <span className="tixh-row__time">{time}</span>
            {row.parts.map((part, i) => (
              <span key={i} className="tixh-part">
                <b>{signed(part.amount)}</b> {part.words}
              </span>
            ))}
          </span>
        ) : (
          <span className="tixh-row__words">
            <span className="tixh-row__time">{time}</span> · {row.words}
          </span>
        )}
      </div>
      <span className={`tixh-amt${row.total < 0 ? ' tixh-amt--spent' : ''}`}>
        {signed(row.total)}
        <span className="visually-hidden"> tickets</span>
      </span>
    </li>
  )
}

function RowIcon({ row, avatar, tag }: { row: HistoryRow; avatar: Avatar; tag: string }) {
  if (row.icon === 'prize') {
    const prize = prizeById(row.prize)
    return (
      <span className="tixh-icon tixh-icon--prize" aria-hidden="true">
        {prize ? <PrizeArt prize={prize} avatar={avatar} name={tag} width={40} /> : <TicketGlyph size={24} />}
      </span>
    )
  }
  if (row.icon === 'ticket' || (!row.icon && !row.game)) {
    return (
      <span className="tixh-icon tixh-icon--ticket" aria-hidden="true">
        <TicketGlyph size={26} />
      </span>
    )
  }
  if (row.icon) {
    return (
      <span className={`tixh-icon tixh-icon--${row.icon}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d={ICON_PATHS[row.icon]} />
        </svg>
      </span>
    )
  }
  return (
    <span className="tixh-icon tixh-icon--game" aria-hidden="true">
      <GameArt slug={row.game!} fallback={<TicketGlyph size={24} />} />
    </span>
  )
}

/** The page's shape while the first days come: a day of grey lines, in the real classes. */
function HistorySkeleton() {
  return (
    <section className="tixh-day tixh-day--ghost" aria-busy="true" aria-label="Loading your tickets">
      <header className="tixh-day__head">
        <span className="tixh-ghost tixh-ghost--head" />
      </header>
      <ul className="tixh-rows">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="tixh-row">
            <span className="tixh-icon tixh-ghost" />
            <div className="tixh-row__main">
              <span className="tixh-ghost tixh-ghost--title" />
              <span className="tixh-ghost tixh-ghost--words" />
            </div>
            <span className="tixh-ghost tixh-ghost--amt" />
          </li>
        ))}
      </ul>
    </section>
  )
}
