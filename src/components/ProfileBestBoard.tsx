import type { CSSProperties } from 'react'
import { getGame, isDailyGame } from '../data/games'
import { boardPlaceHref, gamePlayHref, rankHref } from '../hooks/useHashRoute'
import { usePlayersAround, type BoardRow, type GameBest } from '../hooks/useProfileBoards'
import { inkOn, readableFill } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { hasGamePreview } from '../lib/gamePreviews'
import type { GlobalGamePlace, LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { bestBoard, nextRunLine, ordinal, scoreWithUnit } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { GameArt } from './GameArt'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerName } from './PlayerName'

type Row =
  | { kind: 'run'; rank: number; name: string; score: number; avatarId?: string }
  | { kind: 'gap'; players: number }
  | { kind: 'line'; label: string }

/** The lines drawn across the list and named in the copy; a share line (the top 10%, 25% or half) is told as its place. */
function namedLine(label: string): boolean {
  return label === 'top ten' || label === 'top three'
}

/**
 * The rows to show from a board, a player each: the top five when the player is among them; otherwise the
 * record, the player on the line being chased, and the players either side of this one, with the line drawn
 * where it falls when it is the top ten or the top three.
 */
function boardRows(best: GameBest, rows: BoardRow[], line: { rank: number; label: string } | null, lineRow: BoardRow | null): Row[] {
  const run = (r: BoardRow): Row => ({ kind: 'run', rank: r.rank, name: r.entry.name, score: r.entry.score, avatarId: r.entry.avatarId })
  const out: Row[] = []
  const lineLabel = line && line.label !== 'record' ? line.label : null
  const drawn = lineLabel && namedLine(lineLabel) ? lineLabel : null
  const pinned = lineRow && lineLabel && !rows.some((r) => r.rank === lineRow.rank) ? lineRow : null
  // With the line's player pinned above them, the players around this one are cut to one either side.
  const window = pinned ? rows.filter((r) => Math.abs(r.rank - best.rank) <= 1) : rows
  const first = window[0]?.rank ?? best.rank
  if (first > 1 && best.record) {
    out.push({ kind: 'run', rank: 1, name: best.record.name, score: best.record.score, avatarId: best.record.avatarId })
    const until = pinned ? pinned.rank : first
    if (until > 2) out.push({ kind: 'gap', players: until - 2 })
  }
  if (pinned) {
    out.push(run(pinned))
    if (drawn) out.push({ kind: 'line', label: drawn })
    if (first > pinned.rank + 1) out.push({ kind: 'gap', players: first - pinned.rank - 1 })
  }
  for (const r of window) {
    out.push(run(r))
    if (drawn && !pinned && line && r.rank === line.rank) out.push({ kind: 'line', label: drawn })
  }
  return out
}

/**
 * The game a player does best on, all time, among its players: the place that beats the biggest share of the
 * board's players (the all-time rank's places), with the player's best run on it. A daily's all-time board is
 * its day points, not a run (leaderboardFormat isDayPointsBoard), so the dailies are left out.
 */
function bestGame(bests: Record<string, GameBest>, places: Partial<Record<string, GlobalGamePlace>> | null): GameBest | null {
  const asPlayers = Object.values(bests)
    .filter((b) => !isDailyGame(b.slug))
    .map((b) => {
      const at = places?.[b.slug]
      // An API that sends no players' count leaves the run's place on the board of runs.
      return at?.total ? { ...b, rank: at.place, total: at.total } : b
    })
  return bestBoard(Object.fromEntries(asPlayers.map((b) => [b.slug, b])))
}

/**
 * The player's best game: the one whose board they stand highest on among its players, on its screen, how far
 * ahead they are, and the next player on that board worth chasing, with the players around them, a row each, as
 * the boards list them (a list of runs could be one player's own five, naming no one to chase). The record for
 * someone already in the top three; the top ten, or a place a share of the board up, for everyone else, so
 * there is always something within reach.
 */
