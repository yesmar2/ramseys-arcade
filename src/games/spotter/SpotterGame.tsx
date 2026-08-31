import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { GameThumbArt } from '../../components/GameThumbArt'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { gameBoardHref, gameHref } from '../../hooks/useHashRoute'
import { getGame } from '../../data/games'
import { buildDailyPuzzle, spotterShareLine, type SpotterPuzzle } from './puzzle'
import {
  formatSpotterMs,
  spotterBoardScore,
  spotterLeaderboardMs,
  SPOTTER_HARD_CAP_MS,
  SPOTTER_HINT_MS,
} from './score'
import { getSpotterStreak, isSpotterSolvedToday, saveSpotterResult } from './storage'
import { spotterDayKey } from './dayKey'

type Phase = 'intro' | 'playing' | 'won' | 'revealed'

function variantLabel(variant: SpotterPuzzle['variant']) {
  if (variant === 'poster') return 'Poster wall'
  if (variant === 'cabinet') return 'Cabinet row'
  return 'Leaderboard'
}

function PosterGrid({
  puzzle,
  hint,
  shakeIndex,
  onPick,
}: {
  puzzle: Extract<SpotterPuzzle, { variant: 'poster' }>
  hint: boolean
  shakeIndex: number | null
  onPick: (index: number) => void
}) {
  return (
    <div className="spotter__poster" role="grid" aria-label="Poster wall">
      {puzzle.cells.map((cell, i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        const hinted =
          hint && (row === puzzle.hintRow || col === puzzle.hintCol)
        return (
          <button
            key={`${cell.slug}-${i}`}
            type="button"
            className={`spotter__cell spotter__cell--poster${shakeIndex === i ? ' spotter__cell--shake' : ''}${hinted ? ' spotter__cell--hint' : ''}`}
            style={{ '--cell-accent': cell.accent } as CSSProperties}
            onClick={() => onPick(i)}
            aria-label={cell.name}
          >
            <span className="spotter__thumb">
              <GameThumbArt slug={cell.iconSlug} accent={cell.accent} />
            </span>
            <span className="spotter__label">{cell.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function CabinetRow({
  puzzle,
  shakeIndex,
  onPick,
}: {
  puzzle: Extract<SpotterPuzzle, { variant: 'cabinet' }>
  shakeIndex: number | null
  onPick: (index: number) => void
}) {
  return (
    <div className="spotter__cabinets" role="list" aria-label="Cabinet row">
      {puzzle.cells.map((cell, i) => (
        <button
          key={`${cell.slug}-${i}`}
          type="button"
          className={`spotter__cell spotter__cell--cabinet${shakeIndex === i ? ' spotter__cell--shake' : ''}`}
          style={{ '--cell-accent': cell.accent } as React.CSSProperties}
          onClick={() => onPick(i)}
          aria-label={cell.name}
        >
          <span className="spotter__cabinet-marquee">
            {cell.comingSoon ? 'COMING SOON' : cell.name}
          </span>
          <span className="spotter__thumb">
            <GameThumbArt slug={cell.slug} accent={cell.accent} />
          </span>
          <span className="spotter__cabinet-score">
            {cell.comingSoon ? '—' : cell.score.toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  )
}

function BoardScreenshot({
  puzzle,
  shakeIndex,
  onPick,
}: {
  puzzle: Extract<SpotterPuzzle, { variant: 'board' }>
  shakeIndex: number | null
  onPick: (index: number) => void
}) {
  const game = getGame(puzzle.cells[0]?.slug ?? 'spotter')
  return (
    <div
      className="spotter__board-shot"
      style={{ '--cell-accent': game?.accent ?? '#7a6cf0' } as CSSProperties}
    >
      <p className="spotter__board-title">{game?.name ?? 'Game'} · Today</p>
      <ol className="spotter__board-rows">
        {puzzle.cells.map((row, i) => (
          <li key={`${row.name}-${i}`}>
            <button
              type="button"
              className={`spotter__board-row${shakeIndex === i ? ' spotter__cell--shake' : ''}`}
              onClick={() => onPick(i)}
            >
              <span className="spotter__board-rank">#{row.rank}</span>
              <span className="spotter__board-name">{row.name}</span>
              <span className="spotter__board-score">{row.score.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function SpotterGame() {
  const dayKey = spotterDayKey()
  const puzzle = useMemo(() => buildDailyPuzzle(dayKey), [dayKey])
  const streak = getSpotterStreak()

  const [phase, setPhase] = useState<Phase>('intro')
  const [strikes, setStrikes] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [hint, setHint] = useState(false)
  const [hintPenalty, setHintPenalty] = useState(0)
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const startRef = useRef<number | null>(null)
  const officialSaved = useRef(isSpotterSolvedToday())

  const leaderboardMs = spotterLeaderboardMs(elapsedMs, strikes, hintPenalty)
  const boardScore = spotterBoardScore(leaderboardMs)

  useEffect(() => {
    if (phase !== 'playing') return
    startRef.current = performance.now()
    const id = window.setInterval(() => {
      if (!startRef.current) return
      const ms = performance.now() - startRef.current
      setElapsedMs(ms)
      if (ms >= 60_000 && !hint) setHint(true)
      if (ms >= SPOTTER_HARD_CAP_MS) {
        setPhase('revealed')
        saveSpotterResult({
          dayKey,
          leaderboardMs: spotterLeaderboardMs(SPOTTER_HARD_CAP_MS, strikes, hintPenalty),
          strikes,
          official: false,
          revealed: true,
        })
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, hint, strikes, hintPenalty, dayKey])

  const finishWin = useCallback(
    (ms: number, strikeCount: number) => {
      const lbMs = spotterLeaderboardMs(ms, strikeCount, hintPenalty)
      setPhase('won')
      const alreadyOfficial = officialSaved.current || isSpotterSolvedToday()
      if (!alreadyOfficial) {
        saveSpotterResult({
          dayKey,
          leaderboardMs: lbMs,
          strikes: strikeCount,
          official: true,
        })
        officialSaved.current = true
        setSaveOpen(true)
      }
    },
    [dayKey, hintPenalty],
  )

  const onPick = (index: number) => {
    if (phase !== 'playing') return
    if (index === puzzle.answerIndex) {
      finishWin(elapsedMs, strikes)
      return
    }
    setStrikes((s) => s + 1)
    setShakeIndex(index)
    window.setTimeout(() => setShakeIndex(null), 420)
  }

  const start = () => {
    setPhase('playing')
    setStrikes(0)
    setElapsedMs(0)
    setHint(false)
    setHintPenalty(0)
    startRef.current = performance.now()
  }

  const useHint = () => {
    if (hintPenalty > 0 || puzzle.variant !== 'poster') return
    setHint(true)
    setHintPenalty(SPOTTER_HINT_MS)
  }

  const share = async () => {
    const line = spotterShareLine(
      puzzle.huntNumber,
      leaderboardMs,
      strikes,
      puzzle.glitchDescription,
    )
    try {
      if (navigator.share) {
        await navigator.share({ text: line })
        return
      }
      await navigator.clipboard.writeText(line)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const solvedToday = isSpotterSolvedToday()

  return (
    <div className="spotter">
      <a className="spotter__back" href={gameHref('spotter')}>
        ← Spotter
      </a>

      <header className="spotter__head">
        <p className="spotter__eyebrow">Spotter #{puzzle.huntNumber}</p>
        <h1 className="spotter__title">{variantLabel(puzzle.variant)}</h1>
        <p className="spotter__sub">
          One {puzzle.variant === 'board' ? 'row' : 'tile'} isn&apos;t right. Tap the glitch.
        </p>
        {streak > 0 ? (
          <p className="spotter__streak">{streak}-day streak</p>
        ) : null}
      </header>

      {phase === 'intro' ? (
        <div className="spotter__intro">
          <p className="spotter__intro-copy">
            Today&apos;s hunt is live for everyone. Wrong taps add time. Daily board ranks fastest
            finds.
          </p>
          {solvedToday ? (
            <p className="spotter__intro-done">You already found today&apos;s glitch — practice mode.</p>
          ) : null}
          <button type="button" className="spotter__cta" onClick={start}>
            {solvedToday ? 'Practice again' : 'Start hunt'}
          </button>
        </div>
      ) : null}

      {phase === 'playing' || phase === 'won' || phase === 'revealed' ? (
        <>
          <div className="spotter__hud" aria-live="polite">
            <span>{formatSpotterMs(elapsedMs)}</span>
            <span>{strikes} wrong</span>
          </div>

          {puzzle.variant === 'poster' ? (
            <PosterGrid
              puzzle={puzzle}
              hint={hint}
              shakeIndex={shakeIndex}
              onPick={onPick}
            />
          ) : null}
          {puzzle.variant === 'cabinet' ? (
            <CabinetRow
              puzzle={puzzle}
              shakeIndex={shakeIndex}
              onPick={onPick}
            />
          ) : null}
          {puzzle.variant === 'board' ? (
            <BoardScreenshot
              puzzle={puzzle}
              shakeIndex={shakeIndex}
              onPick={onPick}
            />
          ) : null}

          {phase === 'playing' && puzzle.variant === 'poster' && elapsedMs >= 60_000 && hintPenalty === 0 ? (
            <button type="button" className="spotter__hint" onClick={useHint}>
              Hint (+15s)
            </button>
          ) : null}
        </>
      ) : null}

      {phase === 'won' ? (
        <div className="spotter__result">
          <h2>Found it</h2>
          <p>{formatSpotterMs(leaderboardMs)} · {strikes} wrong taps</p>
          <p className="spotter__reveal">{puzzle.glitchDescription}</p>
          <div className="spotter__result-actions">
            <button type="button" className="spotter__cta" onClick={share}>
              {copied ? 'Copied' : 'Share result'}
            </button>
            <a className="spotter__link" href={gameBoardHref('spotter', 'daily')}>
              Today&apos;s board
            </a>
          </div>
        </div>
      ) : null}

      {phase === 'revealed' ? (
        <div className="spotter__result spotter__result--dnf">
          <h2>Time&apos;s up</h2>
          <p>The glitch was: {puzzle.glitchDescription}</p>
          <button type="button" className="spotter__cta" onClick={start}>
            Try again
          </button>
        </div>
      ) : null}

      {saveOpen && officialSaved.current ? (
        <ScoreSaveCard
          gameSlug="spotter"
          score={boardScore}
          title="Save to today's board"
          subtitle={`${formatSpotterMs(leaderboardMs)} · ${strikes} wrong`}
          onDone={() => setSaveOpen(false)}
        />
      ) : null}
    </div>
  )
}
