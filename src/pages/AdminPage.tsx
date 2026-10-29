import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AdminLaunchList } from '../components/AdminLaunchList'
import { AdminOverview } from '../components/AdminOverview'
import { AdminReset } from '../components/AdminReset'
import { AdminPlayers } from '../components/AdminPlayers'
import { AdminSiteEvents } from '../components/AdminSiteEvents'
import { AdminSeasonPreview } from '../components/AdminSeasonPreview'
import { AdminTrophies } from '../components/AdminTrophies'
import { PageShell } from '../components/PageShell'
import { StaffOnlyDoor } from '../components/StaffOnlyDoor'
import { getGame } from '../data/games'
import { AdminInboxContext, useAdminInbox, useAdminInboxLoader, type AdminInbox } from '../hooks/useAdminInbox'
import { useAuth } from '../hooks/useAuth'
import { adminHref, gamePlayHref, type AdminSection } from '../hooks/useHashRoute'
import {
  adminAgo,
  banTag,
  clearClientErrors,
  clearFeedback,
  fetchAdminWhoami,
  fetchBans,
  fetchClientErrors,
  fetchErrorAlerts,
  fetchFeedback,
  fetchFeedbackPush,
  fetchOpenFlags,
  fetchRunCheck,
  FLAG_KINDS,
  grantTickets,
  liftBan,
  removeClientError,
  removeFeedback,
  sendTestAlert,
  setFeedbackPush,
  settleFlag,
  type AdminBan,
  type AdminClientError,
  type AdminFeedback,
  type AdminFlag,
  type ErrorAlerts,
  type PushService,
  type RunCheck,
  type TestAlert,
} from '../lib/admin'
import { capitalName, HUNT_ANCHORS, huntDay, huntPick, huntTestHref, huntWhere, msUntilNextBug } from '../lib/bugHunt'
import { lazyPage } from '../lib/lazyPage'
import { ApiError } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { refreshTickets } from '../lib/tickets'
import '../styles/admin.css'
import '../styles/adminBooks.css'
import '../styles/adminLayout.css'

// The books draw every planned day, so each comes in a chunk of its own, when it's opened.
const AdminHoleBook = lazyPage(() => import('../components/AdminHoleBook').then((m) => m.AdminHoleBook))
const AdminTrackBook = lazyPage(() => import('../components/AdminTrackBook').then((m) => m.AdminTrackBook))
const AdminCourseBook = lazyPage(() => import('../components/AdminCourseBook').then((m) => m.AdminCourseBook))
const AdminCaveBook = lazyPage(() => import('../components/AdminCaveBook').then((m) => m.AdminCaveBook))
const AdminTowerBook = lazyPage(() => import('../components/AdminTowerBook').then((m) => m.AdminTowerBook))
const AdminSetPlatinum = lazyPage(() => import('../components/AdminSetPlatinum').then((m) => m.AdminSetPlatinum))
const AdminHillsBook = lazyPage(() => import('../components/AdminHillsBook').then((m) => m.AdminHillsBook))
const AdminGauntletBook = lazyPage(() => import('../components/AdminGauntletBook').then((m) => m.AdminGauntletBook))
const AdminPourBook = lazyPage(() => import('../components/AdminPourBook').then((m) => m.AdminPourBook))
const AdminBlipPolls = lazyPage(() => import('../components/AdminBlipPolls').then((m) => m.AdminBlipPolls))

type NavItem = {
  section?: AdminSection
  label: string
  /** The game a daily's book is for, said beside it. */
  game?: string
  title: string
  /**
   * Said under the title. A section that's one card has none: the card's own head names it, and the page's
   * title is there for screen readers.
   */
  blurb?: string
}

/**
 * The sidebar's sections, grouped by the job they're for (pick A of the "Admin page redesign" canvas,
 * 2026-10-23: Ramsey found one long page of cards under ten tabs "getting little confusing").
 */
