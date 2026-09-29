import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref, rankHref } from '../hooks/useHashRoute'
import { neighboursOf, rivalOf } from '../hooks/useProfileBoards'
import { VISIBLE_LEADERBOARD_GAMES, type GlobalRankResult, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  andList,
  cheapestClimb,
  headToHead,
  ordinal,
  periodWord,
  pointsFromMissing,
  shareLines,
  sharedGames,
  type ByGame,
} from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'

/** A middling run on a board is worth about this many points. */
const MIDDLING = 50

type Side = {
  name: string
  rank: number
  score: number
  byGame: ByGame
  avatarId?: string
}

const gameName = (slug: string) => getGame(slug)?.name ?? slug

/** A player's places on the games shown on the wall. */
function onWall(byGame: ByGame): ByGame {
  return Object.fromEntries(
    Object.entries(byGame).filter(([slug]) => (VISIBLE_LEADERBOARD_GAMES as readonly string[]).includes(slug)),
  )
}

/**
 * Two players side by side: on your own card, you and whoever is just above
 * you (on top, whoever is chasing you); on someone else's, you and them; for
 * a visitor with no rank, them and whoever is just above them. The players
 * around, the games both have played and who placed higher, the games the
 * other one has played that you haven't, and what it would take to pass them.
 * However big the arcade gets, the player just above is close, so there is
 * always a way past. It says it in places and names; the points it works from
 * are on How your rank works.
 */
