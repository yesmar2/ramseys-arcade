import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { navigate, rankHref, todayHref } from '../hooks/useHashRoute'
import { neighboursOf, type GameBest, type PeriodRanks } from '../hooks/useProfileBoards'
import { standingsGames } from '../lib/allTime'
import { parseAvatar, wornPrize } from '../lib/avatars'
import { bannerText, inkOn, readableFill, shelfTextDark } from '../lib/color'
import { useMedalCounts, type MedalCounts } from '../lib/courseBests'
import { useHeldHeight } from '../lib/heldShape'
import { useStickers } from '../lib/stickers'
import { PERIOD_LABELS, VISIBLE_LEADERBOARD_PERIODS, type GlobalRankResult, type LeaderboardPeriod } from '../lib/leaderboard'
import { usePlusMember } from '../lib/plus'
import { barPosition, ordinal, periodWord, scoreWithUnit, shareLines, talksInPlaces } from '../lib/profileMath'
import { glide } from '../lib/scrollToPlace'
import { useSeasonTab } from '../lib/seasonStandings'
import { secretByNumber } from '../lib/secrets'
import { chosenSkin, SKINS, type Skin } from '../lib/skins'
import { metalTone, trophyCase, trophyTone, type TrophyAward, type TrophyCaseKind } from '../lib/trophies'
import { CardArt, FullArtCard } from './FullArtCard'
import { GameArt } from './GameArt'
import { useHangarSkins } from './Hangar'
import { BackChevronIcon } from './PageBackLink'
import { PlayerName } from './PlayerName'
import { PlusMark } from './PlusMark'
import { MedalIcon } from './RaceMedal'
import { RewardArt } from './season/RewardArt'
import { StickerAlbum } from './StickerAlbum'
import { EventCup, HuntSetJar, MonthlyTrophyCup, SecretArt, TopTenRibbon, WeeklyMedal } from './TrophyArt'
import '../styles/playerCard.css'

function Skel({ w }: { w: string }) {
  return <span className="skel-line pc__skel" style={{ '--skel-w': w } as CSSProperties} aria-hidden="true" />
}

/** A kind of trophy as the shelf draws it, in its line art. */
function CaseArt({ kind }: { kind: TrophyCaseKind }) {
  if (kind.period === 'secret') return <SecretArt n={kind.secret ?? 0} size="md" />
  if (kind.period === 'event') return <EventCup size="md" />
  if (kind.period === 'hunt') return <HuntSetJar size="md" />
  const tone = kind.period === 'monthly' || kind.period === 'season' ? 'monthly' : 'weekly'
  if (kind.rank > 3) return <TopTenRibbon tone={tone} rank={kind.rank} size="md" />
  return kind.period === 'monthly' || kind.period === 'season' ? <MonthlyTrophyCup tone={metalTone(kind.rank)} size="md" /> : <WeeklyMedal rank={kind.rank} size="md" />
}

/**
 * "1st of a month, twice": a kind of trophy, and how many of it, in words. A secret says which only on your own
 * card: on anyone else's it stays a secret.
 */
function caseWords(kind: TrophyCaseKind, isSelf: boolean): string {
  const n = kind.count
  const times = n === 1 ? '' : n === 2 ? ', twice' : ` ×${n}`
  if (kind.period === 'secret') {
    const secret = secretByNumber(kind.secret ?? 0)
    return secret && isSelf ? secret.name : 'A secret trophy'
  }
  if (kind.period === 'event') return n === 1 ? 'An event won' : `${n} events won`
  if (kind.period === 'hunt') return n === 1 ? 'A bug hunt month' : `${n} bug hunt months`
  const span = kind.period === 'season' ? 'a season' : kind.period === 'monthly' ? 'a month' : 'a week'
  if (kind.rank > 3) return `Top ten of ${span}${times}`
  return `${ordinal(kind.rank)} of ${span}${times}`
}

/** A period in a word, under its place along the card's foot: four fit across a phone's card. */
const PIP_LABELS: Partial<Record<LeaderboardPeriod, string>> = { weekly: 'Week', monthly: 'Month', all: 'All time', season: 'Season' }

/** "just ahead of JO" → "Just ahead of JO", to start a line. */
function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A place on a board in a few words: "#3 all time" near the top, "Top 18%" further down. */
function placeWords(rank: number, total: number): string {
  if (talksInPlaces(rank, total)) return `#${rank} all time`
  return `Top ${Math.max(1, Math.ceil((100 * rank) / Math.max(1, total)))}%`
}

