import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { plateTier, prizeById } from '../data/prizes'
import { parseAvatar, wornPrize } from '../lib/avatars'
import { PlayerName } from './PlayerName'
import { CardBackdrop } from './prizes/PrizeArt'
import { SignArt } from './prizes/SignArt'
import { navigate, rankHref } from '../hooks/useHashRoute'
import { neighboursOf, type PeriodRanks } from '../hooks/useProfileBoards'
import { inkOn } from '../lib/color'
import {
  PERIOD_LABELS,
  RANKED_LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_PERIODS,
  type GlobalRankResult,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { ordinal, periodWord, talksInPlaces } from '../lib/profileMath'
import { metalTone, summarizeTrophies, trophyCase, trophyTone, type TrophyAward, type TrophyCaseKind } from '../lib/trophies'
import { BackChevronIcon } from './PageBackLink'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, SecretUnknown, TopTenRibbon, WeeklyMedal } from './TrophyArt'
import { secretByNumber, SECRETS } from '../lib/secrets'

function Skel({ w }: { w: string }) {
  return <span className="skel-line pcard__skel" style={{ '--skel-w': w } as CSSProperties} aria-hidden="true" />
}

function Flag() {
  return (
    <svg className="hero-race__flag" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 11V1.5" />
      <path d="M2.5 2h6.8L7.6 4.4l1.7 2.4H2.5z" />
    </svg>
  )
}

type Mark = { name: string; score: number; rank: number; me: boolean }

/**
 * The players around a place in the top ten, on the site's race line: the
 * top of the three on the right, and the stretch between the middle and the
 * top lit in the player's colour. Chasing, the player is the middle; on top,
 * the player is the right end, with second and third behind. The dots sit by
 * the points between them, but only the names are written: the points are on
 * How your rank works.
 */
function PlacesLine({ name, isSelf, data }: { name: string; isSelf: boolean; data: GlobalRankResult }) {
  const rank = data.rank
  if (rank == null) return null
  const around = neighboursOf(data)
  const me: Mark = { name, score: data.score, rank, me: true }
  const at = (r: number): Mark | null => {
    const n = around.find((x) => x.rank === r)
    return n ? { name: n.name, score: n.score, rank: n.rank, me: false } : null
  }
  const hi = rank === 1 ? me : at(rank - 1)
  const mid = rank === 1 ? at(2) : me
  const lo = rank === 1 ? at(3) : at(rank + 1)
  if (!hi || !mid) return null

  const span = lo ? hi.score - lo.score : 0
  const raw = lo && span > 0 ? 8 + (84 * (mid.score - lo.score)) / span : 50
  const x = lo ? { lo: 8, mid: Math.min(60, Math.max(34, raw)), hi: 92 } : { lo: 0, mid: 22, hi: 88 }
  const gap = hi.score - mid.score
  const you = isSelf ? 'you' : name
  const said = hi.me
    ? gap > 0
      ? `${isSelf ? 'You lead' : `${name} leads`}, with ${mid.name} second${lo ? ` and ${lo.name} third` : ''}`
      : `${isSelf ? 'You' : name} and ${mid.name} are tied at the top${lo ? `, with ${lo.name} third` : ''}`
    : `${gap > 0 ? `${hi.name} is just ahead of ${you}` : `${hi.name} is tied with ${you}`}${lo ? `, ${lo.name} just behind` : ''}`

  const dot = (m: Mark, left: number, slot: 'hi' | 'mid' | 'lo', edge: string) => {
    const who = m.me ? 'you' : slot === 'lo' ? 'trail' : 'rival'
    return (
      <>
        <span className={`hero-race__dot hero-race__dot--${who}`} style={{ left: `${left}%` }} />
        <span
          className={`hero-race__label hero-race__label--${slot === 'mid' ? 'under' : 'over'} hero-race__label--${who}${edge}`}
          style={{ left: `${left}%` }}
        >
          {slot === 'hi' && m.rank === 1 ? <Flag /> : null}
          {m.name}
        </span>
      </>
    )
  }

  return (
    <div className="hero-race pcard__race" role="img" aria-label={`${said}.`}>
      <span className="hero-race__track" />
      {gap > 0 ? <span className="hero-race__lit" style={{ left: `${x.mid}%`, width: `${x.hi - x.mid}%` }} /> : null}
      {lo ? dot(lo, x.lo, 'lo', ' hero-race__label--start') : null}
      {dot(hi, x.hi, 'hi', ' hero-race__label--end')}
      {dot(mid, x.mid, 'mid', lo ? ' hero-race__label--end' : '')}
      {gap > 0 ? (
        <span className="hero-race__label hero-race__label--under hero-race__label--gap" style={{ left: `${(x.mid + x.hi) / 2}%` }}>
          {hi.me ? (isSelf ? 'You lead' : `${name} leads`) : `Next: ${hi.name}`}
        </span>
      ) : null}
    </div>
  )
}

