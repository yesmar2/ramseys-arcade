import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { navigate, rankHref } from '../hooks/useHashRoute'
import { neighboursOf, type PeriodRanks } from '../hooks/useProfileBoards'
import { inkOn } from '../lib/color'
import {
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_PERIODS,
  type GlobalRankResult,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  barPosition,
  nextLine,
  ordinal,
  periodWord,
  pointsWord,
  pts,
  shareLines,
  talksInPlaces,
  toPass,
} from '../lib/profileMath'
import { summarizeTrophies, type TrophyAward } from '../lib/trophies'
import { BackChevronIcon } from './PageBackLink'

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
 * the player is the right end, with second and third behind.
 */
function PlacesLine({ name, data }: { name: string; data: GlobalRankResult }) {
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
  const said = [hi, mid, lo].filter((m): m is Mark => m != null).map((m) => `${m.name} ${m.score}`)

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
          {m.name} {m.score.toLocaleString()}
        </span>
      </>
    )
  }

  return (
    <div className="hero-race pcard__race" role="img" aria-label={`Points: ${said.join(', ')}`}>
      <span className="hero-race__track" />
      {gap > 0 ? <span className="hero-race__lit" style={{ left: `${x.mid}%`, width: `${x.hi - x.mid}%` }} /> : null}
      {lo ? dot(lo, x.lo, 'lo', ' hero-race__label--start') : null}
      {dot(hi, x.hi, 'hi', ' hero-race__label--end')}
      {dot(mid, x.mid, 'mid', lo ? ' hero-race__label--end' : '')}
      {gap > 0 ? (
        <span className="hero-race__label hero-race__label--under hero-race__label--gap" style={{ left: `${(x.mid + x.hi) / 2}%` }}>
          {gap.toLocaleString()} {hi.me ? 'ahead' : 'to go'}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Past the top ten, the whole board as one bar with last place on the left:
 * where the player sits, the share lines across it, and the points each line
 * still ahead would take. The bar reads the same with a hundred players or
 * ten thousand.
 */
function ShareBar({
  name,
  data,
  scores,
}: {
  name: string
  data: GlobalRankResult
  scores: Record<number, number>
}) {
  const rank = data.rank
  const field = data.totalPlayers
  if (rank == null) return null
  const me = barPosition(rank, field)
  const top = scores[1]
  // The line ahead is named with its points; a line further on only where there is room for its name.
  let lastShown = -1
  const lines = shareLines(field).map((line) => {
    const ahead = line.rank < rank
    const score = scores[line.rank]
    const pos = barPosition(line.rank, field)
    const shown = ahead && (lastShown < 0 || pos - lastShown >= 0.22)
    if (shown) lastShown = pos
    return { ...line, ahead, shown, pos, need: ahead && score != null ? toPass(score, data.score) : null }
  })
  const said = lines
    .filter((l) => l.need != null)
    .map((l) => `${pointsWord(l.need!)} from the ${l.label.toLowerCase()}`)
  const ahead = field - rank

  return (
    <div
      className="pcard-bar"
      role="img"
      aria-label={`${name} is ahead of ${ahead.toLocaleString()} of ${field.toLocaleString()} players${said.length ? `: ${said.join(', ')}` : ''}.`}
    >
      {lines.map((l) => (
        <span
          key={l.key}
          className={`pcard-bar__line${l.shown ? '' : ' pcard-bar__line--quiet'}${l.pos > 0.84 ? ' pcard-bar__line--end' : ''}`}
          style={{ left: `${l.pos * 100}%` }}
        >
          <span className="pcard-bar__tick" />
          {l.shown ? (
            <span className="pcard-bar__label">
              <span className="pcard-bar__name">{l.label}</span>
              <span className="pcard-bar__need">{l.need != null ? `+${l.need.toLocaleString()} pts` : ' '}</span>
            </span>
          ) : null}
        </span>
      ))}
      <span className="pcard-bar__track">
        <span className="pcard-bar__fill" style={{ width: `${me * 100}%` }} />
      </span>
      <span className="pcard-bar__you" style={{ left: `${me * 100}%` }} />
      <span className={`pcard-bar__who${me < 0.3 ? ' pcard-bar__who--start' : ''}`} style={{ left: `${me * 100}%` }}>
        {name} {data.score.toLocaleString()}
        {ahead > 0 ? ` · ahead of ${ahead.toLocaleString()}` : ''}
      </span>
      {top != null && me < 0.72 ? <span className="pcard-bar__top">#1 · {top.toLocaleString()}</span> : null}
    </div>
  )
}

/** The words over the line: where the player stands this period, however the numbers fall. */
function standing({
  name,
  isSelf,
  period,
  ranks,
  data,
  where,
  scores,
  scoresReady,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  ranks: PeriodRanks
  data: GlobalRankResult
  where: string
  scores: Record<number, number>
  scoresReady: boolean
}): { head: ReactNode; sub: ReactNode } {
  const word = periodWord(period)
  const rank = data.rank
  const games = Object.keys(data.byGame).length
  const from = `${pts(data.score)} from ${games} ${games === 1 ? 'game' : 'games'}`
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
    const around = neighboursOf(data)
    const above = around.find((n) => n.rank === rank - 1)
    const below = around.find((n) => n.rank === rank + 1)
    const parts: string[] = [from]
    if (above) {
      const gap = above.score - data.score
      parts.push(gap > 0 ? `${gap.toLocaleString()} behind ${above.name}` : `tied with ${above.name}`)
    }
    if (below) {
      const lead = data.score - below.score
      parts.push(lead > 0 ? `${lead.toLocaleString()} ahead of ${below.name}` : `tied with ${below.name}`)
    }
    return {
      head: (
        <>
          <span className="pcard__hot">{ordinal(rank)}</span> {where} {word}
        </>
      ),
      sub: parts.join(' · '),
    }
  }

  const line = nextLine(rank, field)
  const lineScore = line ? scores[line.rank] : undefined
  const sub = `${from} ${word} · #${rank.toLocaleString()} of ${field.toLocaleString()} players`
  if (line && lineScore != null) {
    return {
      head: (
        <>
          <span className="pcard__hot">{pointsWord(toPass(lineScore, data.score))}</span> from the{' '}
          {line.label.toLowerCase()}
        </>
      ),
      sub,
    }
  }
  if (line && !scoresReady) return { head: <Skel w="14ch" />, sub }
  return {
    head: (
      <>
        <span className="pcard__hot">#{rank.toLocaleString()}</span> {where} {word}
      </>
    ),
    sub,
  }
}

/**
 * The top of a player's page: the card. The character big on the left, the
 * tag, where they stand this period and what's next, on a line; the week, the
 * month and all time down the right; and along the bottom what they've
 * collected. In the top ten it talks about the players around them; below it,
 * about the next share of the arcade to reach, which reads the same however
 * many are playing. Washed in the character's colour, like every banner on
 * the site.
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
  scores,
  trophies,
  actions,
  backHref,
  howHref,
  extra,
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
  /** Points at the share lines ahead, by place, and whether they have landed. */
  scores: { scores: Record<number, number>; ready: boolean }
  trophies: TrophyAward[] | null
  actions: ReactNode
  /** Someone else's card has a way back to the rankings. */
  backHref?: string
  howHref: string
  /** One more fact along the card's foot: on your own, the way to your stats. */
  extra?: ReactNode
}) {
  const style = accent
    ? ({ '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties)
    : undefined
  const word = periodWord(period)
  const said = loading
    ? null
    : standing({ name, isSelf, period, ranks, data, where, scores: scores.scores, scoresReady: scores.ready })
  const rank = data.rank
  const placed = Object.keys(data.byGame).length
  const inPlaces = rank != null && talksInPlaces(rank, data.totalPlayers)
  const summary = trophies ? summarizeTrophies(trophies) : null

  const hrefFor = (p: LeaderboardPeriod) => rankHref(isSelf ? undefined : name, p)
  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    navigate(href)
  }
  const toHow = (e: MouseEvent<HTMLAnchorElement>) => {
    const how = document.getElementById('rank-how')
    if (!how) return
    e.preventDefault()
    if (how instanceof HTMLDetailsElement) how.open = true
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    how.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
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
      className="home-banner pcard"
      style={style}
      aria-label={isSelf ? 'Your player card' : `${name}'s player card`}
    >
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
                Rankings
              </a>
            ) : null}
            <p className="home-banner__kicker">{isSelf ? 'Your player card' : 'Player card'}</p>
            {!loading && data.totalPlayers > 0 ? (
              <span className="home-banner__kicker-note">
                {data.totalPlayers.toLocaleString()} {data.totalPlayers === 1 ? 'player' : 'players'} {word}
              </span>
            ) : null}
          </div>
          <h1 className="pcard__name">{name}</h1>
          <p className="pcard__head">{said ? said.head : <Skel w="16ch" />}</p>
          <p className="pcard__sub">{said ? said.sub : <Skel w="24ch" />}</p>
          {!loading && rank != null ? (
            inPlaces ? (
              <PlacesLine name={name} data={data} />
            ) : (
              <ShareBar name={name} data={data} scores={scores.scores} />
            )
          ) : null}
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
                  <span className="pcard__period-sub">
                    {!row ? (
                      <Skel w="9ch" />
                    ) : ranked ? (
                      `${pts(row.score)} · ${
                        talksInPlaces(row.rank!, row.totalPlayers) || row.rank === row.totalPlayers
                          ? `of ${row.totalPlayers.toLocaleString()} players`
                          : `ahead of ${(row.totalPlayers - row.rank!).toLocaleString()}`
                      }`
                    ) : p === 'all' ? (
                      'No runs yet'
                    ) : (
                      `No runs ${periodWord(p)}`
                    )}
                  </span>
                </span>
                <span className="pcard__period-figure">
                  {!row ? <Skel w="3ch" /> : ranked ? `#${row.rank!.toLocaleString()}` : 'Not yet'}
                </span>
              </a>
            )
          })}
        </nav>
      </div>
      <div className="home-banner__strip pcard__strip">
        <span className="pcard__fact">
          {loading ? (
            <Skel w="12ch" />
          ) : (
            <>
              <b>{placed}</b> of {VISIBLE_LEADERBOARD_GAMES.length} games placed {word}
            </>
          )}
        </span>
        <span className="pcard__fact">
          {!summary ? (
            <Skel w="10ch" />
          ) : summary.total === 0 ? (
            'No trophies yet'
          ) : (
            <>
              <b>{summary.total}</b> {summary.total === 1 ? 'trophy' : 'trophies'}
              {summary.events > 0 ? (
                <>
                  {' '}
                  · <b>{summary.events}</b> {summary.events === 1 ? 'event' : 'events'} won
                </>
              ) : null}
            </>
          )}
        </span>
        {extra}
        {!loading && rank != null && !inPlaces && data.totalPlayers > rank ? (
          <span className="pcard__fact">
            Ahead of <b>{(data.totalPlayers - rank).toLocaleString()}</b> players {word}
          </span>
        ) : null}
        <a className="home-banner__standing-link" href={howHref} onClick={toHow}>
          How ranks work ›
        </a>
      </div>
    </section>
  )
}
