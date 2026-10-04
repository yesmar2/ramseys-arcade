import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { resolveGameAccent } from '../lib/theme'
import { howItWins, type TournamentSummary } from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import { medalKind } from './PodiumMedal'

const PLACES = ['1st', '2nd', '3rd']

/** The row's layout for how many cards are in it: three across, four, or the day's three over the week's two. */
/**
 * How many cards On now had last time on this device: its skeleton holds that many while the events load, and
 * none when it had nothing (the arcade's own events paused, a quiet week), so it never shows cards and then
 * goes. Not known yet (a first look), it waits unseen rather than guessing.
 */
const SHOWN_KEY = 'skermix-onnow-cards'

function shownLastTime(): number | null {
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    const n = raw == null ? NaN : Number(raw)
    return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null
  } catch {
    return null
  }
}

function gridClass(count: number) {
  return `onnow__grid${count === 4 ? ' onnow__grid--four' : count === 5 ? ' onnow__grid--five' : ''}`
}

function gameNames(t: TournamentSummary): string {
  return t.games.map((slug) => getGame(slug)?.name ?? slug).join(' · ')
}

/** One game's colour for a one-game event; the site's own for a mix. */
function eventAccent(t: TournamentSummary): string {
  const slug = t.games.length === 1 ? t.games[0] : null
  return slug ? resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)') : 'var(--accent)'
}

function EventArt({ t }: { t: TournamentSummary }) {
  return (
    <span className={`onnow-card__art${t.games.length > 1 ? ' onnow-card__art--stack' : ''}`} aria-hidden="true">
      {t.games.slice(0, 3).map((slug) => (
        <GameThumbArt key={slug} slug={slug} accent={resolveGameAccent(slug, getGame(slug)?.accent ?? 'var(--accent)')} />
      ))}
    </span>
  )
}

/**
 * Today's event or the weekly, running now: its game, its clock, how it is won,
 * where you stand in it, and a way in.
 */
function RunningCard({
  t,
  mine,
  joined,
  champion,
}: {
  t: TournamentSummary
  /** The same event from your joined list, which carries your place in it. */
  mine: TournamentSummary | null
  joined: boolean
  /** You won the last one of these. */
  champion: boolean
}) {
  const place = mine?.yourPlace ?? null
  const sub = t.games.length > 1 ? gameNames(t) : howItWins(t)
  const players = t.playerCount
  // A line about you stays on a phone, where the card is a slim row; the others go (home.css).
  const aboutYou = Boolean(joined || champion)
  let line: string
  if (joined && place) {
    line = `You're ${PLACES[place - 1] ?? `#${place}`} of ${players}.`
  } else if (champion) {
    line = "You won last week's. Hold the title."
  } else if (joined) {
    line = "You're in. Post a score to get on its board."
  } else if (t.games.length > 1) {
    // How the event scores its games is on its own page; the card says what to do.
    const count = numberWord(t.games.length)
    const all = t.games.length === 2 ? 'play both' : 'play them all'
    line = `${count.charAt(0).toUpperCase()}${count.slice(1)} games, one winner: ${all}.${players > 0 ? ` ${players} in so far.` : ''}`
  } else if (players === 0) {
    line = 'No entries yet. The first score in sets the bar.'
  } else {
    line = `${players} ${players === 1 ? 'player' : 'players'} in so far.`
  }

  return (
    <a className="onnow-card" href={tournamentHref(t.id)} style={{ '--ev-accent': eventAccent(t) } as CSSProperties}>
      <span className="onnow-card__head">
        <EventArt t={t} />
        <span className="onnow-card__titles">
          <span className="onnow-card__title">{t.title}</span>
          <span className={`onnow-card__sub${t.games.length > 1 ? '' : ' onnow-card__sub--rule'}`}>{sub}</span>
        </span>
        <EventCountdown
          endsAt={t.endsAt}
          unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
          className="onnow-card__clock"
        />
      </span>
      <span className={`onnow-card__line${aboutYou ? ' onnow-card__line--you' : ''}`}>{line}</span>
      <span className="onnow-card__foot">
        <span className="onnow-card__go">{joined ? 'Open' : 'Join'}</span>
      </span>
    </a>
  )
}

