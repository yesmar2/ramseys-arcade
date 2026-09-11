import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { usePlayerName } from '../hooks/usePlayerName'
import { linkCurrentNameToAccount } from '../lib/auth'
import { ApiError, getLastPlayerName, normalizePlayerName, PLAYER_NAME_MAX } from '../lib/leaderboard'
import {
  eventKind,
  getTournament,
  getTournamentInvite,
  joinTournament,
  submitTournamentScore,
  type TournamentDetail,
} from '../lib/tournaments'
import {
  bracketCelebrationPayload,
  ScoreCelebration,
  type CelebPayload,
} from './ScoreSaveCard'
import { ScoreSignInPrompt } from './ScoreSignInPrompt'

function attemptsLeftLabel(
  remaining: number | null,
  max: number | null,
  exhausted: boolean,
  outcome: 'champion' | 'match' | null,
): string | null {
  if (outcome === 'champion') return null
  if (outcome === 'match') return null
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
  youWonMatch: boolean
  youWonTournament: boolean
  matchOpponent: string | null
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
      youWonMatch: false,
      youWonTournament: false,
      matchOpponent: null,
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
    const youWonTournament = Boolean(result.youWonTournament)
    const youWonMatch = Boolean(result.youWonMatch || youWonTournament)
    const attemptsRemaining =
      youWonMatch || youWonTournament
        ? 0
        : (result.attemptsRemaining ?? playerStatus?.attemptsRemaining ?? null)
    const maxAttempts = result.maxAttempts ?? playerStatus?.maxAttempts ?? null
    const exhausted =
      youWonMatch ||
      youWonTournament ||
      attemptsRemaining === 0 ||
      (playerStatus ? !playerStatus.canPlay : false)
    return {
      improved: result.improved,
      best: result.best,
      attemptsRemaining,
      maxAttempts,
      exhausted,
      youWonMatch,
      youWonTournament,
      matchOpponent: result.matchOpponent ?? null,
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
  const { signedIn, loading: authLoading } = useAuth()
  const impersonation = useImpersonation()
  const canSaveScores = signedIn || Boolean(impersonation)
  const playerName = usePlayerName()
  const knownName = (playerName || getLastPlayerName()).trim().toUpperCase()
  const [name, setName] = useState(knownName)
  const [nameDraft, setNameDraft] = useState('')
  const [status, setStatus] = useState<'needAuth' | 'needName' | 'saving' | 'done' | 'error'>(
    () => (authLoading ? 'saving' : !canSaveScores ? 'needAuth' : knownName ? 'saving' : 'needName'),
  )
  const [error, setError] = useState<string | null>(null)
  const [improved, setImproved] = useState(false)
  const [best, setBest] = useState(score)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [youWonMatch, setYouWonMatch] = useState(false)
  const [youWonTournament, setYouWonTournament] = useState(false)
  const [matchOpponent, setMatchOpponent] = useState<string | null>(null)
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [celeb, setCeleb] = useState<CelebPayload | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const celebratedRef = useRef(false)

  useEffect(() => {
    if (knownName && !name) setName(knownName)
  }, [knownName, name])

  useEffect(() => {
    if (status === 'needName') nameInputRef.current?.focus()
  }, [status])

  useEffect(() => {
    if (authLoading) return
    if (!canSaveScores) {
      setStatus('needAuth')
      setName('')
      return
    }
    if (!name && knownName) {
      setName(knownName)
      return
    }
    if (!name) {
      setStatus('needName')
      return
    }

    let cancelled = false
    celebratedRef.current = false

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
        setYouWonMatch(snapshot.youWonMatch)
        setYouWonTournament(snapshot.youWonTournament)
        setMatchOpponent(snapshot.matchOpponent)
        setDetail(snapshot.detail)
        setStatus('done')

        if (!celebratedRef.current && (snapshot.youWonTournament || snapshot.youWonMatch)) {
          celebratedRef.current = true
          const payload = bracketCelebrationPayload({
            champion: snapshot.youWonTournament,
            matchWon: snapshot.youWonMatch,
            opponent: snapshot.matchOpponent,
            eventTitle: snapshot.detail?.title,
          })
          if (payload) setCeleb(payload)
        }
      } catch (err) {
        if (cancelled) return
        const code =
          err instanceof ApiError
            ? err.code
            : (err as Error & { code?: string }).code
        if (code === 'AUTH_REQUIRED') {
          setStatus('needAuth')
          setError('Sign in to submit this score.')
          return
        }
        if (code === 'NAME_TAKEN') {
          setName('')
          setNameDraft('')
          setStatus('needName')
          setError('That gamer tag is taken. Pick another.')
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
  }, [tournamentId, gameSlug, score, name, authLoading, canSaveScores, knownName])

  const submitName = async () => {
    const cleaned = cleanName(nameDraft)
    if (!cleaned) return
    if (!canSaveScores) {
      setStatus('needAuth')
      return
    }
    setError(null)
    try {
      if (impersonation) {
        setName(cleaned)
        return
      }
      await linkCurrentNameToAccount(cleaned)
      setName(cleaned)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That gamer tag is taken. Pick another.')
      } else if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') {
        setStatus('needAuth')
        setError('Sign in to submit this score.')
      } else {
        setError(err instanceof Error ? err.message : 'Could not save gamer tag')
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
  const isBracket = detail ? eventKind(detail) === 'bracket' : false
  const outcome: 'champion' | 'match' | null = youWonTournament
    ? 'champion'
    : youWonMatch
      ? 'match'
      : null
  const doneHeadline = (() => {
    if (score <= 0) return 'No score this run'
    if (youWonTournament) return 'You won the tournament'
    if (youWonMatch) {
      return matchOpponent ? `You beat ${matchOpponent}` : 'You won the match'
    }
    if (improved) return `New best · ${best}`
    return `Best still ${best}`
  })()

  return (
    <>
      {celeb ? <ScoreCelebration payload={celeb} onDone={() => setCeleb(null)} /> : null}
      <div className="score-save tour-score" onPointerDown={(e) => e.stopPropagation()}>
        <div className="score-save__hero">
          <span className="score-save__eyebrow">{detail?.title ?? 'Tournament'}</span>
          <strong className="score-save__score">{score}</strong>
          {subtitle && status !== 'saving' && (
            <p className="score-save__sub">{subtitle}</p>
          )}
        </div>

        {status === 'needAuth' && (
          <>
            <ScoreSignInPrompt
              error={error}
              onSignedIn={() => {
                setError(null)
                if (knownName) setName(knownName)
                else setStatus('needName')
              }}
            />
            <div className="score-save__actions">
              <button type="button" className="score-save__btn score-save__btn--ghost" onClick={onDone}>
                Skip
              </button>
            </div>
          </>
        )}

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
            <p className="score-save__as">{doneHeadline}</p>
            {(() => {
              const label = attemptsLeftLabel(
                attemptsRemaining,
                maxAttempts,
                exhausted,
                outcome,
              )
              return label ? <p className="score-save__note">{label}</p> : null
            })()}
            {youWonTournament ? (
              <p className="score-save__note">Bracket complete.</p>
            ) : youWonMatch ? (
              <p className="score-save__note">You’re through to the next round.</p>
            ) : null}
            {!isBracket && (gameCell?.place != null || overallPlace != null) && (
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
              {exhausted || youWonMatch ? (
                <a className="score-save__btn" href={`#/tournaments/${tournamentId}`}>
                  {youWonTournament || isBracket ? 'View bracket' : 'View standings'}
                </a>
              ) : (
                <button type="button" className="score-save__btn" onClick={onDone}>
                  Play again
                </button>
              )}
            </div>
          </>
        )}

        {!exhausted && !youWonMatch ? (
          <div className="score-save__links">
            <a href={`#/tournaments/${tournamentId}`}>Standings</a>
          </div>
        ) : null}
      </div>
    </>
  )
}
