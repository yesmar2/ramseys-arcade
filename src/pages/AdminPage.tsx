import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { homeHref } from '../hooks/useHashRoute'
import {
  banTag,
  fetchAdminWhoami,
  fetchBans,
  fetchClientErrors,
  fetchOpenFlags,
  liftBan,
  settleFlag,
  useIsAdmin,
  type AdminBan,
  type AdminClientError,
  type AdminFlag,
} from '../lib/admin'
import { ApiError } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import '../styles/admin.css'

/*
 * The admin's page: what broke in players' browsers, scores that looked wrong
 * on the way in, and banned tags. The site shows it to the emails in
 * VITE_ADMIN_EMAILS (Vercel); the API answers only those in ADMIN_EMAILS
 * (Render), so both have to name the account.
 */

type Gate = 'checking' | 'signedOut' | 'notAdmin' | 'apiRefused' | 'failed' | 'ready'

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

export function AdminPage() {
  const { account, loading } = useAuth()
  const isAdmin = useIsAdmin()
  const [gate, setGate] = useState<Gate>('checking')

  useEffect(() => {
    if (loading) return
    if (!account) {
      setGate('signedOut')
      return
    }
    if (!isAdmin) {
      setGate('notAdmin')
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
        setGate(err instanceof ApiError && err.status === 404 ? 'apiRefused' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [account, isAdmin, loading])

  return (
    <PageShell innerClassName="lb-page__inner">
      <PageBanner
        size="compact"
        crumbs={[{ href: homeHref(), label: 'Home' }, { label: 'Admin' }]}
        kicker="Admins only"
        title="Admin"
        blurb="What broke in players’ browsers, scores that looked wrong on the way in, and banned tags."
      />
      <div className="adm">
        {gate === 'ready' ? (
          <>
            <ErrorsCard />
            <FlagsCard />
            <BansCard />
          </>
        ) : (
          <section className="adm-card">
            <p className="adm-note">
              {gate === 'checking'
                ? 'Checking…'
                : gate === 'signedOut'
                  ? 'Sign in with an admin account to use this page.'
                  : gate === 'notAdmin'
                    ? 'This account isn’t an admin. Admins are the emails in VITE_ADMIN_EMAILS on Vercel.'
                    : gate === 'apiRefused'
                      ? 'The API doesn’t know this account as an admin. Add its email to ADMIN_EMAILS on Render.'
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
