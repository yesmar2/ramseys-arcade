import { useEffect, useState, type ReactNode } from 'react'
import { PageShell } from '../components/PageShell'
import { PlusGlyph } from '../components/PlusMark'
import { RewardArt } from '../components/season/RewardArt'
import { openSiteMenu } from '../components/siteNav'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { AUTH_EVENT } from '../lib/auth'
import { dayBefore, OPEN_DAYS } from '../lib/archive'
import { APP_NAME } from '../lib/brand'
import { homeHref, seasonHref, termsHref } from '../hooks/useHashRoute'
import { normalizePlayerName } from '../lib/leaderboard'
import { FREE_LIMITS, PLUS_LIMITS } from '../lib/plans'
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
  type MembersLook,
  type PlusInfo,
  type PlusInterval,
} from '../lib/plus'
import { boardDay } from '../lib/rankHow'
import { headlinersOf, liveSeason, plusPrice, useSeason, type SeasonReward } from '../lib/season'
import '../styles/plus.css'

/**
 * Plus, the Dailies + Seasons membership (Ramsey's pick, 2026-10-04): every past day of every daily, every
 * season's Pass+, a members' look each month, new games a week before launch, and room to host.
 *
 * Laid out as A of the "Plus page redesign" canvas (2026-10-07): the price beside a member card with your
 * own tag on it, then what Plus adds as six tiles that each show their thing, then what stays free, the
 * questions people ask, and the button again. Everything about playing stays free, and the page says so
 * before it asks for anything. Nor are places sold: archive days and early games are practice, on no board.
 */

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

/** "OCT": a YYYYMM month, short. */
function monthShort(month: number): string {
  const date = new Date(Date.UTC(Math.floor(month / 100), (month % 100) - 1, 15))
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
}

/** The archive tile's days: the week free before today, and the week before it, which Plus opens. */
function archiveDays(today: string): { plus: string[]; free: string[] } {
  let d = today
  const free: string[] = []
  for (let i = 0; i < OPEN_DAYS; i++) {
    d = dayBefore(d)
    free.unshift(d)
  }
  const plus: string[] = []
  for (let i = 0; i < 7; i++) {
    d = dayBefore(d)
    plus.unshift(d)
  }
  return { plus, free }
}

/** What's free for everyone, whatever the plan. */
const ALWAYS_FREE = [
  'Every game',
  'Every board',
  'Record books',
  'Standings and trophies',
  'Today’s dailies',
  `The last ${OPEN_DAYS} days of each`,
  'The season pass’s free row',
  'Friends and match alerts',
  'Your stats',
  'Joining any event',
]

/** One thing Plus adds: a picture of it, its name and a line on it. */
function Perk({ title, show, children }: { title: string; show: ReactNode; children: ReactNode }) {
  return (
    <article className="plus-perk">
      <div className="plus-perk__show" aria-hidden="true">
        {show}
      </div>
      <h3 className="plus-perk__title">{title}</h3>
      <div className="plus-perk__text">{children}</div>
    </article>
  )
}