export function ProfileRival({
  name,
  isSelf,
  period,
  data,
  viewer,
  viewerData,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  /** The player's rank this period. */
  data: GlobalRankResult
  /** Who is looking, when it isn't the player, and their rank this period. */
  viewer: string
  viewerData: GlobalRankResult | null
}) {
  const word = periodWord(period)
  if (data.rank == null) return null
  const player: Side = { name, rank: data.rank, score: data.score, byGame: data.byGame, avatarId: data.avatarId }
  const visiting = !isSelf && Boolean(viewer) && viewer !== name && viewerData?.rank != null
  const neighbour = rivalOf(data)

  // Whose side the card takes (the "you"), and who they are measured against.
  let you: Side
  let them: Side
  if (visiting && viewerData?.rank != null) {
    you = { name: viewer, rank: viewerData.rank, score: viewerData.score, byGame: viewerData.byGame, avatarId: viewerData.avatarId }
    them = player
  } else {
    if (!neighbour) return null
    you = player
    them = { name: neighbour.name, rank: neighbour.rank, score: neighbour.score, byGame: neighbour.byGame ?? {}, avatarId: neighbour.avatarId }
  }
  const second = isSelf || visiting
  const youWord = second ? 'you' : name
  const haveWord = second ? 'haven’t' : 'hasn’t'

  // Columns run the player's first, in the page's colour.
  const first = visiting ? them : you
  const other = visiting ? you : them
  const firstLabel = isSelf ? 'You' : first.name
  const otherLabel = visiting ? 'You' : other.name
  const shared = sharedGames(first.byGame, other.byGame)
  const score = headToHead(shared)

  const gap = them.score - you.score
  const relation = gap > 0 ? `just ahead of ${youWord}` : gap < 0 ? `just behind ${youWord}` : `tied with ${youWord}`
  const sub = visiting
    ? `You’re #${you.rank.toLocaleString()} ${word}`
    : `#${them.rank.toLocaleString()} ${word}, ${relation}`

  // Games on the wall only: a hidden game still counts, but it can't be named as somewhere to go.
  const missing = pointsFromMissing(onWall(them.byGame), you.byGame)
  const missingNames = missing.slugs.map(gameName)
  const when = period === 'all' ? '' : ` ${word}`
  const theirsFrom =
    missing.slugs.length > 0 ? `${them.name} has played ${andList(missingNames)}${when}, and ${youWord} ${haveWord} yet.` : null

  // How to get past them, when they're ahead and right there. The sums stay hidden: a climb or a new game that would do it.
  let pass: string | null = null
  let climbSlug: string | null = null
  if (!visiting && gap >= 0) {
    const climb = cheapestClimb(you.byGame, gap)
    const unplayed = VISIBLE_LEADERBOARD_GAMES.some((slug) => !you.byGame[slug])
    const middling = unplayed && gap < MIDDLING
    const passWord = second ? 'pass' : 'passes'
    if (climb) {
      climbSlug = climb.slug
      const places = `${climb.places} ${climb.places === 1 ? 'place' : 'places'}`
      pass = middling
        ? `Climb ${places} on ${gameName(climb.slug)}, or try a game ${youWord} ${haveWord} played${when}, and ${youWord} could pass ${them.name}.`
        : `Climb ${places} on ${gameName(climb.slug)} and ${youWord} ${passWord} ${them.name}.`
    } else if (middling) {
      pass = `Play any game ${youWord} ${haveWord} tried${when} and ${youWord} could pass ${them.name}.`
    }
  }
  if (data.rank === 1 && isSelf) {
    pass = gap < 0 ? `You’re in front of ${them.name}.` : `You and ${them.name} are tied.`
  }

  const startWith = missing.slugs[0]
  const startPlace = startWith ? them.byGame[startWith]?.place : undefined
  const link = climbSlug && isSelf
    ? { href: gamePlayHref(climbSlug), text: `Play ${gameName(climbSlug)}` }
    : startWith && startPlace && (isSelf || visiting)
      ? {
          href: isSelf ? gamePlayHref(startWith) : gameHref(startWith),
          text: `${isSelf ? 'Start with' : 'Try'} ${gameName(startWith)}, where ${them.name} is ${ordinal(startPlace)}`,
        }
      : null

  const around = !visiting ? neighboursOf(data) : []
  // Of the lines across the board, only the top ten is drawn: the rest are shares, on How your rank works.
  const lines = shareLines(data.totalPlayers).filter((l) => l.key === 'ten')

  return (
    <article className="prival pcard-panel" id="rival" aria-labelledby="prival-title">
      <div className="prival__head">
        <PlayerAvatar avatarId={visiting ? you.avatarId : them.avatarId} name={visiting ? you.name : them.name} size="md" />
        <div className="prival__who">
          <h2 className="prival__title" id="prival-title">
            {second ? 'You' : name} and {visiting ? name : them.name}
          </h2>
          <span className="prival__sub">{sub}</span>
        </div>
        {shared.length > 0 ? (
          <span className="prival__score" aria-label={`${firstLabel} ${score.mine}, ${otherLabel} ${score.theirs}`}>
            <span className="prival__score-first">{score.mine}</span>
            <span className="prival__score-dash"> – </span>
            {score.theirs}
          </span>
        ) : null}
      </div>

      {!visiting && around.length > 1 ? (
        <div className="prival__around">
          <span className="prival__cap">Around {isSelf ? 'you' : name} {word}</span>
          <ol className="prival__list">
            {around.map((n) => {
              const line = lines.find((l) => l.rank === n.rank && around.some((m) => m.rank === n.rank + 1))
              const mine = n.name === name
              return (
                <li key={n.rank} className="prival__item">
                  <a className={`prival__row${mine ? ' prival__row--mine' : ''}`} href={rankHref(n.name, period)}>
                    <span className="prival__rank">{n.rank.toLocaleString()}</span>
                    <PlayerAvatar avatarId={n.avatarId} name={n.name} size="sm" />
                    <span className="prival__name">
                      {n.name}
                      {mine && isSelf ? <span className="pbest__you">You</span> : null}
                    </span>
                  </a>
                  {line ? (
                    <span className="pbest__line prival__line">
                      <span>{line.label}</span>
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      <div className="prival__table">
        <div className="prival__table-head">
          <span>{shared.length > 0 ? (second ? 'Games you’ve both played' : 'Games both have played') : 'Games in common'}</span>
          {shared.length > 0 ? (
            <>
              <span className="prival__col prival__col--first">{firstLabel}</span>
              <span className="prival__col">{otherLabel}</span>
            </>
          ) : null}
        </div>
        {shared.length > 0 ? (
          <ol className="prival__games">
            {shared.map((g) => {
              const game = getGame(g.slug)
              const accent = resolveGameAccent(g.slug, game?.accent ?? '#2eb8a0')
              const firstWins = g.mine < g.theirs
              const otherWins = g.theirs < g.mine
              return (
                <li key={g.slug} className="prival__game" style={{ '--tile-accent': accent } as CSSProperties}>
                  <GameThumbArt slug={g.slug} accent={accent} />
                  <span className="prival__game-name">{game?.name ?? g.slug}</span>
                  <span className={`prival__col prival__col--first${firstWins ? ' prival__col--win' : ''}`}>#{g.mine}</span>
                  <span className={`prival__col${otherWins ? ' prival__col--win' : ''}`}>#{g.theirs}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="prival__none">No games in common {word} yet.</p>
        )}
      </div>

      {theirsFrom || pass ? (
        <p className="prival__copy">
          {theirsFrom}
          {theirsFrom && pass ? ' ' : null}
          {pass}
        </p>
      ) : null}
      {link ? (
        <a className="prival__link" href={link.href}>
          {link.text} ›
        </a>
      ) : null}
    </article>
  )
}