export function ProfileBestBoard({
  name,
  isSelf,
  viewer,
  bests,
  allTimePlaces,
  groupId,
}: {
  name: string
  isSelf: boolean
  /** Who is looking, when it isn't the player: their rows on the board say so. */
  viewer: string
  bests: Record<string, GameBest> | null
  /** The player's all-time place on each game, among players. */
  allTimePlaces: Partial<Record<string, GlobalGamePlace>> | null
  groupId: string | null
}) {
  const best = bests ? bestGame(bests, allTimePlaces) : null
  const line = best ? nextRunLine(best.rank, best.total) : null
  const players = usePlayersAround(best?.slug ?? null, best?.rank ?? 0, line && line.rank > 1 ? line.rank : null, groupId)
  // A player's card opens at the period you picked: the board is all time's, the card needn't be.
  const period = useDefaultPeriod()

  if (bests === null) {
    return <section className="pbest pbest--wait" aria-hidden="true" />
  }
  if (!best) return null

  const game = getGame(best.slug)
  const gameName = game?.name ?? best.slug
  const accent = resolveGameAccent(best.slug, game?.accent ?? '#2eb8a0')
  const fmt = (score: number) => formatLeaderboardScore(best.slug, score)
  const beaten = best.total - best.rank
  const lineScore = line?.label === 'record' ? best.record?.score : players?.line?.entry.score
  const recordHolder = best.record?.name
  const viewerHolds = !isSelf && viewer && recordHolder === viewer
  const ahead = `Ahead of ${beaten.toLocaleString()} of its ${best.total.toLocaleString()} players.`

  let copy: string
  if (best.rank === 1) {
    // The lead is over the next player down.
    const second = players?.rows.find((r) => r.rank === 2)?.entry
    const lead = second ? `, ${scoreWithUnit(best.slug, Math.abs(best.score - second.score))} clear of ${second.name}` : ''
    copy = isSelf ? `The best run on the board${lead}. The record is yours.` : `The best run on the board${lead}: ${name} holds the record.`
  } else {
    copy = ahead
    if (line?.label === 'record' && lineScore != null) {
      const gap = scoreWithUnit(best.slug, Math.abs(lineScore - best.score))
      copy += isSelf
        ? ` ${gap} short of the record, held by ${recordHolder}.`
        : viewerHolds
          ? ` ${gap} short of your record.`
          : ` ${gap} short of the record, held by ${recordHolder}.`
    } else if (line && lineScore != null) {
      // Where a run just better than the line's takes them, past anyone tied there (the API's beatPlace).
      const lands = namedLine(line.label) ? `in the ${line.label}` : `#${(players?.line?.beatPlace ?? line.rank).toLocaleString()}`
      copy += isSelf ? ` Beat ${fmt(lineScore)} and you’re ${lands}.` : ` Beat ${fmt(lineScore)} and ${name} is ${lands}.`
    }
  }

  // The flag is the player's place among players, as the game cabinets say it, and as the list counts.
  const place = allTimePlaces?.[best.slug]?.place ?? best.rank
  const flag =
    place <= 3
      ? { text: `${ordinal(place)} all time`, tone: place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze' }
      : place <= 10
        ? { text: 'Top 10 all time', tone: 'ten' }
        : { text: `#${place.toLocaleString()} all time`, tone: 'plain' }
  const rows = players ? boardRows(best, players.rows, line, players.line) : null
  const style = { '--tile-accent': accent, '--tile-ink': inkOn(accent), '--tile-fill': readableFill(accent) } as CSSProperties

  return (
    <section className="pbest" style={style} aria-labelledby="pbest-title">
      <a className="pbest__screen" href={gamePlayHref(best.slug)} tabIndex={-1} aria-hidden="true">
        <span className="wall-tile__art">
          <GameArt slug={best.slug} shape="card" fallback={<GameThumbArt slug={best.slug} accent={accent} />} />
        </span>
        {hasGamePreview(best.slug) ? <GamePreview slug={best.slug} className="wall-tile__preview" hoverOnly /> : null}
        <span className={`pbest__flag pbest__flag--${flag.tone}`}>{flag.text}</span>
      </a>
      <div className="pbest__text">
        <p className="pbest__cap">{isSelf ? 'Your best game' : `${name}’s best game`}</p>
        <h2 className="pbest__title" id="pbest-title">
          <span className="pbest__score">{scoreWithUnit(best.slug, best.score)}</span>
          <br />
          on {gameName}
        </h2>
        <p className="pbest__copy">{players || best.rank === 1 || line?.label === 'record' ? copy : ahead}</p>
        <div className="pbest__acts">
          <a className="pbest__play" href={gamePlayHref(best.slug)}>
            Play {gameName}
          </a>
          <a className="pbest__board" href={boardPlaceHref(best.slug as LeaderboardGame, 'all')}>
            Full board
          </a>
        </div>
      </div>
      <div className="pbest__runs">
        <div className="pbest__runs-head">
          <span>{gameName} · all time</span>
          <span className="pbest__runs-n">
            {best.total.toLocaleString()} {best.total === 1 ? 'player' : 'players'}
          </span>
        </div>
        {rows ? (
          <ol className="pbest__list">
            {rows.map((row, i) =>
              row.kind === 'gap' ? (
                <li key={`g${i}`} className="pbest__gap" aria-hidden="true">
                  ⋮ {row.players.toLocaleString()} {row.players === 1 ? 'player' : 'players'}
                </li>
              ) : row.kind === 'line' ? (
                <li key={`l${i}`} className="pbest__line" aria-label={`The ${row.label} ends here`}>
                  <span>{row.label}</span>
                </li>
              ) : (
                <li key={`r${row.rank}`} className={`pbest__row${row.name === name ? ' pbest__row--mine' : ''}`}>
                  <span className="pbest__rank">{row.rank.toLocaleString()}</span>
                  <PlayerAvatar avatarId={row.avatarId} name={row.name} size="sm" />
                  <a className="pbest__who" href={rankHref(row.name, period)}>
                    <PlayerName name={row.name} avatarId={row.avatarId} />
                    {row.name === name && isSelf ? <span className="pbest__you">You</span> : null}
                    {!isSelf && viewer && row.name === viewer ? <span className="pbest__you pbest__you--viewer">You</span> : null}
                  </a>
                  <span className="pbest__run">{fmt(row.score)}</span>
                </li>
              ),
            )}
          </ol>
        ) : (
          <div className="pbest__list pbest__list--wait" aria-hidden="true" />
        )}
      </div>
    </section>
  )
}
