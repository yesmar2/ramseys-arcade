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
import { listFriends } from '../lib/friends'
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
  type PlusInfo,
  type PlusInterval,
} from '../lib/plus'
import { boardDay } from '../lib/rankHow'
import { headlinersOf, liveSeason, plusPrice, useSeason } from '../lib/season'
import '../styles/plus.css'

/**
 * Plus, the Dailies + Seasons membership (Ramsey's pick, 2026-10-04): every past day of every daily, every
 * season's Gold Pass, a members' look each month, any ghost to race, new games a week before launch, and room
 * to host.
 *
 * Laid out as B of the "Plus page, clearer" canvas with C's name (Ramsey, 2026-10-11: "do what you think is
 * best… it should make sense, not repeat stuff"): the season pass's paid row is the Gold Pass now, not "Pass+",
 * a name two letters from Plus. A short top with a member card that has your tag on it, then one chart of
 * Free, the Gold Pass on its own, and Plus, where each thing is said once, then three questions. Everything
 * about playing stays free, and the chart's first column says so. Nor are places sold: archive days, early
 * games and ghosts are practice, on no board.
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

/** The member card: your own tag with the mark, as a member's would read. */
function MemberCard({ name, member, founder, line }: { name: string; member: boolean; founder: boolean; line: { small: string; big: string } }) {
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
      <span className="plus-card__line">
        {line.small}
        <b>{line.big}</b>
      </span>
    </figure>
  )
}