const NAV: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ label: 'Overview', title: 'Overview', blurb: 'How the arcade is doing, what needs you, and what’s on today.' }],
  },
  {
    label: 'Needs you',
    items: [
      { section: 'feedback', label: 'Feedback', title: 'Feedback' },
      { section: 'errors', label: 'Site errors', title: 'Site errors' },
      { section: 'flags', label: 'Flagged scores', title: 'Flagged scores' },
    ],
  },
  {
    label: 'Players',
    items: [
      { section: 'players', label: 'Who’s playing', title: 'Who’s playing' },
      { section: 'tickets', label: 'Tickets', title: 'Tickets' },
      { section: 'bans', label: 'Bans', title: 'Bans' },
      { section: 'runs', label: 'Run check', title: 'Run check' },
    ],
  },
  {
    label: 'Site',
    items: [
      { section: 'events', label: 'Site events', title: 'Site events' },
      { section: 'season', label: 'Season and Gold Pass', title: 'Season and Gold Pass' },
      { section: 'blip', label: 'Blip’s questions', title: 'Blip’s questions' },
      { section: 'alerts', label: 'Error alerts', title: 'Error alerts' },
    ],
  },
  {
    label: 'Launch',
    items: [
      { section: 'launch', label: 'Launch list', title: 'Launch list' },
      { section: 'reset', label: 'Reset test data', title: 'Reset test data' },
    ],
  },
  {
    label: 'Daily games',
    items: [
      { section: 'dailies', label: 'Today’s dailies', title: 'Today’s dailies' },
      {
        section: 'platinum',
        label: 'Set platinum',
        title: 'Set platinum',
        blurb: 'Each race’s course today and the six days after: drive one, and its platinum is your best there and half a second.',
      },
      {
        section: 'holes',
        label: 'Hole Book',
        game: 'acechase',
        title: 'Hole Book',
        blurb: 'Every planned day of Ace Chase’s Today’s Hole: its green from above, how hard it is next to the rest, and the way in.',
      },
      {
        section: 'tracks',
        label: 'Track Book',
        game: 'hotlap',
        title: 'Track Book',
        blurb: 'Every planned day of Hot Lap’s Today’s Track, to test drive ahead of its day.',
      },
      {
        section: 'courses',
        label: 'Course Book',
        game: 'marblerun',
        title: 'Course Book',
        blurb: 'Every planned day of Marble Run’s Today’s Course, to test run ahead of its day.',
      },
      {
        section: 'caves',
        label: 'Cave Book',
        game: 'lander',
        title: 'Cave Book',
        blurb: 'Every planned day of Lander’s Today’s Cave, to test fly ahead of its day.',
      },
      {
        section: 'hills',
        label: 'Hills Book',
        game: 'swoop',
        title: 'Hills Book',
        blurb: 'Every planned day of Swoop’s Today’s Hills, to test fly ahead of its day.',
      },
      {
        section: 'towers',
        label: 'Tower Book',
        game: 'sling',
        title: 'Tower Book',
        blurb: 'Every planned day of Sling’s Today’s Tower, to test climb ahead of its day, and the test tower.',
      },
      {
        section: 'gauntlets',
        label: 'Gauntlet Book',
        game: 'wobblerun',
        title: 'Gauntlet Book',
        blurb: 'Every planned day of Wobble Run’s Today’s Gauntlet, its rounds and their tiers, to test run ahead of its day.',
      },
      {
        section: 'pours',
        label: 'Pour Book',
        game: 'halffull',
        title: 'Pour Book',
        blurb: 'Every day of Half Full’s Today’s Pour: its five glasses, how hard it came out for its weekday, and any day that missed.',
      },
      { section: 'hunt', label: 'Bug hunt', title: 'Bug hunt' },
    ],
  },
  {
    items: [
      {
        section: 'trophies',
        label: 'Trophies and eggs',
        title: 'Trophies and easter eggs',
        blurb: 'Everything a player can win or find, and exactly what earns it: the trophies, the secret ones, the easter eggs, and the rings and pins.',
      },
    ],
  },
]

/** Every section, with the group it's in. */
const NAV_ITEMS = NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))

/*
 * The admin's page: a sidebar of sections (NAV) beside the one that's open, the overview at /admin
 * (AdminOverview.tsx) and each section at /admin/<section>. On a phone the sidebar folds into one button.
 * It opens for the emails in the API's ADMIN_EMAILS (Render): the API is asked, and it's the API that answers
 * every card. Anyone else finds the Staff Only door (StaffOnlyDoor.tsx), an easter egg, and nothing of what's
 * behind it.
 */

type Gate = 'checking' | 'signedOut' | 'notAdmin' | 'failed' | 'ready'

const ago = adminAgo

