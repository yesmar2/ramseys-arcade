import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { rankHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import { HomeOfficialEvents } from './HomeOfficialEvents'
import { PlayerMark } from './PlayerMark'
import { PodiumMedal, medalKind } from './PodiumMedal'

/**
 * The rail beside the banner, a strip under it on a narrow screen: the
 * things that are always true today.
 *
 * Your standing on the board, the daily and weekly events with their clocks,
 * and the soonest event you are in. Nothing here depends on how many people
 * are playing — a standing exists for anyone who has played, there is nearly
 * always a daily and a weekly running, and the last card only shows when
 * you are in something — so it is full on the first day as on the thousandth.
 */
export function HomePulse() {
  // Keyed on the active tag, like the wall and the hub: the rank below is fetched by name,
  // so a borrowed tag in dev or a remembered one with a lapsed session shows its standing too.
  const name = normalizePlayerName(usePlayerName())
  const { rank, score, totalPlayers, avatarId } = useGlobalRank()
  const loading = useGlobalRankLoading()
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()
  const { mine } = useLiveEvents(name)
  const medal = !loading && rank != null ? medalKind(rank) : null
  // The official fixtures already have their own rows above; this card is for the rest.
  const next = mine.find((t) => !t.official) ?? null
  const nextSlug = next?.games[0] ?? null
  const nextAccent = next
    ? resolveGameAccent(nextSlug ?? '', getGame(nextSlug ?? '')?.accent ?? 'var(--accent)')
    : null

  return (
    <div className="home-pulse">
      {name ? (
        <a
          className={`home-pulse__standing${medal ? ` home-pulse__standing--${medal}` : ''}`}
          href={rankHref()}
        >
          <span className="home-pulse__k">{groupId ? 'Your group standing' : 'Your standing'}</span>
          <span className="home-pulse__me">
            <PlayerMark
              name={name}
              avatarId={avatarId}
              className="home-pulse__mark"
              badge={medal ? <PodiumMedal kind={medal} period={period} /> : null}
            />
            <span className="home-pulse__figure">
              <span className="home-pulse__v">
                {loading ? (
                  <span className="skel-line" aria-hidden="true" />
                ) : rank != null ? (
                  `#${rank}`
                ) : (
                  'Not ranked yet'
                )}
              </span>
              <span className="home-pulse__tag">{name}</span>
            </span>
            {!loading && rank != null ? (
              <span className="home-pulse__pts">
                <b>{score.toLocaleString()}</b> pts
              </span>
            ) : null}
          </span>
          <span className="home-pulse__n">
            {PERIOD_LABELS[period]}
            {!loading && totalPlayers > 0
              ? ` · ${totalPlayers.toLocaleString()} ${totalPlayers === 1 ? 'player' : 'players'} ranked`
              : null}{' '}
            ›
          </span>
        </a>
      ) : (
        <a className="home-pulse__standing" href={rankHref()}>
          <span className="home-pulse__k">Your standing</span>
          <span className="home-pulse__v">Not on the boards yet</span>
          <span className="home-pulse__n">Sign in with a gamer tag to get one ›</span>
        </a>
      )}
      <HomeOfficialEvents />
      {next ? (
        <a
          className="home-pulse__next"
          href={tournamentHref(next.id)}
          style={{ '--ev-accent': nextAccent } as CSSProperties}
        >
          <span className="home-pulse__next-art" aria-hidden="true">
            <GameThumbArt slug={nextSlug ?? ''} accent={nextAccent ?? undefined} />
          </span>
          <span className="home-pulse__next-body">
            <span className="home-pulse__k">Your next event</span>
            <span className="home-pulse__next-title">{next.title}</span>
            <EventCountdown
              endsAt={next.endsAt}
              unlimitedDuration={Boolean(next.rules.unlimitedDuration)}
              className="home-pulse__n"
            />
          </span>
          <span className="home-pulse__next-go">Open</span>
        </a>
      ) : null}
    </div>
  )
}
