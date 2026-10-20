import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PlayerName } from '../components/PlayerName'
import { ReportConfetti } from '../components/RunReport'
import { HangarBays } from '../components/prizes/HangarBays'
import { PrizeActions } from '../components/prizes/PrizeActions'
import { LedCounter, PrizeArt } from '../components/prizes/PrizeArt'
import { PlayerCardMini, PrizePanel } from '../components/prizes/PrizePanel'
import { TicketGlyph } from '../components/prizes/Ticket'
import { openSiteMenu } from '../components/siteNav'
import { FOR_SALE, PRIZE_KINDS, PRIZES, prizeById, TICKETS_A_DAY, type Prize, type PrizeKind } from '../data/prizes'
import { ticketsHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { useMyAvatarId } from '../hooks/useMyAvatarId'
import { usePlayerName } from '../hooks/usePlayerName'
import { isWearing, resolveAvatar, wearPrize, wornPrize, type Avatar } from '../lib/avatars'
import { moveChoice } from '../lib/choiceKeys'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { prizeGlow } from '../lib/prizeArt'
import { useSeason } from '../lib/season'
import { HANGAR_SKINS } from '../lib/skins'
import { useTickets } from '../lib/tickets'
import '../styles/counter.css'
import '../styles/fitting.css'

/**
 * The prize counter, as a fitting room: you on one side, your player card and your row on a board, and on the
 * other a tab for each place a prize goes. Pick one and you're wearing it there before you trade for it. On a
 * phone, a pick opens the prize's own sheet instead, which tries it on the same way. Nothing here changes a
 * score, and tickets can't be bought. Titles aren't here: they're earned (a season, a streak), never traded for.
 * Nor are signs: the player card has none any more (2026-10-20).
 */

/** What pays, along the hero's foot. The day's event pays only while the arcade's own events run. */
const EARN: { icon: string; amount: string; what: string; event?: boolean }[] = [
  { icon: 'play', amount: '1–15', what: 'every saved run, by its score' },
  { icon: 'up', amount: '+5', what: 'a new best' },
  { icon: 'calendar', amount: '+10', what: 'today’s event', event: true },
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

type Slot = Exclude<PrizeKind, 'title' | 'sign'> | 'skin'

/** The fitting room's tabs: each a place a prize goes, and what it looks like there. */
const SLOTS: { id: Slot; where: string }[] = [
  { id: 'finish', where: 'The circle by your tag, on every board you’re on.' },
  { id: 'name', where: 'How your tag is written on the boards.' },
  { id: 'card', where: 'Behind your player card.' },
  { id: 'confetti', where: 'Goes up when you top a board or win an event.' },
  { id: 'skin', where: 'Your ship, car or snake in its game. Your ghost and your row on the boards wear it too.' },
]

function slotLabel(slot: Slot): string {
  return slot === 'skin' ? 'Skins' : PRIZE_KINDS[slot].many
}

/** The kinds the "wearing" list goes through, in the order they sit on you. */
const WEAR_ROWS: PrizeKind[] = ['finish', 'name', 'title', 'card', 'confetti', 'sign']

function daysOfPlay(tickets: number) {
  const days = Math.max(1, Math.ceil(tickets / TICKETS_A_DAY))
  return days === 1 ? 'about a day of play' : `about ${days} days of play`
}

/** Phones and narrow windows: a pick opens the prize's sheet, since the fitting room's "you" is out of sight. */
function useNarrow(): boolean {
  const query = '(max-width: 899px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

/** What you have on of a kind, by name: a finish is the badge itself, the rest are worn. */
function wornOf(avatar: Avatar, kind: PrizeKind): Prize | null {
  if (kind === 'finish') return prizeById(avatar.badge)
  return prizeById(wornPrize(avatar, kind))
}

export function PrizeCounterPage() {
  const { signedIn, signedOut } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const tickets = useTickets()
  const standing = useGlobalRank()
  const season = useSeason().season
  const avatarId = useMyAvatarId(name)
  const avatar = useMemo(() => resolveAvatar(avatarId, name || 'YOU'), [avatarId, name])
  const tag = name || 'YOU'
  const owned = useMemo(() => new Set(tickets.owned), [tickets.owned])
  const narrow = useNarrow()
  // Sent here for a skin, from its card on a board or a game's skin picker: the Skins tab, its bay lit.
  const [slot, setSlot] = useState<Slot>(() => (typeof window !== 'undefined' && window.location.hash.startsWith('#hangar') ? 'skin' : 'finish'))
  const [tryingId, setTryingId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [burst, setBurst] = useState(0)
  const goal = prizeById(tickets.goal)
  const balance = signedIn ? tickets.balance : 0
  // The arcade's own events can be paused (/admin, Site events): then there's no day's event to pay for.
  const { official } = useLiveEvents('')
  const eventOn = official.some((t) => t.cadence === 'daily')
  const event = eventOn ? 'today’s event, ' : ''

  const trying = prizeById(tryingId)
  const shown = trying ? wearPrize(avatar, trying.kind, trying.id) : avatar

  const counts = useMemo(() => {
    const out: Partial<Record<Slot, number>> = { skin: HANGAR_SKINS.length }
    for (const p of FOR_SALE) if (p.kind !== 'title' && p.kind !== 'sign') out[p.kind] = (out[p.kind] ?? 0) + 1
    return out
  }, [])

  const pick = (p: Prize) => {
    if (narrow) {
      setOpenId(p.id)
      return
    }
    const again = tryingId === p.id
    setTryingId(again ? null : p.id)
    if (!again && p.kind === 'confetti') setBurst((b) => b + 1)
  }

  // The prize you're saving for: its tab, and on a wide screen it's on you.
  const showGoal = () => {
    if (!goal) return
    if (goal.kind !== 'title' && goal.kind !== 'sign') setSlot(goal.kind)
    pick(goal)
  }

  const forSale = slot === 'skin' ? [] : FOR_SALE.filter((p) => p.kind === slot).sort((a, b) => a.price - b.price)
  // Earned, never traded for: yours ones, the streaks', and what this season's pass gives. Later seasons' stay a surprise.
  const seasonMark = season ? `Season ${season.id}’s` : null
  const earned =
    slot === 'skin'
      ? []
      : PRIZES.filter(
          (p) =>
            p.kind === slot &&
            p.earned &&
            (owned.has(p.id) || /streak/.test(p.earned.by) || (seasonMark != null && p.earned.by.startsWith(seasonMark))),
        )

  const tagFor = (p: Prize) => {
    if (owned.has(p.id)) {
      return (
        <span className="counter-stamp">
          <Icon name="check" size={14} />
          {isWearing(avatar, p.id) ? 'Wearing' : 'Yours'}
        </span>
      )
    }
    if (p.earned) return <span className="fit-tile__earned">{p.earned.short}</span>
    const short = signedIn && p.price > balance
    return (
      <span className={`counter-tag fit-tile__tag${goal?.id === p.id ? ' counter-tag--goal' : short ? ' counter-tag--short' : ''}`}>
        <TicketGlyph size={16} />
        {p.price.toLocaleString()}
      </span>
    )
  }

  const tile = (p: Prize) => {
    const mine = owned.has(p.id)
    return (
      <li key={p.id} className="fit-tile-wrap">
        <button
          type="button"
          className={`fit-tile${p.earned && !mine ? ' fit-tile--earned' : ''}`}
          aria-pressed={!narrow && tryingId === p.id}
          onClick={() => pick(p)}
          aria-label={`${p.name}. ${mine ? (isWearing(avatar, p.id) ? 'Yours, and you’re wearing it' : 'Yours') : p.earned ? p.earned.by : `${p.price.toLocaleString()} tickets`}. Try it on`}
        >
          {goal?.id === p.id && !mine ? (
            <span className="counter-ribbon">
              <Icon name="star" size={12} />
              Saving for
            </span>
          ) : null}
          <span className="fit-tile__stage">
            <span className="counter-item__spot" style={{ '--spot': prizeGlow(p, avatar) } as CSSProperties} />
            <PrizeArt className="fit-tile__art" prize={p} avatar={avatar} name={tag} width={slot === 'card' ? 190 : 130} />
          </span>
          <span className="fit-tile__name">{p.name}</span>
          {tagFor(p)}
        </button>
      </li>
    )
  }

  const open = prizeById(openId)

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
              Try it on.
              <br />
              <em>Trade for it.</em>
            </h1>
            <p className="counter-lede">
              Every game you play pays out tickets. Trade them here for looks that show on the boards: avatars, name styles, backgrounds,
              confetti and skins. Pick one and you’re wearing it before you trade. Earned by playing, never bought.
            </p>
          </div>
          <div className="counter-hero__mine">
            {signedIn ? (
              <>
                <div className="counter-led">
                  <LedCounter value={balance} width={200} />
                  <span className="counter-led__side">
                    <span className="counter-led__label">Tickets</span>
                    {tickets.today.earned > 0 ? <span className="counter-led__today">+{tickets.today.earned.toLocaleString()} today</span> : null}
                    <a className="counter-led__history" href={ticketsHref()}>
                      How you earned them ›
                    </a>
                  </span>
                </div>
                {goal ? (
                  <button type="button" className="counter-goal" onClick={showGoal}>
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
                    <span>Try something on and save for it: every run shows how close you are.</span>
                  </p>
                )}
              </>
            ) : signedOut ? (
              <>
                <button type="button" className="counter-signin" onClick={openSiteMenu}>
                  Sign in to collect tickets
                </button>
                <span className="counter-signin__note">Playing is free. Tickets are kept on your account, with your scores.</span>
              </>
            ) : (
              // A session whose account isn't known yet: the room your tickets and your goal take, and no Sign in.
              <>
                <span className="counter-led skel-btn" aria-hidden="true" />
                <span className="counter-goal skel-btn" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
        <ul className="counter-band" aria-label="What pays tickets">
          {EARN.filter((e) => eventOn || !e.event).map((e) => (
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

      <div className="fit">
        <aside className="fit-you" aria-label={trying ? `You, trying on ${trying.name}` : 'You, as you are'}>
          <span className="fit-you__cap">{trying ? 'Trying on' : 'You, wearing it'}</span>
          <div className="fit-you__card">
            <PlayerCardMini avatar={shown} name={tag} line={standing.rank != null ? `#${standing.rank} in the standings` : undefined} />
          </div>
          <div className="fit-row">
            <span className="fit-row__cap">On a board</span>
            <div className="fit-row__me">
              <span className="fit-row__rank">{standing.rank ?? '–'}</span>
              <PlayerAvatar avatar={shown} name={tag} size="md" />
              <PlayerName className="fit-row__name" name={tag} style={wornPrize(shown, 'name')} />
            </div>
          </div>

          {trying ? (
            <div className="fit-try" key={trying.id}>
              <div className="fit-try__head">
                <span className="fit-try__kind">{PRIZE_KINDS[trying.kind].one}</span>
                <b className="fit-try__name">{trying.name}</b>
                {owned.has(trying.id) || trying.earned || trying.retired ? null : (
                  <span className="counter-tag fit-tile__tag">
                    <TicketGlyph size={16} />
                    {trying.price.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="fit-try__blurb">{trying.blurb}</p>
              {trying.kind === 'confetti' ? (
                <button type="button" className="fit-try__burst" onClick={() => setBurst((b) => b + 1)}>
                  Let it go again
                </button>
              ) : null}
              <PrizeActions
                prize={trying}
                avatar={avatar}
                name={name}
                onTraded={trying.kind === 'confetti' ? () => setBurst((b) => b + 1) : undefined}
                fallback={
                  <button type="button" className="panel__btn panel__btn--ghost" onClick={() => setTryingId(null)}>
                    Put it back
                  </button>
                }
              />
            </div>
          ) : (
            <p className="fit-you__hint">Pick anything to try it on. Nothing changes for anyone else until it’s yours and you put it on.</p>
          )}

          <dl className="fit-wear">
            {WEAR_ROWS.map((kind) => {
              const now = wornOf(avatar, kind)
              const next = trying?.kind === kind && trying.id !== now?.id ? trying : null
              // A title or a sign only shows when you have one on: titles are earned, and signs are retired.
              if ((kind === 'title' || kind === 'sign') && !now && !next) return null
              return (
                <div key={kind} className="fit-wear__row">
                  <dt>{PRIZE_KINDS[kind].one}</dt>
                  <dd>
                    {now ? now.name : <span className="fit-wear__none">None</span>}
                    {next ? <span className="fit-wear__next"> → {next.name}</span> : null}
                  </dd>
                </div>
              )
            })}
          </dl>
        </aside>

        <section className="fit-shop" aria-label="Prizes">
          <div className="fit-tabs" role="tablist" aria-label="Where it goes" onKeyDown={moveChoice}>
            {SLOTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`fit-tab-${s.id}`}
                aria-controls="fit-panel"
                aria-selected={slot === s.id}
                tabIndex={slot === s.id ? 0 : -1}
                className="fit-tab"
                onClick={() => setSlot(s.id)}
              >
                {slotLabel(s.id)}
                <span>{counts[s.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="fit-panel" id="fit-panel" role="tabpanel" aria-labelledby={`fit-tab-${slot}`}>
            <div className="fit-panel__head">
              <h2 className="fit-panel__title">{slotLabel(slot)}</h2>
              <p className="fit-panel__where">{SLOTS.find((s) => s.id === slot)?.where}</p>
            </div>
            {slot === 'skin' ? (
              <HangarBays />
            ) : (
              <>
                <ul className={`fit-grid fit-grid--${slot}`}>{forSale.map(tile)}</ul>
                {earned.length ? (
                  <div className="fit-earned">
                    <h3 className="fit-earned__title">Earned, never traded for</h3>
                    <ul className={`fit-grid fit-grid--${slot} fit-grid--earned`}>{earned.map(tile)}</ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="counter-rules" id="how-tickets-work" aria-label="How tickets work">
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="hand" />
            Earned, never bought
          </span>
          <p>Tickets come from saved runs, {event}day streaks and the bug hunt. There’s no way to buy them.</p>
        </div>
        <div className="counter-rule">
          <span className="counter-rule__t">
            <Icon name="sparkle" />
            Looks, never score
          </span>
          <p>A prize changes how you look, never a score or a place. Rings, pins and titles still only come from playing well.</p>
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
          {/* The API's tickets.ts and ticketLadders.ts: said of the dailies as a kind, never by name, as they come and go. */}
          <p>
            A run pays by the score it reaches, like an arcade machine: 1 ticket, then 3, 5, 7 and 10 at the scores each game’s How to play
            shows. A new best pays 5 more, and Crosswalk one for each ticket picked up. A daily pays your best of the day once instead, up to 15,
            and the ranked dailies’ top three each day get 10, 6 and 3 more after midnight. Runs pay up to 200 tickets a day, bests and pickups
            included. A first go at a game, a day on a streak, {event}the day’s bug, a top-three day, taking a past course’s record and a Dailies
            streak milestone still pay after that.
          </p>
        </div>
      </section>

      {burst ? (
        <div className="fit-burst" aria-hidden="true">
          <ReportConfetti key={burst} accent="#ff8552" kind={trying?.kind === 'confetti' ? trying.id : null} />
        </div>
      ) : null}

      {open ? <PrizePanel prize={open} avatar={avatar} name={name} onPick={setOpenId} onClose={() => setOpenId(null)} /> : null}
    </PageShell>
  )
}