/**
 * The words beside the card: where the player stands this period, however the numbers fall. Places and names
 * only; the points behind them are on How your rank works.
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
          <span className="pc__hot">{ordinal(rank)}</span> {where} {word}
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
        <span className="pc__hot">#{rank.toLocaleString()}</span> {where} {word}
      </>
    ),
    sub:
      behind > 0
        ? `Ahead of ${behind.toLocaleString()} ${behind === 1 ? 'player' : 'players'} ${word}`
        : `Any better run moves ${you} up`,
  }
}

/** Past the top ten, how far up the board the player is, with its share lines (the top half, 25%, 10%). */
function ShareBar({ rank, field }: { rank: number; field: number }) {
  const lines = shareLines(field).filter((l) => l.key !== 'ten')
  const at = (r: number) => `${(barPosition(r, field) * 100).toFixed(1)}%`
  return (
    <div className="pc-bar" aria-hidden="true">
      <span className="pc-bar__track">
        <i style={{ width: at(rank) }} />
        {lines.map((l) => (
          <span key={l.key} className="pc-bar__tick" style={{ left: at(l.rank) }} />
        ))}
      </span>
      <span className="pc-bar__words">
        {lines.map((l) => (
          <span key={l.key} style={{ left: at(l.rank) }}>
            {l.key === 'half' ? 'Top half' : l.label.replace('Top ', '')}
          </span>
        ))}
      </span>
    </div>
  )
}

/** One of the small cards in the hand beside the big one: a picture, and what it is along its foot. */
function Mini({
  kind,
  cap,
  title,
  sub,
  href,
  onClick,
  children,
}: {
  kind: string
  cap: string
  title: ReactNode
  sub: ReactNode
  href: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  children: ReactNode
}) {
  return (
    <li className={`pc-mini pc-mini--${kind}`}>
      <a className="pc-mini__card" href={href} onClick={onClick}>
        <span className="pc-mini__cap">{cap}</span>
        <span className="pc-mini__art" aria-hidden="true">
          {children}
        </span>
        <span className="pc-mini__foot">
          <b>{title}</b>
          <span>{sub}</span>
        </span>
      </a>
    </li>
  )
}

function medalWords(m: MedalCounts): string {
  const parts: string[] = []
  if (m.platinum) parts.push(`${m.platinum} platinum`)
  if (m.gold) parts.push(`${m.gold} gold`)
  if (parts.length < 2 && m.silver) parts.push(`${m.silver} silver`)
  if (parts.length < 2 && m.bronze) parts.push(`${m.bronze} bronze`)
  return parts.join(' · ')
}

/** Down the page to a part of it, gliding unless motion is turned down, without touching the address. */
function jumpTo(id: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    target.scrollIntoView({ behavior: glide(), block: 'start' })
  }
}