function gameName(slug: string) {
  return getGame(slug)?.name ?? slug
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export function AdminPage({ section }: { section?: AdminSection }) {
  const { account, loading } = useAuth()
  const [gate, setGate] = useState<Gate>('checking')
  const [menuOpen, setMenuOpen] = useState(false)
  const here = NAV_ITEMS.find((item) => item.section === section) ?? NAV_ITEMS[0]!
  const { inbox, refresh } = useAdminInboxLoader(gate === 'ready', section)
  const inboxValue = useMemo(() => ({ inbox, refresh }), [inbox, refresh])

  // A section picked from the phone's menu closes the menu behind it.
  useEffect(() => {
    setMenuOpen(false)
  }, [section])

  useEffect(() => {
    if (loading) return
    if (!account) {
      setGate('signedOut')
      return
    }
    let cancelled = false
    setGate('checking')
    fetchAdminWhoami()
      .then(() => {
        if (!cancelled) setGate('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setGate(err instanceof ApiError && err.status === 404 ? 'notAdmin' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [account, loading])

  if (gate === 'signedOut' || gate === 'notAdmin') {
    return (
      <PageShell innerClassName="lb-page__inner">
        <StaffOnlyDoor />
      </PageShell>
    )
  }

  // Asking the API: nothing yet, so neither the admin page nor the door shows and then swaps for the other.
  if (gate === 'checking') {
    return <PageShell innerClassName="lb-page__inner">{null}</PageShell>
  }

  if (gate === 'failed') {
    return (
      <PageShell innerClassName="lb-page__inner">
        <div className="adm">
          <h1 className="adm-head__title">Admin</h1>
          <section className="adm-card">
            <p className="adm-note">Couldn’t reach the API. Try again in a moment.</p>
          </section>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner">
      <AdminInboxContext.Provider value={inboxValue}>
        <div className="adm adm-layout">
          <AdminNav here={here} inbox={inbox} open={menuOpen} onToggle={() => setMenuOpen((open) => !open)} />
          <div className="adm-main">
            <header className="adm-head">
              <p className="adm-head__kicker">Admins only{here.group ? ` · ${here.group}` : ''}</p>
              <h1 className={here.blurb ? 'adm-head__title' : 'visually-hidden'}>{here.title}</h1>
              {here.blurb ? <p className="adm-head__blurb">{here.blurb}</p> : null}
            </header>
            <SectionBody section={section} />
          </div>
        </div>
      </AdminInboxContext.Provider>
    </PageShell>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** What a section's sidebar entry says beside it: how many wait, or how a switch stands. */
function navBadge(section: AdminSection | undefined, inbox: AdminInbox): { text: string; hot?: boolean } | null {
  const waiting = (list: unknown[] | null) => (list?.length ? { text: list.length.toLocaleString(), hot: true } : null)
  switch (section) {
    case 'feedback':
      return waiting(inbox.feedback)
    case 'errors':
      return waiting(inbox.errors)
    case 'flags':
      return waiting(inbox.flags)
    case 'events':
      return inbox.siteEvents == null ? null : { text: inbox.siteEvents ? 'On' : 'Paused' }
    case 'launch':
      return inbox.launchList ? { text: inbox.launchList.toLocaleString() } : null
    default:
      return null
  }
}

/** The sidebar: every section by its group, with what waits. On a phone, one button that opens it. */
function AdminNav({ here, inbox, open, onToggle }: { here: NavItem; inbox: AdminInbox; open: boolean; onToggle: () => void }) {
  const waiting = (inbox.feedback?.length ?? 0) + (inbox.errors?.length ?? 0) + (inbox.flags?.length ?? 0)
  return (
    <nav className={`adm-nav${open ? ' adm-nav--open' : ''}`} aria-label="Admin">
      <button type="button" className="adm-nav__toggle" aria-expanded={open} aria-controls="adm-nav-list" onClick={onToggle}>
        <span className="adm-nav__now">{here.label}</span>
        {waiting ? <span className="adm-nav__badge adm-nav__badge--hot">{waiting.toLocaleString()} need you</span> : null}
        <ChevronDown />
      </button>
      <div className="adm-nav__list" id="adm-nav-list">
        {NAV.map((group, i) => (
          <div key={group.label ?? `group-${i}`} className="adm-nav__group">
            {group.label ? <p className="adm-nav__head">{group.label}</p> : null}
            <ul>
              {group.items.map((item) => {
                const badge = navBadge(item.section, inbox)
                const current = item.section === here.section
                return (
                  <li key={item.label}>
                    <a
                      className={`adm-nav__item${current ? ' adm-nav__item--here' : ''}`}
                      href={adminHref(item.section)}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span className="adm-nav__label">{item.label}</span>
                      {item.game ? <span className="adm-nav__game">{gameName(item.game)}</span> : null}
                      {badge ? <span className={`adm-nav__badge${badge.hot ? ' adm-nav__badge--hot' : ''}`}>{badge.text}</span> : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

/** A book, in the chunk of its own it comes in. */
function Book({ name, children }: { name: string; children: ReactNode }) {
  return <Suspense fallback={<p className="adm-note">Opening the {name}…</p>}>{children}</Suspense>
}

/** What a section holds. */
function SectionBody({ section }: { section?: AdminSection }) {
  switch (section) {
    case undefined:
      return <AdminOverview />
    case 'feedback':
      return <FeedbackCard />
    case 'errors':
      return <ErrorsCard />
    case 'flags':
      return <FlagsCard />
    case 'players':
      return <AdminPlayers />
    case 'tickets':
      return <TicketsCard />
    case 'bans':
      return <BansCard />
    case 'runs':
      return <RunCheckCard />
    case 'events':
      return <AdminSiteEvents />
    case 'season':
      return <AdminSeasonPreview />
    case 'blip':
      return (
        <Book name="questions">
          <AdminBlipPolls />
        </Book>
      )
    case 'alerts':
      return <AlertsCard />
    case 'launch':
      return <AdminLaunchList />
    case 'reset':
      return <AdminReset />
    case 'dailies':
      return <DailyGamesCard />
    case 'holes':
      return (
        <Book name="Hole Book">
          <AdminHoleBook />
        </Book>
      )
    case 'tracks':
      return (
        <Book name="Track Book">
          <AdminTrackBook />
        </Book>
      )
    case 'courses':
      return (
        <Book name="Course Book">
          <AdminCourseBook />
        </Book>
      )
    case 'caves':
      return (
        <Book name="Cave Book">
          <AdminCaveBook />
        </Book>
      )
    case 'hills':
      return (
        <Book name="Hills Book">
          <AdminHillsBook />
        </Book>
      )
    case 'platinum':
      return (
        <Book name="Set platinum list">
          <AdminSetPlatinum />
        </Book>
      )
    case 'towers':
      return (
        <Book name="Tower Book">
          <AdminTowerBook />
        </Book>
      )
    case 'gauntlets':
      return (
        <Book name="Gauntlet Book">
          <AdminGauntletBook />
        </Book>
      )
    case 'pours':
      return (
        <Book name="Pour Book">
          <AdminPourBook />
        </Book>
      )
    case 'hunt':
      return <BugHuntCard />
    case 'trophies':
      return <AdminTrophies />
  }
}

/** A card's list, loaded when it mounts and again on Refresh. */
function useList<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => {
    setError(null)
    load()
      .then(setItems)
      .catch((err) => setError(errorText(err, 'Couldn’t load this')))
  }, [load])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { items, setItems, error, setError, refresh }
}

/** A card's title and count, with Refresh and any other buttons for the whole list (`children`) beside it. */
function CardHead({
  title,
  count,
  onRefresh,
  children,
}: {
  title: string
  count: number | null
  onRefresh: () => void
  children?: ReactNode
}) {
  return (
    <div className="adm-card__head">
      <h2 className="adm-card__title">
        {title}
        {count ? <span className="adm-card__count">{count}</span> : null}
      </h2>
      <div className="adm-card__btns">
        {children}
        <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  )
}

/** Today's real dailies, beside the books in the sidebar that try any day ahead of players. */
function DailyGamesCard() {
  return (
    <section className="adm-card" aria-labelledby="adm-daily">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-daily">
          Today’s dailies
        </h2>
      </div>
      <p className="adm-card__sub">
        The real ones, where your runs count. Each game’s book, in the sidebar, tries any day ahead of players: a hole
        on trial, a test drive, a past day’s pour and the bug hunt’s test mode keep nothing.
      </p>
      <ul className="adm-links">
        <li>
          <a href={gamePlayHref('acechase')}>Ace Chase · Today’s Hole</a>
          <span>the real one, where your tries count; the Hole Book plays any day ahead</span>
        </li>
        <li>
          <a href={gamePlayHref('halffull')}>Half Full · Today’s Pour</a>
          <span>the real one, where your first pour counts; the Pour Book pours any past day again</span>
        </li>
        <li>
          <a href={gamePlayHref('marblerun')}>Marble Run · Today’s Course</a>
          <span>the real one, where your best run today counts; the Course Book test-runs any day ahead</span>
        </li>
        <li>
          <a href={gamePlayHref('lander')}>Lander · Today’s Cave</a>
          <span>the real one, where your best run today counts; the Cave Book test-flies any day ahead</span>
        </li>
        <li>
          <a href={gamePlayHref('swoop')}>Swoop · Today’s Hills</a>
          <span>the real one, where your best run today counts; the Hills Book test-flies any day ahead</span>
        </li>
        <li>
          <a href={gamePlayHref('sling')}>Sling · Today’s Tower</a>
          <span>the real one, where your best run today counts; the Tower Book test-climbs any day ahead</span>
        </li>
        <li>
          <a href={gamePlayHref('wobblerun')}>Wobble Run · Today’s Gauntlet</a>
          <span>the real one, where your best run today counts; the Gauntlet Book test-runs any day ahead</span>
        </li>
        {HUNT_ANCHORS[0] ? (
          <li>
            <a href={huntTestHref({ anchor: HUNT_ANCHORS[0], pose: 'top', at: 0.5 })}>Bug hunt · test mode</a>
            <span>step through every hiding place; a catch there doesn’t count</span>
          </li>
        ) : null}
      </ul>
    </section>
  )
}

/** How many days of the bug hunt the card shows, today's first. */
const HUNT_DAYS = 7

/** A day `n` days after `day` (YYYY-MM-DD), the same way written. */
function dayAfter(day: string, n: number) {
  const at = new Date(`${day}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + n)
  return at.toISOString().slice(0, 10)
}

const huntDayWords = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "13 h 45 min" or "40 min". */
function untilWords(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

/**
 * Where the daily bug hides (lib/bugHunt.ts huntPick), today's and the week's after it, so an admin never has
 * to hunt for it (Ramsey: "we should add it to admin page"). Going there is the real hunt, and a catch counts;
 * Test shows it at the same spot in the hunt's test mode, where it doesn't.
 */
function BugHuntCard() {
  const today = huntDay()
  const days = Array.from({ length: HUNT_DAYS }, (_, i) => huntPick(dayAfter(today, i)))
  return (
    <section className="adm-card" aria-labelledby="adm-hunt">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-hunt">
          Bug hunt
        </h2>
      </div>
      <p className="adm-card__sub">
        Where today’s bug hides, and the week after it. Where the header or the screen’s edge is in its way, it peeks
        out another way than the one listed. Go there is the real hunt: a catch counts for you. Test shows it in the
        same spot in test mode, where a catch doesn’t count. The next bug gets loose at midnight on the boards’ clock,
        in {untilWords(msUntilNextBug())}.
      </p>
      <ul className="adm-list">
        {days.map((pick, i) => (
          <li key={pick.day} className="adm-row">
            <div className="adm-row__main">
              <b className="adm-row__title">
                {i === 0 ? 'Today' : huntDayWords.format(new Date(`${pick.day}T12:00:00Z`))} · {capitalName(pick.bug)}
              </b>
              <span className="adm-row__sub">{huntWhere(pick.anchor, pick.pose)}</span>
            </div>
            <div className="adm-row__acts">
              {i === 0 ? (
                <a className="panel__btn panel__btn--ghost adm-small" href={pick.anchor.href}>
                  Go there
                </a>
              ) : null}
              <a className="panel__btn panel__btn--ghost adm-small" href={huntTestHref({ anchor: pick.anchor, pose: pick.pose, at: pick.at })}>
                Test
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FeedbackCard() {
  const { items, setItems, error, setError, refresh } = useList<AdminFeedback>(fetchFeedback)
  const { refresh: recount } = useAdminInbox()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const onRemove = async (f: AdminFeedback) => {
    setBusy(f.id)
    setError(null)
    setDone(null)
    try {
      await removeFeedback(f.id)
      setItems((list) => list?.filter((row) => row.id !== f.id) ?? null)
      recount()
    } catch (err) {
      setError(errorText(err, 'Couldn’t remove that one'))
    } finally {
      setBusy(null)
    }
  }

  // Up to the newest shown: a message sent since the list loaded stays, to be read first.
  const onClear = async () => {
    if (!items?.length || !window.confirm('Remove all the feedback? This can’t be undone.')) return
    setBusy('all')
    setError(null)
    setDone(null)
    try {
      const { removed } = await clearFeedback(Math.max(...items.map((f) => f.createdAt)))
      setDone(`Removed ${removed.toLocaleString()} ${removed === 1 ? 'message' : 'messages'}.`)
      refresh()
      recount()
    } catch (err) {
      setError(errorText(err, 'Couldn’t remove them'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="adm-card" aria-labelledby="adm-feedback">
      <CardHead
        title="Feedback"
        count={items?.length ?? null}
        onRefresh={() => {
          setDone(null)
          refresh()
        }}
      >
        {items && items.length > 1 ? (
          <button
            type="button"
            className="panel__btn panel__btn--ghost panel__btn--danger adm-small"
            disabled={busy != null}
            onClick={() => void onClear()}
          >
            Remove all
          </button>
        ) : null}
      </CardHead>
      <p className="adm-card__sub" id="adm-feedback">
        What players sent from Tell us (Send feedback in the menu, Suggest a game and Something broke in the footer), the latest first.
        Remove one once you’ve dealt with it.
      </p>
      <FeedbackPushLine />
      {done ? <p className="adm-note">{done}</p> : null}
      {error ? <p className="adm-fail">{error}</p> : null}
      {items && !items.length ? <p className="adm-note">Nothing yet.</p> : null}
      {items?.length ? (
        <ul className="adm-list">
          {items.map((f) => (
            <li key={f.id} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{f.message}</b>
                <span className="adm-row__sub">
                  {f.kind === 'problem' ? 'Something broke' : 'Idea'} · {ago(f.createdAt)}
                  {f.name ? ` · ${f.name}` : f.accountId ? ' · signed in' : ' · not signed in'}
                  {f.path ? ` · ${f.path}` : ''}
                </span>
                {f.userAgent ? (
                  <details className="adm-row__more">
                    <summary>Browser</summary>
                    <p className="adm-row__sub">{f.userAgent}</p>
                  </details>
                ) : null}
              </div>
              <div className="adm-row__acts">
                <button
                  type="button"
                  className="panel__btn panel__btn--ghost adm-small"
                  disabled={busy === f.id || busy === 'all'}
                  onClick={() => void onRemove(f)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * Whether new feedback pushes to the admins' devices (the API's feedbackAlerts.ts), with the switch: on unless
 * turned off, the first message at once and any more within five minutes together. Nothing shows with an API
 * from before it.
 */
function FeedbackPushLine() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchFeedbackPush().then(setOn, (err: unknown) => {
      if (!(err instanceof ApiError && err.status === 404)) setError('Couldn’t read whether new feedback pushes you.')
    })
  }, [])
  const flip = () => {
    if (on == null || busy) return
    setBusy(true)
    setError(null)
    setFeedbackPush(!on)
      .then(setOn)
      .catch(() => setError('That didn’t go through. Try again.'))
      .finally(() => setBusy(false))
  }
  if (on == null) return error ? <p className="adm-fail">{error}</p> : null
  return (
    <>
      <p className="adm-note">
        {on
          ? 'New feedback pushes to your devices, the ones listed under Site errors: the first message at once, then any more within five minutes together.'
          : 'New feedback doesn’t push to your devices. It still comes here.'}
      </p>
      <div className="adm-form">
        <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy} onClick={flip}>
          {busy ? 'Saving…' : on ? 'Stop the pushes' : 'Push me new feedback'}
        </button>
      </div>
      {error ? <p className="adm-fail">{error}</p> : null}
    </>
  )
}

function ErrorsCard() {
  const { items, setItems, error, setError, refresh } = useList<AdminClientError>(fetchClientErrors)
  const { refresh: recount } = useAdminInbox()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const onRemove = async (e: AdminClientError) => {
    setBusy(e.fingerprint)
    setError(null)
    setDone(null)
    try {
      await removeClientError(e.fingerprint)
      setItems((list) => list?.filter((row) => row.fingerprint !== e.fingerprint) ?? null)
      recount()
    } catch (err) {
      setError(errorText(err, 'Couldn’t remove that one'))
    } finally {
      setBusy(null)
    }
  }

  // Up to the newest shown: an error that has happened again since the list loaded stays.
  const onClear = async () => {
    if (!items?.length || !window.confirm('Remove every site error? Any that happen again will come back.')) return
    setBusy('all')
    setError(null)
    setDone(null)
    try {
      const { removed } = await clearClientErrors(Math.max(...items.map((e) => e.lastAt)))
      setDone(`Removed ${removed.toLocaleString()} ${removed === 1 ? 'error' : 'errors'}.`)
      refresh()
      recount()
    } catch (err) {
      setError(errorText(err, 'Couldn’t remove them'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="adm-card" aria-labelledby="adm-errors">
      <CardHead
        title="Site errors"
        count={items?.length ?? null}
        onRefresh={() => {
          setDone(null)
          refresh()
        }}
      >
        {items && items.length > 1 ? (
          <button
            type="button"
            className="panel__btn panel__btn--ghost panel__btn--danger adm-small"
            disabled={busy != null}
            onClick={() => void onClear()}
          >
            Remove all
          </button>
        ) : null}
      </CardHead>
      <p className="adm-card__sub" id="adm-errors">
        What broke in players’ browsers in the last 30 days, the latest first. The same error again counts up. Remove
        one once it’s fixed: if it happens again, it comes back. A spike of them pushes you (Error alerts).
      </p>
      {done ? <p className="adm-note">{done}</p> : null}
      {error ? <p className="adm-fail">{error}</p> : null}
      {items && !items.length ? <p className="adm-note">Nothing has broken lately.</p> : null}
      {items?.length ? (
        <ul className="adm-list">
          {items.map((e) => (
            <li key={e.fingerprint} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{e.message}</b>
                <span className="adm-row__sub">
                  {e.count.toLocaleString()} {e.count === 1 ? 'time' : 'times'} · last {ago(e.lastAt)}
                  {e.path ? ` · ${e.path}` : ''}
                  {e.release ? ` · build ${e.release}` : ''}
                </span>
                {e.stack || e.userAgent ? (
                  <details className="adm-row__more">
                    <summary>Stack and browser</summary>
                    {e.userAgent ? <p className="adm-row__sub">{e.userAgent}</p> : null}
                    {e.stack ? <pre>{e.stack}</pre> : null}
                  </details>
                ) : null}
              </div>
              <div className="adm-row__acts">
                <button
                  type="button"
                  className="panel__btn panel__btn--ghost adm-small"
                  disabled={busy === e.fingerprint || busy === 'all'}
                  onClick={() => void onRemove(e)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** What kind of device each push service means, in plain words. */
const PUSH_DEVICE: Record<PushService, string> = {
  apple: 'an iPhone or iPad (from the Home Screen), or Safari on a Mac',
  google: 'Chrome, on Android or a computer',
  microsoft: 'Edge on Windows',
  mozilla: 'Firefox',
  other: 'another browser',
}

/** A device in plain words: the kind kept when its push was turned on ("Chrome on an Android phone"), else its push service's. */
function deviceWords(d: { service: PushService; device?: string | null }) {
  return d.device || PUSH_DEVICE[d.service]
}

const NO_KEYS = 'This server has no push keys, so it can’t send any. Staging never has them: test alerts on blipka.com.'

/** What a test push found, device by device: "Sent to 1 device" alone left Ramsey asking which one (2026-10-22). */
function testWords({ devices, sent, pushReady, results }: TestAlert): string[] {
  if (pushReady === false) return [`Nothing went. ${NO_KEYS}`]
  if (!devices) return ['No device took it: none of yours has push on.']
  if (!results) return [`Sent to ${sent} ${sent === 1 ? 'device' : 'devices'}.`]
  const lines = results.map((r) =>
    r.ok
      ? `Taken for ${deviceWords(r)}.`
      : r.status === 404 || r.status === 410
        ? `Turned down for ${deviceWords(r)} (${r.status}): it threw its subscription away, so it’s off the list now.`
        : `Turned down for ${deviceWords(r)}${r.status ? ` (${r.status})` : ''}.`,
  )
  if (sent) {
    lines.push(
      'If one didn’t show it, that subscription is an old one, or the device has Blipka’s notifications off. On the device you want, turn Alerts on this device off and on again in Settings → Notifications, then test again.',
    )
  }
  return lines
}

/**
 * Where an error spike's push goes (the API's errorAlerts.ts): the admins' devices that have push on, at any hour,
 * each by the kind of device it is. A test push shows it arrives.
 */
function ErrorAlertsLine() {
  const [alerts, setAlerts] = useState<ErrorAlerts | null>(null)
  const [note, setNote] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    fetchErrorAlerts().then(setAlerts, (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Couldn’t read where alerts go'),
    )
  }, [])
  useEffect(load, [load])
  const onTest = async () => {
    setBusy(true)
    setNote(null)
    setError(null)
    try {
      setNote(testWords(await sendTestAlert()))
      // A device that threw its subscription away has just come off the list.
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t send it')
    } finally {
      setBusy(false)
    }
  }
  if (!alerts) return error ? <p className="adm-fail">{error}</p> : null
  const { spike, windowMinutes, devices, pushReady, deviceList } = alerts
  const admins = new Set(deviceList?.map((d) => d.email)).size
  return (
    <>
      <p className="adm-note">
        A spike pushes you, at any hour and at most once an hour for each: {spike.site.count} site errors from{' '}
        {spike.site.players} players, or {spike.api.count} failed API answers, within {windowMinutes} minutes.{' '}
        {pushReady === false
          ? NO_KEYS
          : devices
            ? `${devices === 1 ? 'It goes to 1 device' : `It goes to ${devices} devices`}${deviceList?.length ? ':' : '.'}`
            : 'None of your devices has push on yet: on your phone, turn on Alerts on this device in Settings → Notifications, then send a test.'}
      </p>
      {pushReady !== false && deviceList?.length ? (
        <ul className="adm-devices">
          {deviceList.map((d, i) => (
            <li key={i}>
              {deviceWords(d)}, turned on {ago(d.lastSeenAt)}
              {admins > 1 ? ` (${d.email})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="adm-form">
        <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy} onClick={() => void onTest()}>
          {busy ? 'Sending…' : 'Send me a test alert'}
        </button>
      </div>
      {note?.map((line, i) => (
        <p key={i} className="adm-note">
          {line}
        </p>
      ))}
      {error ? <p className="adm-fail">{error}</p> : null}
    </>
  )
}

/** Where a spike of errors pushes you, with a test: its own section (Error alerts), out of Site errors. */
function AlertsCard() {
  return (
    <section className="adm-card" aria-labelledby="adm-alerts">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-alerts">
          Error alerts
        </h2>
      </div>
      <p className="adm-card__sub">
        A push to your devices when the site starts breaking: a run of site errors from several players, or of failed API
        answers, in a few minutes.
      </p>
      <ErrorAlertsLine />
    </section>
  )
}

/**
 * Whether a score has to come with its run (REQUIRE_RUN_TOKEN on the API), and how many of the last week's saves
 * did, game by game. Once they all do, the switch can go on without refusing anyone's save.
 */
function RunCheckCard() {
  const [check, setCheck] = useState<RunCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => {
    setError(null)
    fetchRunCheck()
      .then(setCheck)
      .catch((err) => setError(errorText(err, 'Couldn’t load this')))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  const missing = check?.games.filter((g) => g.withRun < g.saves) ?? []
  const share = check && check.saves ? Math.floor((check.withRun / check.saves) * 1000) / 10 : null

  return (
    <section className="adm-card" aria-labelledby="adm-runs">
      <CardHead title="Run check" count={missing.length || null} onRefresh={refresh} />
      <p className="adm-card__sub" id="adm-runs">
        Every run the site starts is timed by the server, and a score is checked against that time. While runs aren’t
        required, a score sent without one isn’t checked. Once the last week’s saves all came with their run, set
        REQUIRE_RUN_TOKEN to 1 on Render (the API service, Environment) and this says On.
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
      {check ? (
        <p className="adm-note">
          Runs required: <b>{check.required ? 'On' : 'Off'}</b>
          {share != null
            ? ` · ${share}% of the last ${check.days} days’ ${check.saves.toLocaleString()} saves came with their run`
            : ` · no saves in the last ${check.days} days`}
        </p>
      ) : null}
      {check && check.saves && !missing.length ? <p className="adm-note">Every save came with its run.</p> : null}
      {missing.length ? (
        <ul className="adm-list">
          {missing.map((g) => (
            <li key={g.game} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{gameName(g.game)}</b>
                <span className="adm-row__sub">
                  {(g.saves - g.withRun).toLocaleString()} of {g.saves.toLocaleString()} saves without a run
                  {g.lastWithout ? ` · the last ${ago(g.lastWithout)}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function FlagsCard() {
  const { items, setItems, error, setError, refresh } = useList<AdminFlag>(fetchOpenFlags)
  const { refresh: recount } = useAdminInbox()
  const [busy, setBusy] = useState<string | null>(null)

  const settle = async (flag: AdminFlag, voidScore: boolean) => {
    setBusy(flag.id)
    setError(null)
    try {
      await settleFlag(flag, voidScore)
      setItems((list) => list?.filter((f) => f.id !== flag.id) ?? null)
      recount()
    } catch (err) {
      setError(errorText(err, 'Couldn’t settle that one'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="adm-card" aria-labelledby="adm-flags">
      <CardHead title="Flagged scores" count={items?.length ?? null} onRefresh={refresh} />
      <p className="adm-card__sub" id="adm-flags">
        Scores that looked wrong on the way in. Take one off the boards, or let it stand.
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
      {items && !items.length ? <p className="adm-note">No scores waiting.</p> : null}
      {items?.length ? (
        <ul className="adm-list">
          {items.map((f) => (
            <li key={f.id} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">
                  {f.name} · {gameName(f.game)} · {formatLeaderboardScore(f.game, f.score)}
                </b>
                <span className="adm-row__sub">
                  {FLAG_KINDS[f.kind] ?? f.kind}
                  {f.detail ? `: ${f.detail}` : ''} · {ago(f.createdAt)}
                </span>
              </div>
              <div className="adm-row__acts">
                <button
                  type="button"
                  className="panel__btn panel__btn--ghost adm-small"
                  disabled={busy === f.id}
                  onClick={() => void settle(f, false)}
                >
                  It’s fine
                </button>
                <button
                  type="button"
                  className="panel__btn panel__btn--ghost panel__btn--danger adm-small"
                  disabled={busy === f.id}
                  onClick={() => void settle(f, true)}
                >
                  Take it off
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function TicketsCard() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('500')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onGive = async (event: FormEvent) => {
    event.preventDefault()
    const tag = name.trim().toUpperCase()
    const count = Math.floor(Number(amount))
    if (!tag || !(count >= 1) || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const paid = await grantTickets(tag, count)
      setDone(`${paid.name} got ${paid.earned.toLocaleString()} tickets and has ${paid.balance.toLocaleString()} now.`)
      // They may be your own: the header's count reads them again.
      void refreshTickets(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'NO_ACCOUNT'
          ? `${tag} has no account behind it: only a tag someone signed in with can hold tickets.`
          : errorText(err, 'Couldn’t give those tickets'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adm-card" aria-labelledby="adm-tickets">
      <div className="adm-card__head">
        <h2 className="adm-card__title">Tickets</h2>
      </div>
      <p className="adm-card__sub" id="adm-tickets">
        Give a tag’s account tickets for the prize counter: to try it out, or to put a payout right. They go in its ledger as a grant.
      </p>
      <form className="adm-form" onSubmit={(event) => void onGive(event)}>
        <input
          className="panel__input adm-input adm-input--tag"
          value={name}
          maxLength={12}
          placeholder="TAG"
          aria-label="Tag to give tickets to"
          onChange={(event) => setName(event.target.value.toUpperCase())}
        />
        <input
          className="panel__input adm-input adm-input--count"
          value={amount}
          inputMode="numeric"
          type="number"
          min={1}
          max={50000}
          aria-label="How many tickets"
          onChange={(event) => setAmount(event.target.value)}
        />
        <button type="submit" className="panel__btn adm-small" disabled={busy || !name.trim() || !(Number(amount) >= 1)}>
          {busy ? 'Giving…' : 'Give tickets'}
        </button>
      </form>
      {done ? <p className="adm-note">{done}</p> : null}
      {error ? <p className="adm-fail">{error}</p> : null}
    </section>
  )
}

function BansCard() {
  const { items, setItems, error, setError, refresh } = useList<AdminBan>(fetchBans)
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [purge, setPurge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const onBan = async (event: FormEvent) => {
    event.preventDefault()
    const tag = name.trim().toUpperCase()
    if (!tag || busy) return
    if (purge && !window.confirm(`Ban ${tag} and delete every score and record it has posted? This can’t be undone.`)) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const { ban, purged } = await banTag(tag, reason.trim(), purge)
      setItems((list) => [ban, ...(list ?? []).filter((b) => b.name !== ban.name)])
      setDone(
        purged
          ? `${ban.name} is banned, and ${purged.leaderboard.toLocaleString()} scores and ${purged.records.toLocaleString()} records are gone.`
          : `${ban.name} is banned.`,
      )
      setName('')
      setReason('')
      setPurge(false)
    } catch (err) {
      setError(errorText(err, 'Couldn’t ban that tag'))
    } finally {
      setBusy(false)
    }
  }

  const onLift = async (ban: AdminBan) => {
    setError(null)
    setDone(null)
    try {
      await liftBan(ban.name)
      setItems((list) => list?.filter((b) => b.name !== ban.name) ?? null)
    } catch (err) {
      setError(errorText(err, 'Couldn’t lift that ban'))
    }
  }

  return (
    <section className="adm-card" aria-labelledby="adm-bans">
      <CardHead title="Bans" count={items?.length ?? null} onRefresh={refresh} />
      <p className="adm-card__sub" id="adm-bans">
        A banned tag, and the account behind it, can’t save scores or records or play in events. Its old scores
        stay unless you delete them too.
      </p>
      <form className="adm-form" onSubmit={(event) => void onBan(event)}>
        <input
          className="panel__input adm-input adm-input--tag"
          value={name}
          maxLength={12}
          placeholder="TAG"
          aria-label="Tag to ban"
          onChange={(event) => setName(event.target.value.toUpperCase())}
        />
        <input
          className="panel__input adm-input"
          value={reason}
          maxLength={500}
          placeholder="Why (only admins see this)"
          aria-label="Reason"
          onChange={(event) => setReason(event.target.value)}
        />
        <label className="adm-check">
          <input type="checkbox" checked={purge} onChange={(event) => setPurge(event.target.checked)} />
          Also delete its scores and records
        </label>
        <button type="submit" className="panel__btn adm-small" disabled={busy || !name.trim()}>
          Ban
        </button>
      </form>
      {done ? <p className="adm-note">{done}</p> : null}
      {error ? <p className="adm-fail">{error}</p> : null}
      {items && !items.length ? <p className="adm-note">Nobody is banned.</p> : null}
      {items?.length ? (
        <ul className="adm-list">
          {items.map((b) => (
            <li key={b.name} className="adm-row">
              <div className="adm-row__main">
                <b className="adm-row__title">{b.name}</b>
                <span className="adm-row__sub">
                  {b.reason ? `${b.reason} · ` : ''}by {b.bannedBy} · {ago(b.bannedAt)}
                </span>
              </div>
              <div className="adm-row__acts">
                <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={() => void onLift(b)}>
                  Lift
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
