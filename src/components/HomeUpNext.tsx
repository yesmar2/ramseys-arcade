import { useEffect, useState, type CSSProperties } from 'react'
import { getGame, isDailyGame, isGameListed } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { gamePlayHref, seasonHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType, type DeviceType } from '../lib/device'
import { gapBetween } from '../lib/gameBoard'
import { useActiveGroup } from '../lib/groups'
import { slots, useRung, type Place, type Rung } from '../lib/heroRung'
import { heroSlug, newestSlug, playableHomeGames } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { usePoll } from '../lib/poll'
import { ordinal } from '../lib/profileMath'
import { recordGap, recordValue } from '../lib/recordBook'
import { fetchGameRecords, GAMES_WITH_RECORDS, type RecordSummary } from '../lib/records'
import { daysLeftLabel, extraTickets, liveSeason, rewardAt, rewardPhrase, seasonProgress, seasonTop, useSeason } from '../lib/season'
import { resolveGameAccent } from '../lib/theme'
import { BlipPoll } from './BlipPoll'
import { GameArt } from './GameArt'
import { GameThumbArt } from './GameThumbArt'
import { SeasonScene } from './season/SeasonLook'
import { nextSeasonSoon } from './season/NextSeason'
import '../styles/upNext.css'

/*
 * Up next for you, under today's ticket (D on the "Home page redesign" canvas, 2026-10-15): a row of cards picked
 * from your own games. The place you're after on the game you played last (or, with no score on it, the game
 * itself, to jump back in), a record you hold and could lose, Blip's question of the day, and the season's pass:
 * three or four of them across the row, never fewer than three (FEWEST_CARDS: more games fill it out). Each card
 * has one way on. It took the place of the banner that used to open the page for anyone who'd played before
 * (HomeHero.tsx keeps a first visit's welcome).
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
  // In the season's last week, the next one's name: seasons run back to back.
  const soon = nextSeasonSoon(season, store.next)
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
        {soon && store.next ? <p className={`unx__next season-${store.next.slug}`}>{soon}</p> : null}
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

/*
 * The fewest cards the row shows: two spread thin across the page (Ramsey, 2026-10-16: "it looks a little funny
 * when there is only two, i think we always need to have at least 3"). With no record held, no season on or no
 * question from Blip, more games fill it out. The Standings card that used to fill in went because it repeated
 * the Standings further down the page.
 */
const FEWEST_CARDS = 3

type Filler = { slug: string; kicker: string; played: boolean }

/**
 * Games to fill the row out with, best first: another game you've played lately, then games you haven't tried
 * (the arcade's newest first, then a different one each day), then more of yours. Never a daily (today's ticket
 * is above the row) or a game the row already has (`taken`).
 */
function fillerGames(device: DeviceType, recent: readonly string[], taken: readonly string[]): Filler[] {
  const playable = playableHomeGames(device)
    .map((g) => g.slug)
    .filter((slug) => !isDailyGame(slug) && !taken.includes(slug))
  const played = recent.filter((slug) => playable.includes(slug))
  const untried = playable.filter((slug) => !recent.includes(slug))
  const day = Math.floor(Date.now() / 86_400_000)
  const turned = untried.length ? [...untried.slice(day % untried.length), ...untried.slice(0, day % untried.length)] : []
  const newest = newestSlug(device)
  const fresh = newest && turned.includes(newest) ? [newest, ...turned.filter((slug) => slug !== newest)] : turned
  return [
    ...played.slice(0, 1).map((slug) => ({ slug, kicker: 'Played lately', played: true })),
    ...fresh.map((slug) => ({ slug, kicker: slug === newest ? 'New in the arcade' : 'Try something new', played: false })),
    ...played.slice(1).map((slug) => ({ slug, kicker: 'Played lately', played: true })),
  ]
}

export function HomeUpNext({ first = false }: { first?: boolean }) {
  const device = useDeviceType()
  const recent = useRecentGames()
  const name = normalizePlayerName(usePlayerName())
  const slug = heroSlug(device, recent)
  const { rung, loading } = useRung(slug, name)
  const held = useHeldRecord(name, recent)
  const store = useSeason()
  const [gaveUp, setGaveUp] = useState(false)
  const seasonUnknown = !store.loaded && !store.season && !gaveUp
  useEffect(() => {
    if (!seasonUnknown) return
    const timer = window.setTimeout(() => setGaveUp(true), SEASON_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [seasonUnknown])
  const season = liveSeason(store)
  // Blip's card is missing when there's no question today or the API couldn't say (BlipPoll.tsx).
  const { signedIn } = useAuth()
  const poll = usePoll(signedIn)
  const blipShown = !(poll.status === 'error' || (poll.status === 'ready' && !poll.view?.today))
  // A record's card or the season's still coming holds its place (the season's as a skeleton), so it counts.
  const have = 1 + (held ? 1 : 0) + (blipShown ? 1 : 0) + (season || seasonUnknown ? 1 : 0)
  const need = first || !slug ? 0 : Math.max(0, FEWEST_CARDS - have)
  const fill = need ? fillerGames(device, recent, [slug!, ...(held ? [held.slug] : [])]).slice(0, need) : []
  // A game you played lately gets its board's chase too, as the row's first card does.
  const playedFill = fill.find((f) => f.played) ?? null
  const { rung: fillRung, loading: fillLoading } = useRung(playedFill?.slug ?? null, name)
  // A first visit has nothing of its own to pick from yet: the season, wide, and Blip's question, after the games.
  if (first) {
    const wide = season ? <SeasonCard key="season" wide /> : seasonUnknown ? <SkelCard key="season" dark wide /> : null
    return (
      <section className={`upnext upnext--first${wide ? '' : ' upnext--alone'}`} aria-label="The season and Blip’s question">
        <div className="upnext__grid">
          {wide}
          <BlipPoll key="blip" look="card" />
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
  // Last in the row, so a season that turns out to be off hands its place to a game rather than moving the row.
  const fillers = fill.map((f) =>
    f === playedFill && fillLoading ? (
      <SkelCard key={`fill-${f.slug}`} />
    ) : f === playedFill && fillRung && slots(fillRung) ? (
      <ChaseCard key={`fill-${f.slug}`} slug={f.slug} rung={fillRung} />
    ) : (
      <PickCard key={`fill-${f.slug}`} slug={f.slug} kicker={f.kicker} />
    ),
  )
  return (
    <section className="upnext" aria-labelledby="upnext-title">
      <div className="upnext__head">
        <h2 id="upnext-title" className="upnext__title">
          Up next for you
        </h2>
        <span className="upnext__sub">
          {record ? 'Picked from your games and your records' : fill.some((f) => !f.played) ? 'Picked for you' : 'Picked from your games'}
        </span>
      </div>
      <div className="upnext__grid">
        {lead}
        {record}
        <BlipPoll key="blip" look="card" />
        {seasonCard}
        {fillers}
      </div>
    </section>
  )
}