/** A friend of yours, by tag, for the chart's ghost row; null signed out, or with none. */
function useAFriend(ask: boolean): string | null {
  const [friend, setFriend] = useState<string | null>(null)
  useEffect(() => {
    if (!ask) {
      setFriend(null)
      return
    }
    let live = true
    listFriends()
      .then((f) => {
        if (live) setFriend(f.friends[0]?.name ?? null)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [ask])
  return friend
}

type Plan = 'free' | 'gold' | 'plus'

/** One line of the chart: what it is, a few words more, and what each plan has of it. */
type Row = { label: ReactNode; sub?: ReactNode; has: Record<Plan, boolean | ReactNode> }
type Group = { title: string; tone: 'teal' | 'gold' | 'plain'; rows: Row[] }

function Yes({ plus = false }: { plus?: boolean }) {
  return (
    <svg className={`plus-cmp__yes${plus ? ' plus-cmp__yes--plus' : ''}`} viewBox="0 0 24 24" role="img" aria-label="Included">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  )
}

function No() {
  return (
    <svg className="plus-cmp__no" viewBox="0 0 24 24" role="img" aria-label="Not included">
      <path d="M7 12h10" />
    </svg>
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
                  text: 'Welcome to Plus. Your free week has started: every past daily is open now. This season’s Gold Pass and the month’s look come with your first payment.',
                }
              : { ok: true, text: 'Welcome to Plus. Every past daily is open, and this season’s Gold Pass is yours: what your level has reached is in your hangar and Prizes now.' },
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
  const friend = useAFriend(signedIn && !member)

  // The season's Gold Pass, when a season is on: its own column, sold once for the season.
  const gold = season && pass ? { season, pass } : null
  const headliners = gold ? headlinersOf(gold.season, gold.pass) : []
  const goldRewards = gold?.pass.rewards ?? []
  const goldSkins = goldRewards.filter((r) => r.kind === 'skin').length
  const yourLevel = seasonStore.you?.level ?? 0
  const reached = goldRewards.filter((r) => r.level <= yourLevel).length
  const goldBought = Boolean(gold?.pass.owned && gold.pass.via !== 'plus')
  const plans: Plan[] = gold ? ['free', 'gold', 'plus'] : ['free', 'plus']

  const after = freeWeek
    ? `Free for ${trialDays} days, then ${price} a ${unit}.`
    : byYear
      ? `About ${money(Math.round(yearly / 12), currency)} a month.`
      : season
        ? `About ${perSeason(monthly, season, currency)} a season, with every season’s Gold Pass in it.`
        : ''

  const join = (small = false) =>
    !signedIn ? (
      <button type="button" className={`plus-btn plus-btn--go${small ? ' plus-btn--small' : ''}`} onClick={openSiteMenu} disabled={loading}>
        {freeWeek ? 'Sign in to start a free week' : 'Sign in to join'}
      </button>
    ) : info?.buyable ? (
      <button
        type="button"
        className={`plus-btn plus-btn--go${small ? ' plus-btn--small' : ''}`}
        disabled={busy}
        onClick={() => void go(() => startPlusMembership(every))}
      >
        {busy ? 'Opening…' : freeWeek ? 'Start your free week' : 'Join Plus'}
      </button>
    ) : (
      <button type="button" className={`plus-btn${small ? ' plus-btn--small' : ''}`} disabled>
        On sale soon
      </button>
    )

  const cardLine = member
    ? onFreeWeek && you?.renewsAt
      ? { small: 'Free week until', big: day(you.renewsAt) }
      : you?.renewsAt
        ? { small: you.cancelsAtEnd ? 'Ends on' : 'Renews on', big: day(you.renewsAt) }
        : { small: 'Member of', big: `${APP_NAME} Plus` }
    : { small: 'Member since', big: 'Today' }

  const groups: Group[] = [
    {
      title: 'Playing',
      tone: 'teal',
      rows: [
        { label: 'Every game, board, record book and event to join', has: { free: true, gold: true, plus: true } },
        { label: 'Standings, trophies, friends and your stats', has: { free: true, gold: true, plus: true } },
        { label: `Today’s dailies, and the last ${OPEN_DAYS} days of each`, has: { free: true, gold: true, plus: true } },
        {
          label: 'Race the #1 and your next place up',
          sub: 'As ghosts, on a racing daily’s board',
          has: { free: true, gold: true, plus: true },
        },
        {
          label: 'Every older daily',
          sub: 'Back to each game’s first. Practice: it never counts toward your rank.',
          has: { free: false, gold: false, plus: true },
        },
        {
          label: (
            <>
              Race anyone’s ghost <span className="plus-cmp__new">New</span>
            </>
          ),
          sub: friend ? `Your friend ${friend}’s, the place above you, anyone on the board` : 'A friend’s, the place above you, anyone on the board',
          has: { free: false, gold: false, plus: true },
        },
        { label: 'New games a week early', sub: 'Practice until the boards open on launch day', has: { free: false, gold: false, plus: true } },
      ],
    },
    {
      title: 'The season pass',
      tone: 'gold',
      rows: gold
        ? [
            {
              label: 'The free row',
              sub: `${gold.season.levels} levels of rewards for everyone who plays`,
              has: { free: true, gold: true, plus: true },
            },
            {
              label: 'The Gold row',
              sub: (
                <>
                  {goldRewards.length} more rewards, {goldSkins} of them skins
                  {gold.pass.bonus ? `, and ${gold.pass.bonus} bonus levels` : ''}.
                  {signedIn && !member && !goldBought && reached > 0 ? (
                    <b className="plus-cmp__you"> You’re level {yourLevel}: {reached} of them are reached already.</b>
                  ) : null}
                </>
              ),
              has: { free: false, gold: <span className="plus-cmp__val">This season</span>, plus: <span className="plus-cmp__val plus-cmp__val--plus">Every season</span> },
            },
          ]
        : [
            {
              label: 'Every season’s Gold Pass',
              sub: 'The paid row of each season’s pass, while a season is on',
              has: { free: false, gold: false, plus: true },
            },
          ],
    },
    {
      title: 'Members only',
      tone: 'gold',
      rows: [
        {
          label: 'A new look every month',
          sub: 'A name style, a card theme or confetti, yours to keep',
          has: { free: false, gold: false, plus: true },
        },
        {
          label: (
            <>
              The Plus mark beside your name <PlusGlyph size="1rem" />
            </>
          ),
          has: { free: false, gold: false, plus: true },
        },
      ],
    },
    {
      title: 'Hosting',
      tone: 'plain',
      rows: [
        { label: 'Players in an event you host', has: { free: FREE_LIMITS.maxDraw, gold: FREE_LIMITS.maxDraw, plus: PLUS_LIMITS.maxDraw } },
        { label: 'Events you host at once', has: { free: FREE_LIMITS.activeEvents, gold: FREE_LIMITS.activeEvents, plus: PLUS_LIMITS.activeEvents } },
        { label: 'Groups you start', has: { free: FREE_LIMITS.groups, gold: FREE_LIMITS.groups, plus: PLUS_LIMITS.groups } },
        { label: 'Players in a group', has: { free: FREE_LIMITS.groupMembers, gold: FREE_LIMITS.groupMembers, plus: PLUS_LIMITS.groupMembers } },
        {
          label: 'Double elimination, a game each round, any past track',
          has: { free: false, gold: false, plus: true },
        },
      ],
    },
  ]

  const cell = (plan: Plan, value: boolean | ReactNode) =>
    value === true ? (
      <Yes plus={plan === 'plus'} />
    ) : value === false ? (
      <No />
    ) : typeof value === 'number' ? (
      <span className={plan === 'plus' ? 'plus-cmp__val plus-cmp__val--plus' : 'plus-cmp__val'}>{value}</span>
    ) : (
      value
    )

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
              One membership.
              <br />
              Every extra.
            </h1>
            <p className="plus-hero__blurb">
              Plus includes every season’s Gold Pass, every past daily and a few things only members get. Playing stays free for
              everyone.
            </p>
            {member ? (
              <div className="plus-have">
                <span className="plus-have__tag">{onFreeWeek ? 'Your free week of Plus' : 'You’re on Plus'}</span>
                {you?.renewsAt ? (
                  <span className="plus-have__line">
                    {onFreeWeek
                      ? you.cancelsAtEnd
                        ? `Your free week ends on ${day(you.renewsAt)}, and Plus with it. Nothing is charged.`
                        : `Your free week ends on ${day(you.renewsAt)}, with your first payment. This season’s Gold Pass and the month’s look come with it.`
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
                <div className="plus-go">
                  {join()}
                  <span className="plus-go__after">
                    {after ? `${after} ` : ''}Cancel any time; what you’ve won stays yours.
                  </span>
                </div>
                {founder ? <p className="plus-hero__founder">Join by {dayWords(founderBy)} and the Founding Member title is yours for good.</p> : null}
                <p className="plus-fine">
                  Renews automatically every {unit} until you cancel, which you can do here any time. By joining you agree to the{' '}
                  <a href={termsHref()}>Terms</a>.
                </p>
              </>
            )}
          </div>
          <div className="plus-hero__card">
            <MemberCard name={yourName || 'YOUR TAG'} member={member} founder={founder} line={cardLine} />
          </div>
        </section>

        {note ? (
          <p className={note.ok ? 'plus-note' : 'plus-note plus-note--bad'} role="status">
            {note.text}
          </p>
        ) : null}

        <section className="plus-compare" aria-labelledby="plus-compare-title">
          <div className="plus-head">
            <div className="plus-head__words">
              <h2 className="plus-head__title" id="plus-compare-title">
                {gold ? 'Free, the Gold Pass or Plus' : 'Free or Plus'}
              </h2>
              <p className="plus-head__line">
                {gold ? 'The Gold Pass is one season’s paid row. Plus includes it every season, and everything else here.' : 'Everything about playing is free. Plus adds the rest.'}
              </p>
            </div>
            {!member && yearly != null ? (
              <div className="plus-every" role="group" aria-label="How to pay for Plus">
                <button type="button" aria-pressed={!byYear} onClick={() => setEvery('month')}>
                  Monthly
                </button>
                <button type="button" aria-pressed={byYear} onClick={() => setEvery('year')}>
                  Yearly{saves > 0 ? <span className="plus-every__save">Save {saves}%</span> : null}
                </button>
              </div>
            ) : null}
          </div>

          <div className="plus-cmp__wrap">
            <table className={`plus-cmp plus-cmp--${plans.length}`}>
              <thead>
                <tr>
                  <th scope="col" className="plus-cmp__corner">
                    <span className="plus-cmp__corner-words">What you get</span>
                  </th>
                  <th scope="col" className="plus-cmp__plan">
                    <span className="plus-cmp__name">Free</span>
                    <span className="plus-cmp__art" aria-hidden="true" />
                    <span className="plus-cmp__price">
                      <strong>{money(0, currency).replace(/\.00$/, '')}</strong>
                    </span>
                    <span className="plus-cmp__what">Every game, every day</span>
                    {signedIn && !member ? <span className="plus-cmp__pill">You’re on Free</span> : null}
                  </th>
                  {gold ? (
                    <th scope="col" className="plus-cmp__plan">
                      <span className="plus-cmp__name">Gold Pass</span>
                      <span className="plus-cmp__art" aria-hidden="true">
                        {headliners.map((reward) => (
                          <span key={reward.id} className="plus-cmp__skin">
                            <RewardArt reward={reward} size={34} />
                          </span>
                        ))}
                      </span>
                      <span className="plus-cmp__price">
                        <strong>{plusPrice(gold.pass)}</strong> once
                      </span>
                      <span className="plus-cmp__what">
                        {gold.season.name} only, for its {seasonWeeks(gold.season)} weeks
                      </span>
                      {goldBought ? (
                        <span className="plus-cmp__pill">Yours this season</span>
                      ) : (
                        <a className="plus-cmp__link" href={seasonHref()}>
                          On the Season page ›
                        </a>
                      )}
                    </th>
                  ) : null}
                  <th scope="col" className="plus-cmp__plan plus-cmp__plan--plus">
                    <span className="plus-cmp__name plus-cmp__name--plus">
                      <PlusGlyph size="1.25rem" />
                      Plus
                    </span>
                    <span className="plus-cmp__art" aria-hidden="true" />
                    <span className="plus-cmp__price">
                      <strong>{price}</strong>/{unit}
                    </span>
                    <span className="plus-cmp__what">
                      {freeWeek && !member ? `First ${trialDays} days free` : byYear ? `About ${money(Math.round(yearly / 12), currency)} a month` : 'Cancel any time'}
                    </span>
                    {member ? <span className="plus-cmp__pill plus-cmp__pill--plus">You’re on Plus</span> : join(true)}
                  </th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.title}>
                  <tr className="plus-cmp__group">
                    <th scope="colgroup" colSpan={plans.length} className={`plus-cmp__group-name plus-cmp__group-name--${group.tone}`}>
                      {group.title}
                    </th>
                    <td className="plus-cmp__plus" />
                  </tr>
                  {group.rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row" className="plus-cmp__label">
                        <span className="plus-cmp__label-main">{row.label}</span>
                        {row.sub ? <span className="plus-cmp__sub">{row.sub}</span> : null}
                      </th>
                      {plans.map((plan) => (
                        <td key={plan} className={plan === 'plus' ? 'plus-cmp__cell plus-cmp__plus' : 'plus-cmp__cell'}>
                          {cell(plan, row.has[plan])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="plus-compare__line">Nothing free today will move behind Plus later, and Plus never buys a place on a board.</p>
        </section>

        <section className="plus-faq" aria-labelledby="plus-faq-title">
          <h2 className="plus-head__title" id="plus-faq-title">
            Questions
          </h2>
          <div className="plus-faq__grid">
            <div className="plus-faq__one">
              <h3>What happens after the free week?</h3>
              <p>
                Your first payment, and with it this season’s Gold Pass and the month’s look. Cancel before the week ends and you pay
                nothing.
              </p>
            </div>
            <div className="plus-faq__one">
              <h3>Can I cancel?</h3>
              <p>Any time, from this page. Plus runs to the end of what you’ve paid for, and what you’ve won stays yours.</p>
            </div>
            <div className="plus-faq__one">
              <h3>Does Plus help my rank?</h3>
              <p>No. Past days, early games and ghosts are practice, and every board is the same for everyone.</p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