/** A kind of trophy as the case draws it, in the shelf's line art. */
function CaseArt({ kind }: { kind: TrophyCaseKind }) {
  if (kind.period === 'secret') return <SecretArt n={kind.secret ?? 0} size="md" />
  if (kind.period === 'event') return <EventCup size="md" />
  if (kind.period === 'hunt') return <HuntSetJar size="md" />
  const tone = kind.period === 'monthly' ? 'monthly' : 'weekly'
  if (kind.rank > 3) return <TopTenRibbon tone={tone} rank={kind.rank} size="md" />
  return kind.period === 'monthly' ? <MonthlyTrophyCup tone={metalTone(kind.rank)} size="md" /> : <WeeklyMedal rank={kind.rank} size="md" />
}

/**
 * "1st of a month, twice": a kind of trophy, and how many of it, in words. A secret says how it was found
 * only on your own card: on anyone else's it stays a secret.
 */
function caseWords(kind: TrophyCaseKind, isSelf: boolean): string {
  const n = kind.count
  const times = n === 1 ? '' : n === 2 ? ', twice' : `, ${n} times`
  if (kind.period === 'secret') {
    const secret = secretByNumber(kind.secret ?? 0)
    if (!secret) return 'A secret'
    return isSelf ? `${secret.name}: ${secret.says}` : `${secret.name}: a secret. Nobody says how to find it.`
  }
  if (kind.period === 'event') return n === 1 ? 'An event won' : `${n} events won`
  if (kind.period === 'hunt') return n === 1 ? 'A full month of the bug hunt' : `${n} full months of the bug hunt`
  const span = kind.period === 'monthly' ? 'a month' : 'a week'
  if (kind.rank > 3) return `Top ten of ${span}${times}, best ${ordinal(kind.rank)}`
  return `${ordinal(kind.rank)} of ${span}${times}`
}

/**
 * The trophy case along the foot of the card: every kind of trophy the player has won, a tile each in its
 * own colour with how many, the proudest first, and the way down to the shelf that has them all. On your
 * own card, a question mark for the secrets you haven't found (lib/secrets.ts).
 */