/** The member card: your own tag with the mark, as a member's would read. */
function MemberCard({
  name,
  member,
  founder,
  line,
  skins,
}: {
  name: string
  member: boolean
  founder: boolean
  line: { small: string; big: string }
  skins: SeasonReward[]
}) {
  return (
    <figure className="plus-card" aria-label={member ? 'Your Plus member card' : 'A Plus member card, with your tag on it'}>
      <div className="plus-card__top">
        <span className="plus-card__brand">
          <PlusGlyph size="1.85rem" />
          {APP_NAME} Plus
        </span>
        <span className="plus-card__kind">Member</span>
      </div>
      <div className="plus-card__who">
        <span className="plus-card__name">
          {name}
          <PlusGlyph size="1.45rem" />
        </span>
        {founder ? <span className="plus-card__title">Founding Member</span> : null}
      </div>
      <div className="plus-card__foot">
        <span className="plus-card__line">
          {line.small}
          <b>{line.big}</b>
        </span>
        {skins.length ? (
          <span className="plus-card__skins">
            {skins.map((reward) => (
              <span key={reward.id} className="plus-card__skin">
                <RewardArt reward={reward} size={36} />
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </figure>
  )
}

export function PlusPage() {
  const { isPlus, signedIn, loading } = useAuth()
  const yourName = normalizePlayerName(usePlayerName())
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
  const today = boardDay()
  // Founding Member, while the months that give it last: a free week has to start a week sooner, as looks come with the first payment.
  const founder = today <= FOUNDER_UNTIL
  const founderBy = freeWeek ? daysBefore(FOUNDER_UNTIL, trialDays) : FOUNDER_UNTIL
  const headliners = season && pass ? headlinersOf(season, pass) : []
  const skinCount = pass ? pass.rewards.filter((r) => r.kind === 'skin').length : 0
  // The looks to come, a month at a time; an older API sends this month's alone.
  const thisMonth = Number(today.slice(0, 4)) * 100 + Number(today.slice(5, 7))
  const looks: (MembersLook & { month: number })[] = info?.ahead ?? (info?.looks ?? []).slice(0, 1).map((look) => ({ ...look, month: thisMonth }))
  const days = archiveDays(today)

  const after = freeWeek
    ? `Free for ${trialDays} days, then ${price} a ${unit}.`
    : byYear
      ? `About ${money(Math.round(yearly / 12), currency)} a month.`
      : season
        ? `About ${perSeason(monthly, season, currency)} a season, with every season’s Pass+ in it.`
        : ''

  const join = !signedIn ? (
    <button type="button" className="plus-btn plus-btn--go" onClick={openSiteMenu} disabled={loading}>
      {freeWeek ? 'Sign in to start a free week' : 'Sign in to join'}
    </button>
  ) : info?.buyable ? (
    <button type="button" className="plus-btn plus-btn--go" disabled={busy} onClick={() => void go(() => startPlusMembership(every))}>
      {busy ? 'Opening…' : freeWeek ? 'Start your free week' : 'Join Plus'}
    </button>
  ) : (
    <button type="button" className="plus-btn" disabled>
      On sale soon
    </button>
  )

  const fine = (
    <p className="plus-fine">
      Renews automatically every {unit} until you cancel, which you can do here any time. By joining you agree to the{' '}
      <a href={termsHref()}>Terms</a>.
    </p>
  )

  const cardLine = member
    ? onFreeWeek && you?.renewsAt
      ? { small: 'Free week until', big: day(you.renewsAt) }
      : you?.renewsAt
        ? { small: you.cancelsAtEnd ? 'Ends on' : 'Renews on', big: day(you.renewsAt) }
        : { small: 'Member of', big: `${APP_NAME} Plus` }
    : season
      ? { small: 'Comes with', big: `${season.name} Pass+` }
      : { small: 'Comes with', big: 'Every past daily' }

  return (
    <PageShell innerClassName="lb-page__inner">
      <div className="plus">
        <section className="plus-hero" aria-labelledby="plus-title">
          <div className="plus-hero__text">
            <nav className="plus-crumb" aria-label="Breadcrumb">
              <a href={homeHref()}>Home</a>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Plus</span>
            </nav>
            <p className="plus-kicker">
              <PlusGlyph size="1.6rem" />
              {APP_NAME} Plus
            </p>
            <h1 className="plus-hero__title" id="plus-title">
              Every past daily.
              <br />
              Every season’s Pass+.
            </h1>
            <p className="plus-hero__blurb">
              Playing stays free for everyone. Plus opens the archive, gives you each season’s Pass+ and a members’ look every
              month, and lets you play new games early and host bigger events.
            </p>
            {member ? (
              <div className="plus-have">
                <span className="plus-have__tag">{onFreeWeek ? 'Your free week of Plus' : 'You’re on Plus'}</span>
                {you?.renewsAt ? (
                  <span className="plus-have__line">
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
                  <button type="button" className="plus-btn plus-btn--go" disabled={busy} onClick={() => void go(managePlusMembership)}>
                    {busy ? 'Opening…' : 'Manage or cancel'}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="plus-buy">
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
                  <span className="plus-price">
                    <strong>{price}</strong>
                    <span>/{unit}</span>
                  </span>
                </div>
                <div className="plus-go">
                  {join}
                  <span className="plus-go__after">
                    {after ? `${after} ` : ''}Cancel any time; what you’ve won stays yours.
                  </span>
                </div>
                {founder ? <p className="plus-hero__founder">Join by {dayWords(founderBy)} and the Founding Member title is yours for good.</p> : null}
                {fine}
              </>
            )}
          </div>
          <div className="plus-hero__card">
            <MemberCard name={yourName || 'YOUR TAG'} member={member} founder={founder} line={cardLine} skins={headliners} />
          </div>
        </section>

        {note ? (
          <p className={note.ok ? 'plus-note' : 'plus-note plus-note--bad'} role="status">
            {note.text}
          </p>
        ) : null}

        <section className="plus-adds" aria-labelledby="plus-adds-title">
          <div className="plus-head">
            <h2 className="plus-head__title" id="plus-adds-title">
              {member ? 'What Plus gives you' : 'What Plus adds'}
            </h2>
          </div>
          <div className="plus-perks">
            <Perk
              title="Every past daily"
              show={
                <div className="plus-days">
                  <div className="plus-days__grid">
                    {days.plus.map((d) => (
                      <span key={d} className="plus-day plus-day--plus">
                        {Number(d.slice(8, 10))}
                      </span>
                    ))}
                    {days.free.map((d) => (
                      <span key={d} className="plus-day plus-day--free">
                        {Number(d.slice(8, 10))}
                      </span>
                    ))}
                  </div>
                  <div className="plus-days__key">
                    <span className="plus-days__key-plus">Outlined: with Plus</span>
                    <span className="plus-days__key-free">Filled: free, the last {OPEN_DAYS} days</span>
                  </div>
                </div>
              }
            >
              The last {OPEN_DAYS} days of every daily are free. Plus opens every day before that, back to each game’s first. Past
              days are practice: they never count toward your rank.
            </Perk>

            <Perk
              title="Every season’s Pass+"
              show={
                headliners.length === 3 ? (
                  <div className="plus-heads">
                    {headliners.map((reward) => (
                      <span key={reward.id} className="plus-heads__one">
                        <RewardArt reward={reward} size={84} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="plus-passplus">Pass+</span>
                )
              }
            >
              {season && pass ? (
                <>
                  {season.name}’s Pass+ row has {pass.rewards.length} rewards, {skinCount} of them skins
                  {pass.bonus ? `, and ${pass.bonus} bonus levels past ${season.levels}` : ''}. Every season after it comes with Plus too.{' '}
                  <a href={seasonHref()}>See the whole pass ›</a>
                </>
              ) : (
                'Each season’s Pass+ row of skins and looks, for every season while you’re a member.'
              )}
            </Perk>

            <Perk
              title="A members’ look every month"
              show={
                <div className="plus-looks">
                  {(looks.length ? looks.slice(0, 4) : [null, null, null, null]).map((look, i) =>
                    look ? (
                      <span key={`${look.month}-${look.id}`} className="plus-looks__one">
                        <span className="plus-looks__when">
                          {monthShort(look.month)} · {look.what}
                        </span>
                        <span className="plus-looks__art">
                          <RewardArt reward={{ kind: 'prize', id: look.id, name: look.name }} size={34} />
                        </span>
                        <span className="plus-looks__name">{look.name}</span>
                      </span>
                    ) : (
                      <span key={i} className="plus-looks__one" />
                    ),
                  )}
                </div>
              }
            >
              A title, a name style, a card theme or confetti. Every member gets that month’s look and keeps it for good. It’s never
              sold on its own.
            </Perk>

            <Perk
              title="New games a week early"
              show={
                <div className="plus-early">
                  <div className="plus-early__bar">
                    <span className="plus-early__plus" />
                    <span className="plus-early__all" />
                  </div>
                  <div className="plus-early__labels">
                    <span className="plus-early__label-plus">Plus plays it</span>
                    <span className="plus-early__label-all">Launch day: everyone</span>
                  </div>
                  <span className="plus-early__note">7 days early. Runs are practice until the boards open.</span>
                </div>
              }
            >
              When a new game is coming, members play it the week before it launches. Boards open for everyone on launch day.
            </Perk>

            <Perk
              title="Room to host"
              show={
                <div className="plus-host">
                  <span className="plus-host__one">
                    <b>{PLUS_LIMITS.maxDraw}</b>
                    <span>players in an event</span>
                    <small>Free: {FREE_LIMITS.maxDraw}</small>
                  </span>
                  <span className="plus-host__one">
                    <b>{PLUS_LIMITS.activeEvents}</b>
                    <span>events at once</span>
                    <small>Free: {FREE_LIMITS.activeEvents}</small>
                  </span>
                  <span className="plus-host__one">
                    <b>{PLUS_LIMITS.groupMembers}</b>
                    <span>players in a group</span>
                    <small>Free: {FREE_LIMITS.groupMembers}</small>
                  </span>
                </div>
              }
            >
              Up to {PLUS_LIMITS.groups} groups, double elimination and a different game each round. Joining is always free, whoever is
              hosting.
            </Perk>

            <Perk
              title="The Plus mark"
              show={
                <div className="plus-row">
                  <span className="plus-row__place">1</span>
                  <span className="plus-row__name">
                    {yourName || 'YOU'}
                    <PlusGlyph size="1.05rem" />
                  </span>
                  <span className="plus-row__note">On every board</span>
                </div>
              }
            >
              A small mark beside your name on the boards, so people can see you’re a member. It shows once your first payment goes
              through.
            </Perk>
          </div>
        </section>

        <section className="plus-free" aria-labelledby="plus-free-title">
          <h2 className="plus-head__title" id="plus-free-title">
            Free for everyone, always
          </h2>
          <ul className="plus-free__list">
            {ALWAYS_FREE.map((thing) => (
              <li key={thing}>{thing}</li>
            ))}
          </ul>
          <p className="plus-free__line">Nothing that is free today will move behind Plus later, and Plus never buys a place on a board.</p>
        </section>

        <section className="plus-faq" aria-labelledby="plus-faq-title">
          <h2 className="plus-head__title" id="plus-faq-title">
            Questions
          </h2>
          <div className="plus-faq__grid">
            <div className="plus-faq__one">
              <h3>What happens after the free week?</h3>
              <p>
                Your first payment, and with it this season’s Pass+ and the month’s look. Cancel before the week ends and you pay
                nothing.
              </p>
            </div>
            <div className="plus-faq__one">
              <h3>Can I cancel?</h3>
              <p>Any time, from this page. Plus runs to the end of what you’ve paid for, and what you’ve won stays yours.</p>
            </div>
            <div className="plus-faq__one">
              <h3>Does Plus help my rank?</h3>
              <p>No. Archive days and early games are practice, and every board is the same for everyone.</p>
            </div>
            {season && pass ? (
              <div className="plus-faq__one">
                <h3>Just want this season’s Pass+?</h3>
                <p>
                  It’s {plusPrice(pass)} once for the whole season ({seasonWeeks(season)} weeks) on the{' '}
                  <a href={seasonHref()}>Season page</a>, no membership.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {!member ? (
          <>
            <section className="plus-close" aria-label="Join Plus">
              <div className="plus-close__text">
                <PlusGlyph size="2.75rem" />
                <div>
                  <b className="plus-close__title">{freeWeek ? 'Try Plus free for a week' : 'Join Plus'}</b>
                  <span className="plus-close__line">
                    {after ? `${after} ` : ''}
                    {freeWeek ? 'Cancel before then and you pay nothing.' : 'Cancel any time.'}
                  </span>
                </div>
              </div>
              {join}
            </section>
            {fine}
          </>
        ) : null}
      </div>
    </PageShell>
  )
}
