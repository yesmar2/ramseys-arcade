import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { plateTier, prizeById } from '../data/prizes'
import { parseAvatar, wornPrize } from '../lib/avatars'
import { PlayerName } from './PlayerName'
import { PlusMark } from './PlusMark'
import { CardBackdrop } from './prizes/PrizeArt'
import { SignArt } from './prizes/SignArt'
import { gameHref, navigate, plusHref, rankHref } from '../hooks/useHashRoute'
import { usePlusMember } from '../lib/plus'
import { neighboursOf, type PeriodRanks } from '../hooks/useProfileBoards'
import { inkOn } from '../lib/color'
import { standingsGames } from '../lib/allTime'
import {
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type GlobalRankResult,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { ordinal, periodWord, talksInPlaces } from '../lib/profileMath'
import { getGame } from '../data/games'
import { chosenSkin, SKINS, type Skin } from '../lib/skins'
import { useHangarSkins } from './Hangar'
import { RewardArt } from './season/RewardArt'
import { metalTone, trophyCase, trophyTone, type TrophyAward, type TrophyCaseKind } from '../lib/trophies'
import { BackChevronIcon } from './PageBackLink'
import { useHeldHeight } from '../lib/heldShape'
import { useSeason } from '../lib/season'
import { seasonHasStandings } from '../lib/seasonStandings'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, SecretUnknown, TopTenRibbon, WeeklyMedal } from './TrophyArt'
import { secretByNumber, SECRETS } from '../lib/secrets'

function Skel({ w }: { w: string }) {
  return <span className="skel-line pcard__skel" style={{ '--skel-w': w } as CSSProperties} aria-hidden="true" />
}

/** A kind of trophy as the case draws it, in the shelf's line art. */
function CaseArt({ kind }: { kind: TrophyCaseKind }) {
  if (kind.period === 'secret') return <SecretArt n={kind.secret ?? 0} size="md" />
  if (kind.period === 'event') return <EventCup size="md" />
  if (kind.period === 'hunt') return <HuntSetJar size="md" />
  const tone = kind.period === 'monthly' || kind.period === 'season' ? 'monthly' : 'weekly'
  if (kind.rank > 3) return <TopTenRibbon tone={tone} rank={kind.rank} size="md" />
  return kind.period === 'monthly' || kind.period === 'season' ? <MonthlyTrophyCup tone={metalTone(kind.rank)} size="md" /> : <WeeklyMedal rank={kind.rank} size="md" />
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
    return isSelf ? `${secret.name}: ${secret.says}` : `${secret.name}: a secret trophy.`
  }
  if (kind.period === 'event') return n === 1 ? 'An event won' : `${n} events won`
  if (kind.period === 'hunt') return n === 1 ? 'A full month of the bug hunt' : `${n} full months of the bug hunt`
  const span = kind.period === 'season' ? 'a season' : kind.period === 'monthly' ? 'a month' : 'a week'
  if (kind.rank > 3) return `Top ten of ${span}${times}, best ${ordinal(kind.rank)}`
  return `${ordinal(kind.rank)} of ${span}${times}`
}

/**
 * The trophy shelf along the card's foot: the proudest few kinds of trophy, each a tile in its own colour
 * with how many, the secrets found as one tile, in a word or two, and the way down to the shelf that has
 * them all. On your own card with nothing won yet, a question mark for the secrets still to find.
 */
