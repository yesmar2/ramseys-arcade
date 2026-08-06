import { useEffect, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { getLastPlayerName } from '../lib/leaderboard'
import {
  getTournament,
  joinTournament,
  submitTournamentScore,
  type TournamentDetail,
} from '../lib/tournaments'

type TournamentScoreCardProps = {
  tournamentId: string
  gameSlug: string
  score: number
  onDone: () => void
}

export function TournamentScoreCard({
  tournamentId,
  gameSlug,
  score,
  onDone,
}: TournamentScoreCardProps) {
  const playerName = usePlayerName()
  const name = (playerName || getLastPlayerName()).trim().toUpperCase()
  const [status, setStatus] = useState<'saving' | 'done' | 'error'>('saving')
  const [error, setError] = useState<string | null>(null)
  const [improved, setImproved] = useState(false)
  const [best, setBest] = useState(score)
  const [detail, setDetail] = useState<TournamentDetail | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!name) {
        setStatus('error')
        setError('Set your name in the header, then try again.')
        return
      }
      if (score <= 0) {
        setStatus('done')
        setImproved(false)
        setBest(0)
        try {
          const d = await getTournament(tournamentId)
          if (!cancelled) setDetail(d)
        } catch {
          /* ignore */
        }
        return
      }

      try {
        // Ensure they're on the roster
        await joinTournament(tournamentId, name)
        const result = await submitTournamentScore(tournamentId, name, gameSlug, score)
        if (cancelled) return
        setImproved(result.improved)
        setBest(result.best)
        const d = await getTournament(tournamentId)
        if (cancelled) return
        setDetail(d)
        setStatus('done')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not submit score')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [tournamentId, gameSlug, score, name])

  const standing = detail?.standings.find((s) => s.name === name)
  const gameCell = standing?.byGame[gameSlug]
  const overallPlace =
    detail && standing
      ? detail.standings.findIndex((s) => s.playerId === standing.playerId) + 1
      : null

  return (
    <div className="score-save tour-score" onPointerDown={(e) => e.stopPropagation()}>
      <div className="score-save__hero">
        <span className="score-save__eyebrow">
          {detail?.title ?? 'Tournament'}
        </span>
        <strong className="score-save__score">{score}</strong>
      </div>

      {status === 'saving' && <p className="score-save__note">Submitting…</p>}

      {status === 'error' && (
        <p className="score-save__note score-save__note--error">{error}</p>
      )}

      {status === 'done' && (
        <>
          <p className="score-save__as">
            {score <= 0
              ? 'No score this run'
              : improved
                ? `New best · ${best}`
                : `Best still ${best}`}
          </p>
          {(gameCell?.place != null || overallPlace != null) && (
            <ul className="score-save__ranks" aria-label="Tournament standing">
              {gameCell?.place != null && (
                <li>
                  <span>This game</span>
                  <strong>#{gameCell.place}</strong>
                </li>
              )}
              {gameCell && gameCell.points > 0 && (
                <li>
                  <span>Points</span>
                  <strong>+{gameCell.points}</strong>
                </li>
              )}
              {overallPlace != null && overallPlace > 0 && (
                <li>
                  <span>Overall</span>
                  <strong>#{overallPlace}</strong>
                </li>
              )}
            </ul>
          )}
        </>
      )}

      <div className="score-save__actions">
        <button type="button" className="score-save__btn" onClick={onDone}>
          Play again
        </button>
      </div>
      <div className="score-save__links">
        <a href={`#/tournaments/${tournamentId}`}>Standings</a>
      </div>
    </div>
  )
}
