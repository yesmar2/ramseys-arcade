import { useEffect, useState, type CSSProperties } from 'react'
import { getGame, isDailyGame, isGameListed } from '../data/games'
import { gamePlayHref, seasonHref, standingsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { gapBetween } from '../lib/gameBoard'
import { useGlobalRank } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { slots, useRung, type Place, type Rung } from '../lib/heroRung'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal, periodWord } from '../lib/profileMath'
import { recordGap, recordValue } from '../lib/recordBook'
import { fetchGameRecords, GAMES_WITH_RECORDS, type RecordSummary } from '../lib/records'
import { daysLeftLabel, extraTickets, liveSeason, rewardAt, rewardPhrase, seasonProgress, seasonTop, useSeason } from '../lib/season'
import { resolveGameAccent } from '../lib/theme'
import { BlipPoll } from './BlipPoll'
import { GameArt } from './GameArt'
import { GameThumbArt } from './GameThumbArt'
import { SeasonScene } from './season/SeasonLook'
import '../styles/upNext.css'

/*
 * Up next for you, under today's ticket (D on the "Home page redesign" canvas, 2026-10-15): a row of cards picked
 * from your own games. The place you're after on the game you played last (or, with no score on it, the game
 * itself, to jump back in), a record you hold and could lose, Blip's question of the day, and the season's pass;
 * where there's no record or no season, your place in the Standings fills in. Each card has one way on. It took
 * the place of the banner that used to open the page for anyone who'd played before (HomeHero.tsx keeps a first
 * visit's welcome).
 */

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
)

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

/** A game's picture across the top of a card, its name (or what the card is) on a chip over it. */
function Band({ slug, chip, gold = false }: { slug: string; chip: string; gold?: boolean }) {
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)')
  return (
    <a className="unx__band" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true" style={{ '--unx-accent': accent } as CSSProperties}>
      <GameArt slug={slug} shape="card" fallback={<GameThumbArt slug={slug} accent={accent} />} />
      <span className={`unx__chip${gold ? ' unx__chip--gold' : ''}`}>{chip}</span>
    </a>
  )
}

/** The three around you on the board, in score order: who's behind, you, and the place you're after (or, on top, you). */
function ChaseSlots({ slug, rung }: { slug: string; rung: Rung }) {
  const s = slots(rung)
  if (!s) return null
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const said = [s.lo, s.mid, s.hi]
    .filter((p): p is Place => p != null)
    .map((p) => `${p === rung.you ? 'you' : p.name} ${fmt(p.score)} in ${ordinal(p.place)}`)
    .join(', ')
  const slot = (p: Place | null, at: 'lo' | 'mid' | 'hi') =>
    p ? (
      <span className={`unx__slot unx__slot--${at}${p === rung.you ? ' unx__slot--you' : ''}`}>
        <span className="unx__slot-who">
          {ordinal(p.place)} · {p === rung.you ? 'You' : p.name}
        </span>
        <b className="unx__slot-score">{fmt(p.score)}</b>
        <span className="unx__slot-bar" />
      </span>
    ) : (
      <span className={`unx__slot unx__slot--${at}`} />
    )
  return (
    <div className="unx__chase" role="img" aria-label={said}>
      {slot(s.lo, 'lo')}
      {slot(s.mid, 'mid')}
      {slot(s.hi, 'hi')}
    </div>
  )
}

/** The place you're after on the game you played last, with the players either side, and the way in. */
function ChaseCard({ slug, rung }: { slug: string; rung: Rung }) {
  const game = getGame(slug)!
  const { you, above, below } = rung
  const gap = above ? above.score - you.score : 0
  // A daily's rung is today's board, so its top is 1st today: a record is a course's best across all time.
  const daily = isDailyGame(slug)
  const kicker = above ? (above.place === 1 && !daily ? 'Your next record' : 'Your next place') : daily ? 'Your place' : 'Your record'
  const target = above ? (above.place === 1 ? (daily ? '1st today' : 'the record') : ordinal(above.place)) : ''
  const title = above
    ? gap > 0
      ? `${gapBetween(slug, above.score, you.score)} from ${target}`
      : `Tied with ${above.name} for ${ordinal(above.place)}`
    : daily
      ? `1st today on ${game.name}`
      : `You hold the ${game.name} record`
  // Tied with the player under you is a tie you got to first, not "0 behind".
  const belowGap = below ? you.score - below.score : 0
  const line = below
    ? belowGap > 0
      ? `${below.name} is ${gapBetween(slug, you.score, below.score)} behind you.`
      : `${below.name} is tied with you, and you got there first.`
    : null
  return (
    <article className="unx" aria-labelledby={`unx-chase-${slug}`}>
      <Band slug={slug} chip={game.name} />
      <div className="unx__body">
        <p className="unx__kick">{kicker}</p>
        <h3 id={`unx-chase-${slug}`} className="unx__title">
          {title}
        </h3>
        <ChaseSlots slug={slug} rung={rung} />
        {line ? <p className="unx__line">{line}</p> : null}
        <a className="unx__go" href={gamePlayHref(slug)}>
          <PlayIcon />
          Play {game.name}
        </a>
      </div>
    </article>
  )
}