function TrophyShelf({
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
  const won = kinds.filter((k) => k.period !== 'secret')
  const secrets = kinds.filter((k) => k.period === 'secret')
  const shown = won.slice(0, 3)
  const secretWords = isSelf
    ? `${secrets.length} of ${SECRETS.length} secrets`
    : secrets.length === 1
      ? 'A secret trophy'
      : `${secrets.length} secret trophies`
  const lead = shown[0] ? caseWords(shown[0], isSelf) : null
  return (
    <div className="pcard-shelf">
      <div className="pcard-shelf__head">
        <span className="pcard-shelf__title">
          Trophies<span className="pcard-shelf__count"> · {trophies.length}</span>
        </span>
        <a className="pcard-shelf__all" href={href} onClick={onOpen}>
          See all<span className="pcard-shelf__all-long"> trophies</span> ›
        </a>
      </div>
      <ul className="pcard-shelf__row">
        {shown.map((kind) => {
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
        {secrets.length ? (
          <li className={`pcard-case__tile trophy-tone--${trophyTone('secret', 0)}`} title={secretWords}>
            <CaseArt kind={secrets[0]} />
            {secrets.length > 1 ? (
              <span className="pcard-case__count" aria-hidden="true">
                ×{secrets.length}
              </span>
            ) : null}
            <span className="visually-hidden">{secretWords}</span>
          </li>
        ) : null}
        {!kinds.length ? (
          <li className="pcard-case__tile pcard-case__tile--hidden trophy-tone--hidden" title={`${SECRETS.length} secrets to find`}>
            <SecretUnknown size="md" />
          </li>
        ) : null}
        <li className="pcard-shelf__words" aria-hidden="true">
          {kinds.length ? (
            <>
              {lead ? <span>{lead}</span> : null}
              {secrets.length ? <span>{secretWords}</span> : null}
            </>
          ) : (
            <span>No trophies yet</span>
          )}
        </li>
      </ul>
    </div>
  )
}

/** How many skins the hangar shelf shows before its "+N": six, five on a phone (the sixth hides there). */
const SHELF_SKINS = 6

/**
 * The hangar shelf beside it: the skins the player has won, the ones they play in first (your own card's
 * picks, lib/skins.ts), then the newest, and the way down to the hangar's bays (components/Hangar.tsx).
 */
function HangarShelf({ skins, isSelf }: { skins: readonly string[]; isSelf: boolean }) {
  const order = (s: Skin) => (isSelf && chosenSkin(s.game) === s.id ? -1000 : 0) - SKINS.indexOf(s)
  const owned = SKINS.filter((s) => skins.includes(s.id)).sort((a, b) => order(a) - order(b))
  const shown = owned.slice(0, SHELF_SKINS)
  const rest = owned.length - shown.length
  // On a phone the sixth is hidden, so it counts among the rest there.
  const restNarrow = owned.length - Math.min(owned.length, SHELF_SKINS - 1)
  const toHangar = (e: MouseEvent<HTMLAnchorElement>) => {
    const hangar = document.getElementById('hangar')
    if (!hangar) return
    e.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    hangar.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
  }
  return (
    <div className="pcard-shelf pcard-shelf--hangar">
      <div className="pcard-shelf__head">
        <span className="pcard-shelf__title">
          Hangar
          <span className="pcard-shelf__count">
            {' '}
            · {owned.length}
            <span className="pcard-shelf__all-long"> {owned.length === 1 ? 'skin' : 'skins'}</span>
          </span>
        </span>
        <a className="pcard-shelf__all" href="#hangar" onClick={toHangar}>
          See all<span className="pcard-shelf__all-long"> skins</span> ›
        </a>
      </div>
      <ul className="pcard-shelf__row">
        {shown.map((skin) => {
          const game = getGame(skin.game)
          const label = `${skin.name}${game ? `, ${game.name}` : ''}`
          return (
            <li key={skin.id} className="pcard-shelf__skin">
              <a href={gameHref(skin.game)} title={label} aria-label={label}>
                <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={52} />
              </a>
            </li>
          )
        })}
        {restNarrow > 0 ? (
          <li className={`pcard-shelf__more${rest > 0 ? '' : ' pcard-shelf__more--narrow'}`} aria-label={`${restNarrow} more`}>
            <span className="pcard-shelf__more-wide">+{rest}</span>
            <span className="pcard-shelf__more-narrow">+{restNarrow}</span>
          </li>
        ) : null}
      </ul>
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
  periods,
  ranks,
  data,
  where,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  /** The card's periods: the week, the month and all time, and the season while it has standings. */
  periods: readonly LeaderboardPeriod[]
  ranks: PeriodRanks
  data: GlobalRankResult
  where: string
}): { head: ReactNode; sub: ReactNode } {
  const word = periodWord(period)
  const rank = data.rank
  const you = isSelf ? 'you' : name

  if (rank == null) {
    const other = periods.find((p) => p !== period && ranks[p]?.rank != null)
    const otherRank = other ? ranks[other]?.rank : null
    // Nowhere in any period. All time isn't the widest: a daily counts toward the week and the month only (lib/allTime.ts).
    const never = periods.every((p) => p === period || (ranks[p] != null && ranks[p]?.rank == null))
    return {
      head: never ? 'Not on the boards yet' : `Not on the board ${word} yet`,
      sub:
        other && otherRank != null
          ? period === 'all'
            ? `#${otherRank} ${periodWord(other)}. Dailies don’t count all time: one run on another game puts ${you} on it.`
            : `#${otherRank} ${periodWord(other)}. One run ${word} puts ${you} on this one.`
          : `One run on any ranked game puts ${you} on the boards.`,
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
 * The top of a player's page: the card. Their card theme from the prize counter in a band across the top
 * (or their colour, without one), the character over it, and beside it the tag with what they wear and
 * where they stand. Under them a tile a period, lit for the one on screen, how many games they've played
 * and, on your own card, your dailies streak; along the foot two shelves, the trophies and the hangar, a
 * few of each and the way down to them all. The points behind a rank are one link away, on How your rank
 * works.
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
  stats,
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
  /** On your own card: your dailies streak, and the way to your stats. */
  stats?: { streak: number; href: string } | null
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
  const member = usePlusMember(name)
  const skins = useHangarSkins(name, isSelf)
  const word = periodWord(period)
  // A Season tile after all time while the season has standings (and whenever the card is the season's).
  const withSeason = seasonHasStandings(useSeason().season) || period === 'season'
  const periods: readonly LeaderboardPeriod[] = withSeason ? [...VISIBLE_LEADERBOARD_PERIODS, 'season'] : VISIBLE_LEADERBOARD_PERIODS
  const said = loading ? null : standing({ name, isSelf, period, periods, ranks, data, where })
  const placed = Object.keys(data.byGame).length
  // The shelves come with their asks: their room is held while those load when this device saw them on this
  // card before (lib/heldShape.ts).
  const shelvesHeld = useHeldHeight<HTMLDivElement>(`pcard-shelves-${name}`, trophies === null || skins === null)
  const trophyShelf = trophies && (trophies.length || isSelf)
  const hangarShelf = skins && skins.some((id) => SKINS.some((s) => s.id === id))

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
      <div className="pcard__band" aria-hidden="true">
        {theme ? <CardBackdrop className="pcard__theme" theme={theme} width={1600} height={480} scale={1.4} /> : null}
      </div>
      {backHref ? (
        <a className="pcard__back" href={backHref}>
          <BackChevronIcon size={16} />
          Standings
        </a>
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
        <div className="pcard__id">
          {sign ? (
            <h1 className="pcard__name pcard__name--sign" aria-label={name}>
              <SignArt sign={sign} name={name} width={340} wires={false} />
            </h1>
          ) : (
            <h1 className="pcard__name">
              <PlayerName name={name} style={wornPrize(look, 'name')} />
            </h1>
          )}
          <div className="pcard__chips">
            {title ? <span className={`prize-plate prize-plate--${plateTier(title)} pcard__title`}>{title.name}</span> : null}
            {member ? (
              // A member's card says so, and where Plus is: the way someone hears of it from a player they look up.
              <a className="pcard-plus" href={plusHref()}>
                <PlusMark name={name} />
                {isSelf ? 'You’re on Plus' : 'Plus member'}
              </a>
            ) : null}
            <span className="pcard__head">{said ? said.head : <Skel w="16ch" />}</span>
          </div>
          {said && data.rank == null ? <p className="pcard__sub">{said.sub}</p> : null}
        </div>
        {actions ? <div className="home-banner__acts pcard__acts">{actions}</div> : null}
        <div className="pcard__tiles" style={{ '--pcard-tiles': periods.length + 1 + (stats ? 1 : 0) } as CSSProperties}>
          <nav className="pcard__ranks" aria-label={isSelf ? 'Your rank by period' : `${name}'s rank by period`}>
            {periods.map((p) => {
              const row = ranks[p] ?? (p === period && !loading ? data : null)
              const on = p === period
              const ranked = row?.rank != null
              return (
                <a
                  key={p}
                  className={`pcard__stat pcard__stat--link${on ? ' pcard__stat--on' : ''}${row && !ranked ? ' pcard__stat--none' : ''}`}
                  href={hrefFor(p)}
                  aria-current={on ? 'true' : undefined}
                  onClick={(e) => go(e, hrefFor(p))}
                >
                  <span className="pcard__stat-label">{PERIOD_LABELS[p]}</span>
                  <b className="pcard__stat-figure">
                    {!row ? <Skel w="3ch" /> : ranked ? `#${row.rank!.toLocaleString()}` : 'Not yet'}
                  </b>
                </a>
              )
            })}
          </nav>
          <div className="pcard__more">
            <span className="pcard__stat">
              <span className="pcard__stat-label">Played {word}</span>
              <b className="pcard__stat-figure">
                {loading ? (
                  <Skel w="4ch" />
                ) : (
                  <>
                    {placed} <small>of {standingsGames(period).length}</small>
                  </>
                )}
              </b>
            </span>
            {stats ? (
              <a className="pcard__stat pcard__stat--link" href={stats.href}>
                <span className="pcard__stat-label">{stats.streak > 0 ? 'Dailies streak' : 'Your stats'}</span>
                <b className="pcard__stat-figure">
                  {stats.streak > 0 ? (
                    <>
                      {stats.streak} <small>{stats.streak === 1 ? 'day' : 'days'}</small>
                    </>
                  ) : (
                    <small>See them ›</small>
                  )}
                </b>
              </a>
            ) : null}
          </div>
        </div>
        <div className="pcard__slot pcard__shelves" ref={shelvesHeld.ref} style={shelvesHeld.style}>
          {trophyShelf ? (
            <TrophyShelf trophies={trophies} isSelf={isSelf} href={rankHref(isSelf ? undefined : name, period, 'trophies')} onOpen={toShelf} />
          ) : null}
          {hangarShelf ? <HangarShelf skins={skins} isSelf={isSelf} /> : null}
        </div>
      </div>
      <div className="home-banner__strip pcard__strip">
        <a className="home-banner__standing-link" href={howHref}>
          {isSelf ? 'How your rank works' : `How ${name}’s rank works`} ›
        </a>
      </div>
    </section>
  )
}

