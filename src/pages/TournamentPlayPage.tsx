import { useEffect, useState } from 'react'
import { AsteroidsGame } from '../games/asteroids/AsteroidsGame'
import { DeadCenterGame } from '../games/dead-center/DeadCenterGame'
import { PatriotGame } from '../games/patriot/PatriotGame'
import { SimonGame } from '../games/simon/SimonGame'
import { SnakeGame } from '../games/snake/SnakeGame'
import { StackerGame } from '../games/stacker/StackerGame'
import { WhackGame } from '../games/whack/WhackGame'
import { DeviceUnavailable } from '../components/DeviceUnavailable'
import { getGame, gamePlayableOn } from '../data/games'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { ApiError, rememberPlayerName } from '../lib/leaderboard'
import { getTournament, joinTournament, type TournamentDetail } from '../lib/tournaments'
import { TournamentPlayProvider } from '../tournaments/TournamentPlayContext'

const PLAYABLE = new Set(['stacker', 'patriot', 'snake', 'dead-center', 'asteroids', 'pop', 'simon'])

export function TournamentPlayPage({
  tournamentId,
  gameSlug,
}: {
  tournamentId: string
  gameSlug: string
}) {
  const playerName = usePlayerName()
  const device = useDeviceType()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [joining, setJoining] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const game = getGame(gameSlug)
  const backHref = `#/tournaments/${tournamentId}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setReady(false)
    getTournament(tournamentId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        if (!data.games.includes(gameSlug) || !PLAYABLE.has(gameSlug)) {
          setLoadError('That game isn’t part of this tournament.')
          return
        }
        if (data.status === 'ended') {
          setLoadError('This tournament has ended.')
          return
        }
        if (data.status === 'upcoming') {
          setLoadError('This tournament hasn’t started yet.')
          return
        }
        const name = playerName.trim().toUpperCase()
        if (name && data.players.some((p) => p.name === name)) {
          setReady(true)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tournamentId, gameSlug, playerName])

  const joinWithName = async (rawName: string) => {
    const name = rawName.trim().slice(0, 12).toUpperCase()
    if (!name || joining) return
    setJoining(true)
    setJoinError(null)
    try {
      await rememberPlayerName(name)
      const result = await joinTournament(tournamentId, name)
      setDetail(result.tournament)
      setReady(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setJoinError('That name is taken — pick another')
      } else {
        setJoinError(err instanceof Error ? err.message : 'Could not join')
      }
    } finally {
      setJoining(false)
    }
  }

  if (game && !gamePlayableOn(game, device)) {
    return <DeviceUnavailable game={game} />
  }

  if (loading) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <p className="tour-play__message">Loading event…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <div className="tour-play__gate">
          <h1>{detail?.title ?? 'Tournament'}</h1>
          <p>{loadError}</p>
          <a className="score-save__btn" href={backHref}>
            Back to event
          </a>
        </div>
      </main>
    )
  }

  if (!ready || !detail) {
    return (
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← Event
        </a>
        <div className="tour-play__gate">
          <p className="tour-play__eyebrow">Tournament</p>
          <h1>{detail?.title}</h1>
          <p className="tour-play__game">{game?.name ?? gameSlug}</p>

          {!playerName && (
            <label className="tour-play__name-field">
              <span className="score-save__label">Name</span>
              <input
                className="score-save__input"
                value={nameDraft}
                maxLength={12}
                placeholder="YOU"
                onChange={(e) => setNameDraft(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void joinWithName(nameDraft)
                  }
                }}
              />
            </label>
          )}

          {joinError && <p className="score-save__note score-save__note--error">{joinError}</p>}

          <div className="tour-play__gate-actions">
            <button
              type="button"
              className="score-save__btn"
              disabled={joining || (!playerName && !nameDraft.trim())}
              onClick={() => void joinWithName(playerName || nameDraft)}
            >
              {joining ? 'Joining…' : 'Join & play'}
            </button>
            <a className="tour-play__ghost" href={backHref}>
              Back
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <TournamentPlayProvider
      value={{
        tournamentId,
        title: detail.title,
        gameSlug,
        status: detail.status,
      }}
    >
      <main className="game-page game-page--fullscreen tour-play">
        <a className="game-page__back game-page__back--overlay" href={backHref}>
          ← {detail.title}
        </a>
        <div className="tour-play__banner" aria-hidden="true">
          <span>{detail.title}</span>
          <strong>{game?.name ?? gameSlug}</strong>
        </div>
        {gameSlug === 'stacker' && <StackerGame />}
        {gameSlug === 'patriot' && <PatriotGame />}
        {gameSlug === 'snake' && <SnakeGame />}
        {gameSlug === 'pop' && <WhackGame />}
        {gameSlug === 'simon' && <SimonGame />}
        {gameSlug === 'dead-center' && <DeadCenterGame />}
        {gameSlug === 'asteroids' && <AsteroidsGame />}
      </main>
    </TournamentPlayProvider>
  )
}