/** The game you played last (or today's pick), when you've no place on its board to chase: straight back in. */
function PickCard({ slug, kicker }: { slug: string; kicker: string }) {
  const game = getGame(slug)!
  return (
    <article className="unx" aria-labelledby={`unx-pick-${slug}`}>
      <Band slug={slug} chip={kicker} />
      <div className="unx__body">
        <p className="unx__kick">{kicker}</p>
        <h3 id={`unx-pick-${slug}`} className="unx__title">
          {game.name}
        </h3>
        <p className="unx__line">{game.description}</p>
        <a className="unx__go" href={gamePlayHref(slug)}>
          <PlayIcon />
          Play {game.name}
        </a>
      </div>
    </article>
  )
}

/** A card still coming: the same frame, its words shimmering. */
function SkelCard({ dark = false, wide = false }: { dark?: boolean; wide?: boolean }) {
  return (
    <article className={`unx unx--skel${dark ? ' unx--season' : ''}${wide ? ' unx--wide' : ''}`} aria-hidden="true">
      <span className="unx__band" />
      <div className="unx__body">
        <p className="unx__kick">
          <span className="skel-line" style={skel('7rem')} />
        </p>
        <p className="unx__title">
          <span className="skel-line" style={skel('11rem')} />
        </p>
        <p className="unx__line">
          <span className="skel-line" style={skel('90%')} />
          <br />
          <span className="skel-line" style={skel('60%')} />
        </p>
        <span className="unx__go unx__go--skel">Play</span>
      </div>
    </article>
  )
}

/* ---------- a record you hold ---------- */

type Held = { slug: string; record: RecordSummary }

/** The record this device last saw you hold, per player and group, so its card comes at once and doesn't pop in. */
const HELD_KEY = 'skermix-held-record'

function readHeld(key: string): Held | null | undefined {
  try {
    const kept = JSON.parse(localStorage.getItem(HELD_KEY) ?? 'null') as { key?: string; held?: Held | null } | null
    if (!kept || kept.key !== key) return undefined
    return kept.held && kept.held.record?.top ? kept.held : null
  } catch {
    return undefined
  }
}

function keepHeld(key: string, held: Held | null) {
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify({ key, held }))
  } catch {
    /* a private window keeps nothing */
  }
}

/** How many of your latest games are asked about: one small ask each. */
const HELD_GAMES = 3

/**
 * A record you hold on one of the games you played last (records are all time, and your group's when one is
 * picked): the one the most players are on. Undefined while it isn't known, null with none.
 */
function useHeldRecord(name: string, recent: readonly string[]): Held | null | undefined {
  const groupId = useActiveGroup()
  const games = recent.filter((slug) => (GAMES_WITH_RECORDS as readonly string[]).includes(slug) && isGameListed(slug) && !isDailyGame(slug)).slice(0, HELD_GAMES)
  const asked = games.join(',')
  const key = name ? `${groupId ?? ''}|${name}|${asked}` : ''
  const [found, setFound] = useState<{ key: string; held: Held | null } | null>(null)
  useEffect(() => {
    if (!key) return
    if (!asked) {
      setFound({ key, held: null })
      return
    }
    let cancelled = false
    Promise.all(asked.split(',').map((slug) => fetchGameRecords(slug, 'all', name).then((r) => ({ slug, records: r.records }))))
      .then((all) => {
        if (cancelled) return
        let held: Held | null = null
        for (const { slug, records } of all) {
          for (const record of records) {
            if (record.you?.rank !== 1 || !record.top) continue
            if (!held || (record.players ?? 0) > (held.record.players ?? 0)) held = { slug, record }
          }
        }
        setFound({ key, held })
        keepHeld(key, held)
      })
      .catch(() => {
        // Nothing known: no card, rather than one that might be wrong.
        if (!cancelled) setFound({ key, held: null })
      })
    return () => {
      cancelled = true
    }
  }, [key, asked, name])
  if (!key) return null
  if (found?.key === key) return found.held
  return readHeld(key)
}