/**
 * The top of a player's page: their trading card, full art, standing tilted on its own sky (the card's
 * background, blurred, across the whole top), and beside it where they stand this period and a hand of small
 * cards: what they're best at, their race medals, on your own card your Dailies streak, and their trophies or
 * skins, each a way to that part of the page. The card turns over to its back, the sticker album (B3 of the
 * "New prize kinds" canvas). Ramsey picked H2 + P2 of the "Player card hero redesign" canvas
 * (2026-10-20). No sign and no title: those are retired from the counter.
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
  best,
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
  /** On your own card: your Dailies streak, the way to the Dailies page; without one, the way to your stats. */
  stats?: { streak: number; href: string } | null
  /** The player's avatar string, which carries what they wear from the prize counter: a background and a name style. */
  avatarId?: string | null
  /** Their best game, all time (ProfileBestBoard's bestGame). */
  best?: GameBest | null
}) {
  const style = accent
    ? ({
        '--hero-accent': accent,
        '--hero-ink': inkOn(accent),
        '--hero-fill': readableFill(accent),
        '--hero-text': bannerText(accent),
        '--hero-shelf-dark': shelfTextDark(accent),
        '--tile-accent': accent,
      } as CSSProperties)
    : undefined
  // What they wear from the prize counter.
  const look = parseAvatar(avatarId)
  const theme = wornPrize(look, 'card')
  const member = usePlusMember(name)
  const skins = useHangarSkins(name, isSelf)
  const medals = useMedalCounts(name)
  const album = useStickers(name, isSelf)
  // The card turns over to its back, the sticker album.
  const [flipped, setFlipped] = useState(false)
  const word = periodWord(period)
  // Without a background, their own constellation fills the card: a star for each trophy (CardStars.tsx).
  const trophyCount = trophies ? trophies.length : null
  // A Season place after all time while the season has standings (and whenever the card is the season's), known
  // before the API answers as the period tabs know it, so the pips are drawn once rather than three then four.
  const withSeason = useSeasonTab() || period === 'season'
  const periods: readonly LeaderboardPeriod[] = withSeason ? [...VISIBLE_LEADERBOARD_PERIODS, 'season'] : VISIBLE_LEADERBOARD_PERIODS
  const said = loading ? null : standing({ name, isSelf, period, periods, ranks, data, where })
  const placed = Object.keys(data.byGame).length
  const rank = data.rank
  const gold = !loading && rank != null && rank <= 3
  // The hand waits for what it shows: its room is held while it loads when this device saw it before.
  const handHeld = useHeldHeight<HTMLUListElement>(`pc-hand-${name}`, trophies === null || skins === null || medals === null)

  const hrefFor = (p: LeaderboardPeriod) => rankHref(isSelf ? undefined : name, p)
  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    navigate(href)
  }

  const avatar = onArtClick ? (
    <button type="button" className="pc__avatar pc__avatar--btn" onClick={onArtClick} aria-label="Edit your avatar">
      {art}
      <span className="pc__edit" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
    </button>
  ) : (
    <span className="pc__avatar" aria-hidden="true">
      {art}
    </span>
  )

  const pips = (
    <nav className="pc-pips" aria-label={isSelf ? 'Your place by period' : `${name}'s place by period`}>
      {periods.map((p) => {
        const row = ranks[p] ?? (p === period && !loading ? data : null)
        const r = row?.rank ?? null
        const on = p === period
        const label = r != null ? `#${r.toLocaleString()} ${periodWord(p)}` : row ? `Not on the board ${periodWord(p)} yet` : PERIOD_LABELS[p]
        return (
          <a
            key={p}
            className={`pc-pip${on ? ' pc-pip--on' : ''}${r != null && r <= 3 ? ' pc-pip--top' : ''}`}
            href={hrefFor(p)}
            aria-current={on ? 'true' : undefined}
            aria-label={label}
            title={label}
            onClick={(e) => go(e, hrefFor(p))}
          >
            <b aria-hidden="true">{r != null ? `#${r > 9999 ? `${Math.floor(r / 1000)}k` : r.toLocaleString()}` : row ? '–' : ''}</b>
            <span aria-hidden="true">{PIP_LABELS[p] ?? PERIOD_LABELS[p]}</span>
          </a>
        )
      })}
    </nav>
  )

  const bestGame = best ? getGame(best.slug) : null
  const line = best && bestGame ? `Best at ${bestGame.name} · ${placeWords(best.rank, best.total)}` : null

  // The hand: up to four, in this order, each only when there's something to show.
  const hand: ReactNode[] = []
  if (best && bestGame) {
    hand.push(
      <Mini key="best" kind="game" cap="Best at" title={bestGame.name} sub={`${placeWords(best.rank, best.total)} · ${scoreWithUnit(best.slug, best.score)}`} href="#best" onClick={jumpTo('best')}>
        <GameArt slug={best.slug} shape="card" />
      </Mini>,
    )
  }
  const medalTotal = medals ? medals.platinum + medals.gold + medals.silver + medals.bronze : 0
  if (medals && (medalTotal > 0 || isSelf)) {
    hand.push(
      <Mini
        key="medals"
        kind="medals"
        cap="Race medals"
        title={medalTotal ? `${medalTotal} ${medalTotal === 1 ? 'medal' : 'medals'}` : 'No medals yet'}
        sub={medalTotal ? medalWords(medals) : 'Beat the blue in a race'}
        href={todayHref()}
      >
        <span className="pc-mini__medal pc-mini__medal--l">
          <MedalIcon medal="silver" size={56} dim={!medals.silver && !medals.gold && !medals.platinum} />
        </span>
        <span className="pc-mini__medal pc-mini__medal--r">
          <MedalIcon medal="bronze" size={56} dim={!medalTotal} />
        </span>
        <span className="pc-mini__medal pc-mini__medal--c">
          <MedalIcon medal={medals.platinum ? 'platinum' : 'gold'} size={64} dim={!medals.platinum && !medals.gold} />
        </span>
      </Mini>,
    )
  }
  if (stats) {
    hand.push(
      <Mini
        key="dailies"
        kind="streak"
        cap="Dailies"
        title={stats.streak > 0 ? 'Day streak' : 'No streak yet'}
        sub={stats.streak > 0 ? 'Keep it going today' : 'Play two races today'}
        href={stats.streak > 0 ? todayHref() : stats.href}
      >
        <svg className="pc-mini__flame" viewBox="0 0 24 24">
          <path d="M12 3c2.2 3 5.5 5 5.5 9.2A5.5 5.5 0 0 1 6.5 12.2c0-2.2 1.1-3.7 2.2-4.8.5 1.6 1.4 2.5 2.2 2.7-.3-2.3-.1-4.9 1.1-7.1z" />
        </svg>
        <b className="pc-mini__big">{stats.streak}</b>
      </Mini>,
    )
  }
  const kinds = trophies ? trophyCase(trophies) : []
  const lead = kinds.find((k) => k.period !== 'secret') ?? kinds[0]
  if (trophies?.length && lead) {
    hand.push(
      <Mini
        key="trophies"
        kind="trophies"
        cap="Trophies"
        title={`${trophies.length} ${trophies.length === 1 ? 'trophy' : 'trophies'}`}
        sub={caseWords(lead, isSelf)}
        href={rankHref(isSelf ? undefined : name, period, 'trophies')}
        onClick={jumpTo('trophies')}
      >
        <span className={`pc-mini__trophy trophy-tone--${trophyTone(lead.period, lead.rank)}`}>
          <CaseArt kind={lead} />
        </span>
      </Mini>,
    )
  }
  const owned = skins ? SKINS.filter((s) => skins.includes(s.id)) : []
  if (owned.length && hand.length < 4) {
    // Your own card shows a skin you play in first.
    const order = (s: Skin) => (isSelf && chosenSkin(s.game) === s.id ? -1000 : 0) - SKINS.indexOf(s)
    const top = [...owned].sort((a, b) => order(a) - order(b))[0]!
    hand.push(
      <Mini key="skins" kind="skins" cap="Skins" title={`${owned.length} ${owned.length === 1 ? 'skin' : 'skins'}`} sub={top.name} href="#hangar" onClick={jumpTo('hangar')}>
        <RewardArt reward={{ kind: 'skin', id: top.id, name: top.name }} size={96} />
      </Mini>,
    )
  }

  return (
    <section className={`pc${gold ? ' pc--gold' : ''}`} style={style} aria-label={isSelf ? 'Your player card' : `${name}'s player card`}>
      <div className="pc__sky" aria-hidden="true">
        <CardArt className="pc__sky-art" theme={theme} tag={name} trophies={trophyCount} wide />
      </div>
      <span className="pc__shade" aria-hidden="true" />
      {backHref ? (
        <a className="pc__back" href={backHref}>
          <BackChevronIcon size={16} />
          Standings
        </a>
      ) : null}

      <div className="pc__main">
        <FullArtCard
          className="pc__card"
          gold={gold}
          tag={name}
          theme={theme}
          trophies={trophyCount}
          avatar={avatar}
          chip={loading ? null : rank != null ? `#${rank.toLocaleString()} ${word}` : `Not on ${word} yet`}
          corner={member ? <PlusMark name={name} /> : null}
          name={
            <h1 className="pc__name">
              <PlayerName name={name} style={wornPrize(look, 'name')} />
            </h1>
          }
          line={line}
          pips={pips}
          foil={wornPrize(look, 'foil')}
          back={<StickerAlbum album={album} isSelf={isSelf} />}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
        />

        <div className="pc__side">
          <div className="pc__words">
            <p className="pc__head">{said ? said.head : <Skel w="16ch" />}</p>
            <p className="pc__sub">
              {said ? said.sub : <Skel w="22ch" />}
              {member ? <span className="pc__plus"> · Plus member</span> : null}
            </p>
            {!loading && rank != null && !talksInPlaces(rank, data.totalPlayers) && shareLines(data.totalPlayers).length ? (
              <ShareBar rank={rank} field={data.totalPlayers} />
            ) : null}
          </div>

          <ul className="pc-hand" ref={handHeld.ref} style={handHeld.style} aria-label={isSelf ? 'Your highlights' : `${name}'s highlights`}>
            {hand.slice(0, 4)}
          </ul>

          <div className="pc__acts">
            {actions ? <div className="home-banner__acts pc__buttons">{actions}</div> : null}
            <span className="pc__facts">
              {loading ? (
                <Skel w="11.5rem" />
              ) : (
                // The games the period ranks (lib/allTime.ts): Stats counts every game played, these only the ranked.
                <span>
                  Played <b>{placed}</b> of {standingsGames(period).length} ranked games {word}
                </span>
              )}
              <a className="pc__how" href={howHref}>
                {isSelf ? 'How your rank works' : `How ${name}’s rank works`} ›
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
