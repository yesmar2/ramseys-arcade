import { useMemo, useState, type CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { LedCounter, PrizeArt } from '../components/prizes/PrizeArt'
import { SignArt } from '../components/prizes/SignArt'
import { TicketGlyph } from '../components/prizes/Ticket'
import { PrizePanel } from '../components/prizes/PrizePanel'
import { openSiteMenu } from '../components/siteNav'
import { PRIZE_KINDS, PRIZES, prizeById, SHELVES, SIGNS, TICKETS_A_DAY, type Prize, type PrizeKind } from '../data/prizes'
import { useAuth } from '../hooks/useAuth'
import { useMyAvatarId } from '../hooks/useMyAvatarId'
import { usePlayerName } from '../hooks/usePlayerName'
import { isWearing, resolveAvatar } from '../lib/avatars'
import { prizeGlow } from '../lib/prizeArt'
import { normalizePlayerName } from '../lib/leaderboard'
import { useTickets } from '../lib/tickets'
import '../styles/counter.css'

/**
 * The prize counter: where tickets trade for looks. Every prize stands in the
 * case wearing your own badge or tag, with its price on a paper tag; the
 * signs, your tag in lights, hang on the wall above, dearest at the top. Pick
 * one to try it on and trade for it. Nothing here changes a score, and
 * tickets can't be bought.
 */

const EARN: { icon: string; amount: string; what: string }[] = [
  { icon: 'play', amount: '1–15', what: 'every saved run, by its score' },
  { icon: 'up', amount: '+5', what: 'a new best' },
  { icon: 'calendar', amount: '+10', what: 'the Daily' },
  { icon: 'flame', amount: '+5', what: 'a day on a streak' },
  { icon: 'bug', amount: '+15', what: 'the day’s bug' },
  { icon: 'pad', amount: '+20', what: 'a first go at a game' },
]

const ICONS: Record<string, string> = {
  play: 'M7 4.5l12 7.5-12 7.5z',
  up: 'M12 19V5M5 12l7-7 7 7',
  calendar: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM16 3v4M8 3v4M4 10h16',
  flame: 'M12 3c2.2 3 5.5 5 5.5 9.2A5.5 5.5 0 0 1 6.5 12.2c0-2.2 1.1-3.7 2.2-4.8.5 1.6 1.4 2.5 2.2 2.7-.3-2.3-.1-4.9 1.1-7.1z',
  bug: 'M12 7.5a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4zM12 7.5V5.5M9.2 4l1.6 2M14.8 4l-1.6 2M8 12H4.5M19.5 12H16M8 16H5.5M18.5 16H16',
  pad: 'M8 7.5h8a5 5 0 0 1 0 10H8a5 5 0 0 1 0-10zM8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01',
  check: 'M20 6L9 17l-5-5',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  hand: 'M12 21c-3.5 0-6-2.5-6-6v-4.5a1.5 1.5 0 0 1 3 0V13M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10.5V4.5a1.5 1.5 0 0 1 3 0v6M15 10.5V6.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6 6',
  sparkle: 'M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5zM18.5 15.5v4M16.5 17.5h4',
  clock: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  )
}

type Filter = 'all' | Exclude<PrizeKind, 'sign'>

const FILTERS: Filter[] = ['all', 'finish', 'name', 'card', 'confetti', 'title']

function daysOfPlay(tickets: number) {
  const days = Math.max(1, Math.ceil(tickets / TICKETS_A_DAY))
  return days === 1 ? 'about a day of play' : `about ${days} days of play`
}