function RecordCard({ held, name }: { held: Held; name: string }) {
  const { slug, record } = held
  const game = getGame(slug)
  const top = record.top!
  const second = record.second ?? null
  return (
    <article className="unx" aria-labelledby={`unx-record-${slug}`}>
      <Band slug={slug} chip="Your record" gold />
      <div className="unx__body">
        <p className="unx__kick unx__kick--defend">Defend it</p>
        <h3 id={`unx-record-${slug}`} className="unx__title">
          {record.label} on {game?.name ?? slug}
        </h3>
        <ol className="unx__rows">
          <li className="unx__row unx__row--you">
            <span className="unx__row-place">1st</span>
            <b className="unx__row-name">{name} · you</b>
            <b className="unx__row-value">{recordValue(record, top.score)}</b>
          </li>
          {second ? (
            <li className="unx__row">
              <span className="unx__row-place">2nd</span>
              <span className="unx__row-name">{second.name}</span>
              <span className="unx__row-value">{recordValue(record, second.score)}</span>
            </li>
          ) : null}
        </ol>
        <p className="unx__line">
          {second
            ? second.score === top.score
              ? `${second.name} is tied with you.`
              : `${second.name} is ${recordGap(record, top.score, second.score)} behind.`
            : 'Nobody else is on it yet.'}
        </p>
        <a className="unx__go" href={gamePlayHref(slug)}>
          <PlayIcon />
          Play {game?.name ?? slug}
        </a>
      </div>
    </article>
  )
}

/* ---------- your place in the Standings, where a card is missing ---------- */

