import { useEffect, useState } from 'react'
import {
  addLeaderboardScore,
  checkQualifies,
  getLastPlayerName,
  PERIOD_LABELS,
  rememberPlayerName,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { usePlayerName } from '../hooks/usePlayerName'

type ScoreSaveProps = {
  gameSlug: string
  score: number
  title: string
  subtitle?: string
  onDone: () => void
}

const PERIOD_ORDER: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all']

function RankChips({ ranks }: { ranks?: Partial<Record<LeaderboardPeriod, number>> }) {
  if (!ranks) return null
  const items = PERIOD_ORDER.filter((p) => ranks[p] != null).slice(0, 3)
  if (!items.length) return null
  return (
    <ul className="score-save__ranks" aria-label="Leaderboard ranks">
      {items.map((p) => (
        <li key={p}>
          <span>{PERIOD_LABELS[p]}</span>
          <strong>#{ranks[p]}</strong>
        </li>
      ))}
    </ul>
  )
}

export function ScoreSaveCard({
  gameSlug,
  score,
  title,
  subtitle,
  onDone,
}: ScoreSaveProps) {
  const playerName = usePlayerName()
  const [saved, setSaved] = useState(false)
  const [ranks, setRanks] = useState<Partial<Record<LeaderboardPeriod, number>>>()
  const [qualifies, setQualifies] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedName = (playerName || getLastPlayerName()).trim().toUpperCase()

  useEffect(() => {
    let cancelled = false
    setQualifies(null)
    setError(null)
    checkQualifies(gameSlug, score)
      .then((result) => {
        if (cancelled) return
        setQualifies(result.qualifies)
        setRanks(result.ranks)
      })
      .catch(() => {
        if (cancelled) return
        setQualifies(false)
        setError('Could not reach leaderboard server')
      })
    return () => {
      cancelled = true
    }
  }, [gameSlug, score])

  const save = async () => {
    if (busy || !resolvedName) return
    setBusy(true)
    setError(null)
    try {
      rememberPlayerName(resolvedName)
      const result = await addLeaderboardScore(gameSlug, resolvedName, score)
      setRanks(result.ranks)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (qualifies === null) {
    return (
      <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
        <div className="score-save__hero">
          <span className="score-save__eyebrow">{title}</span>
          <strong className="score-save__score">{score}</strong>
        </div>
        <p className="score-save__note">Checking boards…</p>
      </div>
    )
  }

  if (!qualifies && !saved) {
    return (
      <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
        <div className="score-save__hero">
          <span className="score-save__eyebrow">{title}</span>
          <strong className="score-save__score">{score}</strong>
          {subtitle && <p className="score-save__sub">{subtitle}</p>}
        </div>
        {error && <p className="score-save__note score-save__note--error">{error}</p>}
        <button type="button" className="score-save__btn" onClick={onDone}>
          Play again
        </button>
        <div className="score-save__links">
          <a href="#/leaderboards">Boards</a>
          <a href="#/tournaments">Events</a>
        </div>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
        <div className="score-save__hero">
          <span className="score-save__eyebrow">Saved · {resolvedName}</span>
          <strong className="score-save__score">{score}</strong>
        </div>
        <RankChips ranks={ranks} />
        <button type="button" className="score-save__btn" onClick={onDone}>
          Play again
        </button>
        <div className="score-save__links">
          <a href="#/leaderboards">Boards</a>
          <a href="#/tournaments">Events</a>
        </div>
      </div>
    )
  }

  return (
    <div className="score-save" onPointerDown={(e) => e.stopPropagation()}>
      <div className="score-save__hero">
        <span className="score-save__eyebrow">Board score</span>
        <strong className="score-save__score">{score}</strong>
      </div>
      <RankChips ranks={ranks} />
      {resolvedName ? (
        <p className="score-save__as">as {resolvedName}</p>
      ) : (
        <p className="score-save__note">Set your name in the header to save.</p>
      )}
      {error && <p className="score-save__note score-save__note--error">{error}</p>}
      <div className="score-save__actions">
        <button
          type="button"
          className="score-save__btn"
          onClick={() => void save()}
          disabled={busy || !resolvedName}
        >
          {busy ? 'Saving…' : 'Save score'}
        </button>
        <button
          type="button"
          className="score-save__btn score-save__btn--ghost"
          onClick={onDone}
          disabled={busy}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