/** Last week's weekly, over: who stood on the podium, by place and name, and how many played. */
function ResultCard({ t, you }: { t: TournamentSummary; you: string }) {
  const title = t.title.startsWith('Weekly ') ? `Last week's ${t.title.slice('Weekly '.length)}` : `Last week: ${t.title}`
  return (
    <a className="onnow-card onnow-card--result" href={tournamentHref(t.id)}>
      <span className="onnow-card__head">
        <span className="onnow-card__art onnow-card__art--trophy" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
        </span>
        <span className="onnow-card__titles">
          <span className="onnow-card__title">{title}</span>
          <span className="onnow-card__sub">{gameNames(t)}</span>
        </span>
        <span className="onnow-card__clock">
          {t.playerCount} {t.playerCount === 1 ? 'player' : 'players'}
        </span>
      </span>
      <ol className="onnow-podium" aria-label="Final podium">
        {(t.podium ?? []).slice(0, 3).map((p) => (
          <li
            key={p.place}
            className={`onnow-podium__place onnow-podium__place--${medalKind(p.place) ?? 'none'}${p.name === you ? ' onnow-podium__place--you' : ''}`}
          >
            <span className="onnow-podium__rank">{PLACES[p.place - 1] ?? `#${p.place}`}</span>
            <span className="onnow-podium__name">{p.name}</span>
          </li>
        ))}
      </ol>
      <span className="onnow-card__foot">
        <span className="onnow-card__more">Final board ›</span>
      </span>
    </a>
  )
}

/** A card's shape while what goes in it loads. */
function SkeletonCard() {
  return (
    <span className="onnow-card onnow-card--skel">
      <span className="skel-line" style={{ '--skel-w': '9rem' } as CSSProperties} />
      <span className="skel-line" style={{ '--skel-w': '13rem' } as CSSProperties} />
    </span>
  )
}

/**
 * On now, on the home page: today's event, this week's weekly and how last
 * week's finished. The day's dailies (Today's Hole, Track, Wanted, Pour and
 * Course) are cards on the Dailies row above it (HomeToday). There is nearly
 * always a day's event and a weekly running, and
 * last week's podium stays up until the next one ends, so the row reads full
 * on a quiet day as on a busy one. While the events load, cards of the same
 * shape hold the space, as many as it had last time (SHOWN_KEY).
 */
export function HomeOnNow() {
  const name = normalizePlayerName(usePlayerName())
  const { official, mine, joinedIds, lastWeekly, loading } = useLiveEvents(name)
  const daily = official.find((t) => t.cadence === 'daily') ?? null
  const weekly = official.find((t) => t.cadence === 'weekly') ?? null
  const mineById = (id: string) => mine.find((t) => t.id === id) ?? null
  const [lastTime] = useState(shownLastTime)
  const count = [daily, weekly, lastWeekly].filter(Boolean).length
  useEffect(() => {
    if (loading) return
    try {
      localStorage.setItem(SHOWN_KEY, String(count))
    } catch {
      /* a private window keeps nothing: next time it waits unseen */
    }
  }, [loading, count])

  if (loading) {
    if (!lastTime) return null
    return (
      <section className="onnow" aria-labelledby="onnow-title" aria-busy="true">
        <div className="home-section__bar">
          <h2 id="onnow-title" className="home-section__title">
            On now
          </h2>
        </div>
        <ul className={gridClass(lastTime)} aria-hidden="true">
          {Array.from({ length: lastTime }, (_, i) => i).map((i) => (
            <li key={i}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (!count) return null

  return (
    <section className="onnow" aria-labelledby="onnow-title">
      <div className="home-section__bar">
        <h2 id="onnow-title" className="home-section__title">
          On now
        </h2>
        <a className="home-section__more" href={tournamentsHref()}>
          All events ›
        </a>
      </div>
      <ul className={gridClass(count)}>
        {daily ? (
          <li data-hunt="home-onnow">
            <RunningCard t={daily} mine={mineById(daily.id)} joined={joinedIds.has(daily.id)} champion={false} />
          </li>
        ) : null}
        {weekly ? (
          <li>
            <RunningCard
              t={weekly}
              mine={mineById(weekly.id)}
              joined={joinedIds.has(weekly.id)}
              champion={Boolean(name) && lastWeekly?.winner === name}
            />
          </li>
        ) : null}
        {lastWeekly ? (
          <li>
            <ResultCard t={lastWeekly} you={name} />
          </li>
        ) : null}
      </ul>
    </section>
  )
}