function StandingsCard() {
  const standing = useGlobalRank()
  const period = useDefaultPeriod()
  if (standing.rank == null) return null
  const rank = standing.rank
  const near = standing.nearby ?? []
  const ahead = near.find((n) => n.rank === rank - 1) ?? null
  const behind = near.find((n) => n.rank === rank + 1) ?? null
  const pts = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'point' : 'points'}`
  const row = (who: string, at: number, score: number, you = false) => (
    <li className={`unx__row${you ? ' unx__row--mine' : ''}`}>
      <span className="unx__row-place">{ordinal(at)}</span>
      {you ? <b className="unx__row-name">{who}</b> : <span className="unx__row-name">{who}</span>}
      {you ? <b className="unx__row-value">{score.toLocaleString()}</b> : <span className="unx__row-value">{score.toLocaleString()}</span>}
    </li>
  )
  return (
    <article className="unx unx--plain" aria-labelledby="unx-standings">
      <div className="unx__body">
        <p className="unx__kick">Standings · {periodWord(period)}</p>
        <h3 id="unx-standings" className="unx__title">
          You’re {ordinal(rank)}
          {standing.totalPlayers ? ` of ${standing.totalPlayers.toLocaleString()}` : ''}
        </h3>
        <ol className="unx__rows">
          {ahead ? row(ahead.name, ahead.rank, ahead.score) : null}
          {row('You', rank, standing.score, true)}
          {behind ? row(behind.name, behind.rank, behind.score) : null}
        </ol>
        <p className="unx__line">
          {ahead
            ? ahead.score === standing.score
              ? `Tied with ${ahead.name}, who got there first.`
              : `${pts(ahead.score - standing.score)} from ${ahead.name}, in ${ordinal(ahead.rank)}.`
            : 'Nobody’s ahead of you.'}
        </p>
        <a className="unx__go unx__go--quiet" href={standingsHref(period)}>
          See the Standings
        </a>
      </div>
    </article>
  )
}

/* ---------- the season ---------- */

/** The season's pass: your level and what's next on it, or for a first visit (`wide`, beside Blip), what it is. */
function SeasonCard({ wide = false }: { wide?: boolean }) {
  const store = useSeason()
  const season = liveSeason(store)
  if (!season) return null
  const you = store.you
  const top = seasonTop(store)
  const p = seasonProgress(season, you)
  const next = p.level < season.levels ? rewardAt(store.rewards, p.level + 1) : null
  const extra = !next && p.level >= season.levels && p.toNext != null ? extraTickets(season, p.level + 1) : null
  const into = p.level > 0 ? Math.round(p.fraction * season.perLevel) : 0
  const line = !you
    ? `Win tickets in any game to climb a free pass of ${season.levels} levels${wide ? ', with looks and ships to win on the way' : ''}.`
    : p.level <= 0
      ? 'Win a ticket in any game to start the pass.'
      : next && p.toNext != null
        ? `${p.toNext.toLocaleString()} ${p.toNext === 1 ? 'ticket' : 'tickets'} to Level ${next.level} and ${rewardPhrase(next)}.`
        : extra != null && p.toNext != null
          ? `${p.toNext.toLocaleString()} ${p.toNext === 1 ? 'ticket' : 'tickets'} to Level ${p.level + 1} and ${extra} bonus tickets.`
          : p.level >= top
            ? 'You’ve reached the top of the pass.'
            : 'Every ticket you win moves you up.'
  return (
    <article className={`unx unx--season${wide ? ' unx--wide' : ''}`} aria-labelledby="unx-season">
      <a className="unx__band" href={seasonHref()} tabIndex={-1} aria-hidden="true">
        <SeasonScene slug={season.slug} />
      </a>
      <div className="unx__body">
        <p className="unx__kick">
          Season {season.id} · {daysLeftLabel(season)}
        </p>
        <h3 id="unx-season" className="unx__title">
          {season.name}
        </h3>
        {you && p.level > 0 ? (
          <div className="unx__level">
            <b>Level {p.level}</b>
            <span className="unx__level-bar" role="img" aria-label={`${into} of ${season.perLevel} tickets to the next level`}>
              <span style={{ width: `${Math.round(p.fraction * 100)}%` }} />
            </span>
            <span className="unx__level-n">
              {into} / {season.perLevel}
            </span>
          </div>
        ) : null}
        <p className="unx__line">{line}</p>
        <a className="unx__go" href={seasonHref()}>
          See the pass
        </a>
      </div>
    </article>
  )
}

/** How long the row holds the season's place before the API says whether one is on (as the banner waited). */
const SEASON_WAIT_MS = 4000

export function HomeUpNext({ first = false }: { first?: boolean }) {
  const device = useDeviceType()
  const recent = useRecentGames()
  const name = normalizePlayerName(usePlayerName())
  const slug = heroSlug(device, recent)
  const { rung, loading } = useRung(slug, name)
  const held = useHeldRecord(name, recent)
  const standing = useGlobalRank()
  const store = useSeason()
  const [gaveUp, setGaveUp] = useState(false)
  const seasonUnknown = !store.loaded && !store.season && !gaveUp
  useEffect(() => {
    if (!seasonUnknown) return
    const timer = window.setTimeout(() => setGaveUp(true), SEASON_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [seasonUnknown])
  const season = liveSeason(store)
  // A first visit has nothing of its own to pick from yet: the season, wide, and Blip's question, after the games.
  if (first) {
    const wide = season ? <SeasonCard key="season" wide /> : seasonUnknown ? <SkelCard key="season" dark wide /> : null
    return (
      <section className={`upnext upnext--first${wide ? '' : ' upnext--alone'}`} aria-label="The season and Blip’s question">
        <div className="upnext__grid">
          {wide}
          <BlipPoll key="blip" />
        </div>
      </section>
    )
  }
  if (!slug || !getGame(slug)) return null

  const lastPlayed = recent.includes(slug)
  const kicker = lastPlayed ? 'Jump back in' : slug === newestSlug(device) ? 'New in the arcade' : 'Today’s pick'
  const lead = loading ? <SkelCard key="chase" /> : rung && slots(rung) ? <ChaseCard key="chase" slug={slug} rung={rung} /> : <PickCard key="chase" slug={slug} kicker={kicker} />
  const record = held ? <RecordCard key="record" held={held} name={name} /> : null
  const seasonCard = season ? <SeasonCard key="season" /> : seasonUnknown ? <SkelCard key="season" dark /> : null
  // Your place in the Standings, where there's no record or no season to show: never more than four cards.
  const fill = (!record || !seasonCard) && standing.rank != null ? <StandingsCard key="standings" /> : null
  return (
    <section className="upnext" aria-labelledby="upnext-title">
      <div className="upnext__head">
        <h2 id="upnext-title" className="upnext__title">
          Up next for you
        </h2>
        <span className="upnext__sub">Picked from your games{record ? ' and your records' : ''}</span>
      </div>
      <div className="upnext__grid">
        {lead}
        {record}
        <BlipPoll key="blip" />
        {seasonCard}
        {fill}
      </div>
    </section>
  )
}
