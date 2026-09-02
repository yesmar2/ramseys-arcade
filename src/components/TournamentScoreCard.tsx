import { useEffect, useRef, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, getLastPlayerName, normalizePlayerName, PLAYER_NAME_MAX, rememberPlayerName } from '../lib/leaderboard'
import {
  getTournament,
  getTournamentInvite,
  joinTournament,
  submitTournamentScore,
  type TournamentDetail,
} from '../lib/tournaments'

function attemptsLeftLabel(
  remaining: number | null,
  max: number | null,
  exhausted: boolean,
): string | null {
  if (exhausted || remaining === 0) return 'No attempts left'
  if (max == null) return 'Unlimited attempts'
  const left = remaining ?? max
  return `${left} attempt${left === 1 ? '' : 's'} left`
}

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

type SubmitSnapshot = {
  improved: boolean
  best: number
  attemptsRemaining: number | null
  maxAttempts: number | null
  exhausted: boolean
  detail: TournamentDetail | null
}

const recentScoreSubmits = new Map<string, { at: number; promise: Promise<SubmitSnapshot> }>()

function submitCacheKey(tournamentId: string, gameSlug: string, name: string, score: number) {
  return `${tournamentId}|${gameSlug}|${name}|${score}`
}

async function submitTournamentRun(
  tournamentId: string,
  gameSlug: string,
  name: string,
  score: number,
): Promise<SubmitSnapshot> {
  if (score <= 0) {
    const d = await getTournament(tournamentId, {
      playerName: name,
      game: gameSlug,
      invite: getTournamentInvite(tournamentId) ?? undefined,
    })
    const status = d.playerStatus
    return {
      improved: false,
      best: 0,
      attemptsRemaining: status?.attemptsRemaining ?? null,
      maxAttempts: status?.maxAttempts ?? null,
      exhausted: status ? !status.canPlay : false,
      detail: d,
    }
  }

  const key = submitCacheKey(tournamentId, gameSlug, name, score)
  const cached = recentScoreSubmits.get(key)
  if (cached && Date.now() - cached.at < 8000) {
    return cached.promise
  }

  const promise = (async (): Promise<SubmitSnapshot> => {
    await joinTournament(tournamentId, name)
    const result = await submitTournamentScore(tournamentId, name, gameSlug, score)
    const d = await getTournament(tournamentId, {
      playerName: name,
      game: gameSlug,
      invite: getTournamentInvite(tournamentId) ?? undefined,
    }).catch(() => null)
    const playerStatus = d?.playerStatus
    const attemptsRemaining = result.attemptsRemaining ?? playerStatus?.attemptsRemaining ?? null
    const maxAttempts = result.maxAttempts ?? playerStatus?.maxAttempts ?? null
    const exhausted = attemptsRemaining === 0
    return {
      improved: result.improved,
      best: result.best,
      attemptsRemaining,
      maxAttempts,
      exhausted,
      detail: d,
    }
  })()

  recentScoreSubmits.set(key, { at: Date.now(), promise })
  return promise
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
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null)
  const [exhausted, setExhausted] = useState(false)
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

      try {
        const snapshot = await submitTournamentRun(tournamentId, gameSlug, name, score)
        if (cancelled) return
        setImproved(snapshot.improved)
        setBest(snapshot.best)
        setAttemptsRemaining(snapshot.attemptsRemaining)
        setMaxAttempts(snapshot.maxAttempts)
        setExhausted(snapshot.exhausted)
        setDetail(snapshot.detail)
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
        if (code === 'INVITE_REQUIRED') {
          setStatus('error')
          setError('Could not submit — reopen the event from your invite link.')
          return
        }
        if (code === 'ATTEMPTS_EXHAUSTED') {
          setExhausted(true)
          setAttemptsRemaining(0)
          setMaxAttempts((prev) => prev ?? 1)
          setStatus('done')
          setError(null)
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

  const standing = detail?.standings.find(
    (s) => normalizePlayerName(s.name) === normalizePlayerName(name),
  )
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
          {(() => {
            const label = attemptsLeftLabel(attemptsRemaining, maxAttempts, exhausted)
            return label ? <p className="score-save__note">{label}</p> : null
          })()}
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
            {exhausted ? (
              <a className="score-save__btn" href={`#/tournaments/${tournamentId}`}>
                View standings
              </a>
            ) : (
              <button type="button" className="score-save__btn" onClick={onDone}>
                Play again
              </button>
            )}
          </div>
        </>
      )}

      {!exhausted ? (
        <div className="score-save__links">
          <a href={`#/tournaments/${tournamentId}`}>Standings</a>
        </div>
      ) : null}
    </div>
  )
}
