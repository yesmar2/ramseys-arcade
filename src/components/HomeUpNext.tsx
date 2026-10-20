import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
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
 * three or four of them across the row, never fewer than three (FEWEST_CARDS: more games fill it out), and on a
 * phone the first two, one under the other (upNext.css). Each card has one way on. It took the place of the banner that used to open the page for anyone who'd played before
 * (HomeHero.tsx keeps a first visit's welcome).
 */

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
)

const skel = (w: string) => ({ '--skel-w': w }) as CSSProperties

/*
 * A card's picture, poster-style (B on the "Up Next Looks" canvas, 2026-10-20): the game's whole 4:3 picture,
 * uncut, with what the card is about over its foot. The pictures before it, a scene sliced to a strip and then the
 * game's middle in a tile or a medal, never pleased Ramsey; the whole picture can't cut anyone in half.
 */
function Pic({ slug, kicker, kickClass, title, titleId, chip }: { slug: string; kicker: ReactNode; kickClass?: string; title: ReactNode; titleId: string; chip?: ReactNode }) {
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)')
  return (
    <div className="unx__pic" style={{ '--unx-accent': accent } as CSSProperties}>
      <a className="unx__pic-art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
        <GameArt slug={slug} shape="card" fallback={<GameThumbArt slug={slug} accent={accent} />} />
      </a>
      {chip}
      <div className="unx__over">
        <p className={`unx__kick${kickClass ? ` ${kickClass}` : ''}`}>{kicker}</p>
        <h3 id={titleId} className="unx__title">
          {title}
        </h3>
      </div>
    </div>
  )
}

const CrownIcon = () => (
  <svg viewBox="0 0 24 16" fill="currentColor" aria-hidden="true">
    <path d="M1 4l5.5 4.5L12 1l5.5 7.5L23 4l-2.2 11H3.2z" />
  </svg>
)

function Go({ slug }: { slug: string }) {
  return (
    <a className="unx__go" href={gamePlayHref(slug)}>
      <PlayIcon />
      Play {getGame(slug)?.name ?? slug}
    </a>
  )
}

/** The three around you on the board, as the board has them: the place you're after, you, and who's behind. */
function ChaseLadder({ slug, rung }: { slug: string; rung: Rung }) {
  const s = slots(rung)
  if (!s) return null
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  return (
    <ol className="unx__ladder" aria-label={`${getGame(slug)?.name ?? slug} board around you`}>
      {[s.hi, s.mid, s.lo]
        .filter((p): p is Place => p != null)
        .map((p) => {
          const you = p === rung.you
          return (
            <li key={`${p.place}-${p.name}`} className={`unx__rung${you ? ' unx__rung--you' : p === s.hi ? ' unx__rung--hi' : ''}`}>
              <span className="unx__rung-who">
                {ordinal(p.place)} · {you ? 'You' : p.name}
              </span>
              <b className="unx__rung-score">{fmt(p.score)}</b>
            </li>
          )
        })}
    </ol>
  )
}

/** The place you're after on a game you played lately, with the players either side, and the way in. */
function ChaseCard({ slug, rung }: { slug: string; rung: Rung }) {
  const game = getGame(slug)!
  const { you, above } = rung
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
  return (
    <article className="unx" aria-labelledby={`unx-chase-${slug}`}>
      <Pic slug={slug} kicker={`${game.name} · ${kicker}`} title={title} titleId={`unx-chase-${slug}`} />
      <div className="unx__body">
        <ChaseLadder slug={slug} rung={rung} />
        <Go slug={slug} />
      </div>
    </article>
  )
}

/** A game you played lately (or today's pick), when you've no place on its board to chase: straight back in. */
function PickCard({ slug, kicker }: { slug: string; kicker: string }) {
  const game = getGame(slug)!
  return (
    <article className="unx" aria-labelledby={`unx-pick-${slug}`}>
      <Pic slug={slug} kicker={kicker} title={game.name} titleId={`unx-pick-${slug}`} />
      <div className="unx__body">
        <p className="unx__line">{game.description}</p>
        <Go slug={slug} />
      </div>
    </article>
  )
}

/** A card still coming: the same frame, its words shimmering. */
function SkelCard({ dark = false, wide = false }: { dark?: boolean; wide?: boolean }) {
  return (
    <article className={`unx unx--skel${dark ? ' unx--season' : ''}${wide ? ' unx--wide' : ''}`} aria-hidden="true">
      <span className="unx__pic" />
      <div className="unx__body">
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
 * picked): the one the most players are on. Never on the game the row opens with (`lead`): one card a game
 * (Ramsey, 2026-10-19: "i don't like when there are two cards for the same game"). Undefined while it isn't
 * known, null with none.
 */
function useHeldRecord(name: string, recent: readonly string[], lead: string | null): Held | null | undefined {
  const groupId = useActiveGroup()
  const games = recent
    .filter((slug) => slug !== lead && (GAMES_WITH_RECORDS as readonly string[]).includes(slug) && isGameListed(slug) && !isDailyGame(slug))
    .slice(0, HELD_GAMES)
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
      <Pic
        slug={slug}
        kicker="Defend it"
        kickClass="unx__kick--defend"
        title={`${record.label} on ${game?.name ?? slug}`}
        titleId={`unx-record-${slug}`}
        chip={
          <span className="unx__chip">
            <CrownIcon />
            Your record
          </span>
        }
      />
      <div className="unx__body">
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
        <Go slug={slug} />
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
  // Signed out, what tickets are, said where a first-timer meets them (Ramsey's pick, "Launch UX picks", 2026-10-20).
  const line = !you
    ? `Every game wins you tickets: spend them on looks, and they climb a free pass of ${season.levels} levels.`
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
      <div className="unx__pic">
        <a className="unx__pic-art" href={seasonHref()} tabIndex={-1} aria-hidden="true">
          <SeasonScene slug={season.slug} />
        </a>
        <div className="unx__over">
          <p className="unx__kick">
            Season {season.id} · {daysLeftLabel(season)}
          </p>
          <h3 id="unx-season" className="unx__title">
            {season.name}
          </h3>
        </div>
      </div>
      <div className="unx__body">
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
  const held = useHeldRecord(name, recent, slug)
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
      <div className={`upnext__grid upnext__grid--${have + fill.length}`}>
        {lead}
        {record}
        <BlipPoll key="blip" look="card" />
        {seasonCard}
        {fillers}
      </div>
    </section>
  )
}
