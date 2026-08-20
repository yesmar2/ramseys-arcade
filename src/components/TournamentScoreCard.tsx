import { useEffect, useRef, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, getLastPlayerName, normalizePlayerName, PLAYER_NAME_MAX, rememberPlayerName } from '../lib/leaderboard'
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
  subtitle?: string
  onDone: () => void
}

function cleanName(raw: string) {
  return normalizePlayerName(raw)
}

export function TournamentScoreCard({
  tournamentId,
  gameSlug,
  score,
  subtitle,
  onDone,
}: TournamentScoreCardProps) {
  const playerName = usePlayerName()
  const knownName = (playerName || getLastPlayerName()).trim().toUpperCase()
  const [name, setName] = useState(knownName)
  const [nameDraft, setNameDraft] = useState('')
  const [status, setStatus] = useState<'needName' | 'saving' | 'done' | 'error'>(() =>
    knownName ? 'saving' : 'needName',
  )
  const [error, setError] = useState<string | null>(null)
  const [improved, setImproved] = useState(false)
  const [best, setBest] = useState(score)
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (knownName && !name) setName(knownName)
  }, [knownName, name])

  useEffect(() => {
    if (status === 'needName') nameInputRef.current?.focus()
  }, [status])

  useEffect(() => {
    if (!name) return

    let cancelled = false

    async function run() {
      setStatus('saving')
      setError(null)

      if (score <= 0) {
        setImproved(false)
        setBest(0)
        try {
          const d = await getTournament(tournamentId)
          if (!cancelled) setDetail(d)
        } catch {
          /* ignore */
        }
        if (!cancelled) setStatus('done')
        return
      }

      try {
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
        const code =
          err instanceof ApiError
            ? err.code
            : (err as Error & { code?: string }).code
        if (code === 'NAME_TAKEN') {
          setName('')
          setNameDraft('')
          setStatus('needName')
          setError('That gamer tag is taken. Sign in or pick another.')
          return
        }
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not submit score')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [tournamentId, gameSlug, score, name])

  const submitName = async () => {
    const cleaned = cleanName(nameDraft)
    if (!cleaned) return
    setError(null)
    try {
      const claimed = await rememberPlayerName(cleaned)
      setName(claimed)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That gamer tag is taken. Sign in or pick another.')
      } else {
        setError(err instanceof Error ? err.message : 'Could not claim name')
      }
    }
  }

  const standing = detail?.standings.find((s) => s.name === name)
  const gameCell = standing?.byGame[gameSlug]
  const overallPlace =
    detail && standing
      ? detail.standings.findIndex((s) => s.playerId === standing.playerId) + 1
      : null

  return (
    <div className="score-save tour-score" onPointerDown={(e) => e.stopPropagation()}>
      <div className="score-save__hero">
        <span className="score-save__eyebrow">{detail?.title ?? 'Tournament'}</span>
        <strong className="score-save__score">{score}</strong>
        {subtitle && status !== 'saving' && (
          <p className="score-save__sub">{subtitle}</p>
        )}
      </div>

      {status === 'needName' && (
        <>
          <label className="score-save__field">
            <span className="score-save__label">Gamer tag</span>
            <input
              ref={nameInputRef}
              className="score-save__input"
              value={nameDraft}
              maxLength={PLAYER_NAME_MAX}
              placeholder="YOU"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setNameDraft(e.target.value.toUpperCase().slice(0, PLAYER_NAME_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitName()
                }
              }}
            />
          </label>
          {error && status === 'needName' && (
            <p className="score-save__note score-save__note--error">{error}</p>
          )}
          <div className="score-save__actions">
            <button
              type="button"
              className="score-save__btn"
              disabled={!cleanName(nameDraft)}
              onClick={() => void submitName()}
            >
              Submit score
            </button>
            <button type="button" className="score-save__btn score-save__btn--ghost" onClick={onDone}>
              Skip
            </button>
          </div>
        </>
      )}

      {status === 'saving' && <p className="score-save__note">Submitting…</p>}

      {status === 'error' && (
        <>
          <p className="score-save__note score-save__note--error">{error}</p>
          <div className="score-save__actions">
            <button type="button" className="score-save__btn" onClick={onDone}>
              Play again
            </button>
          </div>
        </>
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
          <div className="score-save__actions">
            <button type="button" className="score-save__btn" onClick={onDone}>
              Play again
            </button>
          </div>
        </>
      )}

      <div className="score-save__links">
        <a href={`#/tournaments/${tournamentId}`}>Standings</a>
      </div>
    </div>
  )
}