function TrophyCase({
  trophies,
  isSelf,
  href,
  onOpen,
}: {
  trophies: TrophyAward[]
  isSelf: boolean
  href: string
  onOpen: (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const kinds = trophyCase(trophies)
  const hidden = isSelf ? SECRETS.length - kinds.filter((k) => k.period === 'secret').length : 0
  if (!kinds.length && hidden <= 0) return null
  const total = trophies.length
  const hiddenWords = hidden === 1 ? 'A secret still hidden' : `${hidden} secrets still hidden`
  return (
    <div className="pcard-case">
      <span className="pcard-case__label">Trophy case</span>
      <ul className="pcard-case__row">
        {kinds.map((kind) => {
          const words = caseWords(kind, isSelf)
          return (
            <li key={kind.key} className={`pcard-case__tile trophy-tone--${trophyTone(kind.period, kind.rank)}`} title={words}>
              <CaseArt kind={kind} />
              {kind.count > 1 ? (
                <span className="pcard-case__count" aria-hidden="true">
                  ×{kind.count}
                </span>
              ) : null}
              <span className="visually-hidden">{words}</span>
            </li>
          )
        })}
        {hidden > 0 ? (
          <li className="pcard-case__tile pcard-case__tile--hidden trophy-tone--hidden" title={hiddenWords}>
            <SecretUnknown size="md" />
            {hidden > 1 ? (
              <span className="pcard-case__count" aria-hidden="true">
                ×{hidden}
              </span>
            ) : null}
            <span className="visually-hidden">{hiddenWords}</span>
          </li>
        ) : null}
      </ul>
      <a className="pcard-case__all" href={href} onClick={onOpen}>
        {total === 0 ? 'See the shelf' : total === 1 ? 'See the trophy' : `See all ${total} trophies`} ›
      </a>
    </div>
  )
}

/** "just ahead of JO" → "Just ahead of JO", to start a line. */
function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The words over the line: where the player stands this period, however the numbers fall. Places and
 * names only; the points behind them are on How your rank works.
 */
function standing({
  name,
  isSelf,
  period,
  ranks,
  data,
  where,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  ranks: PeriodRanks
  data: GlobalRankResult
  where: string
}): { head: ReactNode; sub: ReactNode } {
  const word = periodWord(period)
  const rank = data.rank
  const you = isSelf ? 'you' : name

  if (rank == null) {
    const other = VISIBLE_LEADERBOARD_PERIODS.find((p) => p !== period && ranks[p]?.rank != null)
    const otherRank = other ? ranks[other]?.rank : null
    // All time is the widest board: nothing there means nothing anywhere.
    const never = period === 'all' || (ranks.all != null && ranks.all.rank == null)
    return {
      head: never ? 'Not on the boards yet' : `Not on the board ${word} yet`,
      sub:
        other && otherRank != null
          ? `#${otherRank} ${periodWord(other)}. One run ${word} puts ${you} on this one.`
          : `One run on any game puts ${you} on the boards.`,
    }
  }

  const field = data.totalPlayers
  if (talksInPlaces(rank, field)) {
    // Who's either side, by name: chasing the one above, just ahead of the one below, or tied.
    const around = neighboursOf(data)
    const above = around.find((n) => n.rank === rank - 1)
    const below = around.find((n) => n.rank === rank + 1)
    const parts: string[] = []
    if (above) parts.push(above.score > data.score ? `chasing ${above.name}` : `tied with ${above.name}`)
    if (below) {
      const ahead = rank === 1 ? 'ahead of' : 'just ahead of'
      parts.push(data.score > below.score ? `${ahead} ${below.name}` : `tied with ${below.name}`)
    }
    return {
      head: (
        <>
          <span className="pcard__hot">{ordinal(rank)}</span> {where} {word}
        </>
      ),
      sub: parts.length ? capital(parts.join(' · ')) : `Nobody else on the boards ${word} yet`,
    }
  }

  // Past the top ten: the place, and how many are behind it.
  const behind = field - rank
  return {
    head: (
      <>
        <span className="pcard__hot">#{rank.toLocaleString()}</span> {where} {word}
      </>
    ),
    sub:
      behind > 0
        ? `Ahead of ${behind.toLocaleString()} ${behind === 1 ? 'player' : 'players'} ${word}`
        : `Any better run moves ${you} up`,
  }
}

/**
 * The top of a player's page: the card. The character big on the left, the
 * tag, where they stand this period and what's next, on a line; the week, the
 * month and all time down the right; and along the bottom what they've
 * collected. In the top ten it talks about the players around them by name;
 * below it, about the place and how many are behind it. The points behind a
 * rank are one link away, on How your rank works. Washed in the character's
 * colour, like every banner on the site.
 */
export function PlayerCard({
  name,
  isSelf,
  period,
  ranks,
  data,
  loading,
  where,
  accent,
  art,
  onArtClick,
  trophies,
  actions,
  backHref,
  howHref,
  extra,
  avatarId,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  ranks: PeriodRanks
  /** This period's rank. */
  data: GlobalRankResult
  loading: boolean
  /** "in the arcade", or "in" a group while the boards are scoped to one. */
  where: string
  accent?: string
  art: ReactNode
  onArtClick?: () => void
  trophies: TrophyAward[] | null
  actions: ReactNode
  /** Someone else's card has a way back to the standings. */
  backHref?: string
  /** How this player's rank works: their own page of the points behind it. */
  howHref: string
  /** One more fact along the card's foot: on your own, the way to your stats. */
  extra?: ReactNode
  /** The player's avatar string, which carries what they wear from the prize counter: a card theme, a title, a name style, the neon sign. */
  avatarId?: string | null
}) {
  const style = accent
    ? ({ '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties)
    : undefined
  // What they wear from the prize counter.
  const look = parseAvatar(avatarId)
  const theme = wornPrize(look, 'card')
  const title = prizeById(wornPrize(look, 'title'))
  const sign = wornPrize(look, 'sign')
  const word = periodWord(period)
  const said = loading ? null : standing({ name, isSelf, period, ranks, data, where })
  const rank = data.rank
  const placed = Object.keys(data.byGame).length
  const inPlaces = rank != null && talksInPlaces(rank, data.totalPlayers)
  const summary = trophies ? summarizeTrophies(trophies) : null

  const hrefFor = (p: LeaderboardPeriod) => rankHref(isSelf ? undefined : name, p)
  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    navigate(href)
  }
  // The shelf is further down the same page.
  const toShelf = (e: MouseEvent<HTMLAnchorElement>) => {
    const shelf = document.getElementById('trophies')
    if (!shelf) return
    e.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    shelf.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
  }

  const tile = (
    <span className="pcard__tile">
      {art}
      {onArtClick ? (
        <span className="pcard__edit" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
      ) : null}
    </span>
  )

  return (
    <section
      className={`home-banner pcard${theme ? ' pcard--themed' : ''}`}
      style={style}
      aria-label={isSelf ? 'Your player card' : `${name}'s player card`}
    >
      {theme ? (
        <>
          <CardBackdrop className="pcard__theme" theme={theme} width={1600} height={720} scale={1.7} />
          <span className="pcard__theme-shade" aria-hidden="true" />
        </>
      ) : null}
      <div className="pcard__main">
        {onArtClick ? (
          <button type="button" className="pcard__art pcard__art--btn" onClick={onArtClick} aria-label="Edit your avatar">
            {tile}
          </button>
        ) : (
          <span className="pcard__art" aria-hidden="true">
            {tile}
          </span>
        )}
        <div className="pcard__text">
          <div className="home-banner__kicker-row">
            {backHref ? (
              <a className="pcard__back" href={backHref}>
                <BackChevronIcon size={16} />
                Standings
              </a>
            ) : null}
            <p className="home-banner__kicker">{isSelf ? 'Your player card' : 'Player card'}</p>
          </div>
          {sign ? (
            <h1 className="pcard__name pcard__name--sign" aria-label={name}>
              <SignArt sign={sign} name={name} width={340} wires={false} />
            </h1>
          ) : (
            <h1 className="pcard__name">
              <PlayerName name={name} style={wornPrize(look, 'name')} />
            </h1>
          )}
          {title ? <span className={`prize-plate prize-plate--${plateTier(title)} pcard__title`}>{title.name}</span> : null}
          <p className="pcard__head">{said ? said.head : <Skel w="16ch" />}</p>
          <p className="pcard__sub">{said ? said.sub : <Skel w="24ch" />}</p>
          {/* Past the top ten there is no line: the whole-board bar is on How your rank works. */}
          {!loading && inPlaces ? <PlacesLine name={name} isSelf={isSelf} data={data} /> : null}
          {actions ? <div className="home-banner__acts pcard__acts">{actions}</div> : null}
        </div>
        <nav className="pcard__ladder" aria-label={isSelf ? 'Your rank by period' : `${name}'s rank by period`}>
          {VISIBLE_LEADERBOARD_PERIODS.map((p) => {
            const row = ranks[p] ?? (p === period && !loading ? data : null)
            const on = p === period
            const ranked = row?.rank != null
            return (
              <a
                key={p}
                className={`pcard__period${on ? ' pcard__period--on' : ''}${row && !ranked ? ' pcard__period--none' : ''}`}
                href={hrefFor(p)}
                aria-current={on ? 'true' : undefined}
                onClick={(e) => go(e, hrefFor(p))}
              >
                <span className="pcard__period-text">
                  <span className="pcard__period-label">{PERIOD_LABELS[p]}</span>
                  {/* Just the place, on the right; a word under the label only when there isn't one. */}
                  {row && !ranked ? (
                    <span className="pcard__period-sub">{p === 'all' ? 'No runs yet' : `No runs ${periodWord(p)}`}</span>
                  ) : null}
                </span>
                <span className="pcard__period-figure">
                  {!row ? <Skel w="3ch" /> : ranked ? `#${row.rank!.toLocaleString()}` : 'Not yet'}
                </span>
              </a>
            )
          })}
        </nav>
      </div>
      {trophies && (trophies.length || isSelf) ? (
        <TrophyCase trophies={trophies} isSelf={isSelf} href={rankHref(isSelf ? undefined : name, period, 'trophies')} onOpen={toShelf} />
      ) : null}
      <div className="home-banner__strip pcard__strip">
        <span className="pcard__fact">
          {loading ? (
            <Skel w="12ch" />
          ) : (
            <>
              Played <b>{placed}</b> of {RANKED_LEADERBOARD_GAMES.length} games<span className="pcard__fact-when"> {word}</span>
            </>
          )}
        </span>
        {/* Once there are trophies, the case above has them all. */}
        {!summary ? (
          <span className="pcard__fact">
            <Skel w="10ch" />
          </span>
        ) : summary.total === 0 ? (
          <span className="pcard__fact">No trophies yet</span>
        ) : null}
        {extra}
        <a className="home-banner__standing-link" href={howHref}>
          {isSelf ? 'How your rank works' : `How ${name}’s rank works`} ›
        </a>
      </div>
    </section>
  )
}
