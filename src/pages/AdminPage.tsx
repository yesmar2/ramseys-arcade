import { Suspense, useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { AdminTrophies } from '../components/AdminTrophies'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { adminHref, gamePlayHref, homeHref, type AdminSection } from '../hooks/useHashRoute'
import {
  banTag,
  fetchAdminWhoami,
  fetchBans,
  fetchClientErrors,
  fetchFeedback,
  fetchOpenFlags,
  grantTickets,
  liftBan,
  notAdminWords,
  settleFlag,
  type AdminBan,
  type AdminClientError,
  type AdminFeedback,
  type AdminFlag,
} from '../lib/admin'
import { HUNT_ANCHORS, huntTestHref } from '../lib/bugHunt'
import { lazyPage } from '../lib/lazyPage'
import { ApiError } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { refreshTickets } from '../lib/tickets'
import '../styles/admin.css'
import '../styles/adminBooks.css'

// The books draw every planned day, so each comes in a chunk of its own, when it's opened.
const AdminHoleBook = lazyPage(() => import('../components/AdminHoleBook').then((m) => m.AdminHoleBook))
const AdminTrackBook = lazyPage(() => import('../components/AdminTrackBook').then((m) => m.AdminTrackBook))

const SECTIONS: { section?: AdminSection; label: string; title: string; blurb: string }[] = [
  {
    label: 'Overview',
    title: 'Admin',
    blurb:
      'What players sent, what broke in their browsers, scores that looked wrong on the way in, tickets, banned tags, and what the daily games have planned.',
  },
  {
    section: 'holes',
    label: 'Hole Book',
    title: 'Hole Book',
    blurb: 'Every planned day of Ace Chase’s Today’s Hole: its green from above, how hard it is next to the rest, and the way in.',
  },
  {
    section: 'tracks',
    label: 'Track Book',
    title: 'Track Book',
    blurb: 'Every planned day of Hot Lap’s Today’s Track, to test drive ahead of its day.',
  },
  {
    section: 'trophies',
    label: 'Trophies',
    title: 'Trophies and easter eggs',
    blurb: 'Everything a player can win or find, and exactly what earns it: the trophies, the secret ones, the easter eggs, and the rings and pins.',
  },
]

/*
 * The admin's page: what players sent, what broke in their browsers, scores
 * that looked wrong on the way in, tickets, and banned tags; and, a tab each,
 * the daily games' books of what's planned (/admin/holes, /admin/tracks) and
 * every trophy, secret, easter egg and bit of flair there is (/admin/trophies). It
 * opens for the emails in the API's ADMIN_EMAILS (Render): the API is asked,
 * and it's the API that answers every card.
 */

type Gate = 'checking' | 'signedOut' | 'notAdmin' | 'failed' | 'ready'

function ago(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

function gameName(slug: string) {
  return getGame(slug)?.name ?? slug
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export function AdminPage({ section }: { section?: AdminSection }) {
  const { account, loading } = useAuth()
  const [gate, setGate] = useState<Gate>('checking')
  // The code the API said no with, for the words under a closed page.
  const [refusal, setRefusal] = useState<string>()
  const here = SECTIONS.find((s) => s.section === section) ?? SECTIONS[0]!

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
        setRefusal(err instanceof ApiError ? err.code : undefined)
        setGate(err instanceof ApiError && err.status === 404 ? 'notAdmin' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [account, loading])

  return (
    <PageShell innerClassName="lb-page__inner">
      <PageBanner
        size="compact"
        crumbs={
          section
            ? [{ href: homeHref(), label: 'Home' }, { href: adminHref(), label: 'Admin' }, { label: here.title }]
            : [{ href: homeHref(), label: 'Home' }, { label: 'Admin' }]
        }
        kicker="Admins only"
        title={here.title}
        blurb={here.blurb}
      />
      <div className="adm">
        {gate === 'ready' ? (
          <>
            <nav className="seg adm-tabs" aria-label="Admin" style={{ '--seg-count': SECTIONS.length } as CSSProperties}>
              {SECTIONS.map((s) => (
                <a
                  key={s.label}
                  className={`seg__item${s === here ? ' seg__item--active' : ''}`}
                  href={adminHref(s.section)}
                  aria-current={s === here ? 'page' : undefined}
                >
                  {s.label}
                </a>
              ))}
            </nav>
            {section === 'holes' ? (
              <Suspense fallback={<p className="adm-note">Opening the Hole Book…</p>}>
                <AdminHoleBook />
              </Suspense>
            ) : section === 'tracks' ? (
              <Suspense fallback={<p className="adm-note">Opening the Track Book…</p>}>
                <AdminTrackBook />
              </Suspense>
            ) : section === 'trophies' ? (
              <AdminTrophies />
            ) : (
              <>
                <DailyGamesCard />
                <FeedbackCard />
                <ErrorsCard />
                <FlagsCard />
                <TicketsCard />
                <BansCard />
              </>
            )}
          </>
        ) : (
          <section className="adm-card">
            <p className="adm-note">
              {gate === 'checking'
                ? 'Checking…'
                : gate === 'signedOut'
                  ? 'Sign in with an admin account to use this page.'
                  : gate === 'notAdmin'
                    ? notAdminWords(refusal, account?.email)
                    : 'Couldn’t reach the API. Try again in a moment.'}
            </p>
          </section>
        )}
      </div>
    </PageShell>
  )
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

function CardHead({ title, count, onRefresh }: { title: string; count: number | null; onRefresh: () => void }) {
  return (
    <div className="adm-card__head">
      <h2 className="adm-card__title">
        {title}
        {count ? <span className="adm-card__count">{count}</span> : null}
      </h2>
      <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  )
}

/** The daily games' books, and the pages that try things out ahead of players. */
function DailyGamesCard() {
  return (
    <section className="adm-card" aria-labelledby="adm-daily">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-daily">
          Daily games
        </h2>
      </div>
      <p className="adm-card__sub">
        What the daily games have planned, day by day, and pages to try things on. A hole on trial, a test drive and
        the bug hunt’s test mode keep nothing.
      </p>
      <div className="adm-books">
        <a className="adm-book" href={adminHref('holes')}>
          <b>Hole Book</b>
          <span>Ace Chase: every planned Today’s Hole, how hard it is, and the way in</span>
        </a>
        <a className="adm-book" href={adminHref('tracks')}>
          <b>Track Book</b>
          <span>Hot Lap: every planned Today’s Track, to test drive</span>
        </a>
      </div>
      <ul className="adm-links">
        <li>
          <a href={gamePlayHref('acechase')}>Ace Chase · Today’s Hole</a>
          <span>the real one, where your tries count; the Hole Book plays any day ahead</span>
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

function FeedbackCard() {
  const { items, error, refresh } = useList<AdminFeedback>(fetchFeedback)
  return (
    <section className="adm-card" aria-labelledby="adm-feedback">
      <CardHead title="Feedback" count={items?.length ?? null} onRefresh={refresh} />
      <p className="adm-card__sub" id="adm-feedback">
        What players sent from Tell us (Send feedback in the menu, Suggest a game and Something broke in the footer), the latest first.
      </p>
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
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ErrorsCard() {
  const { items, error, refresh } = useList<AdminClientError>(fetchClientErrors)
  return (
    <section className="adm-card" aria-labelledby="adm-errors">
      <CardHead title="Site errors" count={items?.length ?? null} onRefresh={refresh} />
      <p className="adm-card__sub" id="adm-errors">
        What broke in players’ browsers in the last 30 days, the latest first. The same error again counts up.
      </p>
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
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function FlagsCard() {
  const { items, setItems, error, setError, refresh } = useList<AdminFlag>(fetchOpenFlags)
  const [busy, setBusy] = useState<string | null>(null)

  const settle = async (flag: AdminFlag, voidScore: boolean) => {
    setBusy(flag.id)
    setError(null)
    try {
      await settleFlag(flag, voidScore)
      setItems((list) => list?.filter((f) => f.id !== flag.id) ?? null)
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
                  {f.kind}
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
