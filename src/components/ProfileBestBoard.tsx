import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, gamePlayHref, rankHref } from '../hooks/useHashRoute'
import { useRunsAround, type BoardRow, type GameBest } from '../hooks/useProfileBoards'
import { inkOn } from '../lib/color'
import { hasGamePreview } from '../lib/gamePreviews'
import type { LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { bestBoard, nextRunLine, ordinal, scoreWithUnit } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'

type Row =
  | { kind: 'run'; rank: number; name: string; score: number; avatarId?: string }
  | { kind: 'gap'; runs: number }
  | { kind: 'line'; label: string }

/**
 * The rows to show from a board: the top five when the run is among them;
 * otherwise the record, the run on the line being chased, and the runs either
 * side of the player's, with the line drawn where it falls.
 */
function boardRows(best: GameBest, rows: BoardRow[], line: { rank: number; label: string } | null, lineRow: BoardRow | null): Row[] {
  const run = (r: BoardRow): Row => ({ kind: 'run', rank: r.rank, name: r.entry.name, score: r.entry.score, avatarId: r.entry.avatarId })
  const out: Row[] = []
  const lineLabel = line && line.label !== 'record' ? line.label : null
  const pinned = lineRow && lineLabel && !rows.some((r) => r.rank === lineRow.rank) ? lineRow : null
  // With the line's run pinned above them, the runs around the player's are cut to one either side.
  const window = pinned ? rows.filter((r) => Math.abs(r.rank - best.rank) <= 1) : rows
  const first = window[0]?.rank ?? best.rank
  if (first > 1 && best.record) {
    out.push({ kind: 'run', rank: 1, name: best.record.name, score: best.record.score, avatarId: best.record.avatarId })
    const until = pinned ? pinned.rank : first
    if (until > 2) out.push({ kind: 'gap', runs: until - 2 })
  }
  if (pinned) {
    out.push(run(pinned))
    out.push({ kind: 'line', label: lineLabel! })
    if (first > pinned.rank + 1) out.push({ kind: 'gap', runs: first - pinned.rank - 1 })
  }
  for (const r of window) {
    out.push(run(r))
    if (lineLabel && !pinned && line && r.rank === line.rank) out.push({ kind: 'line', label: lineLabel })
  }
  return out
}

/**
 * The player's best board: the game whose board their best run beats most
 * of, on its screen, how far the run stands, and the next line on that board
 * worth chasing, with the runs around it. The record for someone already in
 * the top three; the top ten, the top 10%, the top quarter or the top half
 * for everyone else, so there is always something within reach.
 */
export function ProfileBestBoard({
  name,
  isSelf,
  viewer,
  bests,
  groupId,
}: {
  name: string
  isSelf: boolean
  /** Who is looking, when it isn't the player: their rows on the board say so. */
  viewer: string
  bests: Record<string, GameBest> | null
  groupId: string | null
}) {
  const best = bests ? bestBoard(bests) : null
  const line = best ? nextRunLine(best.rank, best.total) : null
  const runs = useRunsAround(best?.slug ?? null, best?.rank ?? 0, line && line.rank > 1 ? line.rank : null, groupId)

  if (bests === null) {
    return <section className="pbest pbest--wait" aria-hidden="true" />
  }
  if (!best) return null

  const game = getGame(best.slug)
  const gameName = game?.name ?? best.slug
  const accent = resolveGameAccent(best.slug, game?.accent ?? '#2eb8a0')
  const fmt = (score: number) => formatLeaderboardScore(best.slug, score)
  const beaten = best.total - best.rank
  const lineScore = line?.label === 'record' ? best.record?.score : runs?.line?.entry.score
  const recordHolder = best.record?.name
  const viewerHolds = !isSelf && viewer && recordHolder === viewer

  let copy: string
  if (best.rank === 1) {
    // A board lists runs, so the next run down can be the player's own; the lead is over the next player.
    const second = runs?.rows.find((r) => r.rank > 1 && r.entry.name !== name)?.entry
    const lead = second ? `, ${scoreWithUnit(best.slug, Math.abs(best.score - second.score))} clear of ${second.name}` : ''
    copy = isSelf ? `The best run on the board${lead}. The record is yours.` : `The best run on the board${lead}: ${name} holds the record.`
  } else {
    copy = `Better than ${beaten.toLocaleString()} of its ${best.total.toLocaleString()} runs.`
    if (line?.label === 'record' && lineScore != null) {
      const gap = scoreWithUnit(best.slug, Math.abs(lineScore - best.score))
      copy += isSelf
        ? ` ${gap} short of the record, held by ${recordHolder}.`
        : viewerHolds
          ? ` ${gap} short of your record.`
          : ` ${gap} short of the record, held by ${recordHolder}.`
    } else if (line && lineScore != null) {
      copy += isSelf
        ? ` Beat ${fmt(lineScore)} and you’re in the ${line.label}.`
        : ` Beat ${fmt(lineScore)} and ${name} is in the ${line.label}.`
    }
  }

  const flag =
    best.rank <= 3
      ? { text: `${ordinal(best.rank)} all time`, tone: best.rank === 1 ? 'gold' : best.rank === 2 ? 'silver' : 'bronze' }
      : best.rank <= 10
        ? { text: 'Top 10 all time', tone: 'ten' }
        : { text: `#${best.rank.toLocaleString()} all time`, tone: 'plain' }
  const rows = runs ? boardRows(best, runs.rows, line, runs.line) : null
  const style = { '--tile-accent': accent, '--tile-ink': inkOn(accent) } as CSSProperties

  return (
    <section className="pbest" style={style} aria-labelledby="pbest-title">
      <a className="pbest__screen" href={gamePlayHref(best.slug)} tabIndex={-1} aria-hidden="true">
        <span className="wall-tile__art">
          <GameThumbArt slug={best.slug} accent={accent} />
        </span>
        {hasGamePreview(best.slug) ? <GamePreview slug={best.slug} className="wall-tile__preview" /> : null}
        <span className={`pbest__flag pbest__flag--${flag.tone}`}>{flag.text}</span>
      </a>
      <div className="pbest__text">
        <p className="pbest__cap">{isSelf ? 'Your best board' : `${name}’s best board`}</p>
        <h2 className="pbest__title" id="pbest-title">
          <span className="pbest__score">{scoreWithUnit(best.slug, best.score)}</span>
          <br />
          on {gameName}
        </h2>
        <p className="pbest__copy">{runs || best.rank === 1 || line?.label === 'record' ? copy : `Better than ${beaten.toLocaleString()} of its ${best.total.toLocaleString()} runs.`}</p>
        <div className="pbest__acts">
          <a className="pbest__play" href={gamePlayHref(best.slug)}>
            Play {gameName}
          </a>
          <a className="pbest__board" href={gameBoardHref(best.slug as LeaderboardGame, 'all')}>
            Full board
          </a>
        </div>
      </div>
      <div className="pbest__runs">
        <div className="pbest__runs-head">
          <span>{gameName} · all time</span>
          <span className="pbest__runs-n">{best.total.toLocaleString()} runs</span>
        </div>
        {rows ? (
          <ol className="pbest__list">
            {rows.map((row, i) =>
              row.kind === 'gap' ? (
                <li key={`g${i}`} className="pbest__gap" aria-hidden="true">
                  ⋮ {row.runs.toLocaleString()} {row.runs === 1 ? 'run' : 'runs'}
                </li>
              ) : row.kind === 'line' ? (
                <li key={`l${i}`} className="pbest__line" aria-label={`The ${row.label} ends here`}>
                  <span>{row.label}</span>
                </li>
              ) : (
                <li
                  key={`r${row.rank}`}
                  className={`pbest__row${row.rank === best.rank && row.name === name ? ' pbest__row--mine' : ''}`}
                >
                  <span className="pbest__rank">{row.rank.toLocaleString()}</span>
                  <PlayerAvatar avatarId={row.avatarId} name={row.name} size="sm" />
                  <a className="pbest__who" href={rankHref(row.name, 'all')}>
                    {row.name}
                    {row.rank === best.rank && row.name === name && isSelf ? <span className="pbest__you">You</span> : null}
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
