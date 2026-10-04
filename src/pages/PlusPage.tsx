import { useEffect, useState } from 'react'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { RewardArt } from '../components/season/RewardArt'
import { openSiteMenu } from '../components/siteNav'
import { useAuth } from '../hooks/useAuth'
import { AUTH_EVENT } from '../lib/auth'
import { dayBefore, OPEN_DAYS } from '../lib/archive'
import { APP_NAME } from '../lib/brand'
import { homeHref, prizesHref, seasonHref, tournamentsHref } from '../hooks/useHashRoute'
import {
  confirmPlusMembership,
  fetchPlus,
  FOUNDER_UNTIL,
  freeWeekFor,
  managePlusMembership,
  money,
  perSeason,
  seasonWeeks,
  startPlusMembership,
  type PlusInfo,
  type PlusInterval,
} from '../lib/plus'
import { boardDay } from '../lib/rankHow'
import { liveSeason, plusPrice, useSeason } from '../lib/season'

/**
 * What the two plans get you.
 *
 * Plus is the Dailies + Seasons membership (Ramsey's pick, 2026-10-04): every past day of every daily, every
 * season's Pass+, a members' look each month and new games first, then the room to host it always had.
 * Everything about playing stays free, and the page says so before it asks for anything: a pricing page that
 * reads as though the games are being sold would be wrong, because they aren't. Nor are places: archive days
 * and early games are practice, on no board.
 */

type Row = {
  label: string
  free: string | boolean
  plus: string | boolean
  note?: string
}

const PLAY: Row[] = [
  { label: 'Every game', free: true, plus: true },
  {
    label: 'New games',
    free: 'From launch day',
    plus: 'A week before launch',
    note: 'Playing early is practice. Boards open for everyone on launch day.',
  },
  { label: 'Weekly, monthly and all-time boards', free: true, plus: true },
  { label: 'Record books', free: true, plus: true },
  { label: 'Standings and trophies', free: true, plus: true },
  { label: 'Friends', free: true, plus: true },
  { label: 'Match alerts', free: true, plus: true },
  {
    label: 'Your stats',
    free: true,
    plus: true,
    note: 'Your rank on every game and how it’s trending, every day you have played, and the records you are closest to taking.',
  },
  {
    label: 'Joining events',
    free: 'Any size',
    plus: 'Any size',
    note: 'Joining is never paid, whoever is hosting.',
  },
]

const DAILIES: Row[] = [
  { label: 'Today’s dailies', free: true, plus: true, note: 'The only daily runs that count toward your rank.' },
  {
    label: 'Past days',
    free: `The last ${OPEN_DAYS} days`,
    plus: 'Every day, back to the first',
    note: 'Past days never count toward your rank. Older than a week, they’re practice: nothing is saved.',
  },
]

const HOST: Row[] = [
  { label: 'Events running at once', free: '1', plus: '5' },
  { label: 'Players in an event', free: 'Up to 8', plus: 'Up to 64' },
  { label: 'Groups you run', free: '1', plus: '5' },
  { label: 'Players in a group', free: '20', plus: '100' },
  { label: 'Double elimination', free: false, plus: true },
  { label: 'A different game each round', free: false, plus: true },
]

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="plus-cell plus-cell--yes">
        <span aria-hidden="true">✓</span>
        <span className="visually-hidden">Included</span>
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="plus-cell plus-cell--no">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">Not included</span>
      </span>
    )
  }
  return <span className="plus-cell">{value}</span>
}