export function PrizeCounterPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const tickets = useTickets()
  const avatarId = useMyAvatarId(name)
  const avatar = useMemo(() => resolveAvatar(avatarId, name || 'YOU'), [avatarId, name])
  const tag = name || 'YOU'
  const owned = useMemo(() => new Set(tickets.owned), [tickets.owned])
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const goal = prizeById(tickets.goal)
  const balance = signedIn ? tickets.balance : 0
  const shown = PRIZES.filter((p) => p.kind !== 'sign' && (filter === 'all' || p.kind === filter))
  const ownedCount = PRIZES.filter((p) => owned.has(p.id)).length

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: 0 }
    for (const p of PRIZES) {
      if (p.kind === 'sign') continue
      out.all = (out.all ?? 0) + 1
      out[p.kind] = (out[p.kind] ?? 0) + 1
    }
    return out
  }, [])

  const tagFor = (p: Prize) => {
    if (owned.has(p.id)) {
      return (
        <span className="counter-stamp">
          <Icon name="check" size={14} />
          {isWearing(avatar, p.id) ? 'Wearing' : 'Yours'}
        </span>
      )
    }
    const short = signedIn && p.price > balance
    return (
      <span className={`counter-tag${goal?.id === p.id ? ' counter-tag--goal' : short ? ' counter-tag--short' : ''}`}>
        <TicketGlyph size={17} />
        {p.price.toLocaleString()}
      </span>
    )
  }

  const item = (p: Prize) => {
    const mine = owned.has(p.id)
    const toGo = signedIn && !mine ? p.price - balance : 0
    return (
      <li key={p.id} className="counter-item">
        <button
          type="button"
          className="counter-item__btn"
          onClick={() => setOpenId(p.id)}
          aria-label={`${p.name}, ${PRIZE_KINDS[p.kind].one.toLowerCase()}. ${mine ? (isWearing(avatar, p.id) ? 'Yours, and you’re wearing it' : 'Yours') : `${p.price.toLocaleString()} tickets`}`}
        >
          <span className="counter-item__stage">
            {goal?.id === p.id && !mine ? (
              <span className="counter-ribbon">
                <Icon name="star" size={12} />
                Saving for
              </span>
            ) : null}
            <span className="counter-item__spot" style={{ '--spot': prizeGlow(p, avatar) } as CSSProperties} />
            <PrizeArt className="counter-item__art" prize={p} avatar={avatar} name={tag} width={150} />
          </span>
          <span className="counter-item__plank" aria-hidden="true" />
          <span className={`counter-item__hang${mine ? ' counter-item__hang--yours' : ''}`}>{tagFor(p)}</span>
          <span className="counter-item__name">{p.name}</span>
          <span className="counter-item__kind">{PRIZE_KINDS[p.kind].one}</span>
          <span className="counter-item__note">{toGo > 0 ? `${toGo.toLocaleString()} to go` : ''}</span>
        </button>
      </li>
    )
  }

  const open = prizeById(openId)
  const wall = [...SIGNS].reverse()

  return (
    <PageShell innerClassName="lb-page__inner counter-page">
      <section className="counter-hero" aria-labelledby="counter-title">
        <div className="counter-hero__main">
          <div className="counter-hero__text">
            <span className="counter-eyebrow">
              <i />
              Prize counter
            </span>
            <h1 className="counter-title" id="counter-title">
              Play for tickets.
              <br />
              <em>Pick a prize.</em>
            </h1>
            <p className="counter-lede">
              Every game you play pays out tickets. Trade them here for looks that show on the boards: badge finishes, name styles, card themes, confetti,
              titles, and signs that put your tag in lights. Earned by playing, never bought.
            </p>
            {signedIn ? (
              <div className="counter-hero__row">
                <div className="counter-led">
                  <LedCounter value={balance} width={200} />
                  <span className="counter-led__side">
                    <span className="counter-led__label">Tickets</span>
                    {tickets.today.earned > 0 ? <span className="counter-led__today">+{tickets.today.earned.toLocaleString()} today</span> : null}
                  </span>
                </div>
                {goal ? (
                  <button type="button" className="counter-goal" onClick={() => setOpenId(goal.id)}>
                    <span className="counter-goal__top">
                      <PrizeArt prize={goal} avatar={avatar} name={tag} width={58} />
                      <span className="counter-goal__txt">
                        <span className="counter-goal__cap">Saving for</span>
                        <span className="counter-goal__name">
                          {goal.name} <span>· {PRIZE_KINDS[goal.kind].one.toLowerCase()}</span>
                        </span>
                      </span>
                    </span>
                    <span className="tix-meter" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, (100 * balance) / goal.price)}%` }} />
                    </span>
                    <span className="counter-goal__foot">
                      {goal.price > balance ? (
                        <>
                          <b>{(goal.price - balance).toLocaleString()} to go</b>
                          <span>{daysOfPlay(goal.price - balance)}</span>
                        </>
                      ) : (
                        <b>Enough to trade for it</b>
                      )}
                    </span>
                  </button>
                ) : (
                  <p className="counter-goal counter-goal--none">
                    <span className="counter-goal__cap">Saving for</span>
                    <span>Pick a prize and save for it: every run shows how close you are.</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="counter-hero__row">
                <button type="button" className="counter-signin" onClick={openSiteMenu} disabled={authLoading}>
                  Sign in to collect tickets
                </button>
                <span className="counter-signin__note">Playing is free. Tickets are kept on your account, with your scores.</span>
              </div>
            )}
          </div>
          <div className="counter-wall">
            <span className="counter-wall__cap">Top of the wall</span>
            <ul className="counter-wall__signs" aria-label="Signs">
              {wall.map((s) => {
                const mine = owned.has(s.id)
                const toGo = signedIn && !mine ? s.price - balance : 0
                return (
                  <li key={s.id} className="counter-wall__item">
                    <button
                      type="button"
                      className="counter-wall__sign"
                      onClick={() => setOpenId(s.id)}
                      aria-label={`${s.name}, sign. ${mine ? (isWearing(avatar, s.id) ? 'Yours, and you’re wearing it' : 'Yours') : `${s.price.toLocaleString()} tickets`}`}
                    >
                      <SignArt sign={s.id} name={tag} width={220} />
                    </button>
                    <div className="counter-wall__row">
                      <span className="counter-wall__name">{s.name}</span>
                      {mine ? (
                        <span className="counter-stamp">
                          <Icon name="check" size={14} />
                          {isWearing(avatar, s.id) ? 'Wearing' : 'Yours'}
                        </span>
                      ) : (
                        <span className={`counter-tag counter-tag--wall${goal?.id === s.id ? ' counter-tag--goal' : ''}`}>
                          <TicketGlyph size={15} />
                          {s.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {toGo > 0 ? <span className="counter-wall__note">{toGo.toLocaleString()} to go</span> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <ul className="counter-band" aria-label="What pays tickets">
          {EARN.map((e) => (
            <li key={e.what} className="counter-earn">
              <Icon name={e.icon} />
              <b>{e.amount}</b> {e.what}
            </li>
          ))}
          <li className="counter-band__more">
            <a href="#how-tickets-work">How tickets work ›</a>
          </li>
        </ul>
      </section>

      <div className="counter-head">
        <h2 className="counter-head__title">In the case</h2>
        <span className="counter-head__sub">
          {counts.all} prizes{signedIn && ownedCount ? ` · ${ownedCount} yours` : ''}
        </span>
        <div className="counter-chips" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="counter-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : PRIZE_KINDS[f].many}
              <span>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="counter-case">
        <span className="counter-case__glass" aria-hidden="true" />
        {SHELVES.map((shelf) => {
          const items = shown.filter(shelf.holds).sort((a, b) => b.price - a.price)
          if (!items.length) return null
          return (
            <section key={shelf.id} className={`counter-shelf counter-shelf--${shelf.id}`} aria-label={shelf.label}>
              <div className="counter-shelf__head">
                <h3 className="counter-shelf__label">{shelf.label}</h3>
                <span className="counter-shelf__range">{shelf.range}</span>
                <span className="counter-shelf__count">
                  {items.length} {items.length === 1 ? 'prize' : 'prizes'}
                </span>
              </div>
              <ul className="counter-shelf__items">{items.map(item)}</ul>
            </section>
          )
        })}
      </div>

      <section className="counter-rules" id="how-tickets-work" aria-label="How tickets work">
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="hand" />
            Earned, never bought
          </span>
          <p>Tickets come from saved runs, the Daily, day streaks and the bug hunt. There’s no way to buy them.</p>
        </div>
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="sparkle" />
            Looks, never score
          </span>
          <p>A prize changes how you look, never a score or a place. Rings and pins still only come from playing well.</p>
        </div>
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="check" />
            Yours for good
          </span>
          <p>Tickets don’t run out and prizes don’t go away. Put one on or take it off here, or in your avatar’s studio.</p>
        </div>
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="clock" />
            Fair pay
          </span>
          <p>
            A run pays by the score it reaches, like an arcade machine: 1 ticket, then 3, 5, 7 and 10 at the scores each game’s How to play
            shows. Today’s Hole and Today’s Track pay your best of the day once, up to 15, and each day’s top three get 10, 6 and 3 more after
            midnight. A new best pays 5 more, and Crosswalk one for each ticket picked up. Runs pay up to 200 a day; the rest comes on top.
          </p>
        </div>
      </section>

      {open ? (
        <PrizePanel
          prize={open}
          avatar={avatar}
          name={name}
          onPick={setOpenId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </PageShell>
  )
}