function Table({ title, blurb, rows }: { title: string; blurb: string; rows: Row[] }) {
  return (
    <section className="plus-table" aria-labelledby={`plus-${title.toLowerCase()}`}>
      <div className="plus-table__head">
        <h2 className="plus-table__title" id={`plus-${title.toLowerCase()}`}>
          {title}
        </h2>
        <p className="plus-table__blurb">{blurb}</p>
      </div>
      <table className="plus-grid">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Feature</span>
            </th>
            <th scope="col">Free</th>
            <th scope="col" className="plus-grid__paid">
              Plus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {row.label}
                {row.note ? <span className="plus-grid__note">{row.note}</span> : null}
              </th>
              <td>
                <Cell value={row.free} />
              </td>
              <td className="plus-grid__paid">
                <Cell value={row.plus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function day(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/** "December 24": a YYYY-MM-DD day in words. */
function dayWords(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** A day so many days before another, both YYYY-MM-DD. */
function daysBefore(iso: string, n: number): string {
  let out = iso
  for (let i = 0; i < n; i++) out = dayBefore(out)
  return out
}

export function PlusPage() {
  const { isPlus, signedIn, loading } = useAuth()
  const seasonStore = useSeason()
  const season = liveSeason(seasonStore)
  const pass = seasonStore.plus ?? null
  const [info, setInfo] = useState<PlusInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  /** By the month or the year: the month unless asked. */
  const [every, setEvery] = useState<PlusInterval>('month')

  useEffect(() => {
    if (loading) return
    let live = true
    fetchPlus()
      .then((next) => {
        if (live) setInfo(next)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [loading, signedIn, isPlus])

  // Back from Stripe's page: the checkout's subscription makes you a member now (its webhook may be a moment behind).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const back = query.get('joined')
    if (!back) return
    const session = query.get('session')
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (back === 'cancelled') {
      setNote({ ok: true, text: 'No charge. Plus is here whenever you want it.' })
      return
    }
    if (back !== 'done' || !session) return
    setNote({ ok: true, text: 'Checking the payment…' })
    void confirmPlusMembership(session)
      .then(({ member, you }) => {
        window.dispatchEvent(new Event(AUTH_EVENT))
        setNote(
          !member
            ? { ok: true, text: 'The payment is still going through. Plus starts as soon as it does.' }
            : you.status === 'trialing'
              ? {
                  ok: true,
                  text: 'Welcome to Plus. Your free week has started: every past daily is open now. This season’s Pass+ and the month’s look come with your first payment.',
                }
              : { ok: true, text: 'Welcome to Plus. Every past daily is open, and this season’s Pass+ is yours: what your level has reached is in your hangar and Prizes now.' },
        )
      })
      .catch(() => setNote({ ok: false, text: 'Couldn’t check the payment just now. If it went through, Plus starts shortly.' }))
  }, [])

  const go = async (open: () => Promise<string>) => {
    setBusy(true)
    setNote(null)
    try {
      window.location.assign(await open())
    } catch (err) {
      setBusy(false)
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Couldn’t open that page' })
    }
  }

  const you = info?.you ?? null
  const member = isPlus || you?.plan === 'plus'
  const currency = info?.currency ?? 'usd'
  const monthly = info?.prices?.month ?? info?.price ?? 299
  const yearly = info?.prices?.year ?? null
  const byYear = every === 'year' && yearly != null
  const price = money(byYear ? yearly : monthly, currency)
  const unit = byYear ? 'year' : 'month'
  // What a year saves on twelve months, to the whole percent: "save 30%".
  const saves = yearly != null ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0
  const freeWeek = freeWeekFor(info)
  const trialDays = info?.trialDays ?? 7
  const onFreeWeek = member && you?.status === 'trialing'
  // Founding Member, while the months that give it last: a free week has to start a week sooner, as looks come with the first payment.
  const founder = (info?.looks ?? []).some((l) => l.id === 't-founder') && boardDay() <= FOUNDER_UNTIL
  const founderBy = freeWeek ? daysBefore(FOUNDER_UNTIL, trialDays) : FOUNDER_UNTIL
  const looks = info?.looks ?? []
  // The boards' month (New York), which the API gives the looks by.
  const month = new Date(`${boardDay()}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })

  return (
    <PageShell innerClassName="lb-page__inner">
      <PageBanner
        size="compact"
        crumbs={[{ href: homeHref(), label: 'Home' }, { label: 'Plus' }]}
        kicker={`${APP_NAME} Plus`}
        title="Every past daily, and every season’s Pass+."
        blurb={`Playing stays free for everyone: every game, every board, today’s dailies and the last ${OPEN_DAYS} days of each, and joining any event however big. Plus opens every older day of every daily, gives you each season’s Pass+ and a members’ look every month, lets you play new games a week before they launch, and makes room to host bigger events.`}
        actions={
          member ? (
            <>
              <span className="plus-hero__have">{onFreeWeek ? 'Your free week of Plus' : 'You’re on Plus'}</span>
              {you?.renewsAt ? (
                <span className="home-banner__hint">
                  {onFreeWeek
                    ? you.cancelsAtEnd
                      ? `Your free week ends on ${day(you.renewsAt)}, and Plus with it. Nothing is charged.`
                      : `Your free week ends on ${day(you.renewsAt)}, with your first payment. This season’s Pass+ and the month’s look come with it.`
                    : you.cancelsAtEnd
                      ? `Ends on ${day(you.renewsAt)}: what you’ve won stays yours.`
                      : `Renews on ${day(you.renewsAt)}.`}
                </span>
              ) : null}
              {you?.source === 'stripe' ? (
                <button type="button" className="plus-hero__btn plus-hero__btn--go" disabled={busy} onClick={() => void go(managePlusMembership)}>
                  {busy ? 'Opening…' : 'Manage or cancel'}
                </button>
              ) : null}
            </>
          ) : (
            <>
              {yearly != null ? (
                <div className="plus-every" role="group" aria-label="How to pay">
                  <button type="button" aria-pressed={!byYear} onClick={() => setEvery('month')}>
                    Monthly
                  </button>
                  <button type="button" aria-pressed={byYear} onClick={() => setEvery('year')}>
                    Yearly{saves > 0 ? <span className="plus-every__save">Save {saves}%</span> : null}
                  </button>
                </div>
              ) : null}
              <span className="plus-hero__price">
                <strong>{price}</strong>
                <span>/{unit}</span>
              </span>
              {!signedIn ? (
                <button type="button" className="plus-hero__btn plus-hero__btn--go" onClick={openSiteMenu} disabled={loading}>
                  {freeWeek ? 'Sign in to start a free week' : 'Sign in to join'}
                </button>
              ) : info?.buyable ? (
                <button type="button" className="plus-hero__btn plus-hero__btn--go" disabled={busy} onClick={() => void go(() => startPlusMembership(every))}>
                  {busy ? 'Opening…' : freeWeek ? 'Start your free week' : 'Join Plus'}
                </button>
              ) : (
                <button type="button" className="plus-hero__btn" disabled>
                  On sale soon
                </button>
              )}
              <span className="home-banner__hint">
                {freeWeek
                  ? `Free for ${trialDays} days, then ${price} a ${unit}. Cancel before the week ends and you pay nothing.`
                  : byYear
                    ? `About ${money(Math.round(yearly / 12), currency)} a month. Cancel any time; what you’ve won stays yours.`
                    : `${season ? `About ${perSeason(monthly, season, currency)} a season, with every season’s Pass+ in it. ` : ''}Cancel any time. What you’ve won stays yours.`}
              </span>
              {founder ? (
                <span className="home-banner__hint plus-hero__founder">
                  Join by {dayWords(founderBy)} and the Founding Member title is yours for good.
                </span>
              ) : null}
            </>
          )
        }
      />

      {note ? (
        <p className={note.ok ? 'plus-note' : 'plus-note plus-note--bad'} role="status">
          {note.text}
        </p>
      ) : null}

      {looks.length ? (
        <section className="plus-pass plus-look" aria-labelledby="plus-look-title">
          <div className="plus-pass__head">
            <h2 className="plus-table__title" id="plus-look-title">
              {onFreeWeek ? `${month}’s members’ look comes with your first payment` : member ? `${month}’s members’ look is yours` : `${month}’s members’ look`}
            </h2>
            {member && !onFreeWeek ? (
              <a className="plus-pass__link" href={prizesHref()}>
                Wear it in Prizes ›
              </a>
            ) : null}
          </div>
          <p className="plus-table__blurb">
            Every month, every member gets that month&rsquo;s look, and keeps it for good. It&rsquo;s never sold on its own.
            {founder ? ` Founding Member is given only until ${dayWords(FOUNDER_UNTIL)}.` : ''}
          </p>
          <ul className="plus-pass__row">
            {looks.map((look) => (
              <li key={look.id} className="plus-pass__item">
                <span className="plus-pass__art">
                  <RewardArt reward={{ kind: 'prize', id: look.id, name: look.name }} size={60} />
                </span>
                <span className="plus-pass__name">{look.name}</span>
                <span className="plus-look__what">{look.what}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {season && pass ? (
        <section className="plus-pass" aria-labelledby="plus-pass-title">
          <div className="plus-pass__head">
            <h2 className="plus-table__title" id="plus-pass-title">
              {member ? `Season ${season.id}’s Pass+ is yours` : `Season ${season.id}’s Pass+ comes with it`}
            </h2>
            <a className="plus-pass__link" href={seasonHref()}>
              See the whole pass ›
            </a>
          </div>
          <p className="plus-table__blurb">
            {season.name}: {pass.rewards.length} rewards on the Pass+ row, {pass.rewards.filter((r) => r.kind === 'skin').length} of them skins
            {pass.bonus ? `, and ${pass.bonus} bonus levels past ${season.levels}` : ''}. Every season after it too, while you&rsquo;re a member.
          </p>
          <ul className="plus-pass__row">
            {pass.rewards.slice(0, 12).map((reward) => (
              <li key={reward.id} className="plus-pass__item">
                <span className="plus-pass__art">
                  <RewardArt reward={reward} size={60} />
                </span>
                <span className="plus-pass__name">{reward.name}</span>
              </li>
            ))}
          </ul>
          {!member ? (
            <p className="plus-table__blurb">
              Just want this season&rsquo;s? Pass+ is {plusPrice(pass)} once for the whole season ({seasonWeeks(season)} weeks) on the{' '}
              <a href={seasonHref()}>Season page</a>, no membership.
            </p>
          ) : null}
        </section>
      ) : null}

      <Table title="Playing" blurb="Free for everyone. Playing needs no account; sign in to save your scores and join in." rows={PLAY} />
      <Table title="Dailies" blurb="Games with a new challenge every day, the same for everyone." rows={DAILIES} />
      <Table
        title="Seasons"
        blurb="A new theme every season, with a pass to climb by winning tickets."
        rows={[
          { label: 'The season pass’s free row', free: true, plus: true },
          { label: 'The season’s Pass+ row', free: pass ? `${plusPrice(pass)} once a season` : 'A season at a time', plus: 'Every season, included' },
          { label: 'A members’ look each month', free: false, plus: true, note: 'A title, name style, card theme or confetti, yours to keep.' },
        ]}
      />
      <Table title="Hosting" blurb="Running events and groups for other people." rows={HOST} />

      <footer className="plus-foot">
        <p className="plus-foot__line">Nothing that is free today will move behind Plus later.</p>
        <a className="plus-foot__link" href={tournamentsHref()}>
          {signedIn ? 'Back to events' : 'See what is running'} →
        </a>
      </footer>
    </PageShell>
  )
}
